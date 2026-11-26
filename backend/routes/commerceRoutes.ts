import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.ts';
import type { DatabaseState } from '../db/seedData.ts';
import { db } from '../db/store.ts';
import {
  calculateCartTotals,
  getEffectivePrice,
  isOrderCancellable,
  roundCurrency,
  validateCouponForCart,
  validateStockAdjustment,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  type PricedCartItem,
} from '../domain/pricing.ts';
import { authenticate, recordAuditLog } from '../middleware/auth.ts';
import { emitRealtimeEvent } from '../realtime/socket.ts';
import { enrichProduct } from './catalogRoutes.ts';

export const commerceRouter = Router();

function buildCartResponse(state: DatabaseState, userId: string) {
  const cart = state.carts.find((c) => c.userId === userId) || {
    _id: '',
    userId,
    items: [],
    couponCode: undefined,
    updatedAt: new Date().toISOString(),
  };

  const pricedItems: Array<
    PricedCartItem & {
      image: string;
      slug: string;
      stockQuantity: number;
      brandName: string;
    }
  > = [];

  for (const item of cart.items) {
    const product = state.products.find((p) => p._id === item.productId && p.status === 'active');
    if (!product) continue;
    const inv = state.inventories.find((i) => i.productId === product._id);
    const stockQuantity = inv?.stockQuantity ?? 0;
    const brand = state.brands.find((b) => b._id === product.brandId);
    const unitPrice = getEffectivePrice(product.price, product.discountPrice);
    const safeQty = Math.min(item.quantity, Math.max(1, stockQuantity));
    pricedItems.push({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      categoryId: product.categoryId,
      brandName: brand?.name || 'Veltrix',
      image: product.images[0] || '',
      unitPrice,
      originalPrice: product.price,
      quantity: safeQty,
      lineTotal: roundCurrency(unitPrice * safeQty),
      stockQuantity,
      variantLabel: item.variantLabel,
    });
  }

  const coupon = cart.couponCode
    ? state.coupons.find((c) => c.code === cart.couponCode?.toUpperCase())
    : null;

  const totals = calculateCartTotals(pricedItems, coupon, {
    freeShippingThreshold: state.settings.freeShippingThreshold,
    shippingFee: state.settings.standardShippingFee,
    taxRate: state.settings.taxRate,
  });

  return {
    items: pricedItems,
    itemCount: pricedItems.reduce((sum, i) => sum + i.quantity, 0),
    couponCode: totals.appliedCouponCode || null,
    couponError: totals.couponError || null,
    ...totals,
  };
}

// ---------- CART ----------

commerceRouter.get('/cart', authenticate, (req, res) => {
  res.json(buildCartResponse(db.getState(), req.user!.id));
});

