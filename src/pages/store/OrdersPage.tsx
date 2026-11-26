import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileText, Package, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductImage } from '../../components/store/ProductImage';
import { useApp } from '../../context/AppContext';
import { apiRequest, formatCurrency } from '../../lib/api';
import type { Order } from '../../types';

const TRACKING_STEPS = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

function getStepIndex(status: Order['status']): number {
  if (status === 'packed') return 2;
  const idx = TRACKING_STEPS.findIndex((s) => s.key === status);
  return idx;
}

export function OrdersPage() {
  const { user, authLoading, pushToast } = useApp();
  const queryClient = useQueryClient();
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: () => apiRequest<{ orders: Order[] }>('/api/commerce/orders'),
    enabled: Boolean(user),
  });

  async function cancelOrder(orderId: string) {
    setCancellingId(orderId);
    try {
      await apiRequest(`/api/commerce/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by customer before shipment' }),
      });
      pushToast('success', 'Order cancelled', 'Inventory has been restored automatically.');
      await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    } catch (err) {
      pushToast('error', 'Cancellation failed', err instanceof Error ? err.message : 'Unable to cancel');
    } finally {
      setCancellingId(null);
    }
  }

  if (authLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center text-sm text-slate-500">
        Loading your orders...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Sign in to track your orders
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          View real-time shipment timelines, download invoices, and manage eligible cancellations.
        </p>
        <Link
          to="/auth?next=/orders"
          className="inline-flex px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-sm font-semibold"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
          My Orders &amp; Delivery Tracking
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Live fulfillment history synced directly with our warehouse system.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : data && data.orders.length > 0 ? (
        <div className="space-y-6">
          {data.orders.map((order) => {
            const stepIdx = getStepIndex(order.status);
            const isCancelled = ['cancelled', 'returned', 'refunded'].includes(order.status);
            const canCancel = ['pending', 'confirmed', 'processing'].includes(order.status);

            return (
              <article
                key={order._id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
              >
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                    <div>
                      <span className="text-slate-500 block">Order Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {order.orderNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Placed</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status</span>
                      <span
                        className={`font-semibold capitalize ${
                          isCancelled
                            ? 'text-rose-600 dark:text-rose-400'
                            : order.status === 'delivered'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {order.status.replace(/_/g, ' ')} · {order.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInvoiceOrder(order)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Invoice</span>
                    </button>
                    {canCancel && (
                      <button
                        type="button"
                        disabled={cancellingId === order._id}
                        onClick={() => void cancelOrder(order._id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-50"
                      >
                        {cancellingId === order._id ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Visual Order Tracking Timeline */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                  {isCancelled ? (
                    <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                      Order {order.status} — Reserved stock has been restored to warehouse inventory.
                    </p>
                  ) : (
                    <ol className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                      {TRACKING_STEPS.map((step, idx) => {
                        const completed = idx <= stepIdx;
                        return (
                          <li key={step.key} className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 ${
                                completed
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              }`}
                            >
                              {completed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                            </span>
                            <span
                              className={`text-xs font-medium leading-tight ${
                                completed
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {step.label}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>

                {/* Items */}
                <div className="px-6 py-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {order.items.map((item) => (
                    <div key={item._id} className="py-3 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                        <ProductImage src={item.image} alt={item.productName} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {item.sku} · Qty {item.quantity} × {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3">
          <p className="font-display font-semibold text-slate-900 dark:text-white">No orders yet</p>
          <p className="text-sm text-slate-500">Orders you place will appear here with live shipment tracking.</p>
          <Link
            to="/shop"
            className="inline-flex px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white"
          >
            Start Shopping
          </Link>
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" role="dialog" aria-modal="true" aria-label="Order invoice">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                  Tax Invoice · {invoiceOrder.orderNumber}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Veltrix Commerce · Raghuraj Pratap Singh (raghurajpratapsingh8787@gmail.com)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceOrder(null)}
                aria-label="Close invoice"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs border-y border-slate-200 dark:border-slate-800 py-4">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white mb-1">Bill &amp; Ship To</p>
                <p>{invoiceOrder.shippingAddress.customerName}</p>
                <p>{invoiceOrder.shippingAddress.address}</p>
                <p>
                  {invoiceOrder.shippingAddress.city}, {invoiceOrder.shippingAddress.state}{' '}
                  {invoiceOrder.shippingAddress.postalCode}
                </p>
                <p>{invoiceOrder.shippingAddress.email}</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">Order Details</p>
                <p>Date: {new Date(invoiceOrder.createdAt).toLocaleDateString()}</p>
                <p>Method: {invoiceOrder.paymentMethod.toUpperCase()}</p>
                <p>Payment: {invoiceOrder.paymentStatus.toUpperCase()}</p>
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {invoiceOrder.items.map((i) => (
                  <tr key={i._id}>
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                      {i.productName} <span className="font-mono text-slate-400">({i.sku})</span>
                    </td>
                    <td className="py-2.5 text-right font-mono">{i.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(i.unitPrice)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto max-w-xs space-y-1.5 text-xs tabular-nums">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(invoiceOrder.subtotal)}</span></div>
              {invoiceOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Discount</span><span className="font-mono">-{formatCurrency(invoiceOrder.discount)}</span></div>
              )}
              <div className="flex justify-between"><span>Shipping</span><span className="font-mono">{formatCurrency(invoiceOrder.shippingFee)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span className="font-mono">{formatCurrency(invoiceOrder.tax)}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-950 dark:text-white">
                <span>Total</span><span className="font-mono">{formatCurrency(invoiceOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
