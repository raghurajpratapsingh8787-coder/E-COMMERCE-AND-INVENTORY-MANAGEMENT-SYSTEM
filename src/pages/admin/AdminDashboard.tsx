import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest, formatCurrency, sanitizeCsvCell } from '../../lib/api';
import type { Order, Product } from '../../types';

interface AnalyticsPayload {
  range: string;
  kpis: {
    totalRevenue: number;
    rangedRevenue: number;
    totalOrders: number;
    totalProducts: number;
    totalCustomers: number;
    totalInventoryUnits: number;
    totalInventoryValue: number;
    totalRetailValue: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    pendingOrders: number;
    completedOrders: number;
    pendingPurchaseOrders: number;
  };
  salesTrend: Array<{ date: string; revenue: number; orders: number }>;
  categorySales: Array<{ name: string; revenue: number; units: number }>;
  bestSellingProducts: Array<{ productId: string; name: string; sku: string; unitsSold: number; revenue: number }>;
  paymentMethods: Array<{ method: string; count: number; amount: number }>;
  inventoryDistribution: Array<{ name: string; units: number; value: number }>;
  customerGrowth: Array<{ date: string; customers: number }>;
  recentOrders: Order[];
  lowStockItems: Product[];
}

const CHART_COLORS = ['#2563eb', '#4f46e5', '#0ea5e9', '#64748b'];

export function AdminDashboard() {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', range],
    queryFn: () => apiRequest<AnalyticsPayload>(`/api/admin/dashboard/analytics?range=${range}`),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Revenue', value: formatCurrency(data.kpis.totalRevenue), sub: `${formatCurrency(data.kpis.rangedRevenue)} in ${range}` },
    { label: 'Total Orders', value: String(data.kpis.totalOrders), sub: `${data.kpis.pendingOrders} active · ${data.kpis.completedOrders} delivered` },
    { label: 'Inventory Cost Value', value: formatCurrency(data.kpis.totalInventoryValue), sub: `${data.kpis.totalInventoryUnits} units across ${data.kpis.totalProducts} SKUs` },
    { label: 'Total Customers', value: String(data.kpis.totalCustomers), sub: 'Verified retail accounts' },
    { label: 'Low Stock Alerts', value: String(data.kpis.lowStockProducts), sub: 'Below minimum reorder level', warn: data.kpis.lowStockProducts > 0 },
    { label: 'Out of Stock', value: String(data.kpis.outOfStockProducts), sub: 'Requires replenishment', danger: data.kpis.outOfStockProducts > 0 },
    { label: 'Pending Orders', value: String(data.kpis.pendingOrders), sub: 'Awaiting fulfillment' },
    { label: 'Pending Purchase Orders', value: String(data.kpis.pendingPurchaseOrders), sub: 'Open supplier restocks' },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
            Operations Overview
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Real-time financial, order, and warehouse metrics computed from live database records.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          {(['7d', '30d', '90d', '1y'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer ${
                range === r
                  ? 'bg-slate-900 dark:bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: idx * 0.03 }}
            className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
            <p
              className={`font-mono text-2xl font-bold tabular-nums ${
                card.danger
                  ? 'text-rose-600 dark:text-rose-400'
                  : card.warn
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-950 dark:text-white'
              }`}
            >
              {card.value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Primary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-slate-950 dark:text-white">
              Revenue &amp; Order Trend ({range.toUpperCase()})
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {formatCurrency(data.kpis.rangedRevenue)}
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0))} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-display font-bold text-base text-slate-950 dark:text-white">
            Category Revenue
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categorySales} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0))} />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Recent Orders + Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-slate-950 dark:text-white">
              Recent Orders
            </h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Manage All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="py-2.5 pr-3">Order</th>
                  <th className="py-2.5 pr-3">Customer</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {data.recentOrders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 font-mono font-semibold">{ord.orderNumber}</td>
                    <td className="py-2.5 pr-3">{ord.shippingAddress.customerName}</td>
                    <td className="py-2.5 pr-3 capitalize">{ord.status.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(ord.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-slate-950 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Low-Stock Watchlist</span>
            </h2>
            <Link to="/admin/inventory" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Adjust Stock
            </Link>
          </div>

          {data.lowStockItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">All SKUs are above minimum safety stock thresholds.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.lowStockItems.map((item) => (
                <div key={item._id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                    <p className="font-mono text-slate-500">{item.sku}</p>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <p className={`font-mono font-bold ${item.stockQuantity === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {item.stockQuantity} left
                    </p>
                    <p className="text-slate-400">Min {item.minStockLevel}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('90d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-full', range],
    queryFn: () => apiRequest<AnalyticsPayload>(`/api/admin/dashboard/analytics?range=${range}`),
  });

  function downloadSalesCsv() {
    if (!data) return;
    const rows = [
      ['Product', 'SKU', 'Units Sold', 'Revenue USD'],
      ...data.bestSellingProducts.map((p) => [p.name, p.sku, String(p.unitsSold), p.revenue.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.map((v) => sanitizeCsvCell(v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veltrix-sales-report-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !data) {
    return <div className="h-96 rounded-xl bg-white dark:bg-slate-900 animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Sales, Inventory &amp; Customer Analytics
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Interactive business intelligence reports backed by live database aggregations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {(['7d', '30d', '90d', '1y'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md cursor-pointer ${
                  range === r ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={downloadSalesCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-600 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Sales CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-display font-bold text-base">Inventory Distribution (Cost Value)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.inventoryDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0))} />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-display font-bold text-base">Payment Methods Mix</h2>
          <div className="h-72 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.paymentMethods}
                  dataKey="amount"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={(entry) => `${String(entry.name ?? '')}`}
                >
                  {data.paymentMethods.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-display font-bold text-base">Customer Growth</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.customerGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip />
                <Area type="monotone" dataKey="customers" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-display font-bold text-base">Best-Selling Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Units</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {data.bestSellingProducts.map((p) => (
                  <tr key={p.productId}>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                      <p className="font-mono text-slate-400">{p.sku}</p>
                    </td>
                    <td className="py-2.5 text-right font-mono">{p.unitsSold}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
