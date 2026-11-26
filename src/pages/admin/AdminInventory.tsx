import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownUp, Download, X } from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { apiRequest, formatCurrency, sanitizeCsvCell } from '../../lib/api';

interface InventoryRow {
  productId: string;
  name: string;
  sku: string;
  categoryName: string;
  costPrice: number;
  price: number;
  stockQuantity: number;
  minStockLevel: number;
  warehouseLocation: string;
  inventoryValue: number;
  status: 'healthy' | 'low_stock' | 'out_of_stock';
  updatedAt: string;
}

interface StockMovementRow {
  _id: string;
  productName: string;
  sku: string;
  type: string;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  reason: string;
  performedByName?: string;
  createdAt: string;
}

interface InventoryResponse {
  summary: {
    totalUnits: number;
    totalCostValue: number;
    totalRetailValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    pendingPurchaseOrders: number;
  };
  items: InventoryRow[];
  movements: StockMovementRow[];
}

export function AdminInventory() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [tab, setTab] = useState<'levels' | 'movements'>('levels');
  const [adjType, setAdjType] = useState<'purchase' | 'sale' | 'return' | 'damage' | 'manual_adjustment'>('manual_adjustment');
  const [delta, setDelta] = useState(5);
  const [minThreshold, setMinThreshold] = useState(5);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => apiRequest<InventoryResponse>('/api/admin/inventory'),
  });

  function openAdjust(row: InventoryRow) {
    setSelected(row);
    setAdjType('manual_adjustment');
    setDelta(5);
    setMinThreshold(row.minStockLevel);
    setReason('Cycle count adjustment');
    setAdjError(null);
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAdjError(null);
    setSubmitting(true);

    // Damage & Sale reduce stock automatically if user entered a positive magnitude
    const signedDelta =
      (adjType === 'damage' || adjType === 'sale') && delta > 0 ? -Math.abs(delta) : Number(delta);

    try {
      await apiRequest(`/api/admin/inventory/${selected.productId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          type: adjType,
          quantityDelta: signedDelta,
          minStockLevel: Number(minThreshold),
          reason,
        }),
      });
      pushToast('success', 'Stock updated atomically', `${selected.sku} movement recorded.`);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    } catch (err) {
      setAdjError(err instanceof Error ? err.message : 'Stock adjustment rejected.');
    } finally {
      setSubmitting(false);
    }
  }

  function exportStockCsv() {
    if (!data) return;
    const rows = [
      ['SKU', 'Product', 'Category', 'Location', 'Stock Qty', 'Min Level', 'Unit Cost', 'Inventory Value', 'Status'],
      ...data.items.map((i) => [
        i.sku,
        i.name,
        i.categoryName,
        i.warehouseLocation,
        String(i.stockQuantity),
        String(i.minStockLevel),
        i.costPrice.toFixed(2),
        i.inventoryValue.toFixed(2),
        i.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => sanitizeCsvCell(v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veltrix-inventory-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Inventory &amp; Stock Control
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Atomic stock adjustments, negative-stock enforcement, low-stock alerts, and full movement ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={exportStockCsv}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Stock Report</span>
        </button>
      </div>

      {/* KPI Strip */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 tabular-nums">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Total Stock Units</p>
            <p className="font-mono text-2xl font-bold mt-1">{data.summary.totalUnits}</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Inventory Cost Value</p>
            <p className="font-mono text-2xl font-bold mt-1">{formatCurrency(data.summary.totalCostValue)}</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Low-Stock SKUs</p>
            <p className="font-mono text-2xl font-bold mt-1 text-amber-600">{data.summary.lowStockCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Out-of-Stock SKUs</p>
            <p className="font-mono text-2xl font-bold mt-1 text-rose-600">{data.summary.outOfStockCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Pending Purchase Orders</p>
            <p className="font-mono text-2xl font-bold mt-1 text-blue-600">{data.summary.pendingPurchaseOrders}</p>
          </div>
        </div>
      )}

      {/* Segmented View Switch */}
      <div className="inline-flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        <button
          type="button"
          onClick={() => setTab('levels')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'levels' ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Current Stock Levels
        </button>
        <button
          type="button"
          onClick={() => setTab('movements')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'movements' ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Stock Movement Ledger ({data?.movements.length ?? 0})
        </button>
      </div>

      {tab === 'levels' ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-left text-slate-500">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">SKU / Location</th>
                  <th className="py-3 px-4 text-right">On Hand</th>
                  <th className="py-3 px-4 text-right">Min Alert</th>
                  <th className="py-3 px-4 text-right">Cost Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {isLoading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading inventory...</td></tr>
                ) : (
                  data?.items.map((row) => (
                    <tr key={row.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{row.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {row.sku} · {row.warehouseLocation}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-sm">{row.stockQuantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">{row.minStockLevel}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(row.inventoryValue)}</td>
                      <td className="py-3 px-4 font-semibold">
                        {row.status === 'out_of_stock' ? (
                          <span className="text-rose-600 dark:text-rose-400">Out of stock</span>
                        ) : row.status === 'low_stock' ? (
                          <span className="text-amber-600 dark:text-amber-400">Low stock</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">Healthy</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openAdjust(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <ArrowDownUp className="w-3.5 h-3.5" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-left text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Product / SKU</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Delta</th>
                  <th className="py-3 px-4 text-right">Before → After</th>
                  <th className="py-3 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {data?.movements.map((m) => (
                  <tr key={m._id}>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{m.productName}</p>
                      <p className="font-mono text-slate-400">{m.sku}</p>
                    </td>
                    <td className="py-3 px-4 capitalize font-medium">{m.type.replace('_', ' ')}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        m.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {m.previousStock} → {m.newStock}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {m.reason} {m.referenceId ? `(${m.referenceId})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" role="dialog" aria-modal="true" aria-label={`Adjust stock for ${selected.name}`}>
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Adjust Stock · {selected.sku}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.name} (Current: <strong className="font-mono">{selected.stockQuantity}</strong> units)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close stock adjustment modal"
                className="p-1.5 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adjError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {adjError}
              </div>
            )}

            <form onSubmit={submitAdjustment} className="space-y-4">
              <div>
                <label htmlFor="adj-type" className="block text-xs font-medium mb-1">Movement Type</label>
                <select
                  id="adj-type"
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as typeof adjType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="purchase">Purchase / Restock (+)</option>
                  <option value="manual_adjustment">Manual Adjustment (+/-)</option>
                  <option value="return">Customer Return (+)</option>
                  <option value="damage">Damaged / Write-off (-)</option>
                  <option value="sale">Direct Sale (-)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adj-delta" className="block text-xs font-medium mb-1">Quantity Change</label>
                  <input
                    id="adj-delta"
                    type="number"
                    required
                    value={delta}
                    onChange={(e) => setDelta(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="adj-min" className="block text-xs font-medium mb-1">Min Alert Level</label>
                  <input
                    id="adj-min"
                    type="number"
                    min={0}
                    required
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="adj-reason" className="block text-xs font-medium mb-1">Audit Reason</label>
                <input
                  id="adj-reason"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Apply Atomic Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
