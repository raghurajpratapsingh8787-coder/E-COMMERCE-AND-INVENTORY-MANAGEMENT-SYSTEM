import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../../components/store/ProductCard';
import { apiRequest } from '../../lib/api';
import type { Brand, Category, Product } from '../../types';

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [brand, setBrand] = useState(searchParams.get('brand') || 'all');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('inStock') === 'true');
  const [sort, setSort] = useState(searchParams.get('sort') || 'featured');
  const [page, setPage] = useState(1);

  const { data: meta } = useQuery({
    queryKey: ['catalog-meta'],
    queryFn: () => apiRequest<{ categories: Category[]; brands: Brand[] }>('/api/catalog/categories', {}, false),
  });

  const queryString = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(category !== 'all' ? { category } : {}),
    ...(brand !== 'all' ? { brand } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    ...(inStockOnly ? { inStock: 'true' } : {}),
    sort,
    page: String(page),
    limit: '12',
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['products', queryString],
    queryFn: () =>
      apiRequest<{
        products: Product[];
        pagination: { page: number; pages: number; total: number };
      }>(`/api/catalog/products?${queryString}`, {}, false),
  });

  function resetFilters() {
    setSearch('');
    setCategory('all');
    setBrand('all');
    setMaxPrice('');
    setInStockOnly(false);
    setSort('featured');
    setPage(1);
    setSearchParams({});
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
            Shop Catalog
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
            Showing {data?.products.length ?? 0} of {data?.pagination.total ?? 0} products with live warehouse stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <label htmlFor="shop-search" className="sr-only">
              Search products
            </label>
            <input
              id="shop-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, SKU, brand..."
              className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <label htmlFor="shop-sort" className="sr-only">
            Sort products
          </label>
          <select
            id="shop-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
        </div>

        <label htmlFor="filter-category" className="sr-only">Category</label>
        <select
          id="filter-category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
        >
          <option value="all">All Categories</option>
          {meta?.categories.map((c) => (
            <option key={c._id} value={c.slug}>{c.name}</option>
          ))}
        </select>

        <label htmlFor="filter-brand" className="sr-only">Brand</label>
        <select
          id="filter-brand"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
        >
          <option value="all">All Brands</option>
          {meta?.brands.map((b) => (
            <option key={b._id} value={b.slug}>{b.name}</option>
          ))}
        </select>

        <label htmlFor="filter-max-price" className="sr-only">Max price</label>
        <input
          id="filter-max-price"
          type="number"
          min={0}
          value={maxPrice}
          onChange={(e) => {
            setMaxPrice(e.target.value);
            setPage(1);
          }}
          placeholder="Max price ($)"
          className="w-32 px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
        />

        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              setInStockOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>In stock only</span>
        </label>

        {(search || category !== 'all' || brand !== 'all' || maxPrice || inStockOnly) && (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-96 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : data && data.products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <p className="font-display font-semibold text-slate-900 dark:text-white">
            No matching products found
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Try clearing one or more filters to view our full inventory.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: data.pagination.pages }).map((_, idx) => {
            const p = idx + 1;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                  page === p
                    ? 'bg-slate-900 dark:bg-blue-600 text-white'
                    : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
