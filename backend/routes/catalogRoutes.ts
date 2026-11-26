import crypto from 'crypto';
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { db } from '../db/store.ts';
import type { DatabaseState, ProductDoc } from '../db/seedData.ts';
import {
  detectImageMimeFromMagicBytes,
  getDiscountPercentage,
  getEffectivePrice,
} from '../domain/pricing.ts';
import { authenticate, optionalAuth, requirePermission } from '../middleware/auth.ts';

export const catalogRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

export function enrichProduct(state: DatabaseState, product: ProductDoc, includeInternal = false) {
  const category = state.categories.find((c) => c._id === product.categoryId);
  const brand = state.brands.find((b) => b._id === product.brandId);
  const inventory = state.inventories.find((i) => i.productId === product._id);
  const variants = state.productVariants.filter((v) => v.productId === product._id);
  const stockQuantity = inventory?.stockQuantity ?? 0;
  const minStockLevel = inventory?.minStockLevel ?? 5;
  const effectivePrice = getEffectivePrice(product.price, product.discountPrice);
  const discountPercent = getDiscountPercentage(product.price, product.discountPrice);

  const { costPrice, ...publicProduct } = product;

  return {
    ...publicProduct,
    ...(includeInternal ? { costPrice } : {}),
    categoryName: category?.name || 'General',
    categorySlug: category?.slug || 'general',
    brandName: brand?.name || 'Veltrix',
    brandSlug: brand?.slug || 'veltrix',
    stockQuantity,
    minStockLevel,
    warehouseLocation: inventory?.warehouseLocation || 'Main Hub',
    effectivePrice,
    discountPercent,
    variants,
    availability:
      product.status !== 'active'
        ? product.status
        : stockQuantity <= 0
          ? 'out_of_stock'
          : stockQuantity <= minStockLevel
            ? 'low_stock'
            : 'in_stock',
  };
}

catalogRouter.get('/storefront', (_req, res) => {
  const state = db.getState();
  const activeProducts = state.products
    .filter((p) => p.status === 'active')
    .map((p) => enrichProduct(state, p));

  const categories = state.categories
    .filter((c) => c.isActive)
    .map((c) => ({
      ...c,
      productCount: activeProducts.filter((p) => p.categoryId === c._id).length,
    }));

  const approvedReviews = state.reviews
    .filter((r) => r.isApproved)
    .slice(0, 6)
    .map((r) => {
      const prod = state.products.find((p) => p._id === r.productId);
      return { ...r, productName: prod?.name || 'Product', productSlug: prod?.slug || '' };
    });

  const activeCoupons = state.coupons
    .filter((c) => c.isActive && new Date(c.expiresAt).getTime() > Date.now() && c.usedCount < c.usageLimit)
    .map((c) => ({
      code: c.code,
      type: c.type,
      value: c.value,
      minOrderValue: c.minOrderValue,
      expiresAt: c.expiresAt,
    }));

  res.json({
    heroImage: '/src/assets/images/hero_flagship_workspace_1795710279475.jpg',
    featured: activeProducts.filter((p) => p.featured).slice(0, 6),
    trending: activeProducts.filter((p) => p.trending).slice(0, 6),
    bestSellers: activeProducts.filter((p) => p.bestSeller).slice(0, 6),
    newArrivals: activeProducts.filter((p) => p.newArrival).slice(0, 6),
    deals: activeProducts.filter((p) => p.discountPercent > 0),
    categories,
    brands: state.brands.filter((b) => b.isActive),
    reviews: approvedReviews,
    coupons: activeCoupons,
    store: {
      storeName: state.settings.storeName,
      ownerName: state.settings.ownerName,
      ownerEmail: state.settings.ownerEmail,
      supportPhone: state.settings.supportPhone,
      freeShippingThreshold: state.settings.freeShippingThreshold,
    },
  });
});

catalogRouter.get('/categories', (_req, res) => {
  const state = db.getState();
  const categories = state.categories.map((c) => ({
    ...c,
    productCount: state.products.filter((p) => p.categoryId === c._id && p.status === 'active').length,
  }));
  res.json({ categories, brands: state.brands });
});

