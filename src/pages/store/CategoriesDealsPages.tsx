import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Copy, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../../components/store/ProductCard';
import { ProductImage } from '../../components/store/ProductImage';
import { useApp } from '../../context/AppContext';
import { apiRequest } from '../../lib/api';
import type { Brand, Category, Product } from '../../types';

export function CategoriesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['categories-all'],
    queryFn: () =>
      apiRequest<{ categories: Category[]; brands: Brand[] }>('/api/catalog/categories', {}, false),
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
          Product Departments
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Browse every collection managed inside the Veltrix warehouse catalog.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data?.categories.map((cat) => (
            <Link
              key={cat._id}
              to={`/shop?category=${cat.slug}`}
              className="group grid grid-cols-1 sm:grid-cols-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500/60 transition-colors"
            >
              <div className="sm:col-span-2 aspect-[4/3] sm:aspect-auto bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <ProductImage
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="sm:col-span-3 p-6 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {cat.productCount ?? 0} active items
                  </span>
                  <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                    {cat.name}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  <span>Explore Department</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.brands.length > 0 && (
        <section className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-5">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Featured Partner Makers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.brands.map((brand) => (
              <Link
                key={brand._id}
                to={`/shop?brand=${brand.slug}`}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500/60 transition-colors space-y-1.5"
              >
                <h3 className="font-display font-semibold text-slate-900 dark:text-white">{brand.name}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">{brand.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export function DealsPage() {
  const { pushToast } = useApp();
  const { data, isLoading } = useQuery({
    queryKey: ['deals-storefront'],
    queryFn: () =>
      apiRequest<{
        deals: Product[];
        coupons: Array<{ code: string; type: 'percentage' | 'fixed'; value: number; minOrderValue: number; expiresAt: string }>;
      }>('/api/catalog/storefront', {}, false),
  });

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    pushToast('success', 'Coupon copied', `Paste ${code} in your cart or checkout.`);
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
          Seasonal Offers &amp; Active Coupons
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Direct markdown pricing and verified coupon codes checked automatically at checkout.
        </p>
      </div>

      {data && data.coupons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {data.coupons.map((coupon) => (
            <div
              key={coupon.code}
              className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Active Promotion</span>
                </div>
                <p className="font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {coupon.type === 'percentage' ? `${coupon.value}% Off` : `$${coupon.value} Off`}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  Min. order ${coupon.minOrderValue} · Valid until{' '}
                  {new Date(coupon.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <code className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {coupon.code}
                </code>
                <button
                  type="button"
                  onClick={() => copyCode(coupon.code)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Markdown Products
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-96 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.deals.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>
    </main>
  );
}
