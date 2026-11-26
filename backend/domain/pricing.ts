import crypto from 'crypto';

export type UserRole = 'super_admin' | 'store_manager' | 'customer';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'razorpay' | 'manual';

export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'return'
  | 'damage'
  | 'manual_adjustment'
  | 'cancellation';

export type ProductStatus = 'draft' | 'active' | 'out_of_stock' | 'discontinued';

export interface PricedCartItem {
  productId: string;
  name: string;
  sku: string;
  categoryId: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
  variantLabel?: string;
}

export interface CouponInput {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  eligibleCategoryIds?: string[];
  eligibleProductIds?: string[];
}

export interface CartCalculationResult {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  appliedCouponCode?: string;
  couponError?: string;
}

export const FREE_SHIPPING_THRESHOLD = 250;
export const STANDARD_SHIPPING_FEE = 18;
export const TAX_RATE = 0.08;

export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function getEffectivePrice(price: number, discountPrice?: number | null): number {
  if (typeof discountPrice === 'number' && discountPrice > 0 && discountPrice < price) {
    return roundCurrency(discountPrice);
  }
  return roundCurrency(price);
}

export function getDiscountPercentage(price: number, discountPrice?: number | null): number {
  if (!discountPrice || discountPrice <= 0 || discountPrice >= price || price <= 0) {
    return 0;
  }
  return Math.round(((price - discountPrice) / price) * 100);
}

export function validateCouponForCart(
  coupon: CouponInput | null | undefined,
  items: PricedCartItem[],
  now: Date = new Date()
): { valid: boolean; discount: number; error?: string } {
  if (!coupon) {
    return { valid: false, discount: 0, error: 'Coupon code not found.' };
  }
  if (!coupon.isActive) {
    return { valid: false, discount: 0, error: 'This coupon is currently disabled.' };
  }
  if (new Date(coupon.expiresAt).getTime() < now.getTime()) {
    return { valid: false, discount: 0, error: 'This coupon has expired.' };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discount: 0, error: 'This coupon has reached its usage limit.' };
  }

  const eligibleItems = items.filter((item) => {
    const hasCatFilter = coupon.eligibleCategoryIds && coupon.eligibleCategoryIds.length > 0;
    const hasProdFilter = coupon.eligibleProductIds && coupon.eligibleProductIds.length > 0;
    if (!hasCatFilter && !hasProdFilter) return true;
    const catMatch = hasCatFilter && coupon.eligibleCategoryIds!.includes(item.categoryId);
    const prodMatch = hasProdFilter && coupon.eligibleProductIds!.includes(item.productId);
    return Boolean(catMatch || prodMatch);
  });

  if (eligibleItems.length === 0) {
    return { valid: false, discount: 0, error: 'Coupon does not apply to any items in your cart.' };
  }

  const eligibleSubtotal = roundCurrency(
    eligibleItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const fullSubtotal = roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));

  if (fullSubtotal < coupon.minOrderValue) {
    return {
      valid: false,
      discount: 0,
      error: `Minimum order value of $${coupon.minOrderValue.toFixed(2)} required.`,
    };
  }

  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = roundCurrency((eligibleSubtotal * coupon.value) / 100);
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = roundCurrency(Math.min(coupon.value, eligibleSubtotal));
  }

  discount = Math.max(0, Math.min(discount, fullSubtotal));
  return { valid: true, discount };
}

export function calculateCartTotals(
  items: PricedCartItem[],
  coupon?: CouponInput | null,
  options?: {
    freeShippingThreshold?: number;
    shippingFee?: number;
    taxRate?: number;
    now?: Date;
  }
): CartCalculationResult {
  const freeThreshold = options?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD;
  const flatShipping = options?.shippingFee ?? STANDARD_SHIPPING_FEE;
  const taxRate = options?.taxRate ?? TAX_RATE;

  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));
  if (subtotal <= 0) {
    return { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 };
  }

  let discount = 0;
  let appliedCouponCode: string | undefined;
  let couponError: string | undefined;

  if (coupon) {
    const check = validateCouponForCart(coupon, items, options?.now);
    if (check.valid) {
      discount = check.discount;
      appliedCouponCode = coupon.code;
    } else {
      couponError = check.error;
    }
  }

  const discountedSubtotal = roundCurrency(Math.max(0, subtotal - discount));
  const shipping = discountedSubtotal >= freeThreshold ? 0 : flatShipping;
  const tax = roundCurrency(discountedSubtotal * taxRate);
  const total = roundCurrency(discountedSubtotal + shipping + tax);

  return {
    subtotal,
    discount,
    shipping,
    tax,
    total,
    appliedCouponCode,
    couponError,
  };
}

export function validateStockAdjustment(
  currentStock: number,
  delta: number
): { ok: boolean; nextStock: number; error?: string } {
  if (!Number.isInteger(delta)) {
    return { ok: false, nextStock: currentStock, error: 'Stock delta must be an integer.' };
  }
  const nextStock = currentStock + delta;
  if (nextStock < 0) {
    return {
      ok: false,
      nextStock: currentStock,
      error: `Insufficient stock: cannot reduce stock (${currentStock}) by ${Math.abs(delta)}.`,
    };
  }
  return { ok: true, nextStock };
}

export function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  secret: string
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !secret) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(razorpaySignature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !signature || !webhookSecret) {
    return false;
  }
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function detectImageMimeFromMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }
  return null;
}

export function isOrderCancellable(status: OrderStatus): boolean {
  return ['pending', 'confirmed', 'processing'].includes(status);
}

export function computeInventorySummary(
  items: Array<{ stockQuantity: number; minStockLevel: number; costPrice: number; price: number }>
) {
  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const item of items) {
    const qty = Math.max(0, item.stockQuantity);
    totalUnits += qty;
    totalCostValue += qty * item.costPrice;
    totalRetailValue += qty * item.price;
    if (qty === 0) {
      outOfStockCount += 1;
    } else if (qty <= item.minStockLevel) {
      lowStockCount += 1;
    }
  }

  return {
    totalUnits,
    totalCostValue: roundCurrency(totalCostValue),
    totalRetailValue: roundCurrency(totalRetailValue),
    lowStockCount,
    outOfStockCount,
  };
}

export type Permission =
  | 'admin:dashboard'
  | 'products:write'
  | 'categories:write'
  | 'inventory:write'
  | 'orders:manage'
  | 'suppliers:manage'
  | 'purchases:manage'
  | 'coupons:manage'
  | 'payments:manage'
  | 'customers:manage'
  | 'managers:manage'
  | 'settings:manage'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'admin:dashboard',
    'products:write',
    'categories:write',
    'inventory:write',
    'orders:manage',
    'suppliers:manage',
    'purchases:manage',
    'coupons:manage',
    'payments:manage',
    'customers:manage',
    'managers:manage',
    'settings:manage',
    'audit:read',
  ],
  store_manager: [
    'admin:dashboard',
    'products:write',
    'categories:write',
    'inventory:write',
    'orders:manage',
    'suppliers:manage',
    'purchases:manage',
    'coupons:manage',
    'customers:manage',
  ],
  customer: [],
};

export function hasRolePermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
