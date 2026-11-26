import mongoose, { Schema, type Model } from 'mongoose';

/**
 * Complete Mongoose ODM Architecture (21 Models)
 * Used directly when MONGODB_URI is configured for MongoDB Atlas.
 */

// 1. User
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'store_manager', 'customer'], default: 'customer', index: true },
    phone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    passwordResetToken: { type: String },
    passwordResetExpiresAt: { type: Date },
    refreshTokens: [{ tokenHash: String, expiresAt: Date }],
  },
  { timestamps: true }
);

// 2. CustomerProfile
const CustomerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    preferredCurrency: { type: String, default: 'USD' },
    newsletterSubscribed: { type: Boolean, default: false },
    supportNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

// 3. Category
const CategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 4. Brand
const BrandSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 5. Product
const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, index: true },
    description: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    specifications: { type: Map, of: String, default: {} },
    weightKg: { type: Number, default: 0.5 },
    dimensionsCm: { length: Number, width: Number, height: Number },
    status: { type: String, enum: ['draft', 'active', 'out_of_stock', 'discontinued'], default: 'active', index: true },
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
ProductSchema.index({ name: 'text', description: 'text', sku: 'text' });
ProductSchema.index({ category: 1, status: 1, price: 1 });

// 6. ProductVariant
const ProductVariantSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    skuSuffix: { type: String, required: true },
    color: { type: String },
    size: { type: String },
    priceDelta: { type: Number, default: 0 },
    stockQuantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// 7. Inventory
const InventorySchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true, index: true },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    minStockLevel: { type: Number, required: true, min: 0, default: 5 },
    warehouseLocation: { type: String, default: 'Main Hub A1' },
    lastRestockedAt: { type: Date },
  },
  { timestamps: true }
);

// 8. StockMovement
const StockMovementSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'damage', 'manual_adjustment', 'cancellation'],
      required: true,
      index: true,
    },
    quantityDelta: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true, min: 0 },
    referenceType: { type: String },
    referenceId: { type: String },
    reason: { type: String, default: '' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
StockMovementSchema.index({ product: 1, createdAt: -1 });

// 9. Cart
const CartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        variantLabel: { type: String },
      },
    ],
    couponCode: { type: String },
  },
  { timestamps: true }
);

// 10. Wishlist
const WishlistSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    notifyOnRestock: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// 11. Order
const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'packed',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
        'refunded',
      ],
      default: 'pending',
      index: true,
    },
    shippingAddress: {
      customerName: String,
      phone: String,
      email: String,
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    couponCode: { type: String },
    paymentMethod: { type: String, enum: ['cod', 'razorpay', 'manual'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'processing', 'paid', 'failed', 'refunded'], default: 'pending' },
    notes: { type: String, default: '' },
    idempotencyKey: { type: String, sparse: true, unique: true },
    timeline: [{ status: String, note: String, timestamp: Date }],
  },
  { timestamps: true }
);
OrderSchema.index({ user: 1, createdAt: -1 });

// 12. OrderItem
const OrderItemSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    variantLabel: { type: String },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
  },
  { timestamps: true }
);

// 13. Payment
const PaymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['cod', 'razorpay', 'manual'], required: true },
    status: { type: String, enum: ['pending', 'processing', 'paid', 'failed', 'refunded'], default: 'pending' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    providerOrderId: { type: String, index: true },
    providerPaymentId: { type: String, sparse: true, unique: true },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

// 14. Coupon
const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    usageLimit: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },
    usedByUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    eligibleCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    eligibleProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 15. Review
const ReviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true },
    comment: { type: String, required: true },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);
ReviewSchema.index({ product: 1, user: 1, order: 1 }, { unique: true });

// 16. Supplier
const SupplierSchema = new Schema(
  {
    name: { type: String, required: true },
    company: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: '' },
    contactPerson: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    suppliedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// 17. PurchaseOrder
const PurchaseOrderSchema = new Schema(
  {
    poNumber: { type: String, required: true, unique: true, index: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'partially_received', 'received', 'cancelled'],
      default: 'draft',
    },
    totalCost: { type: Number, required: true, min: 0 },
    expectedDeliveryDate: { type: Date },
    receivedAt: { type: Date },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// 18. PurchaseOrderItem
const PurchaseOrderItemSchema = new Schema(
  {
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantityOrdered: { type: Number, required: true, min: 1 },
    quantityReceived: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// 19. Address
const AddressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, default: 'Home' },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'United States' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 20. Notification
const NotificationSchema = new Schema(
  {
    recipientRole: { type: String, enum: ['super_admin', 'store_manager', 'customer'] },
    recipientUser: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, enum: ['low_stock', 'order_status', 'new_order', 'restock', 'system'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    link: { type: String },
  },
  { timestamps: true }
);

// 21. AuditLog
const AuditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);
AuditLogSchema.index({ createdAt: -1 });

function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema);
}

export const MongooseModels = {
  User: getModel('User', UserSchema),
  CustomerProfile: getModel('CustomerProfile', CustomerProfileSchema),
  Category: getModel('Category', CategorySchema),
  Brand: getModel('Brand', BrandSchema),
  Product: getModel('Product', ProductSchema),
  ProductVariant: getModel('ProductVariant', ProductVariantSchema),
  Inventory: getModel('Inventory', InventorySchema),
  StockMovement: getModel('StockMovement', StockMovementSchema),
  Cart: getModel('Cart', CartSchema),
  Wishlist: getModel('Wishlist', WishlistSchema),
  Order: getModel('Order', OrderSchema),
  OrderItem: getModel('OrderItem', OrderItemSchema),
  Payment: getModel('Payment', PaymentSchema),
  Coupon: getModel('Coupon', CouponSchema),
  Review: getModel('Review', ReviewSchema),
  Supplier: getModel('Supplier', SupplierSchema),
  PurchaseOrder: getModel('PurchaseOrder', PurchaseOrderSchema),
  PurchaseOrderItem: getModel('PurchaseOrderItem', PurchaseOrderItemSchema),
  Address: getModel('Address', AddressSchema),
  Notification: getModel('Notification', NotificationSchema),
  AuditLog: getModel('AuditLog', AuditLogSchema),
};
