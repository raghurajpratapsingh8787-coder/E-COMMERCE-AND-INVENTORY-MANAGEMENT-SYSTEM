import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isAllowedOrigin, isSafeImageUrl } from '../config/env.ts';
import { db } from '../db/store.ts';
import {
  calculateCartTotals,
  computeInventorySummary,
  detectImageMimeFromMagicBytes,
  getDiscountPercentage,
  hasRolePermission,
  validateCouponForCart,
  validateStockAdjustment,
  verifyRazorpayPaymentSignature,
} from '../domain/pricing.ts';
import { createOrderAtomic } from '../routes/commerceRoutes.ts';

test('server-side pricing, percentage coupon, free shipping, and tax math', () => {
  const items = [
    {
      productId: 'p1',
      name: 'Headphones',
      sku: 'SKU-1',
      categoryId: 'cat_audio',
      unitPrice: 300,
      originalPrice: 350,
      quantity: 1,
      lineTotal: 300,
    },
  ];
  const coupon = {
    code: 'WELCOME10',
    type: 'percentage' as const,
    value: 10,
    minOrderValue: 150,
    maxDiscount: 100,
    usageLimit: 50,
    usedCount: 1,
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    isActive: true,
  };

  const totals = calculateCartTotals(items, coupon);
  assert.equal(totals.subtotal, 300);
  assert.equal(totals.discount, 30);
  assert.equal(totals.shipping, 0); // 270 >= 250 free threshold
  assert.equal(totals.tax, 21.6); // 270 * 0.08
  assert.equal(totals.total, 291.6);
  assert.equal(getDiscountPercentage(400, 300), 25);
});

test('expired coupon and minimum order threshold are rejected', () => {
  const items = [
    {
      productId: 'p1',
      name: 'Kettle',
      sku: 'SKU-2',
      categoryId: 'cat_living',
      unitPrice: 100,
      originalPrice: 100,
      quantity: 1,
      lineTotal: 100,
    },
  ];

  const expired = validateCouponForCart(
    {
      code: 'OLD',
      type: 'fixed',
      value: 20,
      minOrderValue: 50,
      usageLimit: 10,
      usedCount: 0,
      expiresAt: new Date(Date.now() - 10_000).toISOString(),
      isActive: true,
    },
    items
  );
  assert.equal(expired.valid, false);
  assert.match(expired.error || '', /expired/i);

  const belowMin = validateCouponForCart(
    {
      code: 'BIG',
      type: 'fixed',
      value: 20,
      minOrderValue: 200,
      usageLimit: 10,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      isActive: true,
    },
    items
  );
  assert.equal(belowMin.valid, false);
  assert.match(belowMin.error || '', /minimum/i);
});

test('negative inventory quantity is rejected', () => {
  const fail = validateStockAdjustment(2, -3);
  assert.equal(fail.ok, false);
  assert.equal(fail.nextStock, 2);

  const pass = validateStockAdjustment(5, -5);
  assert.equal(pass.ok, true);
  assert.equal(pass.nextStock, 0);
});

test('Razorpay HMAC-SHA256 payment signature verification', () => {
  const secret = 'test_webhook_secret_key';
  const orderId = 'order_rzp_123';
  const paymentId = 'pay_rzp_456';
  const sig = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, sig, secret), true);
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, 'tampered_sig', secret), false);
});

test('magic-byte image signature verification rejects forged extensions', () => {
  const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const jpgBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const fakeScript = Buffer.from('<script>alert(1)</script>');

  assert.equal(detectImageMimeFromMagicBytes(pngBuf), 'image/png');
  assert.equal(detectImageMimeFromMagicBytes(jpgBuf), 'image/jpeg');
  assert.equal(detectImageMimeFromMagicBytes(fakeScript), null);
});

