import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import React, { useState } from 'react';
import { ProductImage } from '../../components/store/ProductImage';
import { useApp } from '../../context/AppContext';
import { apiRequest, formatCurrency } from '../../lib/api';
import type { Brand, Category, Product } from '../../types';

const DEFAULT_IMG = '/src/assets/images/product_studio_headphones_1795710278477.jpg';

export function AdminProducts() {
  const { pushToast } = useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    brandId: '',
    price: 299,
    discountPrice: '',
    costPrice: 120,
    stockQuantity: 15,
    minStockLevel: 5,
    weightKg: 0.8,
    status: 'active' as Product['status'],
    images: [DEFAULT_IMG],
    featured: false,
  });

  const { data: meta } = useQuery({
    queryKey: ['admin-catalog-meta'],
    queryFn: () => apiRequest<{ categories: Category[]; brands: Brand[] }>('/api/catalog/categories'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', search],
    queryFn: () =>
      apiRequest<{ products: Product[] }>(
        `/api/catalog/products?includeAll=true&limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ),
  });

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      sku: `VTX-${Math.floor(1000 + Math.random() * 9000)}`,
      description: '',
      categoryId: meta?.categories[0]?._id || 'cat_audio',
      brandId: meta?.brands[0]?._id || 'brand_nordak',
      price: 299,
      discountPrice: '',
      costPrice: 120,
      stockQuantity: 12,
      minStockLevel: 5,
      weightKg: 0.8,
      status: 'active',
      images: [DEFAULT_IMG],
      featured: false,
    });
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      description: p.description,
      categoryId: p.categoryId,
      brandId: p.brandId,
      price: p.price,
      discountPrice: p.discountPrice ? String(p.discountPrice) : '',
      costPrice: p.costPrice,
      stockQuantity: p.stockQuantity,
      minStockLevel: p.minStockLevel,
      weightKg: p.weightKg,
      status: p.status,
      images: p.images.length > 0 ? p.images : [DEFAULT_IMG],
      featured: p.featured,
    });
    setModalOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiRequest<{ url: string }>('/api/catalog/uploads', {
        method: 'POST',
        body: fd,
      });
      setForm((prev) => ({ ...prev, images: [res.url, ...prev.images.filter((i) => i !== DEFAULT_IMG)] }));
      pushToast('success', 'Image uploaded', 'Verified image signature and stored securely.');
    } catch (err) {
      pushToast('error', 'Upload rejected', err instanceof Error ? err.message : 'Invalid image file.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        description: form.description,
        categoryId: form.categoryId,
        brandId: form.brandId,
        price: Number(form.price),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
        costPrice: Number(form.costPrice),
        stockQuantity: Number(form.stockQuantity),
        minStockLevel: Number(form.minStockLevel),
        weightKg: Number(form.weightKg),
        status: form.status,
        images: form.images,
        featured: form.featured,
      };

      if (editing) {
        await apiRequest(`/api/admin/products/${editing._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        pushToast('success', 'Product updated', `${form.name} saved.`);
      } else {
        await apiRequest('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('success', 'Product created', `${form.name} added to catalog & inventory.`);
      }

      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['storefront'] });
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : 'Check required fields.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Product) {
    try {
      await apiRequest(`/api/admin/products/${p._id}`, { method: 'DELETE' });
      pushToast('info', 'Product deleted', `${p.name} removed.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      pushToast('error', 'Delete failed', err instanceof Error ? err.message : 'Unable to delete');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Product Catalog
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create, edit, price, and upload verified photography for all SKUs.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <label htmlFor="admin-prod-search" className="sr-only">Search products</label>
        <input
          id="admin-prod-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product name or SKU..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
        />
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-left text-slate-500">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">Cost</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {isLoading ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading products...</td></tr>
              ) : (
                data?.products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                          <ProductImage src={p.images[0]} alt={p.name} />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white line-clamp-1">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{p.sku}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{p.categoryName}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{formatCurrency(p.effectivePrice)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{formatCurrency(p.costPrice)}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{p.stockQuantity}</td>
                    <td className="py-3 px-4 capitalize">{p.status.replace('_', ' ')}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.name}`}
                          className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(p)}
                          aria-label={`Delete ${p.name}`}
                          className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" role="dialog" aria-modal="true" aria-label={editing ? 'Edit product' : 'Create product'}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                {editing ? `Edit ${editing.name}` : 'Create New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close product modal"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-name" className="block text-xs font-medium mb-1">Product Name</label>
                  <input
                    id="prod-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="prod-sku" className="block text-xs font-medium mb-1">SKU</label>
                  <input
                    id="prod-sku"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="prod-cat" className="block text-xs font-medium mb-1">Category</label>
                  <select
                    id="prod-cat"
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {meta?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-brand" className="block text-xs font-medium mb-1">Brand</label>
                  <select
                    id="prod-brand"
                    value={form.brandId}
                    onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {meta?.brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-price" className="block text-xs font-medium mb-1">Retail Price ($)</label>
                  <input
                    id="prod-price"
                    type="number"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="prod-discount" className="block text-xs font-medium mb-1">Discount Price (Optional)</label>
                  <input
                    id="prod-discount"
                    type="number"
                    step="0.01"
                    value={form.discountPrice}
                    onChange={(e) => setForm({ ...form, discountPrice: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="prod-cost" className="block text-xs font-medium mb-1">Cost Price ($)</label>
                  <input
                    id="prod-cost"
                    type="number"
                    step="0.01"
                    required
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="prod-status" className="block text-xs font-medium mb-1">Status</label>
                  <select
                    id="prod-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Product['status'] })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="out_of_stock">Out of stock</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
                {!editing && (
                  <div>
                    <label htmlFor="prod-stock" className="block text-xs font-medium mb-1">Initial Stock Units</label>
                    <input
                      id="prod-stock"
                      type="number"
                      min={0}
                      required
                      value={form.stockQuantity}
                      onChange={(e) => setForm({ ...form, stockQuantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="prod-min-stock" className="block text-xs font-medium mb-1">Min Stock Alert Level</label>
                  <input
                    id="prod-min-stock"
                    type="number"
                    min={0}
                    required
                    value={form.minStockLevel}
                    onChange={(e) => setForm({ ...form, minStockLevel: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prod-desc" className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  id="prod-desc"
                  required
                  minLength={10}
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {/* Secure Image Upload */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800">
                    <ProductImage src={form.images[0]} alt="Preview" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900 dark:text-white">Product Photography</p>
                    <p className="text-slate-500">Magic-byte validated JPEG/PNG/WebP (max 5MB)</p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer hover:bg-slate-100">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