commerceRouter.post('/cart/items', authenticate, async (req, res) => {
  const parsed = z
    .object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(50).default(1),
      variantLabel: z.string().max(80).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid cart item payload.' });
    return;
  }

  const outcome = await db.mutate((state) => {
    const product = state.products.find((p) => p._id === parsed.data.productId && p.status === 'active');
    if (!product) {
      return { ok: false as const, status: 404, error: 'Product is unavailable or inactive.' };
    }
    const inv = state.inventories.find((i) => i.productId === product._id);
    const available = inv?.stockQuantity ?? 0;
    if (available <= 0) {
      return { ok: false as const, status: 409, error: 'This product is currently out of stock.' };
    }

    let cart = state.carts.find((c) => c.userId === req.user!.id);
    if (!cart) {
      cart = { _id: db.newId('cart'), userId: req.user!.id, items: [], updatedAt: new Date().toISOString() };
      state.carts.push(cart);
    }

    const existing = cart.items.find(
      (i) => i.productId === product._id && (i.variantLabel || '') === (parsed.data.variantLabel || '')
    );
    const desiredQty = (existing?.quantity || 0) + parsed.data.quantity;
    if (desiredQty > available) {
      return {
        ok: false as const,
        status: 409,
        error: `Only ${available} unit(s) available in stock.`,
      };
    }

    if (existing) {
      existing.quantity = desiredQty;
    } else {
      cart.items.push({
        productId: product._id,
        quantity: parsed.data.quantity,
        variantLabel: parsed.data.variantLabel,
      });
    }
    cart.updatedAt = new Date().toISOString();
    return { ok: true as const, cartResponse: buildCartResponse(state, req.user!.id) };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  res.json(outcome.cartResponse);
});

commerceRouter.patch('/cart/items/:productId', authenticate, async (req, res) => {
  const parsed = z.object({ quantity: z.number().int().min(0).max(50) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid quantity is required.' });
    return;
  }

  const outcome = await db.mutate((state) => {
    const cart = state.carts.find((c) => c.userId === req.user!.id);
    if (!cart) return { ok: true as const, cartResponse: buildCartResponse(state, req.user!.id) };

    const idx = cart.items.findIndex((i) => i.productId === req.params.productId);
    if (idx === -1) {
      return { ok: false as const, status: 404, error: 'Item not found in cart.' };
    }

    if (parsed.data.quantity === 0) {
      cart.items.splice(idx, 1);
    } else {
      const inv = state.inventories.find((i) => i.productId === req.params.productId);
      const available = inv?.stockQuantity ?? 0;
      if (parsed.data.quantity > available) {
        return { ok: false as const, status: 409, error: `Only ${available} unit(s) in stock.` };
      }
      cart.items[idx].quantity = parsed.data.quantity;
    }
    cart.updatedAt = new Date().toISOString();
    return { ok: true as const, cartResponse: buildCartResponse(state, req.user!.id) };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  res.json(outcome.cartResponse);
});

commerceRouter.delete('/cart/items/:productId', authenticate, async (req, res) => {
  const cartResponse = await db.mutate((state) => {
    const cart = state.carts.find((c) => c.userId === req.user!.id);
    if (cart) {
      cart.items = cart.items.filter((i) => i.productId !== req.params.productId);
      cart.updatedAt = new Date().toISOString();
    }
    return buildCartResponse(state, req.user!.id);
  });
  res.json(cartResponse);
});

commerceRouter.post('/cart/coupon', authenticate, async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const outcome = await db.mutate((state) => {
    let cart = state.carts.find((c) => c.userId === req.user!.id);
    if (!cart) {
      cart = { _id: db.newId('cart'), userId: req.user!.id, items: [], updatedAt: new Date().toISOString() };
      state.carts.push(cart);
    }

    if (!code) {
      cart.couponCode = undefined;
      return { ok: true as const, cartResponse: buildCartResponse(state, req.user!.id) };
    }

    const coupon = state.coupons.find((c) => c.code === code);
    const previewCart = buildCartResponse(state, req.user!.id);
    const check = validateCouponForCart(coupon, previewCart.items);
    if (!check.valid) {
      return { ok: false as const, status: 400, error: check.error || 'Invalid coupon.' };
    }
    if (coupon && coupon.usedByUsers.includes(req.user!.id)) {
      return { ok: false as const, status: 400, error: 'You have already redeemed this coupon.' };
    }

    cart.couponCode = code;
    cart.updatedAt = new Date().toISOString();
    return { ok: true as const, cartResponse: buildCartResponse(state, req.user!.id) };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  res.json(outcome.cartResponse);
});

// ---------- WISHLIST ----------

commerceRouter.get('/wishlist', authenticate, (req, res) => {
  const state = db.getState();
  const wl = state.wishlists.find((w) => w.userId === req.user!.id);
  const ids = wl?.productIds || [];
  const products = state.products
    .filter((p) => ids.includes(p._id))
    .map((p) => enrichProduct(state, p));
  res.json({ productIds: ids, products, notifyOnRestock: wl?.notifyOnRestock || [] });
});

commerceRouter.post('/wishlist/toggle', authenticate, async (req, res) => {
  const productId = String(req.body?.productId || '');
  if (!productId) {
    res.status(400).json({ error: 'productId required.' });
    return;
  }
  const result = await db.mutate((state) => {
    let wl = state.wishlists.find((w) => w.userId === req.user!.id);
    if (!wl) {
      wl = {
        _id: db.newId('wish'),
        userId: req.user!.id,
        productIds: [],
        notifyOnRestock: [],
        updatedAt: new Date().toISOString(),
      };
      state.wishlists.push(wl);
    }
    const idx = wl.productIds.indexOf(productId);
    let saved = false;
    if (idx === -1) {
      wl.productIds.push(productId);
      saved = true;
    } else {
      wl.productIds.splice(idx, 1);
      saved = false;
    }
    wl.updatedAt = new Date().toISOString();
    return { saved, productIds: wl.productIds };
  });
  res.json(result);
});

commerceRouter.post('/wishlist/move-to-cart', authenticate, async (req, res) => {
  const productId = String(req.body?.productId || '');
  const outcome = await db.mutate((state) => {
    const product = state.products.find((p) => p._id === productId && p.status === 'active');
    const inv = state.inventories.find((i) => i.productId === productId);
    if (!product || !inv || inv.stockQuantity <= 0) {
      return { ok: false as const, status: 409, error: 'Product is currently out of stock.' };
    }
    let cart = state.carts.find((c) => c.userId === req.user!.id);
    if (!cart) {
      cart = { _id: db.newId('cart'), userId: req.user!.id, items: [], updatedAt: new Date().toISOString() };
      state.carts.push(cart);
    }
    const existing = cart.items.find((i) => i.productId === productId);
    if (existing) {
      if (existing.quantity + 1 > inv.stockQuantity) {
        return { ok: false as const, status: 409, error: 'Stock limit reached in cart.' };
      }
      existing.quantity += 1;
    } else {
      cart.items.push({ productId, quantity: 1 });
    }
    const wl = state.wishlists.find((w) => w.userId === req.user!.id);
    if (wl) {
      wl.productIds = wl.productIds.filter((id) => id !== productId);
    }
    return { ok: true as const, cart: buildCartResponse(state, req.user!.id) };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  res.json(outcome.cart);
});

// ---------- COUPON VALIDATION ----------

commerceRouter.post('/coupons/validate', authenticate, (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const state = db.getState();
  const coupon = state.coupons.find((c) => c.code === code);
  const cartResp = buildCartResponse(state, req.user!.id);
  const check = validateCouponForCart(coupon, cartResp.items);
  if (!check.valid) {
    res.status(400).json({ valid: false, error: check.error });
    return;
  }
  if (coupon && coupon.usedByUsers.includes(req.user!.id)) {
    res.status(400).json({ valid: false, error: 'You have already redeemed this coupon.' });
    return;
  }
  res.json({ valid: true, code: coupon!.code, discount: check.discount });
});

// ---------- ORDERS (ATOMIC CHECKOUT + CONCURRENCY LOCK) ----------

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, 'Full name is required').max(100),
  phone: z.string().trim().min(6, 'Phone number is required').max(30),
  email: z.string().trim().email('Valid email required'),
  address: z.string().trim().min(5, 'Delivery address is required').max(250),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State / region is required').max(80),
  postalCode: z.string().trim().min(3, 'Postal code is required').max(20),
  country: z.string().trim().min(2).max(80).default('United States'),
  paymentMethod: z.enum(['cod', 'razorpay']),
  couponCode: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional().default(''),
  idempotencyKey: z.string().trim().max(120).optional(),
  // Optional direct items override for Buy Now / API testing (server ALWAYS ignores client prices!)
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        variantLabel: z.string().max(80).optional(),
      })
    )
    .optional(),
});

export async function createOrderAtomic(params: {
  userId: string;
  userEmail: string;
  userName: string;
  payload: z.infer<typeof checkoutSchema>;
  ipAddress?: string;
}) {
  return db.withStockLock((state) => {
    // 1. Idempotency check (prevents duplicate checkout submissions)
    if (params.payload.idempotencyKey) {
      const existingOrder = state.orders.find(
        (o) => o.idempotencyKey === params.payload.idempotencyKey && o.userId === params.userId
      );
      if (existingOrder) {
        const items = state.orderItems.filter((oi) => oi.orderId === existingOrder._id);
        return { ok: true as const, duplicate: true, order: { ...existingOrder, items }, lowStockAlerts: [] };
      }
    }

    // 2. Resolve items from cart or explicit items list
    const userCart = state.carts.find((c) => c.userId === params.userId);
    const requestedItems =
      params.payload.items && params.payload.items.length > 0
        ? params.payload.items
        : userCart?.items || [];

    if (requestedItems.length === 0) {
      return { ok: false as const, status: 400, error: 'Your cart is empty.' };
    }

    // 3. Authoritative server-side price & stock validation
    const pricedItems: Array<PricedCartItem & { image: string }> = [];
    for (const reqItem of requestedItems) {
      const product = state.products.find((p) => p._id === reqItem.productId);
      if (!product || product.status === 'draft' || product.status === 'discontinued') {
        return { ok: false as const, status: 400, error: 'One or more products are no longer available.' };
      }
      const inv = state.inventories.find((i) => i.productId === product._id);
      if (product.status === 'out_of_stock' || !inv || inv.stockQuantity < reqItem.quantity) {
        return {
          ok: false as const,
          status: 409,
          error: `Insufficient stock for "${product.name}". Available: ${inv?.stockQuantity ?? 0}.`,
        };
      }
      const unitPrice = getEffectivePrice(product.price, product.discountPrice);
      pricedItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        categoryId: product.categoryId,
        image: product.images[0] || '',
        unitPrice,
        originalPrice: product.price,
        quantity: reqItem.quantity,
        lineTotal: roundCurrency(unitPrice * reqItem.quantity),
        variantLabel: reqItem.variantLabel,
      });
    }

    // 4. Coupon validation on backend
    const effectiveCouponCode = (params.payload.couponCode || userCart?.couponCode || '').trim().toUpperCase();
    const coupon = effectiveCouponCode
      ? state.coupons.find((c) => c.code === effectiveCouponCode)
      : null;

    if (effectiveCouponCode) {
      const check = validateCouponForCart(coupon, pricedItems);
      if (!check.valid) {
        return { ok: false as const, status: 400, error: check.error || 'Invalid coupon.' };
      }
      if (coupon && coupon.usedByUsers.includes(params.userId)) {
        return { ok: false as const, status: 400, error: 'Coupon already used on this account.' };
      }
    }

    // 5. Reject Razorpay checkout cleanly if keys are not configured
    if (params.payload.paymentMethod === 'razorpay' && !env.isRazorpayConfigured()) {
      return {
        ok: false as const,
        status: 503,
        error: 'Online Razorpay payments are not configured yet. Please select Cash on Delivery.',
      };
    }

    const totals = calculateCartTotals(pricedItems, coupon, {
      freeShippingThreshold: state.settings.freeShippingThreshold,
      shippingFee: state.settings.standardShippingFee,
      taxRate: state.settings.taxRate,
    });

    const now = new Date().toISOString();
    const orderId = db.newId('ord');
    const orderNumber = `VTX-${new Date().getFullYear()}-${String(1001 + state.orders.length).padStart(4, '0')}`;

    // 6. Atomically deduct stock & record stock movements
    const lowStockAlerts: Array<{ productName: string; remaining: number; threshold: number }> = [];
    for (const item of pricedItems) {
      const inv = state.inventories.find((i) => i.productId === item.productId)!;
      const check = validateStockAdjustment(inv.stockQuantity, -item.quantity);
      if (!check.ok) {
        return { ok: false as const, status: 409, error: check.error || 'Insufficient stock.' };
      }
      const prev = inv.stockQuantity;
      inv.stockQuantity = check.nextStock;
      inv.updatedAt = now;

      const prod = state.products.find((p) => p._id === item.productId);
      if (prod && inv.stockQuantity === 0) {
        prod.status = 'out_of_stock';
      }

      state.stockMovements.unshift({
        _id: db.newId('sm'),
        productId: item.productId,
        type: 'sale',
        quantityDelta: -item.quantity,
        previousStock: prev,
        newStock: inv.stockQuantity,
        referenceType: 'ORDER',
        referenceId: orderNumber,
        reason: `Order ${orderNumber} placed`,
        performedBy: params.userId,
        performedByName: params.userName,
        createdAt: now,
      });

      if (inv.stockQuantity <= inv.minStockLevel) {
        lowStockAlerts.push({
          productName: item.name,
          remaining: inv.stockQuantity,
          threshold: inv.minStockLevel,
        });
        state.notifications.unshift({
          _id: db.newId('notif'),
          recipientRole: 'super_admin',
          type: 'low_stock',
          title: `Low stock: ${item.name}`,
          message: `Only ${inv.stockQuantity} unit(s) left (min threshold: ${inv.minStockLevel}).`,
          isRead: false,
          link: '/admin/inventory',
          createdAt: now,
        });
      }
    }

    // 7. Mark coupon usage
    if (coupon && totals.appliedCouponCode) {
      coupon.usedCount += 1;
      coupon.usedByUsers.push(params.userId);
    }

    // 8. Persist Order, OrderItems, and Payment
    const orderDoc = {
      _id: orderId,
      orderNumber,
      userId: params.userId,
      status: params.payload.paymentMethod === 'cod' ? ('confirmed' as const) : ('pending' as const),
      shippingAddress: {
        customerName: params.payload.customerName,
        phone: params.payload.phone,
        email: params.payload.email,
        address: params.payload.address,
        city: params.payload.city,
        state: params.payload.state,
        postalCode: params.payload.postalCode,
        country: params.payload.country,
      },
      subtotal: totals.subtotal,
      discount: totals.discount,
      shippingFee: totals.shipping,
      tax: totals.tax,
      totalAmount: totals.total,
      couponCode: totals.appliedCouponCode,
      paymentMethod: params.payload.paymentMethod,
      paymentStatus: 'pending' as const,
      notes: params.payload.notes || '',
      idempotencyKey: params.payload.idempotencyKey,
      timeline: [
        { status: 'pending', note: 'Order placed', timestamp: now },
        ...(params.payload.paymentMethod === 'cod'
          ? [{ status: 'confirmed', note: 'Cash on Delivery confirmed & inventory allocated', timestamp: now }]
          : []),
      ],
      createdAt: now,
      updatedAt: now,
    };

    state.orders.unshift(orderDoc);
    const createdItems = pricedItems.map((item) => {
      const oi = {
        _id: db.newId('oi'),
        orderId,
        productId: item.productId,
        productName: item.name,
        sku: item.sku,
        image: item.image,
        variantLabel: item.variantLabel,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      };
      state.orderItems.push(oi);
      return oi;
    });

    const paymentDoc = {
      _id: db.newId('pay'),
      orderId,
      orderNumber,
      userId: params.userId,
      method: params.payload.paymentMethod,
      status: 'pending' as const,
      amount: totals.total,
      currency: state.settings.currency,
      createdAt: now,
    };
    state.payments.unshift(paymentDoc);

    // Update customer profile metrics
    let profile = state.customerProfiles.find((p) => p.userId === params.userId);
    if (!profile) {
      profile = {
        _id: db.newId('cprof'),
        userId: params.userId,
        totalOrders: 0,
        totalSpent: 0,
        newsletterSubscribed: false,
        supportNotes: '',
        createdAt: now,
        updatedAt: now,
      };
      state.customerProfiles.push(profile);
    }
    profile.totalOrders += 1;
    profile.totalSpent = roundCurrency(profile.totalSpent + totals.total);
    profile.updatedAt = now;

    // Clear customer cart if checkout came from cart
    if (userCart && (!params.payload.items || params.payload.items.length === 0)) {
      userCart.items = [];
      userCart.couponCode = undefined;
      userCart.updatedAt = now;
    }

    state.notifications.unshift({
      _id: db.newId('notif'),
      recipientRole: 'super_admin',
      type: 'new_order',
      title: `New order ${orderNumber}`,
      message: `${params.payload.customerName} placed an order for $${totals.total.toFixed(2)}.`,
      isRead: false,
      link: '/admin/orders',
      createdAt: now,
    });

    return {
      ok: true as const,
      duplicate: false,
      order: { ...orderDoc, items: createdItems, payment: paymentDoc },
      lowStockAlerts,
    };
  });
}

