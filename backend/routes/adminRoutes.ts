import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { env, isSafeImageUrl } from '../config/env.ts';
import { db } from '../db/store.ts';
import {
  computeInventorySummary,
  roundCurrency,
  validateStockAdjustment,
  type OrderStatus,
} from '../domain/pricing.ts';
import { authenticate, recordAuditLog, requirePermission, requireRoles } from '../middleware/auth.ts';
import { emitRealtimeEvent } from '../realtime/socket.ts';
import { enrichProduct } from './catalogRoutes.ts';

export const adminRouter = Router();

// All admin routes require authentication & at least admin:dashboard permission
adminRouter.use(authenticate, requirePermission('admin:dashboard'));

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------- DASHBOARD & ANALYTICS (REAL DATABASE AGGREGATIONS) ----------

adminRouter.get('/dashboard/analytics', (req, res) => {
  const state = db.getState();
  const range = String(req.query.range || '30d');
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  const days = daysMap[range] || 30;
  const cutoffMs = Date.now() - days * 86400 * 1000;

  const nonCancelledOrders = state.orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded');
  const rangedOrders = nonCancelledOrders.filter((o) => new Date(o.createdAt).getTime() >= cutoffMs);

  const totalRevenue = roundCurrency(nonCancelledOrders.reduce((s, o) => s + o.totalAmount, 0));
  const rangedRevenue = roundCurrency(rangedOrders.reduce((s, o) => s + o.totalAmount, 0));
  const totalOrders = state.orders.length;
  const pendingOrders = state.orders.filter((o) => ['pending', 'confirmed', 'processing', 'packed'].includes(o.status)).length;
  const completedOrders = state.orders.filter((o) => o.status === 'delivered').length;
  const totalProducts = state.products.length;
  const totalCustomers = state.users.filter((u) => u.role === 'customer').length;

  const invJoin = state.products.map((p) => {
    const inv = state.inventories.find((i) => i.productId === p._id);
    return {
      stockQuantity: inv?.stockQuantity ?? 0,
      minStockLevel: inv?.minStockLevel ?? 5,
      costPrice: p.costPrice,
      price: p.price,
    };
  });
  const inventoryStats = computeInventorySummary(invJoin);

  // Daily / period revenue & order trend series
  const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
  const bucketCount = range === '7d' ? 7 : range === '30d' ? 10 : 12;
  const stepMs = (days * 86400 * 1000) / bucketCount;
  for (let i = bucketCount - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * stepMs);
    const label =
      range === '1y'
        ? d.toLocaleDateString('en-US', { month: 'short' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    buckets.set(label, { date: label, revenue: 0, orders: 0 });
  }
  const bucketKeys = Array.from(buckets.keys());
  for (const ord of rangedOrders) {
    const elapsed = Math.max(0, Date.now() - new Date(ord.createdAt).getTime());
    const idxFromEnd = Math.min(bucketCount - 1, Math.floor(elapsed / stepMs));
    const key = bucketKeys[bucketCount - 1 - idxFromEnd];
    if (key) {
      const b = buckets.get(key)!;
      b.revenue = roundCurrency(b.revenue + ord.totalAmount);
      b.orders += 1;
    }
  }
  const salesTrend = Array.from(buckets.values());

  // Category-wise sales
  const categoryMap = new Map<string, { name: string; revenue: number; units: number }>();
  for (const cat of state.categories) {
    categoryMap.set(cat._id, { name: cat.name, revenue: 0, units: 0 });
  }
  const validOrderIds = new Set(nonCancelledOrders.map((o) => o._id));
  const productSales = new Map<string, { productId: string; name: string; sku: string; unitsSold: number; revenue: number }>();

  for (const item of state.orderItems) {
    if (!validOrderIds.has(item.orderId)) continue;
    const prod = state.products.find((p) => p._id === item.productId);
    if (prod) {
      const catEntry = categoryMap.get(prod.categoryId);
      if (catEntry) {
        catEntry.revenue = roundCurrency(catEntry.revenue + item.lineTotal);
        catEntry.units += item.quantity;
      }
    }
    const existing = productSales.get(item.productId) || {
      productId: item.productId,
      name: item.productName,
      sku: item.sku,
      unitsSold: 0,
      revenue: 0,
    };
    existing.unitsSold += item.quantity;
    existing.revenue = roundCurrency(existing.revenue + item.lineTotal);
    productSales.set(item.productId, existing);
  }

  const categorySales = Array.from(categoryMap.values());
  const bestSellingProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Payment methods breakdown
  const paymentBreakdownMap: Record<string, { method: string; count: number; amount: number }> = {
    cod: { method: 'Cash on Delivery', count: 0, amount: 0 },
    razorpay: { method: 'Razorpay', count: 0, amount: 0 },
    manual: { method: 'Manual', count: 0, amount: 0 },
  };
  for (const pay of state.payments) {
    const entry = paymentBreakdownMap[pay.method];
    if (entry) {
      entry.count += 1;
      entry.amount = roundCurrency(entry.amount + pay.amount);
    }
  }

  // Inventory distribution by category
  const inventoryDistribution = state.categories.map((cat) => {
    const catProds = state.products.filter((p) => p.categoryId === cat._id);
    const units = catProds.reduce((sum, p) => {
      const inv = state.inventories.find((i) => i.productId === p._id);
      return sum + (inv?.stockQuantity ?? 0);
    }, 0);
    const value = roundCurrency(
      catProds.reduce((sum, p) => {
        const inv = state.inventories.find((i) => i.productId === p._id);
        return sum + (inv?.stockQuantity ?? 0) * p.costPrice;
      }, 0)
    );
    return { name: cat.name, units, value };
  });

  // Customer growth by registration bucket
  const customerGrowth = bucketKeys.map((dateLabel, idx) => ({
    date: dateLabel,
    customers: Math.max(
      1,
      state.users.filter((u) => {
        if (u.role !== 'customer') return false;
        const bucketEnd = Date.now() - (bucketCount - 1 - idx) * stepMs;
        return new Date(u.createdAt).getTime() <= bucketEnd;
      }).length
    ),
  }));

  res.json({
    range,
    kpis: {
      totalRevenue,
      rangedRevenue,
      totalOrders,
      totalProducts,
      totalCustomers,
      totalInventoryUnits: inventoryStats.totalUnits,
      totalInventoryValue: inventoryStats.totalCostValue,
      totalRetailValue: inventoryStats.totalRetailValue,
      lowStockProducts: inventoryStats.lowStockCount,
      outOfStockProducts: inventoryStats.outOfStockCount,
      pendingOrders,
      completedOrders,
      pendingPurchaseOrders: state.purchaseOrders.filter((po) =>
        ['draft', 'sent', 'approved', 'partially_received'].includes(po.status)
      ).length,
    },
    salesTrend,
    categorySales,
    bestSellingProducts,
    paymentMethods: Object.values(paymentBreakdownMap),
    inventoryDistribution,
    customerGrowth,
    recentOrders: state.orders.slice(0, 6),
    lowStockItems: state.products
      .map((p) => enrichProduct(state, p, true))
      .filter((p) => p.stockQuantity <= p.minStockLevel),
  });
});

// ---------- PRODUCTS CRUD ----------

const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().min(2).max(40),
  description: z.string().trim().min(10).max(2000),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  price: z.number().positive(),
  discountPrice: z.number().nonnegative().optional().nullable(),
  costPrice: z.number().nonnegative(),
  stockQuantity: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(5),
  warehouseLocation: z.string().trim().max(60).optional().default('Bay A-01'),
  images: z
    .array(z.string().min(1).refine(isSafeImageUrl, 'Image URL must be a valid https/http URL or /uploads path'))
    .min(1),
  specifications: z.record(z.string(), z.string()).optional().default({}),
  weightKg: z.number().nonnegative().optional().default(0.5),
  dimensionsCm: z
    .object({ length: z.number().nonnegative(), width: z.number().nonnegative(), height: z.number().nonnegative() })
    .optional()
    .default({ length: 20, width: 15, height: 10 }),
  status: z.enum(['draft', 'active', 'out_of_stock', 'discontinued']).default('active'),
  featured: z.boolean().optional().default(false),
  trending: z.boolean().optional().default(false),
  bestSeller: z.boolean().optional().default(false),
  newArrival: z.boolean().optional().default(true),
});

