import { Eye, Heart, ShoppingBag, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../lib/api';
import type { Product } from '../../types';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart, wishlistIds, toggleWishlist, setQuickViewProduct } = useApp();
  const isWishlisted = wishlistIds.includes(product._id);
  const outOfStock = product.stockQuantity <= 0;

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-shadow hover:shadow-lg hover:shadow-slate-900/5 dark:hover:shadow-black/30"
    >
      {/* 65-75% Studio Product Imagery */}
      <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          <ProductImage
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </Link>

        {/* Functional Icon Actions (Wishlist + Quick View) */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void toggleWishlist(product._id)}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            className={`w-9 h-9 rounded-lg flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer ${
              isWishlisted
                ? 'bg-indigo-600 text-white'
                : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <Heart className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => setQuickViewProduct(product)}
            aria-label={`Quick view ${product.name}`}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Structured Card Content — Clean Unboxed Metadata */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">
            {product.brandName} <span aria-hidden="true">·</span> {product.categoryName}
          </span>
          <span className="inline-flex items-center gap-1 shrink-0 tabular-nums font-medium text-slate-700 dark:text-slate-300">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            {product.averageRating > 0 ? product.averageRating.toFixed(1) : 'New'}
          </span>
        </div>

        <Link
          to={`/product/${product.slug}`}
          className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {product.name}
        </Link>

        {/* Stock Availability (Clean semantic text, zero pill spam) */}
        <div className="text-xs font-medium">
          {outOfStock ? (
            <span className="text-rose-600 dark:text-rose-400">Out of stock</span>
          ) : product.stockQuantity <= product.minStockLevel ? (
            <span className="text-amber-600 dark:text-amber-400 tabular-nums">
              Low stock · {product.stockQuantity} left
            </span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
              In stock · {product.stockQuantity} available
            </span>
          )}
        </div>

        {/* Baseline Price + Add to Cart */}
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap tabular-nums">
            <span className="text-base font-semibold text-slate-900 dark:text-white font-mono">
              {formatCurrency(product.effectivePrice)}
            </span>
            {product.discountPercent > 0 && (
              <>
                <span className="text-xs text-slate-400 line-through font-mono">
                  {formatCurrency(product.price)}
                </span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  -{product.discountPercent}%
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={outOfStock}
            onClick={() => void addToCart(product, 1)}
            aria-label={`Add ${product.name} to cart`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer bg-slate-900 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{outOfStock ? 'Sold Out' : 'Add'}</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
