import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { apiRequest, formatCurrency } from '../../lib/api';
import type {
  AuditLog,
  Brand,
  Category,
  Coupon,
  NotificationItem,
  Order,
  Product,
  PurchaseOrder,
  Review,
  Supplier,
} from '../../types';

// ================= ORDERS =================

export function AdminOrdersPage() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => apiRequest<{ orders: Order[] }>('/api/admin/orders'),
  });

  async function updateStatus(orderId: string, status: Order['status']) {
    setUpdatingId(orderId);
    try {
      await apiRequest(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      pushToast('success', 'Order updated', `Status changed to ${status.replace(/_/g, ' ')}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    } catch (err) {
      pushToast('error', 'Update failed', err instanceof Error ? err.message : 'Unable to update order');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">Order Fulfillment</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Advance shipment statuses, trigger real-time customer notifications, and restore stock on cancellations.
        </p>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-left text-slate-500">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Workflow Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {isLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading orders...</td></tr>
              ) : (
                data?.orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-slate-900 dark:text-white">{ord.orderNumber}</p>
                      <p className="text-slate-400">{new Date(ord.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{ord.shippingAddress.customerName}</p>
                      <p className="text-slate-500">{ord.shippingAddress.city}, {ord.shippingAddress.state}</p>
                    </td>
                    <td className="py-3 px-4">{ord.items.length} line item(s)</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{formatCurrency(ord.totalAmount)}</td>
                    <td className="py-3 px-4 uppercase font-mono">
                      {ord.paymentMethod} · {ord.paymentStatus}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Status for order ${ord.orderNumber}`}
                        disabled={updatingId === ord._id}
                        value={ord.status}
                        onChange={(e) => void updateStatus(ord._id, e.target.value as Order['status'])}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        {[
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
                        ].map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================= CATEGORIES & BRANDS =================

export function AdminCategoriesPage() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [brandName, setBrandName] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-cats-brands'],
    queryFn: () => apiRequest<{ categories: Category[]; brands: Brand[] }>('/api/catalog/categories'),
  });

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      setCatName('');
      setCatDesc('');
      pushToast('success', 'Category created');
      await queryClient.invalidateQueries({ queryKey: ['admin-cats-brands'] });
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : 'Unable to create');
    }
  }

  async function deleteCategory(id: string) {
    try {
      await apiRequest(`/api/admin/categories/${id}`, { method: 'DELETE' });
      pushToast('info', 'Category deleted');
      await queryClient.invalidateQueries({ queryKey: ['admin-cats-brands'] });
    } catch (err) {
      pushToast('error', 'Cannot delete', err instanceof Error ? err.message : 'Category in use');
    }
  }

  async function addBrand(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/brands', {
        method: 'POST',
        body: JSON.stringify({ name: brandName }),
      });
      setBrandName('');
      pushToast('success', 'Brand added');
      await queryClient.invalidateQueries({ queryKey: ['admin-cats-brands'] });
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : 'Unable to add brand');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <h1 className="font-display text-xl font-bold">Categories</h1>
        <form onSubmit={addCategory} className="space-y-3">
          <input
            required
            placeholder="Category name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            placeholder="Short description"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>
        </form>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {data?.categories.map((c) => (
            <div key={c._id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                <p className="text-slate-500">{c.productCount ?? 0} product(s) · {c.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => void deleteCategory(c._id)}
                aria-label={`Delete category ${c.name}`}
                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <h2 className="font-display text-xl font-bold">Brands</h2>
        <form onSubmit={addBrand} className="flex gap-2">
          <input
            required
            placeholder="New brand name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white cursor-pointer">
            Add
          </button>
        </form>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {data?.brands.map((b) => (
            <div key={b._id} className="py-3 flex justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">{b.name}</span>
              <span className="font-mono text-slate-500">{b.slug}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ================= CUSTOMERS & STORE MANAGERS =================

export function AdminCustomersPage() {
  const { user, pushToast } = useApp();
  const queryClient = useQueryClient();
  const [mgr, setMgr] = useState({ name: '', email: '', password: '', phone: '' });

  const { data } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: () =>
      apiRequest<{
        users: Array<{
          id: string;
          name: string;
          email: string;
          role: string;
          isActive: boolean;
          totalOrders: number;
          totalSpent: number;
          createdAt: string;
        }>;
      }>('/api/admin/customers'),
  });

  async function toggleStatus(id: string, isActive: boolean) {
    try {
      await apiRequest(`/api/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      pushToast('success', 'Account status updated');
      await queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    } catch (err) {
      pushToast('error', 'Error', err instanceof Error ? err.message : 'Action rejected');
    }
  }

  async function createManager(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/managers', {
        method: 'POST',
        body: JSON.stringify(mgr),
      });
      setMgr({ name: '', email: '', password: '', phone: '' });
      pushToast('success', 'Store Manager created', 'Account is ready for login.');
      await queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : 'Unable to create manager');
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Customers &amp; Team Access
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Review customer order totals, manage account status, and provision Store Manager accounts.
        </p>
      </div>

      {user?.role === 'super_admin' && (
        <form
          onSubmit={createManager}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>Provision Store Manager Account (Super Admin Only)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input required placeholder="Full Name" value={mgr.name} onChange={(e) => setMgr({ ...mgr, name: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
            <input required type="email" placeholder="Manager Email" value={mgr.email} onChange={(e) => setMgr({ ...mgr, email: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
            <input required type="password" minLength={8} placeholder="Password (8+ chars)" value={mgr.password} onChange={(e) => setMgr({ ...mgr, password: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
            <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
              Create Store Manager
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-left text-slate-500">
                <th className="py-3 px-4">Name / Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Orders</th>
                <th className="py-3 px-4 text-right">Lifetime Spend</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {data?.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                    <p className="font-mono text-slate-500">{u.email}</p>
                  </td>
                  <td className="py-3 px-4 capitalize font-medium">{u.role.replace('_', ' ')}</td>
                  <td className="py-3 px-4 text-right font-mono">{u.totalOrders}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold">{formatCurrency(u.totalSpent)}</td>
                  <td className="py-3 px-4">
                    <span className={u.isActive ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.role !== 'super_admin' && (
                      <button
                        type="button"
                        onClick={() => void toggleStatus(u.id, !u.isActive)}
                        className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================= SUPPLIERS =================

export function AdminSuppliersPage() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', address: '', contactPerson: '' });

  const { data } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: () => apiRequest<{ suppliers: Supplier[] }>('/api/admin/suppliers'),
  });

  async function createSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/suppliers', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', company: '', email: '', phone: '', address: '', contactPerson: '' });
      pushToast('success', 'Supplier added');
      await queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : 'Check fields');
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Supplier Directory</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage manufacturing partners linked to warehouse purchase orders.
        </p>
      </div>

      <form onSubmit={createSupplier} className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input required placeholder="Supplier Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        <input required placeholder="Company Legal Name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        <input required placeholder="Contact Person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        <input required placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white cursor-pointer">
          Add Supplier
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.suppliers.map((s) => (
          <div key={s._id} className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">{s.company}</h2>
              <span className="text-emerald-600 font-semibold capitalize">{s.status}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">Contact: {s.contactPerson} · {s.phone}</p>
            <p className="font-mono text-slate-500">{s.email}</p>
            {s.address && <p className="text-slate-500">{s.address}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= PURCHASE ORDERS & ATOMIC RECEIVING =================

export function AdminPurchasesPage() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState('sup_1');
  const [productId, setProductId] = useState('prod_watch');
  const [qty, setQty] = useState(10);
  const [unitCost, setUnitCost] = useState(250);

  const { data: poData } = useQuery({
    queryKey: ['admin-pos'],
    queryFn: () => apiRequest<{ purchaseOrders: PurchaseOrder[] }>('/api/admin/purchase-orders'),
  });
  const { data: supData } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: () => apiRequest<{ suppliers: Supplier[] }>('/api/admin/suppliers'),
  });
  const { data: prodData } = useQuery({
    queryKey: ['admin-po-products'],
    queryFn: () => apiRequest<{ products: Product[] }>('/api/catalog/products?includeAll=true&limit=50'),
  });

  async function createPo(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          expectedDeliveryDate: new Date(Date.now() + 7 * 86400_000).toISOString(),
          notes: 'Warehouse stock replenishment',
          items: [{ productId, quantityOrdered: Number(qty), unitCost: Number(unitCost) }],
        }),
      });
      pushToast('success', 'Purchase order created');
      await queryClient.invalidateQueries({ queryKey: ['admin-pos'] });
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : 'Error creating PO');
    }
  }

  async function receiveAllRemaining(po: PurchaseOrder) {
    const itemsToReceive = po.items
      .filter((i) => i.quantityOrdered > i.quantityReceived)
      .map((i) => ({ itemId: i._id, receiveQty: i.quantityOrdered - i.quantityReceived }));
    if (itemsToReceive.length === 0) return;

    try {
      await apiRequest(`/api/admin/purchase-orders/${po._id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ items: itemsToReceive }),
      });
      pushToast('success', 'Stock received atomically', `${po.poNumber} added to warehouse inventory.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-pos'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
    } catch (err) {
      pushToast('error', 'Receive blocked', err instanceof Error ? err.message : 'Unable to receive');
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Purchase Orders &amp; Stock Receiving</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create supplier POs and atomically receive stock with double-receiving prevention.
        </p>
      </div>

      <form onSubmit={createPo} className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <div>
          <label htmlFor="po-sup" className="block text-xs font-medium mb-1">Supplier</label>
          <select id="po-sup" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            {supData?.suppliers.map((s) => <option key={s._id} value={s._id}>{s.company}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="po-prod" className="block text-xs font-medium mb-1">Product</label>
          <select id="po-prod" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            {prodData?.products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="po-qty" className="block text-xs font-medium mb-1">Order Qty</label>
          <input id="po-qty" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
        <div>
          <label htmlFor="po-cost" className="block text-xs font-medium mb-1">Unit Cost ($)</label>
          <input id="po-cost" type="number" min={1} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
          Create PO
        </button>
      </form>

      <div className="space-y-4">
        {poData?.purchaseOrders.map((po) => (
          <div key={po._id} className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-mono font-bold text-sm text-slate-950 dark:text-white">
                  {po.poNumber} · {po.supplierName}
                </h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  Total Cost: {formatCurrency(po.totalCost)} · Status: <strong className="capitalize">{po.status.replace('_', ' ')}</strong>
                </p>
              </div>
              {po.status !== 'received' && po.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => void receiveAllRemaining(po)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Receive Remaining Stock</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs tabular-nums">
              {po.items.map((item) => (
                <div key={item._id} className="py-2 flex justify-between">
                  <span>{item.productName} <span className="font-mono text-slate-400">({item.sku})</span></span>
                  <span className="font-mono">
                    Received {item.quantityReceived} / {item.quantityOrdered} @ {formatCurrency(item.unitCost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= PAYMENTS =================

export function AdminPaymentsPage() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () =>
      apiRequest<{
        payments: Array<{
          _id: string;
          orderId: string;
          orderNumber: string;
          method: string;
          status: string;
          amount: number;
          providerPaymentId?: string;
          createdAt: string;
        }>;
        razorpayConfigured: boolean;
      }>('/api/admin/payments'),
  });

  async function markPayment(orderId: string, status: 'paid' | 'refunded') {
    try {
      await apiRequest('/api/admin/payments/manual', {
        method: 'POST',
        body: JSON.stringify({ orderId, status, note: `Admin marked ${status}` }),
      });
      pushToast('success', 'Payment updated');
      await queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : 'Unable to update');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Payments &amp; Reconciliation</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Gateway Status: {data?.razorpayConfigured ? 'Razorpay Live/Test Active' : 'Cash on Delivery & Manual Active (Razorpay keys unset)'}
        </p>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-left text-slate-500">
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {data?.payments.map((p) => (
                <tr key={p._id}>
                  <td className="py-3 px-4 font-mono font-semibold">{p.orderNumber}</td>
                  <td className="py-3 px-4 uppercase">{p.method}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold">{formatCurrency(p.amount)}</td>
                  <td className="py-3 px-4 capitalize font-semibold">{p.status}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {p.status !== 'paid' && (
                      <button
                        type="button"
                        onClick={() => void markPayment(p.orderId, 'paid')}
                        className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        Mark Paid
                      </button>
                    )}
                    {p.status === 'paid' && (
                      <button
                        type="button"
                        onClick={() => void markPayment(p.orderId, 'refunded')}
                        className="px-2.5 py-1 rounded-md border border-rose-300 text-rose-600 font-semibold cursor-pointer"
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================= COUPONS =================

export function AdminCouponsPage() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 15,
    minOrderValue: 100,
    usageLimit: 100,
    expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  });

  const { data } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => apiRequest<{ coupons: Coupon[] }>('/api/admin/coupons'),
  });

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          value: Number(form.value),
          minOrderValue: Number(form.minOrderValue),
          usageLimit: Number(form.usageLimit),
          expiresAt: new Date(form.expiresAt).toISOString(),
        }),
      });
      setForm({ ...form, code: '' });
      pushToast('success', 'Coupon created');
      await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : 'Unable to create coupon');
    }
  }

  async function toggleCoupon(id: string, isActive: boolean) {
    await apiRequest(`/api/admin/coupons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Coupon Campaigns</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Server-validated percentage and fixed discounts with usage caps and expiration enforcement.
        </p>
      </div>

      <form onSubmit={createCoupon} className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div>
          <label htmlFor="cp-code" className="block text-xs mb-1">Code</label>
          <input id="cp-code" required placeholder="AUTUMN20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
        <div>
          <label htmlFor="cp-type" className="block text-xs mb-1">Type</label>
          <select id="cp-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'percentage' | 'fixed' })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed ($)</option>
          </select>
        </div>
        <div>
          <label htmlFor="cp-val" className="block text-xs mb-1">Value</label>
          <input id="cp-val" type="number" min={1} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
        <div>
          <label htmlFor="cp-min" className="block text-xs mb-1">Min Order ($)</label>
          <input id="cp-min" type="number" min={0} value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })} className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
        <div>
          <label htmlFor="cp-exp" className="block text-xs mb-1">Expires</label>
          <input id="cp-exp" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white cursor-pointer">
          Create Coupon
        </button>
      </form>

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-left text-slate-500">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Discount</th>
              <th className="py-3 px-4 text-right">Usage</th>
              <th className="py-3 px-4">Expires</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
            {data?.coupons.map((c) => (
              <tr key={c._id}>
                <td className="py-3 px-4 font-mono font-bold">{c.code}</td>
                <td className="py-3 px-4">
                  {c.type === 'percentage' ? `${c.value}%` : formatCurrency(c.value)} (min {formatCurrency(c.minOrderValue)})
                </td>
                <td className="py-3 px-4 text-right font-mono">{c.usedCount} / {c.usageLimit}</td>
                <td className="py-3 px-4 font-mono">{new Date(c.expiresAt).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => void toggleCoupon(c._id, !c.isActive)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      c.isActive ? 'text-emerald-700 border border-emerald-300' : 'text-slate-500 border border-slate-300'
                    }`}
                  >
                    {c.isActive ? 'Active (Disable)' : 'Disabled (Enable)'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= NOTIFICATIONS, REVIEWS & AUDIT LOGS =================

export function AdminNotificationsPage() {
  const { user } = useApp();
  const queryClient = useQueryClient();

  const { data: notifData } = useQuery({
    queryKey: ['admin-notifs'],
    queryFn: () => apiRequest<{ notifications: NotificationItem[] }>('/api/admin/notifications'),
  });
  const { data: reviewData } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: () => apiRequest<{ reviews: Review[] }>('/api/admin/reviews'),
  });
  const { data: auditData } = useQuery({
    queryKey: ['admin-audits'],
    queryFn: () => apiRequest<{ auditLogs: AuditLog[] }>('/api/admin/audit-logs'),
    enabled: user?.role === 'super_admin',
  });

  async function markRead(id: string) {
    await apiRequest(`/api/admin/notifications/${id}/read`, { method: 'PATCH' });
    await queryClient.invalidateQueries({ queryKey: ['admin-notifs'] });
  }

  async function toggleReview(id: string, isApproved: boolean) {
    await apiRequest(`/api/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ isApproved }) });
    await queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold">Notifications, Moderation &amp; Audit Trail</h1>

      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="font-display font-bold text-base">System &amp; Low-Stock Alerts</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {notifData?.notifications.map((n) => (
            <div key={n._id} className="py-3 flex items-start justify-between gap-4 text-xs">
              <div>
                <p className={`font-semibold ${n.isRead ? 'text-slate-500' : 'text-slate-950 dark:text-white'}`}>
                  {n.title}
                </p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">{n.message}</p>
              </div>
              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => void markRead(n._id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark Read</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="font-display font-bold text-base">Verified Review Moderation</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {reviewData?.reviews.map((r) => (
            <div key={r._id} className="py-3 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {r.title} · {r.rating}/5 ({r.productName})
                </p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">{r.comment} — {r.userName}</p>
              </div>
              <button
                type="button"
                onClick={() => void toggleReview(r._id, !r.isApproved)}
                className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 shrink-0 cursor-pointer"
              >
                {r.isApproved ? 'Hide' : 'Approve'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {user?.role === 'super_admin' && auditData && (
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Immutable Security Audit Log</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {auditData.auditLogs.slice(0, 25).map((log) => (
                  <tr key={log._id}>
                    <td className="py-2 pr-3 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{log.actorEmail} ({log.actorRole})</td>
                    <td className="py-2 pr-3 font-semibold text-blue-600 dark:text-blue-400">{log.action}</td>
                    <td className="py-2">{log.entityType}:{log.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ================= SETTINGS =================

export function AdminSettingsPage() {
  const { user, pushToast } = useApp();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiRequest<{
        settings: {
          storeName: string;
          ownerName: string;
          ownerEmail: string;
          supportPhone: string;
          freeShippingThreshold: number;
          standardShippingFee: number;
          taxRate: number;
          lowStockDefaultThreshold: number;
        };
        integrations: {
          mongodb: boolean;
          razorpay: boolean;
          cloudinary: boolean;
          smtp: boolean;
          redis: boolean;
        };
      }>('/api/admin/settings'),
  });

  const [saving, setSaving] = useState(false);

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          storeName: String(fd.get('storeName')),
          ownerName: String(fd.get('ownerName')),
          ownerEmail: String(fd.get('ownerEmail')),
          supportPhone: String(fd.get('supportPhone')),
          freeShippingThreshold: Number(fd.get('freeShippingThreshold')),
          standardShippingFee: Number(fd.get('standardShippingFee')),
          lowStockDefaultThreshold: Number(fd.get('lowStockDefaultThreshold')),
        }),
      });
      pushToast('success', 'Store settings saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : 'Super Admin required');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <div className="h-64 rounded-xl bg-white dark:bg-slate-900 animate-pulse" />;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Store Configuration</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Store ownership, shipping rules, and server integration posture.
        </p>
      </div>

      <form onSubmit={saveSettings} className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-store" className="block text-xs font-medium mb-1">Store Name</label>
            <input id="set-store" name="storeName" defaultValue={data.settings.storeName} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label htmlFor="set-owner" className="block text-xs font-medium mb-1">Owner Name</label>
            <input id="set-owner" name="ownerName" defaultValue={data.settings.ownerName} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label htmlFor="set-email" className="block text-xs font-medium mb-1">Owner / Contact Email</label>
            <input id="set-email" name="ownerEmail" type="email" defaultValue={data.settings.ownerEmail} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label htmlFor="set-phone" className="block text-xs font-medium mb-1">Support Phone</label>
            <input id="set-phone" name="supportPhone" defaultValue={data.settings.supportPhone} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label htmlFor="set-free" className="block text-xs font-medium mb-1">Free Shipping Threshold ($)</label>
            <input id="set-free" name="freeShippingThreshold" type="number" defaultValue={data.settings.freeShippingThreshold} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label htmlFor="set-fee" className="block text-xs font-medium mb-1">Standard Shipping Fee ($)</label>
            <input id="set-fee" name="standardShippingFee" type="number" defaultValue={data.settings.standardShippingFee} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label htmlFor="set-low" className="block text-xs font-medium mb-1">Default Low-Stock Alert Level</label>
            <input id="set-low" name="lowStockDefaultThreshold" type="number" defaultValue={data.settings.lowStockDefaultThreshold} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
          </div>
        </div>

        {user?.role === 'super_admin' && (
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        )}
      </form>

      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
        <h2 className="font-display font-bold text-base">Server Integrations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>MongoDB Atlas: <strong>{data.integrations.mongodb ? 'Connected' : 'Local Atomic Store Active'}</strong></div>
          <div>Razorpay Gateway: <strong>{data.integrations.razorpay ? 'Configured' : 'Unconfigured (COD Active)'}</strong></div>
          <div>Cloudinary Storage: <strong>{data.integrations.cloudinary ? 'Configured' : 'Confined Local Uploads Active'}</strong></div>
          <div>SMTP Mailer: <strong>{data.integrations.smtp ? 'Configured' : 'Preview Token Mode'}</strong></div>
        </div>
      </section>
    </div>
  );
}
