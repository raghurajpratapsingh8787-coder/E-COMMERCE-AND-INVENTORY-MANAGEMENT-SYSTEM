import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductImage } from '../../components/store/ProductImage';
import { useApp } from '../../context/AppContext';
import { apiRequest, formatCurrency } from '../../lib/api';
import type { Product } from '../../types';

export function WishlistPage() {
  const { user, toggleWishlist, refreshCart, refreshWishlist, pushToast, setCartOpen } = useApp();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist-page', user?.id],
    queryFn: () => apiRequest<{ products: Product[] }>('/api/commerce/wishlist'),
    enabled: Boolean(user),
  });

  async function moveToCart(productId: string) {
    try {
      await apiRequest('/api/commerce/wishlist/move-to-cart', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      await Promise.all([refreshCart(), refreshWishlist()]);
      await queryClient.invalidateQueries({ queryKey: ['wishlist-page'] });
      setCartOpen(true);
      pushToast('success', 'Moved to cart');
    } catch (err) {
      pushToast('error', 'Unable to move item', err instanceof Error ? err.message : 'Stock unavailable');
    }
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <Heart className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Sign in to view your saved Wishlist
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your wishlist is synced securely to your account across sessions.
        </p>
        <Link
          to="/auth?next=/wishlist"
          className="inline-flex px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-sm font-semibold"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
          Saved Wishlist
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Move saved hardware straight to your cart with live warehouse stock checks.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : data && data.products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.products.map((p) => (
            <article
              key={p._id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
            >
              <Link to={`/product/${p.slug}`} className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 block">
                <ProductImage src={p.images[0]} alt={p.name} />
              </Link>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{p.brandName}</p>
                  <Link to={`/product/${p.slug}`} className="font-display font-semibold text-base text-slate-900 dark:text-white mt-1 block">
                    {p.name}
                  </Link>
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white mt-2 tabular-nums">
                    {formatCurrency(p.effectivePrice)}
                  </p>
                  <p className={`text-xs mt-1 ${p.stockQuantity > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {p.stockQuantity > 0 ? `${p.stockQuantity} in stock` : 'Out of stock'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={p.stockQuantity <= 0}
                    onClick={() => void moveToCart(p._id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-600 disabled:opacity-40 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Move to Cart</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleWishlist(p._id);
                      await queryClient.invalidateQueries({ queryKey: ['wishlist-page'] });
                    }}
                    aria-label={`Remove ${p.name} from wishlist`}
                    className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3">
          <p className="font-display font-semibold text-slate-900 dark:text-white">
            Your wishlist is empty
          </p>
          <Link
            to="/shop"
            className="inline-flex px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white"
          >
            Browse Catalog
          </Link>
        </div>
      )}
    </main>
  );
}
