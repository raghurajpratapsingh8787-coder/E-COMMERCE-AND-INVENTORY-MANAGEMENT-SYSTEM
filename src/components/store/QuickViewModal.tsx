import { ArrowRight, ShoppingBag, Star, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../lib/api';
import { ProductImage } from './ProductImage';

export function QuickViewModal() {
  const { quickViewProduct, setQuickViewProduct, addToCart } = useApp();
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);

  if (!quickViewProduct) return null;

  const outOfStock = quickViewProduct.stockQuantity <= 0;

  async function handleAdd() {
    if (!quickViewProduct) return;
    const ok = await addToCart(quickViewProduct, qty, selectedVariant);
    if (ok) {
      setQuickViewProduct(null);
      setQty(1);
      setSelectedVariant(undefined);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Quick view ${quickViewProduct.name}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setQuickViewProduct(null)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className="relative z-10 w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2"
        >
          <button
            type="button"
            onClick={() => setQuickViewProduct(null)}
            aria-label="Close quick view"
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="aspect-[4/3] md:aspect-auto bg-slate-100 dark:bg-slate-800">
            <ProductImage src={quickViewProduct.images[0]} alt={quickViewProduct.name} />
          </div>

          <div className="p-6 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{quickViewProduct.brandName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{quickViewProduct.sku}</span>
              </div>

              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white leading-snug">
                {quickViewProduct.name}
              </h2>

              <div className="flex items-center gap-3 text-sm tabular-nums">
                <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                  {formatCurrency(quickViewProduct.effectivePrice)}
                </span>
                {quickViewProduct.discountPercent > 0 && (
                  <span className="font-mono text-sm text-slate-400 line-through">
                    {formatCurrency(quickViewProduct.price)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {quickViewProduct.averageRating > 0 ? quickViewProduct.averageRating.toFixed(1) : 'New'}
                </span>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                {quickViewProduct.description}
              </p>

              {quickViewProduct.variants.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Option</span>
                  <div className="flex flex-wrap gap-2">
                    {quickViewProduct.variants.map((v) => {
                      const label = [v.color, v.size].filter(Boolean).join(' / ');
                      const active = selectedVariant === label;
                      return (
                        <button
                          key={v._id}
                          type="button"
                          onClick={() => setSelectedVariant(label)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <label htmlFor="quickview-qty" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Qty
                </label>
                <input
                  id="quickview-qty"
                  type="number"
                  min={1}
                  max={Math.max(1, quickViewProduct.stockQuantity)}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(quickViewProduct.stockQuantity, Number(e.target.value) || 1)))}
                  className="w-16 px-2.5 py-1.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {quickViewProduct.stockQuantity} in stock
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => void handleAdd()}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
                </button>
                <Link
                  to={`/product/${quickViewProduct.slug}`}
                  onClick={() => setQuickViewProduct(null)}
                  className="inline-flex items-center gap-1 py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>Full Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
