export type UserRole = 'super_admin' | 'store_manager' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  isActive: boolean;
  productCount?: number;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}

export interface ProductVariant {
  _id: string;
  productId: string;
  skuSuffix: string;
  color?: string;
  size?: string;
  priceDelta: number;
  stockQuantity: number;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  price: number;
  discountPrice?: number;
  effectivePrice: number;
  discountPercent: number;
  costPrice: number;
  images: string[];
  specifications: Record<string, string>;
  weightKg: number;
  dimensionsCm: { length: number; width: number; height: number };
  status: 'draft' | 'active' | 'out_of_stock' | 'discontinued';
  availability: 'in_stock' | 'low_stock' | 'out_of_stock' | 'draft' | 'discontinued';
  stockQuantity: number;
  minStockLevel: number;
  warehouseLocation: string;
  featured: boolean;
  trending: boolean;
  bestSeller: boolean;
  newArrival: boolean;
  averageRating: number;
  reviewCount: number;
  variants: ProductVariant[];
  createdAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  categoryId: string;
  brandName: string;
  image: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
  stockQuantity: number;
  variantLabel?: string;
}

export interface CartState {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  couponError?: string | null;
}

export interface OrderItem {
  _id: string;
  productId: string;
  productName: string;
  sku: string;
  image: string;
  variantLabel?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId: string;
  status:
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
  shippingAddress: {
    customerName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  totalAmount: number;
  couponCode?: string;
  paymentMethod: 'cod' | 'razorpay' | 'manual';
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
  notes: string;
  timeline: Array<{ status: string; note: string; timestamp: string }>;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  _id: string;
  productId: string;
  productName?: string;
  productSlug?: string;
  userId: string;
  userName: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  isApproved: boolean;
  createdAt: string;
}

export interface Coupon {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
}

export interface Supplier {
  _id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: 'draft' | 'sent' | 'approved' | 'partially_received' | 'received' | 'cancelled';
  totalCost: number;
  expectedDeliveryDate: string;
  receivedAt?: string;
  notes: string;
  items: Array<{
    _id: string;
    productId: string;
    productName: string;
    sku: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
  }>;
  createdAt: string;
}

export interface Address {
  _id: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface NotificationItem {
  _id: string;
  type: 'low_stock' | 'order_status' | 'new_order' | 'restock' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}