commerceRouter.post('/orders', authenticate, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid checkout fields.' });
    return;
  }

  const result = await createOrderAtomic({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userName: req.user!.name,
    payload: parsed.data,
    ipAddress: req.ip,
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  if (!result.duplicate) {
    emitRealtimeEvent({ roles: ['super_admin', 'store_manager'] }, 'order:created', {
      orderNumber: result.order.orderNumber,
      totalAmount: result.order.totalAmount,
      customerName: result.order.shippingAddress.customerName,
    });
    for (const alert of result.lowStockAlerts) {
      emitRealtimeEvent({ roles: ['super_admin', 'store_manager'] }, 'inventory:low-stock', alert);
    }
  }

  res.status(result.duplicate ? 200 : 201).json({ order: result.order });
});

commerceRouter.get('/orders', authenticate, (req, res) => {
  const state = db.getState();
  const orders = state.orders
    .filter((o) => o.userId === req.user!.id)
    .map((o) => ({
      ...o,
      items: state.orderItems.filter((oi) => oi.orderId === o._id),
      payment: state.payments.find((p) => p.orderId === o._id) || null,
    }));
  res.json({ orders });
});

commerceRouter.get('/orders/:id', authenticate, (req, res) => {
  const state = db.getState();
  const order = state.orders.find(
    (o) => o._id === req.params.id || o.orderNumber === req.params.id
  );
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  const isStaff = req.user!.role === 'super_admin' || req.user!.role === 'store_manager';
  if (!isStaff && order.userId !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden: you cannot access another customer’s order.' });
    return;
  }

  res.json({
    order: {
      ...order,
      items: state.orderItems.filter((oi) => oi.orderId === order._id),
      payment: state.payments.find((p) => p.orderId === order._id) || null,
    },
  });
});