adminRouter.post('/products', requirePermission('products:write'), async (req, res) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product payload.' });
    return;
  }

  const skuUpper = parsed.data.sku.toUpperCase();
  const outcome = await db.mutate((state) => {
    if (state.products.some((p) => p.sku.toUpperCase() === skuUpper)) {
      return { ok: false as const, status: 409, error: `SKU "${skuUpper}" already exists.` };
    }
    const now = new Date().toISOString();
    const productId = db.newId('prod');
    const baseSlug = slugify(parsed.data.name);
    const slug = state.products.some((p) => p.slug === baseSlug)
      ? `${baseSlug}-${productId.slice(-4)}`
      : baseSlug;

    const product = {
      _id: productId,
      name: parsed.data.name,
      slug,
      sku: skuUpper,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId,
      brandId: parsed.data.brandId,
      price: parsed.data.price,
      discountPrice: parsed.data.discountPrice || undefined,
      costPrice: parsed.data.costPrice,
      images: parsed.data.images,
      specifications: parsed.data.specifications,
      weightKg: parsed.data.weightKg,
      dimensionsCm: parsed.data.dimensionsCm,
      status: parsed.data.stockQuantity === 0 && parsed.data.status === 'active' ? ('out_of_stock' as const) : parsed.data.status,
      featured: parsed.data.featured,
      trending: parsed.data.trending,
      bestSeller: parsed.data.bestSeller,
      newArrival: parsed.data.newArrival,
      averageRating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    state.products.unshift(product);
    state.inventories.push({
      _id: db.newId('inv'),
      productId,
      stockQuantity: parsed.data.stockQuantity,
      reservedQuantity: 0,
      minStockLevel: parsed.data.minStockLevel,
      warehouseLocation: parsed.data.warehouseLocation,
      lastRestockedAt: now,
      updatedAt: now,
    });

    if (parsed.data.stockQuantity > 0) {
      state.stockMovements.unshift({
        _id: db.newId('sm'),
        productId,
        type: 'purchase',
        quantityDelta: parsed.data.stockQuantity,
        previousStock: 0,
        newStock: parsed.data.stockQuantity,
        reason: 'Initial stock on product creation',
        performedBy: req.user!.id,
        performedByName: req.user!.name,
        createdAt: now,
      });
    }

    return { ok: true as const, product: enrichProduct(state, product, true) };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'PRODUCT_CREATED',
    entityType: 'Product',
    entityId: outcome.product._id,
    details: { sku: outcome.product.sku, name: outcome.product.name, price: outcome.product.price },
    ipAddress: req.ip,
  });

  res.status(201).json({ product: outcome.product });
});

