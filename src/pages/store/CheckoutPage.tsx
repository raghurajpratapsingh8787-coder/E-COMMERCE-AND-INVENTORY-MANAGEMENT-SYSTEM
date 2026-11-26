import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, CreditCard, Lock, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ProductImage } from '../../components/store/ProductImage';
import { useApp } from '../../context/AppContext';
import { apiRequest, formatCurrency } from '../../lib/api';
import type { Order } from '../../types';

const checkoutFormSchema = z.object({
  customerName: z.string().trim().min(2, 'Full name is required'),
  phone: z.string().trim().min(6, 'Valid phone number is required'),
  email: z.string().trim().email('Valid email address is required'),
  address: z.string().trim().min(5, 'Street delivery address is required'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State / region is required'),
  postalCode: z.string().trim().min(3, 'Postal code is required'),
  country: z.string().trim().min(2, 'Country is required'),
  paymentMethod: z.enum(['cod', 'razorpay']),
  notes: z.string().max(500).optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export function CheckoutPage() {
  const { user, authLoading, cart, bootstrap, refreshCart, pushToast, applyCartCoupon } = useApp();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState('');
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const idempotencyKey = useMemo(
    () => `chk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const razorpayConfigured = Boolean(bootstrap?.razorpayConfigured);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      customerName: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
      paymentMethod: 'cod',
      notes: '',
    },
  });

  useEffect(() => {
    if (user) {
      setValue('customerName', user.name);
      setValue('email', user.email);
      if (user.phone) setValue('phone', user.phone);
    }
  }, [user, setValue]);

  const selectedMethod = watch('paymentMethod');

  if (authLoading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center text-sm text-slate-500">
        Loading checkout session...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Sign in to complete checkout
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your cart items will carry over automatically once you sign in or register.
        </p>
        <Link
          to="/auth?next=/checkout"
          className="inline-flex px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-sm font-semibold"
        >
          Sign In / Register
        </Link>
      </main>
    );
  }

  if (placedOrder) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Order {placedOrder.orderNumber} Confirmed
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Inventory has been reserved atomically and your shipment is being prepared.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Number</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{placedOrder.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method</span>
              <span className="uppercase font-medium text-slate-900 dark:text-white">
                {placedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payable Total</span>
              <span className="font-mono font-bold text-slate-950 dark:text-white">
                {formatCurrency(placedOrder.totalAmount)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              Track Order Status
            </button>
            <Link
              to="/shop"
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (cart.items.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Your cart is empty
        </h1>
        <Link to="/shop" className="inline-flex px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-sm font-semibold">
          Browse Shop
        </Link>
      </main>
    );
  }

  async function onSubmit(values: CheckoutFormValues) {
    setSubmitError(null);
    try {
      const res = await apiRequest<{ order: Order }>('/api/commerce/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          couponCode: cart.couponCode || undefined,
          idempotencyKey,
        }),
      });
      await refreshCart();
      setPlacedOrder(res.order);
      pushToast('success', 'Order placed', `Order ${res.order.orderNumber} confirmed.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed.';
      setSubmitError(msg);
      pushToast('error', 'Checkout failed', msg);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white tracking-tight mb-8">
        Secure Checkout
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-7 space-y-8" noValidate>
          {/* Shipping Information */}
          <section className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              1. Delivery Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="chk-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  id="chk-name"
                  {...register('customerName')}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.customerName && <p className="text-xs text-rose-600 mt-1">{errors.customerName.message}</p>}
              </div>

              <div>
                <label htmlFor="chk-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  id="chk-phone"
                  {...register('phone')}
                  placeholder="+1 (415) 555-0192"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="chk-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  id="chk-email"
                  type="email"
                  {...register('email')}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="chk-address" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Address
                </label>
                <input
                  id="chk-address"
                  {...register('address')}
                  placeholder="Street, suite or apartment"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.address && <p className="text-xs text-rose-600 mt-1">{errors.address.message}</p>}
              </div>

              <div>
                <label htmlFor="chk-city" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  City
                </label>
                <input
                  id="chk-city"
                  {...register('city')}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.city && <p className="text-xs text-rose-600 mt-1">{errors.city.message}</p>}
              </div>

              <div>
                <label htmlFor="chk-state" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  State / Province
                </label>
                <input
                  id="chk-state"
                  {...register('state')}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.state && <p className="text-xs text-rose-600 mt-1">{errors.state.message}</p>}
              </div>

              <div>
                <label htmlFor="chk-postal" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Postal Code
                </label>
                <input
                  id="chk-postal"
                  {...register('postalCode')}
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.postalCode && <p className="text-xs text-rose-600 mt-1">{errors.postalCode.message}</p>}
              </div>

              <div>
                <label htmlFor="chk-country" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Country
                </label>
                <input
                  id="chk-country"
                  {...register('country')}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {errors.country && <p className="text-xs text-rose-600 mt-1">{errors.country.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="chk-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Order Notes (Optional)
                </label>
                <textarea
                  id="chk-notes"
                  rows={2}
                  {...register('notes')}
                  placeholder="Delivery gate code, concierge instructions..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Payment Method */}
          <section className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              2. Payment Method
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-colors ${
                  selectedMethod === 'cod'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input type="radio" value="cod" {...register('paymentMethod')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Cash on Delivery</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pay upon delivery. Immediate stock reservation.
                  </p>
                </div>
              </label>

              <label
                className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                  !razorpayConfigured
                    ? 'opacity-65 cursor-not-allowed border-slate-200 dark:border-slate-800'
                    : selectedMethod === 'razorpay'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 cursor-pointer'
                      : 'border-slate-200 dark:border-slate-800 cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  value="razorpay"
                  disabled={!razorpayConfigured}
                  {...register('paymentMethod')}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>Razorpay Online</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {razorpayConfigured
                      ? 'HMAC-SHA256 verified test payment gateway.'
                      : 'Online payments not configured yet — add Razorpay keys in server env.'}
                  </p>
                </div>
              </label>
            </div>

            {!razorpayConfigured && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Online payments are currently unconfigured in environment variables. Cash on Delivery is fully enabled with server-side stock locking.
                </span>
              </div>
            )}
          </section>

          {submitError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{isSubmitting ? 'Validating stock & placing order...' : `Place Order · ${formatCurrency(cart.total)}`}</span>
          </button>
        </form>

        {/* Order Summary Sidebar */}
        <aside className="lg:col-span-5 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-5 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Order Summary ({cart.itemCount})
          </h2>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {cart.items.map((item) => (
              <div key={`${item.productId}-${item.variantLabel || ''}`} className="py-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                  <ProductImage src={item.image} alt={item.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Qty {item.quantity} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <label htmlFor="chk-coupon" className="sr-only">Coupon code</label>
            <input
              id="chk-coupon"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Coupon code (WELCOME10)"
              className="flex-1 px-3 py-2 text-xs font-mono uppercase rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            />
            <button
              type="button"
              onClick={async () => {
                setCouponErr(null);
                const r = await applyCartCoupon(couponInput.trim());
                if (!r.ok) setCouponErr(r.error || 'Invalid coupon');
                else setCouponInput('');
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer"
            >
              Apply
            </button>
          </div>
          {couponErr && <p className="text-xs text-rose-600">{couponErr}</p>}

          <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-sm tabular-nums">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(cart.subtotal)}</span>
            </div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Coupon ({cart.couponCode})</span>
                <span className="font-mono">-{formatCurrency(cart.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Shipping</span>
              <span className="font-mono">{cart.shipping === 0 ? 'Free' : formatCurrency(cart.shipping)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Tax (8%)</span>
              <span className="font-mono">{formatCurrency(cart.tax)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-slate-200 dark:border-slate-800 font-bold text-base text-slate-950 dark:text-white">
              <span>Server-Verified Total</span>
              <span className="font-mono">{formatCurrency(cart.total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