commerceRouter.post('/orders/:id/cancel', authenticate, async (req, res) => {
  const reason = String(req.body?.reason || 'Cancelled by customer').slice(0, 200);
  const outcome = await db.withStockLock((state) => {
    const order = state.orders.find((o) => o._id === req.params.id);
    if (!order) {
      return { ok: false as const, status: 404, error: 'Order not found.' };
    }
    const isStaff = req.user!.role === 'super_admin' || req.user!.role === 'store_manager';
    if (!isStaff && order.userId !== req.user!.id) {
      return { ok: false as const, status: 403, error: 'Forbidden: cannot cancel this order.' };
    }
    if (!isOrderCancellable(order.status)) {
      return {
        ok: false as const,
        status: 400,
        error: `Orders in "${order.status}" status cannot be cancelled.`,
      };
    }

    const now = new Date().toISOString();
    order.status = 'cancelled';
    order.updatedAt = now;
    order.timeline.push({ status: 'cancelled', note: reason, timestamp: now });

    // Restore stock atomically for every item in cancelled order
    const items = state.orderItems.filter((oi) => oi.orderId === order._id);
    for (const item of items) {
      const inv = state.inventories.find((i) => i.productId === item.productId);
      if (inv) {
        const prev = inv.stockQuantity;
        inv.stockQuantity = prev + item.quantity;
        inv.updatedAt = now;

        const prod = state.products.find((p) => p._id === item.productId);
        if (prod && prod.status === 'out_of_stock' && inv.stockQuantity > 0) {
          prod.status = 'active';
        }

        state.stockMovements.unshift({
          _id: db.newId('sm'),
          productId: item.productId,
          type: 'cancellation',
          quantityDelta: item.quantity,
          previousStock: prev,
          newStock: inv.stockQuantity,
          referenceType: 'ORDER',
          referenceId: order.orderNumber,
          reason: `Stock restored: ${reason}`,
          performedBy: req.user!.id,
          performedByName: req.user!.name,
          createdAt: now,
        });
      }
    }

    const payment = state.payments.find((p) => p.orderId === order._id);
    if (payment && payment.status === 'paid') {
      payment.status = 'refunded';
      order.paymentStatus = 'refunded';
    } else if (payment) {
      payment.status = 'failed';
      order.paymentStatus = 'failed';
    }

    return { ok: true as const, order: { ...order, items } };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'ORDER_CANCELLED',
    entityType: 'Order',
    entityId: outcome.order._id,
    details: { orderNumber: outcome.order.orderNumber, reason },
    ipAddress: req.ip,
  });

  emitRealtimeEvent(
    { userId: outcome.order.userId, roles: ['super_admin', 'store_manager'] },
    'order:updated',
    { orderNumber: outcome.order.orderNumber, status: 'cancelled' }
  );

  res.json({ order: outcome.order });
});