adminRouter.patch('/products/:id', requirePermission('products:write'), async (req, res) => {
  const parsed = productCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product update.' });
    return;
  }

  const outcome = await db.mutate((state) => {
    const product = state.products.find((p) => p._id === req.params.id);
    if (!product) return { ok: false as const, status: 404, error: 'Product not found.' };

    const oldPrice = product.price;
    if (parsed.data.name) product.name = parsed.data.name;
    if (parsed.data.sku) product.sku = parsed.data.sku.toUpperCase();
    if (parsed.data.description) product.description = parsed.data.description;
    if (parsed.data.categoryId) product.categoryId = parsed.data.categoryId;
    if (parsed.data.brandId) product.brandId = parsed.data.brandId;
    if (parsed.data.price !== undefined) product.price = parsed.data.price;
    if (parsed.data.discountPrice !== undefined) product.discountPrice = parsed.data.discountPrice || undefined;
    if (parsed.data.costPrice !== undefined) product.costPrice = parsed.data.costPrice;
    if (parsed.data.images) product.images = parsed.data.images;
    if (parsed.data.specifications) product.specifications = parsed.data.specifications;
    if (parsed.data.weightKg !== undefined) product.weightKg = parsed.data.weightKg;
    if (parsed.data.dimensionsCm) product.dimensionsCm = parsed.data.dimensionsCm;
    if (parsed.data.status) product.status = parsed.data.status;
    if (parsed.data.featured !== undefined) product.featured = parsed.data.featured;
    if (parsed.data.trending !== undefined) product.trending = parsed.data.trending;
    if (parsed.data.bestSeller !== undefined) product.bestSeller = parsed.data.bestSeller;
    if (parsed.data.newArrival !== undefined) product.newArrival = parsed.data.newArrival;
    product.updatedAt = new Date().toISOString();

    const inv = state.inventories.find((i) => i.productId === product._id);
    if (inv && parsed.data.minStockLevel !== undefined) {
      inv.minStockLevel = parsed.data.minStockLevel;
    }

    return { ok: true as const, product: enrichProduct(state, product, true), priceChanged: oldPrice !== product.price, oldPrice };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: outcome.priceChanged ? 'PRODUCT_PRICE_CHANGED' : 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: outcome.product._id,
    details: { oldPrice: outcome.oldPrice, newPrice: outcome.product.price, status: outcome.product.status },
    ipAddress: req.ip,
  });

  res.json({ product: outcome.product });
});

adminRouter.delete('/products/:id', requirePermission('products:write'), async (req, res) => {
  const deleted = await db.mutate((state) => {
    const idx = state.products.findIndex((p) => p._id === req.params.id);
    if (idx === -1) return null;
    const [removed] = state.products.splice(idx, 1);
    state.inventories = state.inventories.filter((i) => i.productId !== removed._id);
    return removed;
  });

  if (!deleted) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'PRODUCT_DELETED',
    entityType: 'Product',
    entityId: deleted._id,
    details: { sku: deleted.sku, name: deleted.name },
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

// ---------- CATEGORIES & BRANDS ----------

adminRouter.post('/categories', requirePermission('categories:write'), async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300).optional().default(''),
      image: z
        .string()
        .refine(isSafeImageUrl, 'Invalid category image URL')
        .optional()
        .default('/src/assets/images/product_studio_headphones_1795710278477.jpg'),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid category name required.' });
    return;
  }
  const created = await db.mutate((state) => {
    const doc = {
      _id: db.newId('cat'),
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      description: parsed.data.description,
      image: parsed.data.image,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    state.categories.push(doc);
    return doc;
  });
  res.status(201).json({ category: created });
});

