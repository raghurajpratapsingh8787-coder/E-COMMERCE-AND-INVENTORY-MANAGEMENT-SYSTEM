import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../lib/api';
import { ProductImage } from './ProductImage';

export function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    updateCartQty,
    removeFromCart,
    applyCartCoupon,
    user,
  } = useApp();
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const navigate = useNavigate();

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError(null);
    setApplying(true);
    const res = await applyCartCoupon(couponInput.trim());
    setApplying(false);
    if (!res.ok) {
      setCouponError(res.error || 'Invalid coupon code.');
    } else {
      setCouponInput('');
    }
  }

  function handleCheckout() {
    setCartOpen(false);
    if (!user) {
      navigate('/auth?next=/checkout');
    } else {
      navigate('/checkout');
    }
  }

  return (
    <AnimatePresence>
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping cart">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col border-l border-slate-200 dark:border-slate-800 shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-slate-900 dark:text-white" />
                <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Shopping Cart ({cart.itemCount})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close shopping cart"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {cart.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="font-display font-semibold text-slate-900 dark:text-white">
                    Your cart is empty
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    Browse our studio hardware catalog to add items with live stock verification.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false);
                      navigate('/shop');
                    }}
                    className="mt-5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-600 cursor-pointer"
                  >
                    Explore Shop
                  </button>
                </div>
              ) : (
                cart.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantLabel || ''}`}
                    className="flex gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-none"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                      <ProductImage src={item.image} alt={item.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                          {item.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => void removeFromCart(item.productId)}
                          aria-label={`Remove ${item.name} from cart`}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.variantLabel && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.variantLabel}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg">
                          <button
                            type="button"
                            onClick={() => void updateCartQty(item.productId, item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-mono font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.stockQuantity}
                            onClick={() => void updateCartQty(item.productId, item.quantity + 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Totals & Coupon */}
            {cart.items.length > 0 && (
              <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-4">
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <label htmlFor="cart-coupon-input" className="sr-only">
                      Coupon code
                    </label>
                    <input
                      id="cart-coupon-input"
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Coupon code (e.g. WELCOME10)"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono uppercase rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={applying || !couponInput.trim()}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer disabled:opacity-50"
                  >
                    Apply
                  </button>
                </form>

                {couponError && <p className="text-xs text-rose-600 dark:text-rose-400">{couponError}</p>}
                {cart.couponCode && (
                  <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400">
                    <span>Coupon applied: <strong className="font-mono">{cart.couponCode}</strong></span>
                    <button
                      type="button"
                      onClick={() => void applyCartCoupon('')}
                      className="underline hover:text-emerald-900 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="space-y-1.5 text-sm tabular-nums">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(cart.subtotal)}</span>
                  </div>
                  {cart.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="font-mono">-{formatCurrency(cart.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Shipping</span>
                    <span className="font-mono">{cart.shipping === 0 ? 'Free' : formatCurrency(cart.shipping)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Estimated Tax (8%)</span>
                    <span className="font-mono">{formatCurrency(cart.tax)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white text-base">
                    <span>Payable Total</span>
                    <span className="font-mono">{formatCurrency(cart.total)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full py-3 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                >
                  {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
