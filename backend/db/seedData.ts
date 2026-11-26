import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  StockMovementType,
  UserRole,
} from '../domain/pricing.ts';

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpiresAt?: string;
  refreshTokens: Array<{ tokenHash: string; expiresAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileDoc {
  _id: string;
  userId: string;
  totalOrders: number;
  totalSpent: number;
  newsletterSubscribed: boolean;
  supportNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDoc {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  isActive: boolean;
  createdAt: string;
}

export interface BrandDoc {
  _id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProductVariantDoc {
  _id: string;
  productId: string;
  skuSuffix: string;
  color?: string;
  size?: string;
  priceDelta: number;
  stockQuantity: number;
}

export interface ProductDoc {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  categoryId: string;
  brandId: string;
  price: number;
  discountPrice?: number;
  costPrice: number;
  images: string[];
  specifications: Record<string, string>;
  weightKg: number;
  dimensionsCm: { length: number; width: number; height: number };
  status: ProductStatus;
  featured: boolean;
  trending: boolean;
  bestSeller: boolean;
  newArrival: boolean;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDoc {
  _id: string;
  productId: string;
  stockQuantity: number;
  reservedQuantity: number;
  minStockLevel: number;
  warehouseLocation: string;
  lastRestockedAt: string;
  updatedAt: string;
}

export interface StockMovementDoc {
  _id: string;
  productId: string;
  type: StockMovementType;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  referenceType?: string;
  referenceId?: string;
  reason: string;
  performedBy?: string;
  performedByName?: string;
  createdAt: string;
}

export interface CartDoc {
  _id: string;
  userId: string;
  items: Array<{ productId: string; quantity: number; variantLabel?: string }>;
  couponCode?: string;
  updatedAt: string;
}

export interface WishlistDoc {
  _id: string;
  userId: string;
  productIds: string[];
  notifyOnRestock: string[];
  updatedAt: string;
}

export interface OrderItemDoc {
  _id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  image: string;
  variantLabel?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDoc {
  _id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string;
  idempotencyKey?: string;
  timeline: Array<{ status: string; note: string; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDoc {
  _id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface CouponDoc {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  usedByUsers: string[];
  eligibleCategoryIds: string[];
  eligibleProductIds: string[];
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface ReviewDoc {
  _id: string;
  productId: string;
  userId: string;
  userName: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDoc {
  _id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  status: 'active' | 'inactive';
  suppliedProductIds: string[];
  createdAt: string;
}

export interface PurchaseOrderItemDoc {
  _id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface PurchaseOrderDoc {
  _id: string;
  poNumber: string;
  supplierId: string;
  status: 'draft' | 'sent' | 'approved' | 'partially_received' | 'received' | 'cancelled';
  totalCost: number;
  expectedDeliveryDate: string;
  receivedAt?: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddressDoc {
  _id: string;
  userId: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

export interface NotificationDoc {
  _id: string;
  recipientRole?: UserRole;
  recipientUserId?: string;
  type: 'low_stock' | 'order_status' | 'new_order' | 'restock' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLogDoc {
  _id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface StoreSettingsDoc {
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  supportPhone: string;
  currency: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  taxRate: number;
  lowStockDefaultThreshold: number;
  stockReservationPolicy: 'deduct_on_order' | 'deduct_on_payment';
  adminClaimed: boolean;
}

export interface NewsletterDoc {
  email: string;
  subscribedAt: string;
}

export interface DatabaseState {
  users: UserDoc[];
  customerProfiles: CustomerProfileDoc[];
  categories: CategoryDoc[];
  brands: BrandDoc[];
  products: ProductDoc[];
  productVariants: ProductVariantDoc[];
  inventories: InventoryDoc[];
  stockMovements: StockMovementDoc[];
  carts: CartDoc[];
  wishlists: WishlistDoc[];
  orders: OrderDoc[];
  orderItems: OrderItemDoc[];
  payments: PaymentDoc[];
  coupons: CouponDoc[];
  reviews: ReviewDoc[];
  suppliers: SupplierDoc[];
  purchaseOrders: PurchaseOrderDoc[];
  purchaseOrderItems: PurchaseOrderItemDoc[];
  addresses: AddressDoc[];
  notifications: NotificationDoc[];
  auditLogs: AuditLogDoc[];
  newsletters: NewsletterDoc[];
  settings: StoreSettingsDoc;
}

export const GENERATED_IMAGES = {
  hero: '/src/assets/images/hero_flagship_workspace_1795710279475.jpg',
  headphones: '/src/assets/images/product_studio_headphones_1795710278477.jpg',
  keyboard: '/src/assets/images/product_mechanical_keyboard_1795710276363.jpg',
  watch: '/src/assets/images/product_chronograph_watch_1795710277300.jpg',
  lamp: '/src/assets/images/product_architectural_lamp_1795710280336.jpg',
  weekender: '/src/assets/images/product_leather_weekender_1795710313415.jpg',
  speaker: '/src/assets/images/product_smart_speaker_1795710279912.jpg',
  kettle: '/src/assets/images/product_ceramic_espresso_1795710278723.jpg',
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400 * 1000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400 * 1000).toISOString();
}

export function createInitialSeedState(ownerName: string, ownerEmail: string): DatabaseState {
  const now = new Date().toISOString();

  const categories: CategoryDoc[] = [
    {
      _id: 'cat_audio',
      name: 'Reference Audio',
      slug: 'reference-audio',
      description: 'Wireless studio headphones and architectural room acoustics.',
      image: GENERATED_IMAGES.headphones,
      isActive: true,
      createdAt: daysAgo(60),
    },
    {
      _id: 'cat_workspace',
      name: 'Workspace Hardware',
      slug: 'workspace-hardware',
      description: 'CNC aluminum keyboards and sculptural architectural desk lighting.',
      image: GENERATED_IMAGES.keyboard,
      isActive: true,
      createdAt: daysAgo(60),
    },
    {
      _id: 'cat_carry',
      name: 'Horology & Carry',
      slug: 'horology-carry',
      description: 'Automatic timepieces and full-grain Italian leather travel goods.',
      image: GENERATED_IMAGES.watch,
      isActive: true,
      createdAt: daysAgo(60),
    },
    {
      _id: 'cat_living',
      name: 'Ritual & Living',
      slug: 'ritual-living',
      description: 'Precision pour-over brewing instruments and matte ceramics.',
      image: GENERATED_IMAGES.kettle,
      isActive: true,
      createdAt: daysAgo(60),
    },
  ];

  const brands: BrandDoc[] = [
    { _id: 'brand_nordak', name: 'Nordak Acoustics', slug: 'nordak-acoustics', description: 'Copenhagen studio sound engineering.', isActive: true, createdAt: daysAgo(60) },
    { _id: 'brand_kestrel', name: 'Kestrel Precision', slug: 'kestrel-precision', description: 'Machined desktop peripherals and optics.', isActive: true, createdAt: daysAgo(60) },
    { _id: 'brand_vermeer', name: 'Vermeer Studio', slug: 'vermeer-studio', description: 'Architectural lighting and leather ateliers.', isActive: true, createdAt: daysAgo(60) },
    { _id: 'brand_soren', name: 'Soren Horology', slug: 'soren-horology', description: 'Minimalist Swiss-movement timepieces.', isActive: true, createdAt: daysAgo(60) },
  ];

  const products: ProductDoc[] = [
    {
      _id: 'prod_headphones',
      name: 'Nordak M1 Reference Wireless Headphones',
      slug: 'nordak-m1-reference-headphones',
      sku: 'VTX-AUD-001',
      description: 'Precision-tuned 45mm beryllium drivers housed in matte obsidian aluminum with brushed titanium headband and adaptive hybrid active noise cancellation. Engineered for 42 hours of studio-grade playback.',
      categoryId: 'cat_audio',
      brandId: 'brand_nordak',
      price: 429,
      discountPrice: 369,
      costPrice: 195,
      images: [GENERATED_IMAGES.headphones, GENERATED_IMAGES.hero],
      specifications: {
        Driver: '45mm Beryllium Dynamic',
        Battery: '42 Hours ANC On',
        Connectivity: 'Bluetooth 5.4 / USB-C Lossless',
        Materials: 'Brushed Titanium & Lambskin',
      },
      weightKg: 0.31,
      dimensionsCm: { length: 20, width: 17, height: 8 },
      status: 'active',
      featured: true,
      trending: true,
      bestSeller: true,
      newArrival: false,
      averageRating: 4.9,
      reviewCount: 2,
      createdAt: daysAgo(45),
      updatedAt: daysAgo(2),
    },
    {
      _id: 'prod_keyboard',
      name: 'Kestrel 75 CNC Mechanical Keyboard',
      slug: 'kestrel-75-cnc-keyboard',
      sku: 'VTX-WRK-002',
      description: 'Milled from a solid block of 6063 aerospace aluminum in anodized deep navy and silver. Features gasket-mounted acoustics, hot-swappable tactile switches, and a coiled braided USB-C cable.',
      categoryId: 'cat_workspace',
      brandId: 'brand_kestrel',
      price: 319,
      discountPrice: 279,
      costPrice: 142,
      images: [GENERATED_IMAGES.keyboard, GENERATED_IMAGES.hero],
      specifications: {
        Layout: '75% Compact ANSI',
        Chassis: 'CNC 6063 Anodized Aluminum',
        Switches: 'Hot-Swappable Tactile 55g',
        Mount: 'Silicone Poron Gasket',
      },
      weightKg: 1.85,
      dimensionsCm: { length: 32, width: 14, height: 3.4 },
      status: 'active',
      featured: true,
      trending: true,
      bestSeller: true,
      newArrival: true,
      averageRating: 4.8,
      reviewCount: 1,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(1),
    },
    {
      _id: 'prod_watch',
      name: 'Soren Midnight Automatic Field Watch',
      slug: 'soren-midnight-automatic-watch',
      sku: 'VTX-HOR-003',
      description: '39mm brushed 316L stainless steel case framing a sunray midnight-navy dial beneath anti-reflective sapphire crystal. Powered by a 26-jewel automatic caliber with 44-hour power reserve.',
      categoryId: 'cat_carry',
      brandId: 'brand_soren',
      price: 590,
      discountPrice: 520,
      costPrice: 265,
      images: [GENERATED_IMAGES.watch],
      specifications: {
        Case: '39mm Brushed 316L Steel',
        Crystal: 'Domed Sapphire AR',
        Movement: 'Automatic 28,800 vph',
        WaterResistance: '100m / 10 ATM',
      },
      weightKg: 0.08,
      dimensionsCm: { length: 24, width: 4, height: 1.1 },
      status: 'active',
      featured: true,
      trending: false,
      bestSeller: true,
      newArrival: false,
      averageRating: 5.0,
      reviewCount: 1,
      createdAt: daysAgo(50),
      updatedAt: daysAgo(3),
    },
    {
      _id: 'prod_lamp',
      name: 'Vermeer Articulated Brass Desk Lamp',
      slug: 'vermeer-articulated-brass-lamp',
      sku: 'VTX-WRK-004',
      description: 'Sculptural task illumination crafted in powder-coated obsidian steel and solid satin brass friction joints. Delivers CRI 97+ glare-free warm-to-neutral dimming from 2700K to 4500K.',
      categoryId: 'cat_workspace',
      brandId: 'brand_vermeer',
      price: 265,
      discountPrice: 229,
      costPrice: 112,
      images: [GENERATED_IMAGES.lamp, GENERATED_IMAGES.hero],
      specifications: {
        ColorRendering: 'CRI 97+ Museum Grade',
        ColorTemp: '2700K – 4500K Stepless',
        Materials: 'Satin Brass & Matte Steel',
        Power: '14W LED / 50,000h Lifespan',
      },
      weightKg: 2.2,
      dimensionsCm: { length: 42, width: 16, height: 48 },
      status: 'active',
      featured: true,
      trending: true,
      bestSeller: false,
      newArrival: true,
      averageRating: 4.7,
      reviewCount: 1,
      createdAt: daysAgo(22),
      updatedAt: daysAgo(2),
    },
    {
      _id: 'prod_weekender',
      name: 'Vermeer Como Full-Grain Leather Weekender',
      slug: 'vermeer-como-leather-weekender',
      sku: 'VTX-CRY-005',
      description: 'Hand-cut vegetable-tanned Italian pebbled leather in deep midnight navy with solid matte gunmetal hardware, padded 16-inch laptop divider, and airline cabin-compliant proportions.',
      categoryId: 'cat_carry',
      brandId: 'brand_vermeer',
      price: 485,
      discountPrice: undefined,
      costPrice: 218,
      images: [GENERATED_IMAGES.weekender],
      specifications: {
        Leather: 'Full-Grain Italian Calfskin',
        Capacity: '38 Liters (Cabin Approved)',
        Hardware: 'Brushed Gunmetal YKK Excella',
        Lining: 'Water-Resistant Herringbone Cotton',
      },
      weightKg: 1.65,
      dimensionsCm: { length: 52, width: 24, height: 30 },
      status: 'active',
      featured: true,
      trending: false,
      bestSeller: true,
      newArrival: false,
      averageRating: 4.9,
      reviewCount: 1,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(4),
    },
    {
      _id: 'prod_speaker',
      name: 'Nordak A2 Acoustic Home Speaker',
      slug: 'nordak-a2-acoustic-speaker',
      sku: 'VTX-AUD-006',
      description: '360-degree omnidirectional acoustic cylinder wrapped in Danish Kvadrat wool textile, crowned with a weighted CNC-knurled aluminum rotary volume dial. Supports AirPlay 2 and Wi-Fi multi-room.',
      categoryId: 'cat_audio',
      brandId: 'brand_nordak',
      price: 349,
      discountPrice: 299,
      costPrice: 156,
      images: [GENERATED_IMAGES.speaker],
      specifications: {
        Amplification: '90W Class-D Tri-Amp',
        Textile: 'Kvadrat Acoustic Wool',
        Streaming: 'Wi-Fi / AirPlay 2 / Bluetooth 5.3',
        Control: 'Machined Aluminum Rotary Encoder',
      },
      weightKg: 2.1,
      dimensionsCm: { length: 14, width: 14, height: 24 },
      status: 'active',
      featured: true,
      trending: true,
      bestSeller: false,
      newArrival: true,
      averageRating: 4.8,
      reviewCount: 1,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1),
    },
    {
      _id: 'prod_kettle',
      name: 'Kestrel Precision Gooseneck Pour-Over Set',
      slug: 'kestrel-precision-pour-over-set',
      sku: 'VTX-LIV-007',
      description: 'Variable-temperature matte slate stainless gooseneck kettle paired with a hand-cast ribbed porcelain dripper and borosilicate carafe. Maintains 1-degree thermal accuracy for clean extraction.',
      categoryId: 'cat_living',
      brandId: 'brand_kestrel',
      price: 195,
      discountPrice: 169,
      costPrice: 82,
      images: [GENERATED_IMAGES.kettle],
      specifications: {
        Capacity: '900ml Kettle / 600ml Carafe',
        TempRange: '60°C – 100°C PID Controlled',
        Dripper: 'Ribbed Matte Porcelain V02',
        Finish: 'Slate Ceramic Coating & Walnut',
      },
      weightKg: 1.4,
      dimensionsCm: { length: 28, width: 18, height: 22 },
      status: 'active',
      featured: false,
      trending: true,
      bestSeller: false,
      newArrival: true,
      averageRating: 4.9,
      reviewCount: 1,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(1),
    },
    {
      _id: 'prod_desk_bundle',
      name: 'Veltrix Executive Studio Desk Ensemble',
      slug: 'veltrix-executive-studio-ensemble',
      sku: 'VTX-WRK-008',
      description: 'Curated flagship workspace bundle pairing our CNC mechanical keyboard, articulated brass task lamp, and slate leather desk mat at a collector edition saving.',
      categoryId: 'cat_workspace',
      brandId: 'brand_kestrel',
      price: 640,
      discountPrice: 549,
      costPrice: 290,
      images: [GENERATED_IMAGES.hero, GENERATED_IMAGES.keyboard, GENERATED_IMAGES.lamp],
      specifications: {
        Includes: 'Keyboard + Brass Lamp + Slate Mat',
        Edition: 'Numbered Studio Release',
        Warranty: '3-Year Hardware Coverage',
        Packaging: 'Recycled Felt Presentation Box',
      },
      weightKg: 4.5,
      dimensionsCm: { length: 55, width: 35, height: 18 },
      status: 'active',
      featured: false,
      trending: true,
      bestSeller: true,
      newArrival: true,
      averageRating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(8),
      updatedAt: now,
    },
  ];

  const productVariants: ProductVariantDoc[] = [
    { _id: 'var_1', productId: 'prod_headphones', skuSuffix: 'OBS', color: 'Obsidian Black', size: 'Standard', priceDelta: 0, stockQuantity: 16 },
    { _id: 'var_2', productId: 'prod_headphones', skuSuffix: 'TIT', color: 'Brushed Titanium', size: 'Standard', priceDelta: 20, stockQuantity: 8 },
    { _id: 'var_3', productId: 'prod_keyboard', skuSuffix: 'NVY-TAC', color: 'Midnight Navy', size: 'Tactile Switches', priceDelta: 0, stockQuantity: 12 },
    { _id: 'var_4', productId: 'prod_keyboard', skuSuffix: 'SLV-LIN', color: 'Anodized Silver', size: 'Linear Switches', priceDelta: 0, stockQuantity: 7 },
    { _id: 'var_5', productId: 'prod_watch', skuSuffix: '39-NVY', color: 'Midnight Dial', size: '39mm', priceDelta: 0, stockQuantity: 4 },
    { _id: 'var_6', productId: 'prod_weekender', skuSuffix: 'NVY-38L', color: 'Midnight Navy', size: '38L Cabin', priceDelta: 0, stockQuantity: 3 },
  ];

  const inventories: InventoryDoc[] = [
    { _id: 'inv_1', productId: 'prod_headphones', stockQuantity: 24, reservedQuantity: 0, minStockLevel: 8, warehouseLocation: 'Bay A-01', lastRestockedAt: daysAgo(12), updatedAt: daysAgo(1) },
    { _id: 'inv_2', productId: 'prod_keyboard', stockQuantity: 19, reservedQuantity: 0, minStockLevel: 6, warehouseLocation: 'Bay A-04', lastRestockedAt: daysAgo(10), updatedAt: daysAgo(1) },
    { _id: 'inv_3', productId: 'prod_watch', stockQuantity: 4, reservedQuantity: 0, minStockLevel: 6, warehouseLocation: 'Vault V-02', lastRestockedAt: daysAgo(20), updatedAt: daysAgo(2) },
    { _id: 'inv_4', productId: 'prod_lamp', stockQuantity: 14, reservedQuantity: 0, minStockLevel: 5, warehouseLocation: 'Bay B-02', lastRestockedAt: daysAgo(14), updatedAt: daysAgo(2) },
    { _id: 'inv_5', productId: 'prod_weekender', stockQuantity: 3, reservedQuantity: 0, minStockLevel: 5, warehouseLocation: 'Bay C-01', lastRestockedAt: daysAgo(25), updatedAt: daysAgo(3) },
    { _id: 'inv_6', productId: 'prod_speaker', stockQuantity: 22, reservedQuantity: 0, minStockLevel: 6, warehouseLocation: 'Bay A-02', lastRestockedAt: daysAgo(9), updatedAt: daysAgo(1) },
    { _id: 'inv_7', productId: 'prod_kettle', stockQuantity: 31, reservedQuantity: 0, minStockLevel: 8, warehouseLocation: 'Bay D-03', lastRestockedAt: daysAgo(7), updatedAt: daysAgo(1) },
    { _id: 'inv_8', productId: 'prod_desk_bundle', stockQuantity: 6, reservedQuantity: 0, minStockLevel: 4, warehouseLocation: 'Bay A-09', lastRestockedAt: daysAgo(6), updatedAt: now },
  ];

  const users: UserDoc[] = [
    {
      _id: 'user_super_admin',
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      passwordHash: '', // Claimed securely via first-run setup or ADMIN_INITIAL_PASSWORD env var
      role: 'super_admin',
      phone: '+1 (415) 555-0192',
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
      createdAt: daysAgo(90),
      updatedAt: now,
    },
    {
      _id: 'user_customer_1',
      name: 'Elena Vance',
      email: 'elena.vance@example.com',
      passwordHash: '', // Non-login seed customer for historical analytics & verified reviews
      role: 'customer',
      phone: '+1 (312) 555-0148',
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
      createdAt: daysAgo(45),
      updatedAt: daysAgo(5),
    },
    {
      _id: 'user_customer_2',
      name: 'Marcus Chen',
      email: 'marcus.chen@example.com',
      passwordHash: '',
      role: 'customer',
      phone: '+1 (206) 555-0174',
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
      createdAt: daysAgo(32),
      updatedAt: daysAgo(3),
    },
  ];

  const customerProfiles: CustomerProfileDoc[] = [
    { _id: 'cprof_1', userId: 'user_customer_1', totalOrders: 2, totalSpent: 1207.44, newsletterSubscribed: true, supportNotes: 'VIP repeat hardware buyer.', createdAt: daysAgo(45), updatedAt: daysAgo(5) },
    { _id: 'cprof_2', userId: 'user_customer_2', totalOrders: 2, totalSpent: 989.28, newsletterSubscribed: true, supportNotes: 'Prefers signature delivery.', createdAt: daysAgo(32), updatedAt: daysAgo(2) },
  ];

  const orders: OrderDoc[] = [
    {
      _id: 'ord_1001',
      orderNumber: 'VTX-2026-1001',
      userId: 'user_customer_1',
      status: 'delivered',
      shippingAddress: {
        customerName: 'Elena Vance',
        phone: '+1 (312) 555-0148',
        email: 'elena.vance@example.com',
        address: '742 West Fulton Market, Suite 400',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60661',
        country: 'United States',
      },
      subtotal: 648,
      discount: 64.8,
      shippingFee: 0,
      tax: 46.66,
      totalAmount: 629.86,
      couponCode: 'WELCOME10',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      notes: 'Leave with building concierge.',
      timeline: [
        { status: 'pending', note: 'Order placed', timestamp: daysAgo(24) },
        { status: 'confirmed', note: 'Inventory verified and allocated', timestamp: daysAgo(23) },
        { status: 'shipped', note: 'Dispatched via Express Courier', timestamp: daysAgo(22) },
        { status: 'delivered', note: 'Delivered and signed', timestamp: daysAgo(20) },
      ],
      createdAt: daysAgo(24),
      updatedAt: daysAgo(20),
    },
    {
      _id: 'ord_1002',
      orderNumber: 'VTX-2026-1002',
      userId: 'user_customer_2',
      status: 'delivered',
      shippingAddress: {
        customerName: 'Marcus Chen',
        phone: '+1 (206) 555-0174',
        email: 'marcus.chen@example.com',
        address: '1205 Western Ave, Apt 9B',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'United States',
      },
      subtotal: 520,
      discount: 0,
      shippingFee: 0,
      tax: 41.6,
      totalAmount: 561.6,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      notes: '',
      timeline: [
        { status: 'pending', note: 'Order placed', timestamp: daysAgo(14) },
        { status: 'confirmed', note: 'Payment confirmed', timestamp: daysAgo(14) },
        { status: 'shipped', note: 'Dispatched via Insured Air', timestamp: daysAgo(12) },
        { status: 'delivered', note: 'Delivered to recipient', timestamp: daysAgo(10) },
      ],
      createdAt: daysAgo(14),
      updatedAt: daysAgo(10),
    },
    {
      _id: 'ord_1003',
      orderNumber: 'VTX-2026-1003',
      userId: 'user_customer_1',
      status: 'shipped',
      shippingAddress: {
        customerName: 'Elena Vance',
        phone: '+1 (312) 555-0148',
        email: 'elena.vance@example.com',
        address: '742 West Fulton Market, Suite 400',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60661',
        country: 'United States',
      },
      subtotal: 528,
      discount: 0,
      shippingFee: 0,
      tax: 42.24,
      totalAmount: 570.24,
      paymentMethod: 'manual',
      paymentStatus: 'paid',
      notes: 'Corporate workspace order',
      timeline: [
        { status: 'pending', note: 'Order placed', timestamp: daysAgo(5) },
        { status: 'confirmed', note: 'Invoice settled', timestamp: daysAgo(4) },
        { status: 'packed', note: 'Quality checked & packed', timestamp: daysAgo(3) },
        { status: 'shipped', note: 'In transit with courier', timestamp: daysAgo(2) },
      ],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(2),
    },
    {
      _id: 'ord_1004',
      orderNumber: 'VTX-2026-1004',
      userId: 'user_customer_2',
      status: 'processing',
      shippingAddress: {
        customerName: 'Marcus Chen',
        phone: '+1 (206) 555-0174',
        email: 'marcus.chen@example.com',
        address: '1205 Western Ave, Apt 9B',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'United States',
      },
      subtotal: 485,
      discount: 25,
      shippingFee: 0,
      tax: 36.8,
      totalAmount: 496.8,
      couponCode: 'SAVE25',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      notes: 'Evening delivery preferred',
      timeline: [
        { status: 'pending', note: 'Order placed', timestamp: daysAgo(2) },
        { status: 'confirmed', note: 'Order confirmed', timestamp: daysAgo(1) },
        { status: 'processing', note: 'Preparing leather garment sleeve', timestamp: daysAgo(1) },
      ],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
  ];

  const orderItems: OrderItemDoc[] = [
    { _id: 'oi_1', orderId: 'ord_1001', productId: 'prod_headphones', productName: 'Nordak M1 Reference Wireless Headphones', sku: 'VTX-AUD-001', image: GENERATED_IMAGES.headphones, variantLabel: 'Obsidian Black', unitPrice: 369, quantity: 1, lineTotal: 369 },
    { _id: 'oi_2', orderId: 'ord_1001', productId: 'prod_keyboard', productName: 'Kestrel 75 CNC Mechanical Keyboard', sku: 'VTX-WRK-002', image: GENERATED_IMAGES.keyboard, variantLabel: 'Midnight Navy', unitPrice: 279, quantity: 1, lineTotal: 279 },
    { _id: 'oi_3', orderId: 'ord_1002', productId: 'prod_watch', productName: 'Soren Midnight Automatic Field Watch', sku: 'VTX-HOR-003', image: GENERATED_IMAGES.watch, variantLabel: '39mm', unitPrice: 520, quantity: 1, lineTotal: 520 },
    { _id: 'oi_4', orderId: 'ord_1003', productId: 'prod_lamp', productName: 'Vermeer Articulated Brass Desk Lamp', sku: 'VTX-WRK-004', image: GENERATED_IMAGES.lamp, unitPrice: 229, quantity: 1, lineTotal: 229 },
    { _id: 'oi_5', orderId: 'ord_1003', productId: 'prod_speaker', productName: 'Nordak A2 Acoustic Home Speaker', sku: 'VTX-AUD-006', image: GENERATED_IMAGES.speaker, unitPrice: 299, quantity: 1, lineTotal: 299 },
    { _id: 'oi_6', orderId: 'ord_1004', productId: 'prod_weekender', productName: 'Vermeer Como Full-Grain Leather Weekender', sku: 'VTX-CRY-005', image: GENERATED_IMAGES.weekender, unitPrice: 485, quantity: 1, lineTotal: 485 },
  ];

  const payments: PaymentDoc[] = [
    { _id: 'pay_1', orderId: 'ord_1001', orderNumber: 'VTX-2026-1001', userId: 'user_customer_1', method: 'cod', status: 'paid', amount: 629.86, currency: 'USD', verifiedAt: daysAgo(20), createdAt: daysAgo(24) },
    { _id: 'pay_2', orderId: 'ord_1002', orderNumber: 'VTX-2026-1002', userId: 'user_customer_2', method: 'razorpay', status: 'paid', amount: 561.6, currency: 'USD', providerOrderId: 'order_rzp_seed1002', providerPaymentId: 'pay_rzp_seed1002', verifiedAt: daysAgo(14), createdAt: daysAgo(14) },
    { _id: 'pay_3', orderId: 'ord_1003', orderNumber: 'VTX-2026-1003', userId: 'user_customer_1', method: 'manual', status: 'paid', amount: 570.24, currency: 'USD', verifiedAt: daysAgo(4), createdAt: daysAgo(5) },
    { _id: 'pay_4', orderId: 'ord_1004', orderNumber: 'VTX-2026-1004', userId: 'user_customer_2', method: 'cod', status: 'pending', amount: 496.8, currency: 'USD', createdAt: daysAgo(2) },
  ];

  const coupons: CouponDoc[] = [
    {
      _id: 'coup_1',
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minOrderValue: 150,
      maxDiscount: 120,
      usageLimit: 250,
      usedCount: 1,
      usedByUsers: ['user_customer_1'],
      eligibleCategoryIds: [],
      eligibleProductIds: [],
      expiresAt: daysFromNow(180),
      isActive: true,
      createdAt: daysAgo(60),
    },
    {
      _id: 'coup_2',
      code: 'SAVE25',
      type: 'fixed',
      value: 25,
      minOrderValue: 200,
      usageLimit: 100,
      usedCount: 1,
      usedByUsers: ['user_customer_2'],
      eligibleCategoryIds: [],
      eligibleProductIds: [],
      expiresAt: daysFromNow(90),
      isActive: true,
      createdAt: daysAgo(30),
    },
    {
      _id: 'coup_3',
      code: 'STUDIO15',
      type: 'percentage',
      value: 15,
      minOrderValue: 300,
      maxDiscount: 150,
      usageLimit: 50,
      usedCount: 0,
      usedByUsers: [],
      eligibleCategoryIds: ['cat_audio', 'cat_workspace'],
      eligibleProductIds: [],
      expiresAt: daysFromNow(60),
      isActive: true,
      createdAt: daysAgo(10),
    },
  ];

  const reviews: ReviewDoc[] = [
    {
      _id: 'rev_1',
      productId: 'prod_headphones',
      userId: 'user_customer_1',
      userName: 'Elena Vance',
      orderId: 'ord_1001',
      rating: 5,
      title: 'Reference clarity with zero listening fatigue',
      comment: 'Switched from studio monitors during late sessions. The titanium headband balances the weight effortlessly and USB-C lossless mode is remarkably transparent.',
      isApproved: true,
      createdAt: daysAgo(18),
      updatedAt: daysAgo(18),
    },
    {
      _id: 'rev_2',
      productId: 'prod_keyboard',
      userId: 'user_customer_1',
      userName: 'Elena Vance',
      orderId: 'ord_1001',
      rating: 5,
      title: 'Machined like a precision camera body',
      comment: 'Deep, muted typing acoustics straight out of the box. The anodized midnight navy finish looks architectural on a walnut desk.',
      isApproved: true,
      createdAt: daysAgo(17),
      updatedAt: daysAgo(17),
    },
    {
      _id: 'rev_3',
      productId: 'prod_watch',
      userId: 'user_customer_2',
      userName: 'Marcus Chen',
      orderId: 'ord_1002',
      rating: 5,
      title: 'Understated dial depth and crisp regulation',
      comment: 'Runs +2 seconds a day after a week on the wrist. The 39mm case slips neatly under a cuff and the sapphire anti-reflective coating disappears in daylight.',
      isApproved: true,
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
    },
  ];

  const suppliers: SupplierDoc[] = [
    {
      _id: 'sup_1',
      name: 'Nordak Nordic Audio A/S',
      company: 'Nordak Industrial Group',
      email: 'supply@nordak-audio.example.com',
      phone: '+45 33 14 28 90',
      address: 'Bredgade 45, 1260 Copenhagen, Denmark',
      contactPerson: 'Henrik Lindqvist',
      status: 'active',
      suppliedProductIds: ['prod_headphones', 'prod_speaker'],
      createdAt: daysAgo(80),
    },
    {
      _id: 'sup_2',
      name: 'Atelier Vermeer & Precision Mfg',
      company: 'Vermeer Hardware SRL',
      email: 'orders@vermeer-atelier.example.com',
      phone: '+39 02 8941 5520',
      address: 'Via Tortona 31, 20144 Milano, Italy',
      contactPerson: 'Chiara Bellini',
      status: 'active',
      suppliedProductIds: ['prod_keyboard', 'prod_lamp', 'prod_weekender', 'prod_kettle'],
      createdAt: daysAgo(75),
    },
  ];

  const purchaseOrders: PurchaseOrderDoc[] = [
    {
      _id: 'po_1',
      poNumber: 'PO-2026-0041',
      supplierId: 'sup_2',
      status: 'approved',
      totalCost: 2470,
      expectedDeliveryDate: daysFromNow(5),
      notes: 'Restock order for low-stock leather weekenders and brass lamps.',
      createdBy: 'user_super_admin',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
  ];

  const purchaseOrderItems: PurchaseOrderItemDoc[] = [
    { _id: 'poi_1', purchaseOrderId: 'po_1', productId: 'prod_weekender', productName: 'Vermeer Como Full-Grain Leather Weekender', sku: 'VTX-CRY-005', quantityOrdered: 8, quantityReceived: 0, unitCost: 218 },
    { _id: 'poi_2', purchaseOrderId: 'po_1', productId: 'prod_lamp', productName: 'Vermeer Articulated Brass Desk Lamp', sku: 'VTX-WRK-004', quantityOrdered: 6, quantityReceived: 0, unitCost: 112 },
  ];

  const stockMovements: StockMovementDoc[] = [
    { _id: 'sm_1', productId: 'prod_headphones', type: 'purchase', quantityDelta: 25, previousStock: 0, newStock: 25, referenceType: 'PO', referenceId: 'PO-2026-0018', reason: 'Initial warehouse intake', performedBy: 'user_super_admin', performedByName: ownerName, createdAt: daysAgo(30) },
    { _id: 'sm_2', productId: 'prod_headphones', type: 'sale', quantityDelta: -1, previousStock: 25, newStock: 24, referenceType: 'ORDER', referenceId: 'VTX-2026-1001', reason: 'Customer order fulfillment', performedBy: 'user_customer_1', performedByName: 'Elena Vance', createdAt: daysAgo(24) },
    { _id: 'sm_3', productId: 'prod_watch', type: 'sale', quantityDelta: -1, previousStock: 5, newStock: 4, referenceType: 'ORDER', referenceId: 'VTX-2026-1002', reason: 'Customer order fulfillment', performedBy: 'user_customer_2', performedByName: 'Marcus Chen', createdAt: daysAgo(14) },
    { _id: 'sm_4', productId: 'prod_weekender', type: 'sale', quantityDelta: -1, previousStock: 4, newStock: 3, referenceType: 'ORDER', referenceId: 'VTX-2026-1004', reason: 'Customer order allocation', performedBy: 'user_customer_2', performedByName: 'Marcus Chen', createdAt: daysAgo(2) },
  ];

  const notifications: NotificationDoc[] = [
    {
      _id: 'notif_1',
      recipientRole: 'super_admin',
      type: 'low_stock',
      title: 'Low stock alert: Soren Midnight Automatic Field Watch',
      message: 'Remaining stock (4 units) is below the minimum threshold of 6 units.',
      isRead: false,
      link: '/admin/inventory',
      createdAt: daysAgo(2),
    },
    {
      _id: 'notif_2',
      recipientRole: 'super_admin',
      type: 'low_stock',
      title: 'Low stock alert: Vermeer Como Leather Weekender',
      message: 'Remaining stock (3 units) is below the minimum threshold of 5 units. PO-2026-0041 approved.',
      isRead: false,
      link: '/admin/purchases',
      createdAt: daysAgo(1),
    },
  ];

  const auditLogs: AuditLogDoc[] = [
    {
      _id: 'aud_1',
      actorId: 'user_super_admin',
      actorEmail: ownerEmail.toLowerCase(),
      actorRole: 'super_admin',
      action: 'PURCHASE_ORDER_APPROVED',
      entityType: 'PurchaseOrder',
      entityId: 'po_1',
      details: { poNumber: 'PO-2026-0041', totalCost: 2470 },
      ipAddress: '127.0.0.1',
      createdAt: daysAgo(2),
    },
  ];

  return {
    users,
    customerProfiles,
    categories,
    brands,
    products,
    productVariants,
    inventories,
    stockMovements,
    carts: [],
    wishlists: [],
    orders,
    orderItems,
    payments,
    coupons,
    reviews,
    suppliers,
    purchaseOrders,
    purchaseOrderItems,
    addresses: [],
    notifications,
    auditLogs,
    newsletters: [{ email: 'elena.vance@example.com', subscribedAt: daysAgo(40) }],
    settings: {
      storeName: 'Veltrix Commerce',
      ownerName,
      ownerEmail: ownerEmail.toLowerCase(),
      supportPhone: '+1 (415) 555-0192',
      currency: 'USD',
      freeShippingThreshold: 250,
      standardShippingFee: 18,
      taxRate: 0.08,
      lowStockDefaultThreshold: 5,
      stockReservationPolicy: 'deduct_on_order',
      adminClaimed: false,
    },
  };
}