catalogRouter.get('/products', optionalAuth, (req, res) => {
  const state = db.getState();
  const isStaff = req.user?.role === 'super_admin' || req.user?.role === 'store_manager';
  const search = String(req.query.search || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const brand = String(req.query.brand || '').trim();
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
  const inStock = req.query.inStock === 'true';
  const dealsOnly = req.query.dealsOnly === 'true';
  const includeAllStatuses = isStaff && req.query.includeAll === 'true';
  const sort = String(req.query.sort || 'featured');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 24)));

  let list = state.products.map((p) => enrichProduct(state, p, isStaff));

  if (!includeAllStatuses) {
    list = list.filter((p) => p.status === 'active' || p.status === 'out_of_stock');
  }
  if (search) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search) ||
        p.brandName.toLowerCase().includes(search) ||
        p.categoryName.toLowerCase().includes(search)
    );
  }
  if (category && category !== 'all') {
    list = list.filter((p) => p.categoryId === category || p.categorySlug === category);
  }
  if (brand && brand !== 'all') {
    list = list.filter((p) => p.brandId === brand || p.brandSlug === brand);
  }
  if (typeof minPrice === 'number' && !Number.isNaN(minPrice)) {
    list = list.filter((p) => p.effectivePrice >= minPrice);
  }
  if (typeof maxPrice === 'number' && !Number.isNaN(maxPrice)) {
    list = list.filter((p) => p.effectivePrice <= maxPrice);
  }
  if (inStock) {
    list = list.filter((p) => p.stockQuantity > 0);
  }
  if (dealsOnly) {
    list = list.filter((p) => p.discountPercent > 0);
  }

  switch (sort) {
    case 'price_asc':
      list.sort((a, b) => a.effectivePrice - b.effectivePrice);
      break;
    case 'price_desc':
      list.sort((a, b) => b.effectivePrice - a.effectivePrice);
      break;
    case 'rating':
      list.sort((a, b) => b.averageRating - a.averageRating);
      break;
    case 'newest':
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    default:
      list.sort((a, b) => Number(b.featured) - Number(a.featured) || b.averageRating - a.averageRating);
  }

  const total = list.length;
  const start = (page - 1) * limit;
  const paginated = list.slice(start, start + limit);

  res.json({
    products: paginated,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

catalogRouter.get('/products/:slugOrId', optionalAuth, (req, res) => {
  const state = db.getState();
  const isStaff = req.user?.role === 'super_admin' || req.user?.role === 'store_manager';
  const product = state.products.find(
    (p) => p.slug === req.params.slugOrId || p._id === req.params.slugOrId
  );
  if (!product || (!isStaff && product.status === 'draft')) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const enriched = enrichProduct(state, product, isStaff);
  const reviews = state.reviews
    .filter((r) => r.productId === product._id && r.isApproved)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const related = state.products
    .filter((p) => p._id !== product._id && p.status === 'active' && p.categoryId === product.categoryId)
    .slice(0, 4)
    .map((p) => enrichProduct(state, p));

  // Check if authenticated user has a completed/delivered purchase eligible to review
  let eligibleOrderId: string | null = null;
  if (req.user) {
    const userDeliveredOrders = state.orders.filter(
      (o) => o.userId === req.user!.id && o.status === 'delivered'
    );
    for (const ord of userDeliveredOrders) {
      const hasProduct = state.orderItems.some(
        (oi) => oi.orderId === ord._id && oi.productId === product._id
      );
      const alreadyReviewed = state.reviews.some(
        (r) => r.orderId === ord._id && r.productId === product._id && r.userId === req.user!.id
      );
      if (hasProduct && !alreadyReviewed) {
        eligibleOrderId = ord._id;
        break;
      }
    }
  }

  res.json({
    product: enriched,
    reviews,
    related,
    canReview: Boolean(eligibleOrderId),
    eligibleOrderId,
  });
});

catalogRouter.post('/products/:id/reviews', authenticate, async (req, res) => {
  const parsed = z
    .object({
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().min(3).max(120),
      comment: z.string().trim().min(8).max(1200),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review input.' });
    return;
  }

  const productId = String(req.params.id);
  const result = await db.mutate((state) => {
    const product = state.products.find((p) => p._id === productId);
    if (!product) {
      return { ok: false as const, status: 404, error: 'Product not found.' };
    }

    const deliveredOrders = state.orders.filter(
      (o) => o.userId === req.user!.id && o.status === 'delivered'
    );
    const eligibleOrder = deliveredOrders.find((ord) => {
      const bought = state.orderItems.some(
        (oi) => oi.orderId === ord._id && oi.productId === productId
      );
      const reviewed = state.reviews.some(
        (r) => r.orderId === ord._id && r.productId === productId && r.userId === req.user!.id
      );
      return bought && !reviewed;
    });

    if (!eligibleOrder) {
      return {
        ok: false as const,
        status: 403,
        error: 'Only customers with a delivered purchase of this product can submit a verified review once per order.',
      };
    }

    const now = new Date().toISOString();
    const review = {
      _id: db.newId('rev'),
      productId,
      userId: req.user!.id,
      userName: req.user!.name,
      orderId: eligibleOrder._id,
      rating: parsed.data.rating,
      title: parsed.data.title,
      comment: parsed.data.comment,
      isApproved: true,
      createdAt: now,
      updatedAt: now,
    };
    state.reviews.unshift(review);

    const approved = state.reviews.filter((r) => r.productId === productId && r.isApproved);
    product.reviewCount = approved.length;
    product.averageRating =
      approved.length > 0
        ? Math.round((approved.reduce((acc, r) => acc + r.rating, 0) / approved.length) * 10) / 10
        : 0;

    return { ok: true as const, review };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(201).json({ review: result.review });
});

catalogRouter.post('/newsletter', async (req, res) => {
  const parsed = z.object({ email: z.string().trim().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  const emailLower = parsed.data.email.toLowerCase();
  await db.mutate((state) => {
    if (!state.newsletters.some((n) => n.email === emailLower)) {
      state.newsletters.push({ email: emailLower, subscribedAt: new Date().toISOString() });
    }
  });
  res.status(201).json({ ok: true, message: 'Subscribed to Veltrix product releases.' });
});

/**
 * Secure Product Image Upload
 * Validates actual file magic bytes (never trusts extensions), limits size to 5MB,
 * generates unique crypto filenames, and enforces strict directory confinement.
 */
catalogRouter.post(
  '/uploads',
  authenticate,
  requirePermission('products:write'),
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded.' });
      return;
    }

    const detectedMime = detectImageMimeFromMagicBytes(req.file.buffer);
    if (!detectedMime || !ALLOWED_MIME_TO_EXT[detectedMime]) {
      res.status(400).json({
        error: 'Invalid image file. Only verified JPEG, PNG, WebP, or GIF image signatures are accepted.',
      });
      return;
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const ext = ALLOWED_MIME_TO_EXT[detectedMime];
    const filename = `prod_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const resolvedPath = path.resolve(UPLOADS_DIR, filename);

    // Strict path confinement check
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid upload destination.' });
      return;
    }

    fs.writeFileSync(resolvedPath, req.file.buffer);
    res.status(201).json({
      url: `/uploads/${filename}`,
      mimeType: detectedMime,
      size: req.file.size,
    });
  }
);