test('RBAC permission matrix enforces least privilege', () => {
  assert.equal(hasRolePermission('super_admin', 'managers:manage'), true);
  assert.equal(hasRolePermission('store_manager', 'inventory:write'), true);
  assert.equal(hasRolePermission('store_manager', 'managers:manage'), false);
  assert.equal(hasRolePermission('customer', 'admin:dashboard'), false);
});

test('inventory summary computes accurate valuation and low/out stock counts', () => {
  const summary = computeInventorySummary([
    { stockQuantity: 10, minStockLevel: 5, costPrice: 100, price: 200 },
    { stockQuantity: 3, minStockLevel: 5, costPrice: 50, price: 120 },
    { stockQuantity: 0, minStockLevel: 4, costPrice: 80, price: 150 },
  ]);
  assert.equal(summary.totalUnits, 13);
  assert.equal(summary.totalCostValue, 1150);
  assert.equal(summary.lowStockCount, 1);
  assert.equal(summary.outOfStockCount, 1);
});

test('concurrent checkout for final item in stock prevents overselling and handles idempotency', async () => {
  const tmpFile = path.join(os.tmpdir(), `veltrix-test-${Date.now()}.json`);
  await db.init(tmpFile);

  // Set stock of prod_watch to exactly 1 unit
  await db.mutate((state) => {
    const inv = state.inventories.find((i) => i.productId === 'prod_watch');
    if (inv) inv.stockQuantity = 1;
  });

  const basePayload = {
    customerName: 'Buyer Test',
    phone: '+1 555 0100',
    email: 'buyer@example.com',
    address: '100 Market St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    country: 'United States',
    paymentMethod: 'cod' as const,
    notes: '',
    items: [{ productId: 'prod_watch', quantity: 1 }],
  };

  // Two customers attempt to buy the final watch concurrently
  const [r1, r2] = await Promise.all([
    createOrderAtomic({
      userId: 'user_customer_1',
      userEmail: 'elena.vance@example.com',
      userName: 'Elena Vance',
      payload: { ...basePayload, idempotencyKey: 'idem_race_1' },
    }),
    createOrderAtomic({
      userId: 'user_customer_2',
      userEmail: 'marcus.chen@example.com',
      userName: 'Marcus Chen',
      payload: { ...basePayload, idempotencyKey: 'idem_race_2' },
    }),
  ]);

  const successes = [r1, r2].filter((r) => r.ok);
  const failures = [r1, r2].filter((r) => !r.ok);
  assert.equal(successes.length, 1, 'Exactly one concurrent buyer must succeed');
  assert.equal(failures.length, 1, 'Second concurrent buyer must be rejected');
  assert.equal((failures[0] as { status: number }).status, 409);

  // Stock must be 0, never negative
  const finalInv = db.getState().inventories.find((i) => i.productId === 'prod_watch');
  assert.equal(finalInv?.stockQuantity, 0);

  // Duplicate checkout with same idempotencyKey returns existing order without failing or double-deducting
  const dup = await createOrderAtomic({
    userId: 'user_customer_1',
    userEmail: 'elena.vance@example.com',
    userName: 'Elena Vance',
    payload: { ...basePayload, idempotencyKey: 'idem_race_1' },
  });
  assert.equal(dup.ok, true);
  if (dup.ok) {
    assert.equal(dup.duplicate, true);
  }

  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

test('origin allowlist and image URL validators block bypass payloads', () => {
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedOrigin('https://my-app.run.app', 'my-app.run.app'), true);
  assert.equal(isAllowedOrigin('https://evil-localhost.attacker.com', 'my-app.run.app'), false);
  assert.equal(isAllowedOrigin('https://other-tenant.run.app', 'my-app.run.app'), false);
  assert.equal(isAllowedOrigin('javascript:alert(1)'), false);

  assert.equal(isSafeImageUrl('/uploads/prod_123.png'), true);
  assert.equal(isSafeImageUrl('https://res.cloudinary.com/demo/image.webp'), true);
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImageUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeImageUrl('//evil.example/img.png'), false);
  assert.equal(isSafeImageUrl('/uploads/../../etc/passwd'), false);
});