// ---------- RAZORPAY TEST PAYMENT INTEGRATION ----------

commerceRouter.post('/payments/razorpay/create-order', authenticate, async (req, res) => {
  if (!env.isRazorpayConfigured()) {
    res.status(503).json({
      error: 'Razorpay credentials are not configured on the server. Use Cash on Delivery instead.',
    });
    return;
  }

  const orderId = String(req.body?.orderId || '');
  const state = db.getState();
  const order = state.orders.find((o) => o._id === orderId && o.userId === req.user!.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  const providerOrderId = `order_rzp_${crypto.randomBytes(8).toString('hex')}`;
  await db.mutate((s) => {
    const pay = s.payments.find((p) => p.orderId === order._id);
    if (pay) {
      pay.providerOrderId = providerOrderId;
      pay.status = 'processing';
    }
  });

  res.json({
    keyId: env.RAZORPAY_KEY_ID,
    providerOrderId,
    amountInSubunits: Math.round(order.totalAmount * 100),
    currency: state.settings.currency,
  });
});

commerceRouter.post('/payments/razorpay/verify', authenticate, async (req, res) => {
  const parsed = z
    .object({
      orderId: z.string().min(1),
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Incomplete payment verification payload.' });
    return;
  }
  if (!env.isRazorpayConfigured()) {
    res.status(503).json({ error: 'Razorpay is not configured on this server.' });
    return;
  }

  const valid = verifyRazorpayPaymentSignature(
    parsed.data.razorpay_order_id,
    parsed.data.razorpay_payment_id,
    parsed.data.razorpay_signature,
    env.RAZORPAY_KEY_SECRET
  );

  if (!valid) {
    res.status(400).json({ error: 'Invalid payment signature. Verification rejected.' });
    return;
  }

  const result = await db.mutate((state) => {
    const order = state.orders.find((o) => o._id === parsed.data.orderId && o.userId === req.user!.id);
    if (!order) return { ok: false as const, status: 404, error: 'Order not found.' };

    const payment = state.payments.find((p) => p.orderId === order._id);
    if (!payment) return { ok: false as const, status: 404, error: 'Payment record missing.' };

    // Prevent cross-order payment replay: verify providerOrderId matches this order's initiated payment
    if (!payment.providerOrderId || payment.providerOrderId !== parsed.data.razorpay_order_id) {
      return { ok: false as const, status: 400, error: 'Payment order mismatch. Verification rejected.' };
    }

    // Idempotency guard: prevent duplicate payment processing
    if (payment.status === 'paid' && payment.providerPaymentId === parsed.data.razorpay_payment_id) {
      return { ok: true as const, alreadyVerified: true, order };
    }

    const now = new Date().toISOString();
    payment.status = 'paid';
    payment.providerOrderId = parsed.data.razorpay_order_id;
    payment.providerPaymentId = parsed.data.razorpay_payment_id;
    payment.verifiedAt = now;

    order.paymentStatus = 'paid';
    if (order.status === 'pending') {
      order.status = 'confirmed';
      order.timeline.push({ status: 'confirmed', note: 'Payment signature verified via Razorpay', timestamp: now });
    }
    order.updatedAt = now;
    return { ok: true as const, alreadyVerified: false, order };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({ ok: true, alreadyVerified: result.alreadyVerified, order: result.order });
});

commerceRouter.post('/payments/razorpay/webhook', async (req, res) => {
  const signature = String(req.headers['x-razorpay-signature'] || '');
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Webhook secret not configured.' });
    return;
  }
  const rawBody =
    (req as typeof req & { rawBody?: string }).rawBody ?? JSON.stringify(req.body || {});
  if (!verifyRazorpayWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET)) {
    res.status(401).json({ error: 'Invalid webhook signature.' });
    return;
  }

  const event = req.body?.event;
  const providerOrderId = req.body?.payload?.payment?.entity?.order_id;
  const providerPaymentId = req.body?.payload?.payment?.entity?.id;

  if (event === 'payment.captured' && providerOrderId && providerPaymentId) {
    await db.mutate((state) => {
      const payment = state.payments.find((p) => p.providerOrderId === providerOrderId);
      if (!payment || payment.status === 'paid') return; // Idempotent
      const now = new Date().toISOString();
      payment.status = 'paid';
      payment.providerPaymentId = providerPaymentId;
      payment.verifiedAt = now;
      const order = state.orders.find((o) => o._id === payment.orderId);
      if (order) {
        order.paymentStatus = 'paid';
        if (order.status === 'pending') {
          order.status = 'confirmed';
          order.timeline.push({ status: 'confirmed', note: 'Payment captured via webhook', timestamp: now });
        }
      }
    });
  }

  res.json({ received: true });
});