adminRouter.delete('/categories/:id', requirePermission('categories:write'), async (req, res) => {
  const result = await db.mutate((state) => {
    const inUse = state.products.some((p) => p.categoryId === req.params.id);
    if (inUse) return { ok: false as const, error: 'Cannot delete a category that still has products assigned.' };
    state.categories = state.categories.filter((c) => c._id !== req.params.id);
    return { ok: true as const };
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

adminRouter.post('/brands', requirePermission('categories:write'), async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300).optional().default(''),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid brand name required.' });
    return;
  }
  const created = await db.mutate((state) => {
    const doc = {
      _id: db.newId('brand'),
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      description: parsed.data.description,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    state.brands.push(doc);
    return doc;
  });
  res.status(201).json({ brand: created });
});

// ---------- INVENTORY MANAGEMENT ----------

adminRouter.get('/inventory', (_req, res) => {
  const state = db.getState();
  const items = state.products.map((p) => {
    const inv = state.inventories.find((i) => i.productId === p._id);
    const cat = state.categories.find((c) => c._id === p.categoryId);
    const qty = inv?.stockQuantity ?? 0;
    const min = inv?.minStockLevel ?? 5;
    return {
      productId: p._id,
      name: p.name,
      sku: p.sku,
      categoryName: cat?.name || 'General',
      image: p.images[0] || '',
      costPrice: p.costPrice,
      price: p.price,
      stockQuantity: qty,
      minStockLevel: min,
      warehouseLocation: inv?.warehouseLocation || 'Bay A-01',
      inventoryValue: roundCurrency(qty * p.costPrice),
      status: qty === 0 ? 'out_of_stock' : qty <= min ? 'low_stock' : 'healthy',
      updatedAt: inv?.updatedAt || p.updatedAt,
    };
  });

  const summary = computeInventorySummary(items);
  const pendingPOs = state.purchaseOrders.filter((po) =>
    ['draft', 'sent', 'approved', 'partially_received'].includes(po.status)
  ).length;

  const movements = state.stockMovements.slice(0, 80).map((m) => {
    const prod = state.products.find((p) => p._id === m.productId);
    return { ...m, productName: prod?.name || 'Deleted Product', sku: prod?.sku || '—' };
  });

  res.json({
    summary: { ...summary, pendingPurchaseOrders: pendingPOs },
    items,
    movements,
  });
});

adminRouter.post('/inventory/:productId/adjust', requirePermission('inventory:write'), async (req, res) => {
  const parsed = z
    .object({
      type: z.enum(['purchase', 'sale', 'return', 'damage', 'manual_adjustment']),
      quantityDelta: z.number().int().refine((n) => n !== 0, 'Quantity change cannot be zero'),
      minStockLevel: z.number().int().min(0).optional(),
      reason: z.string().trim().min(2).max(200),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid stock adjustment.' });
    return;
  }

  const productId = String(req.params.productId);
  const outcome = await db.withStockLock((state) => {
    const product = state.products.find((p) => p._id === productId);
    if (!product) return { ok: false as const, status: 404, error: 'Product not found.' };

    let inv = state.inventories.find((i) => i.productId === productId);
    if (!inv) {
      inv = {
        _id: db.newId('inv'),
        productId,
        stockQuantity: 0,
        reservedQuantity: 0,
        minStockLevel: 5,
        warehouseLocation: 'Bay A-01',
        lastRestockedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.inventories.push(inv);
    }

    const check = validateStockAdjustment(inv.stockQuantity, parsed.data.quantityDelta);
    if (!check.ok) {
      return { ok: false as const, status: 400, error: check.error || 'Negative stock not allowed.' };
    }

    const now = new Date().toISOString();
    const prev = inv.stockQuantity;
    inv.stockQuantity = check.nextStock;
    if (parsed.data.minStockLevel !== undefined) {
      inv.minStockLevel = parsed.data.minStockLevel;
    }
    if (parsed.data.quantityDelta > 0) {
      inv.lastRestockedAt = now;
    }
    inv.updatedAt = now;

    if (inv.stockQuantity === 0 && product.status === 'active') {
      product.status = 'out_of_stock';
    } else if (inv.stockQuantity > 0 && product.status === 'out_of_stock') {
      product.status = 'active';
    }

    const movement = {
      _id: db.newId('sm'),
      productId,
      type: parsed.data.type,
      quantityDelta: parsed.data.quantityDelta,
      previousStock: prev,
      newStock: inv.stockQuantity,
      reason: parsed.data.reason,
      performedBy: req.user!.id,
      performedByName: req.user!.name,
      createdAt: now,
    };
    state.stockMovements.unshift(movement);

    const lowStockTriggered = inv.stockQuantity <= inv.minStockLevel;
    if (lowStockTriggered) {
      state.notifications.unshift({
        _id: db.newId('notif'),
        recipientRole: 'super_admin',
        type: 'low_stock',
        title: `Low stock alert: ${product.name}`,
        message: `Stock is now ${inv.stockQuantity} unit(s) (threshold: ${inv.minStockLevel}).`,
        isRead: false,
        link: '/admin/inventory',
        createdAt: now,
      });
    }

    return { ok: true as const, inventory: inv, movement, productName: product.name, lowStockTriggered };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'STOCK_ADJUSTED',
    entityType: 'Inventory',
    entityId: productId,
    details: {
      type: parsed.data.type,
      delta: parsed.data.quantityDelta,
      newStock: outcome.inventory.stockQuantity,
      reason: parsed.data.reason,
    },
    ipAddress: req.ip,
  });

  if (outcome.lowStockTriggered) {
    emitRealtimeEvent({ roles: ['super_admin', 'store_manager'] }, 'inventory:low-stock', {
      productName: outcome.productName,
      remaining: outcome.inventory.stockQuantity,
      threshold: outcome.inventory.minStockLevel,
    });
  }

  res.json({ inventory: outcome.inventory, movement: outcome.movement });
});

// ---------- ORDERS MANAGEMENT ----------

adminRouter.get('/orders', (_req, res) => {
  const state = db.getState();
  const orders = state.orders.map((o) => ({
    ...o,
    items: state.orderItems.filter((oi) => oi.orderId === o._id),
    payment: state.payments.find((p) => p.orderId === o._id) || null,
  }));
  res.json({ orders });
});

adminRouter.patch('/orders/:id/status', requirePermission('orders:manage'), async (req, res) => {
  const parsed = z
    .object({
      status: z.enum([
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
      ]),
      note: z.string().trim().max(250).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid order status.' });
    return;
  }

  const outcome = await db.withStockLock((state) => {
    const order = state.orders.find((o) => o._id === req.params.id);
    if (!order) return { ok: false as const, status: 404, error: 'Order not found.' };

    const previousStatus: OrderStatus = order.status;
    const nextStatus = parsed.data.status;
    const now = new Date().toISOString();

    // Restore stock if newly cancelled or returned
    if (
      (nextStatus === 'cancelled' || nextStatus === 'returned') &&
      previousStatus !== 'cancelled' &&
      previousStatus !== 'returned'
    ) {
      const items = state.orderItems.filter((oi) => oi.orderId === order._id);
      for (const item of items) {
        const inv = state.inventories.find((i) => i.productId === item.productId);
        if (inv) {
          const prev = inv.stockQuantity;
          inv.stockQuantity = prev + item.quantity;
          inv.updatedAt = now;
          state.stockMovements.unshift({
            _id: db.newId('sm'),
            productId: item.productId,
            type: nextStatus === 'returned' ? 'return' : 'cancellation',
            quantityDelta: item.quantity,
            previousStock: prev,
            newStock: inv.stockQuantity,
            referenceType: 'ORDER',
            referenceId: order.orderNumber,
            reason: `Order marked ${nextStatus} by ${req.user!.name}`,
            performedBy: req.user!.id,
            performedByName: req.user!.name,
            createdAt: now,
          });
        }
      }
    }

    order.status = nextStatus;
    order.updatedAt = now;
    order.timeline.push({
      status: nextStatus,
      note: parsed.data.note || `Order status updated to ${nextStatus.replace(/_/g, ' ')}`,
      timestamp: now,
    });

    // If COD delivered, mark payment paid automatically
    if (nextStatus === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
      const pay = state.payments.find((p) => p.orderId === order._id);
      if (pay) {
        pay.status = 'paid';
        pay.verifiedAt = now;
      }
    }
    if (nextStatus === 'refunded') {
      order.paymentStatus = 'refunded';
      const pay = state.payments.find((p) => p.orderId === order._id);
      if (pay) pay.status = 'refunded';
    }

    state.notifications.unshift({
      _id: db.newId('notif'),
      recipientUserId: order.userId,
      type: 'order_status',
      title: `Order ${order.orderNumber} is ${nextStatus.replace(/_/g, ' ')}`,
      message: parsed.data.note || `Your order status was updated to ${nextStatus.replace(/_/g, ' ')}.`,
      isRead: false,
      link: '/orders',
      createdAt: now,
    });

    return { ok: true as const, order, previousStatus };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'ORDER_STATUS_UPDATED',
    entityType: 'Order',
    entityId: outcome.order._id,
    details: { from: outcome.previousStatus, to: outcome.order.status, orderNumber: outcome.order.orderNumber },
    ipAddress: req.ip,
  });

  emitRealtimeEvent({ userId: outcome.order.userId }, 'order:updated', {
    orderNumber: outcome.order.orderNumber,
    status: outcome.order.status,
  });

  res.json({ order: outcome.order });
});

// ---------- PAYMENTS ----------

adminRouter.get('/payments', (_req, res) => {
  const state = db.getState();
  res.json({
    payments: state.payments,
    razorpayConfigured: env.isRazorpayConfigured(),
  });
});

adminRouter.post('/payments/manual', requirePermission('payments:manage'), async (req, res) => {
  const parsed = z
    .object({
      orderId: z.string().min(1),
      status: z.enum(['paid', 'refunded', 'failed']),
      note: z.string().trim().max(200).optional().default('Manual payment update'),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid manual payment payload.' });
    return;
  }

  const outcome = await db.mutate((state) => {
    const order = state.orders.find((o) => o._id === parsed.data.orderId);
    if (!order) return { ok: false as const, error: 'Order not found.' };
    const now = new Date().toISOString();
    let payment = state.payments.find((p) => p.orderId === order._id);
    if (!payment) {
      payment = {
        _id: db.newId('pay'),
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        method: 'manual',
        status: parsed.data.status,
        amount: order.totalAmount,
        currency: state.settings.currency,
        verifiedAt: parsed.data.status === 'paid' ? now : undefined,
        createdAt: now,
      };
      state.payments.unshift(payment);
    } else {
      payment.status = parsed.data.status;
      if (parsed.data.status === 'paid') payment.verifiedAt = now;
    }
    order.paymentStatus = parsed.data.status;
    order.timeline.push({ status: order.status, note: `Payment marked ${parsed.data.status}: ${parsed.data.note}`, timestamp: now });
    return { ok: true as const, payment };
  });

  if (!outcome.ok) {
    res.status(404).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: parsed.data.status === 'refunded' ? 'PAYMENT_REFUNDED' : 'PAYMENT_UPDATED',
    entityType: 'Payment',
    entityId: outcome.payment._id,
    details: { orderId: parsed.data.orderId, status: parsed.data.status },
    ipAddress: req.ip,
  });

  res.json({ payment: outcome.payment });
});

// ---------- CUSTOMERS & STORE MANAGERS ----------

adminRouter.get('/customers', (_req, res) => {
  const state = db.getState();
  const users = state.users.map((u) => {
    const profile = state.customerProfiles.find((p) => p.userId === u._id);
    const userOrders = state.orders.filter((o) => o.userId === u._id);
    return {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      isActive: u.isActive,
      isEmailVerified: u.isEmailVerified,
      totalOrders: userOrders.length,
      totalSpent: roundCurrency(
        userOrders
          .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
          .reduce((s, o) => s + o.totalAmount, 0)
      ),
      supportNotes: profile?.supportNotes || '',
      createdAt: u.createdAt,
    };
  });
  res.json({ users });
});

adminRouter.patch('/users/:id/status', requirePermission('customers:manage'), async (req, res) => {
  const isActive = Boolean(req.body?.isActive);
  const outcome = await db.mutate((state) => {
    const user = state.users.find((u) => u._id === req.params.id);
    if (!user) return { ok: false as const, status: 404, error: 'User not found.' };
    if (user.role === 'super_admin') {
      return { ok: false as const, status: 400, error: 'Super Admin account cannot be deactivated.' };
    }
    if (user.role === 'store_manager' && req.user!.role !== 'super_admin') {
      return { ok: false as const, status: 403, error: 'Only Super Admin can change Store Manager account status.' };
    }
    user.isActive = isActive;
    user.updatedAt = new Date().toISOString();
    return { ok: true as const, user };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'USER_STATUS_CHANGED',
    entityType: 'User',
    entityId: outcome.user._id,
    details: { email: outcome.user.email, isActive },
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

adminRouter.post('/managers', requireRoles('super_admin'), async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email(),
      password: z.string().min(8).max(100),
      phone: z.string().trim().max(30).optional().default(''),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid manager details.' });
    return;
  }

  const emailLower = parsed.data.email.toLowerCase();
  if (db.getState().users.some((u) => u.email === emailLower)) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const created = await db.mutate((state) => {
    const now = new Date().toISOString();
    const doc = {
      _id: db.newId('mgr'),
      name: parsed.data.name,
      email: emailLower,
      passwordHash,
      role: 'store_manager' as const,
      phone: parsed.data.phone,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
      createdAt: now,
      updatedAt: now,
    };
    state.users.push(doc);
    return doc;
  });

  await recordAuditLog({
    actor: req.user,
    action: 'STORE_MANAGER_CREATED',
    entityType: 'User',
    entityId: created._id,
    details: { email: created.email, role: 'store_manager' },
    ipAddress: req.ip,
  });

  res.status(201).json({
    manager: { id: created._id, name: created.name, email: created.email, role: created.role, isActive: created.isActive },
  });
});

// ---------- SUPPLIERS & PURCHASE ORDERS ----------

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().max(240).optional().default(''),
  contactPerson: z.string().trim().min(2).max(100),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

adminRouter.get('/suppliers', (_req, res) => {
  res.json({ suppliers: db.getState().suppliers });
});

adminRouter.post('/suppliers', requirePermission('suppliers:manage'), async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid supplier payload.' });
    return;
  }
  const created = await db.mutate((state) => {
    const doc = {
      _id: db.newId('sup'),
      ...parsed.data,
      suppliedProductIds: [],
      createdAt: new Date().toISOString(),
    };
    state.suppliers.unshift(doc);
    return doc;
  });

  await recordAuditLog({
    actor: req.user,
    action: 'SUPPLIER_CREATED',
    entityType: 'Supplier',
    entityId: created._id,
    details: { company: created.company },
    ipAddress: req.ip,
  });
  res.status(201).json({ supplier: created });
});

adminRouter.patch('/suppliers/:id', requirePermission('suppliers:manage'), async (req, res) => {
  const parsed = supplierSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid supplier update.' });
    return;
  }
  const updated = await db.mutate((state) => {
    const sup = state.suppliers.find((s) => s._id === req.params.id);
    if (!sup) return null;
    Object.assign(sup, parsed.data);
    return sup;
  });
  if (!updated) {
    res.status(404).json({ error: 'Supplier not found.' });
    return;
  }
  res.json({ supplier: updated });
});

adminRouter.get('/purchase-orders', (_req, res) => {
  const state = db.getState();
  const list = state.purchaseOrders.map((po) => {
    const supplier = state.suppliers.find((s) => s._id === po.supplierId);
    const items = state.purchaseOrderItems.filter((i) => i.purchaseOrderId === po._id);
    return { ...po, supplierName: supplier?.company || 'Supplier', items };
  });
  res.json({ purchaseOrders: list });
});

adminRouter.post('/purchase-orders', requirePermission('purchases:manage'), async (req, res) => {
  const parsed = z
    .object({
      supplierId: z.string().min(1),
      expectedDeliveryDate: z.string().min(4),
      notes: z.string().max(400).optional().default(''),
      items: z
        .array(
          z.object({
            productId: z.string().min(1),
            quantityOrdered: z.number().int().min(1).max(10000),
            unitCost: z.number().positive(),
          })
        )
        .min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid purchase order payload.' });
    return;
  }

  const outcome = await db.mutate((state) => {
    const supplier = state.suppliers.find((s) => s._id === parsed.data.supplierId);
    if (!supplier) return { ok: false as const, error: 'Supplier not found.' };

    const now = new Date().toISOString();
    const poId = db.newId('po');
    const poNumber = `PO-${new Date().getFullYear()}-${String(42 + state.purchaseOrders.length).padStart(4, '0')}`;
    const totalCost = roundCurrency(
      parsed.data.items.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0)
    );

    const po = {
      _id: poId,
      poNumber,
      supplierId: supplier._id,
      status: 'approved' as const,
      totalCost,
      expectedDeliveryDate: parsed.data.expectedDeliveryDate,
      notes: parsed.data.notes,
      createdBy: req.user!.id,
      createdAt: now,
      updatedAt: now,
    };
    state.purchaseOrders.unshift(po);

    const createdItems = parsed.data.items.map((item) => {
      const prod = state.products.find((p) => p._id === item.productId);
      const doc = {
        _id: db.newId('poi'),
        purchaseOrderId: poId,
        productId: item.productId,
        productName: prod?.name || 'Product',
        sku: prod?.sku || 'SKU',
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        unitCost: item.unitCost,
      };
      state.purchaseOrderItems.push(doc);
      return doc;
    });

    return { ok: true as const, purchaseOrder: { ...po, supplierName: supplier.company, items: createdItems } };
  });

  if (!outcome.ok) {
    res.status(404).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'PURCHASE_ORDER_CREATED',
    entityType: 'PurchaseOrder',
    entityId: outcome.purchaseOrder._id,
    details: { poNumber: outcome.purchaseOrder.poNumber, totalCost: outcome.purchaseOrder.totalCost },
    ipAddress: req.ip,
  });

  res.status(201).json({ purchaseOrder: outcome.purchaseOrder });
});

/**
 * Atomic Purchase Order Stock Receiving
 * Prevents receiving the same purchase quantity more than once!
 */
adminRouter.post('/purchase-orders/:id/receive', requirePermission('purchases:manage'), async (req, res) => {
  const parsed = z
    .object({
      items: z
        .array(
          z.object({
            itemId: z.string().min(1),
            receiveQty: z.number().int().min(1),
          })
        )
        .min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Specify at least one line item quantity to receive.' });
    return;
  }

  const outcome = await db.withStockLock((state) => {
    const po = state.purchaseOrders.find((p) => p._id === req.params.id);
    if (!po) return { ok: false as const, status: 404, error: 'Purchase order not found.' };
    if (po.status === 'received' || po.status === 'cancelled') {
      return { ok: false as const, status: 400, error: `Purchase order is already ${po.status}.` };
    }

    const poItems = state.purchaseOrderItems.filter((i) => i.purchaseOrderId === po._id);

    // Validate every requested receive quantity BEFORE mutating
    for (const reqLine of parsed.data.items) {
      const line = poItems.find((i) => i._id === reqLine.itemId);
      if (!line) {
        return { ok: false as const, status: 404, error: 'Purchase order item not found.' };
      }
      const remaining = line.quantityOrdered - line.quantityReceived;
      if (reqLine.receiveQty > remaining) {
        return {
          ok: false as const,
          status: 409,
          error: `Cannot receive ${reqLine.receiveQty} units of "${line.productName}"; only ${remaining} remaining.`,
        };
      }
    }

    const now = new Date().toISOString();
    for (const reqLine of parsed.data.items) {
      const line = poItems.find((i) => i._id === reqLine.itemId)!;
      line.quantityReceived += reqLine.receiveQty;

      const inv = state.inventories.find((i) => i.productId === line.productId);
      if (inv) {
        const prev = inv.stockQuantity;
        inv.stockQuantity = prev + reqLine.receiveQty;
        inv.lastRestockedAt = now;
        inv.updatedAt = now;

        const prod = state.products.find((p) => p._id === line.productId);
        if (prod && prod.status === 'out_of_stock' && inv.stockQuantity > 0) {
          prod.status = 'active';
        }

        state.stockMovements.unshift({
          _id: db.newId('sm'),
          productId: line.productId,
          type: 'purchase',
          quantityDelta: reqLine.receiveQty,
          previousStock: prev,
          newStock: inv.stockQuantity,
          referenceType: 'PO',
          referenceId: po.poNumber,
          reason: `Received against ${po.poNumber}`,
          performedBy: req.user!.id,
          performedByName: req.user!.name,
          createdAt: now,
        });
      }
    }

    const allReceived = poItems.every((i) => i.quantityReceived >= i.quantityOrdered);
    po.status = allReceived ? 'received' : 'partially_received';
    po.receivedAt = now;
    po.updatedAt = now;

    return { ok: true as const, purchaseOrder: { ...po, items: poItems } };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'PURCHASE_ORDER_RECEIVED',
    entityType: 'PurchaseOrder',
    entityId: outcome.purchaseOrder._id,
    details: { poNumber: outcome.purchaseOrder.poNumber, status: outcome.purchaseOrder.status },
    ipAddress: req.ip,
  });

  res.json({ purchaseOrder: outcome.purchaseOrder });
});

// ---------- COUPONS ----------

const couponSchema = z.object({
  code: z.string().trim().min(3).max(32),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minOrderValue: z.number().min(0).default(0),
  maxDiscount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().min(1).default(100),
  expiresAt: z.string().min(4),
  isActive: z.boolean().optional().default(true),
});

adminRouter.get('/coupons', (_req, res) => {
  res.json({ coupons: db.getState().coupons });
});

adminRouter.post('/coupons', requirePermission('coupons:manage'), async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid coupon.' });
    return;
  }
  const codeUpper = parsed.data.code.toUpperCase();
  const outcome = await db.mutate((state) => {
    if (state.coupons.some((c) => c.code === codeUpper)) {
      return { ok: false as const, error: `Coupon code "${codeUpper}" already exists.` };
    }
    const doc = {
      _id: db.newId('coup'),
      code: codeUpper,
      type: parsed.data.type,
      value: parsed.data.value,
      minOrderValue: parsed.data.minOrderValue,
      maxDiscount: parsed.data.maxDiscount || undefined,
      usageLimit: parsed.data.usageLimit,
      usedCount: 0,
      usedByUsers: [],
      eligibleCategoryIds: [],
      eligibleProductIds: [],
      expiresAt: parsed.data.expiresAt,
      isActive: parsed.data.isActive,
      createdAt: new Date().toISOString(),
    };
    state.coupons.unshift(doc);
    return { ok: true as const, coupon: doc };
  });

  if (!outcome.ok) {
    res.status(409).json({ error: outcome.error });
    return;
  }

  await recordAuditLog({
    actor: req.user,
    action: 'COUPON_CREATED',
    entityType: 'Coupon',
    entityId: outcome.coupon._id,
    details: { code: outcome.coupon.code, value: outcome.coupon.value, type: outcome.coupon.type },
    ipAddress: req.ip,
  });

  res.status(201).json({ coupon: outcome.coupon });
});

adminRouter.patch('/coupons/:id', requirePermission('coupons:manage'), async (req, res) => {
  const isActive = req.body?.isActive;
  const updated = await db.mutate((state) => {
    const coupon = state.coupons.find((c) => c._id === req.params.id);
    if (!coupon) return null;
    if (typeof isActive === 'boolean') coupon.isActive = isActive;
    return coupon;
  });
  if (!updated) {
    res.status(404).json({ error: 'Coupon not found.' });
    return;
  }
  res.json({ coupon: updated });
});

// ---------- NOTIFICATIONS, REVIEWS, AUDIT LOGS & SETTINGS ----------

adminRouter.get('/notifications', (req, res) => {
  const state = db.getState();
  const list = state.notifications.filter(
    (n) => n.recipientRole === 'super_admin' || n.recipientRole === req.user!.role || n.recipientUserId === req.user!.id
  );
  res.json({ notifications: list });
});

adminRouter.patch('/notifications/:id/read', async (req, res) => {
  const updated = await db.mutate((state) => {
    const n = state.notifications.find((item) => item._id === req.params.id);
    if (!n) return { ok: false as const, status: 404 };
    const allowed =
      req.user!.role === 'super_admin' ||
      n.recipientUserId === req.user!.id ||
      n.recipientRole === req.user!.role;
    if (!allowed) return { ok: false as const, status: 403 };
    n.isRead = true;
    return { ok: true as const };
  });
  if (!updated.ok) {
    res.status(updated.status).json({ error: updated.status === 403 ? 'Forbidden.' : 'Notification not found.' });
    return;
  }
  res.json({ ok: true });
});

adminRouter.get('/reviews', (_req, res) => {
  const state = db.getState();
  const reviews = state.reviews.map((r) => {
    const prod = state.products.find((p) => p._id === r.productId);
    return { ...r, productName: prod?.name || 'Product' };
  });
  res.json({ reviews });
});

adminRouter.patch('/reviews/:id', requirePermission('products:write'), async (req, res) => {
  const isApproved = Boolean(req.body?.isApproved);
  await db.mutate((state) => {
    const rev = state.reviews.find((r) => r._id === req.params.id);
    if (rev) {
      rev.isApproved = isApproved;
      const prod = state.products.find((p) => p._id === rev.productId);
      if (prod) {
        const approved = state.reviews.filter((r) => r.productId === prod._id && r.isApproved);
        prod.reviewCount = approved.length;
        prod.averageRating =
          approved.length > 0
            ? Math.round((approved.reduce((a, b) => a + b.rating, 0) / approved.length) * 10) / 10
            : 0;
      }
    }
  });
  res.json({ ok: true });
});

adminRouter.get('/audit-logs', requireRoles('super_admin'), (_req, res) => {
  res.json({ auditLogs: db.getState().auditLogs });
});

adminRouter.get('/settings', (_req, res) => {
  res.json({
    settings: db.getState().settings,
    integrations: {
      mongodb: db.isMongoConnected(),
      razorpay: env.isRazorpayConfigured(),
      cloudinary: env.isCloudinaryConfigured(),
      smtp: env.isSmtpConfigured(),
      redis: Boolean(env.REDIS_URL),
    },
  });
});

adminRouter.patch('/settings', requireRoles('super_admin'), async (req, res) => {
  const parsed = z
    .object({
      storeName: z.string().trim().min(2).max(80).optional(),
      ownerName: z.string().trim().min(2).max(80).optional(),
      ownerEmail: z.string().trim().email().optional(),
      supportPhone: z.string().trim().max(30).optional(),
      freeShippingThreshold: z.number().min(0).optional(),
      standardShippingFee: z.number().min(0).optional(),
      taxRate: z.number().min(0).max(0.5).optional(),
      lowStockDefaultThreshold: z.number().int().min(0).optional(),
      stockReservationPolicy: z.enum(['deduct_on_order', 'deduct_on_payment']).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid settings payload.' });
    return;
  }

  const updated = await db.mutate((state) => {
    Object.assign(state.settings, parsed.data);
    return state.settings;
  });

  await recordAuditLog({
    actor: req.user,
    action: 'SETTINGS_UPDATED',
    entityType: 'StoreSettings',
    entityId: 'global',
    details: parsed.data as Record<string, unknown>,
    ipAddress: req.ip,
  });

  res.json({ settings: updated });
});
