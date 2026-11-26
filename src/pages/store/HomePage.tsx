import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck, Star, Tag, Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../../components/store/ProductCard';
import { ProductImage } from '../../components/store/ProductImage';
import { apiRequest } from '../../lib/api';
import type { Category, Product, Review } from '../../types';

interface StorefrontResponse {
  heroImage: string;
  featured: Product[];
  trending: Product[];
  bestSellers: Product[];
  newArrivals: Product[];
  deals: Product[];
  categories: Category[];
  reviews: Review[];
  coupons: Array<{ code: string; type: 'percentage' | 'fixed'; value: number; minOrderValue: number }>;
  store: {
    storeName: string;
    ownerName: string;
    ownerEmail: string;
    freeShippingThreshold: number;
  };
}

type CollectionTab = 'featured' | 'trending' | 'bestSellers' | 'newArrivals';

export function HomePage() {
  const [activeTab, setActiveTab] = useState<CollectionTab>('featured');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront'],
    queryFn: () => apiRequest<StorefrontResponse>('/api/catalog/storefront', {}, false),
  });

  const tabs: Array<{ key: CollectionTab; label: string }> = [
    { key: 'featured', label: 'Featured' },
    { key: 'trending', label: 'Trending' },
    { key: 'bestSellers', label: 'Best Sellers' },
    { key: 'newArrivals', label: 'New Arrivals' },
  ];

  const activeProducts = data ? data[activeTab] : [];

  return (
    <main className="bg-white dark:bg-slate-950">
      {/* Split Architectural Hero */}
      <section className="border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 flex flex-col justify-center space-y-6"
            >
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 tracking-wide">
                Autumn Studio Collection · Direct from Warehouse
              </p>
              <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight text-slate-950 dark:text-white leading-[1.08]">
                Precision tools for modern work and sound.
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
                Machined hardware, reference wireless acoustics, and full-grain carry essentials — backed by live
                stock verification and atomic order fulfillment.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Shop Collection</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/deals"
                  className="inline-flex items-center px-5 py-3 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
                >
                  View Seasonal Offers
                </Link>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Free express shipping over $250</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Verified stock &amp; COD available</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 aspect-[16/10] lg:aspect-auto lg:min-h-[420px]"
            >
              <ProductImage
                src={data?.heroImage || '/src/assets/images/hero_flagship_workspace_1795710279475.jpg'}
                alt="Veltrix flagship studio workspace featuring reference headphones, CNC keyboard, and brass desk lamp"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Curated Collection Grid with Interactive Segmented Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
              Curated Hardware Catalog
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Live pricing and real-time warehouse availability.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter curated products"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start sm:self-auto"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 h-96 animate-pulse"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-sm text-rose-700 dark:text-rose-300">
            Unable to load catalog products right now. Please refresh the page.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}

        <div className="flex justify-center pt-2">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <span>Browse All Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Popular Categories */}
      {data && data.categories.length > 0 && (
        <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                  Shop by Department
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Explore categories curated for durability and acoustic craft.
                </p>
              </div>
              <Link
                to="/categories"
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                All Categories
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {data.categories.map((cat) => (
                <Link
                  key={cat._id}
                  to={`/shop?category=${cat.slug}`}
                  className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800"
                >
                  <ProductImage
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent flex flex-col justify-end p-5">
                    <h3 className="font-display font-semibold text-white text-lg">{cat.name}</h3>
                    <p className="text-xs text-slate-200 mt-0.5 tabular-nums">
                      {cat.productCount ?? 0} product{(cat.productCount ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promotional Coupon Banner + Verified Customer Reviews */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        {data && data.coupons.length > 0 && (
          <div className="rounded-2xl bg-slate-900 dark:bg-indigo-950/60 border border-slate-800 text-white p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-300">
                <Tag className="w-3.5 h-3.5" />
                <span>Active Storefront Promotion</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                Save {data.coupons[0].type === 'percentage' ? `${data.coupons[0].value}%` : `$${data.coupons[0].value}`} on orders over ${data.coupons[0].minOrderValue}
              </h2>
              <p className="text-sm text-slate-300">
                Apply code <strong className="font-mono text-white">{data.coupons[0].code}</strong> at checkout.
                Validated automatically on the server with instant order total preview.
              </p>
            </div>
            <Link
              to="/deals"
              className="px-5 py-3 rounded-lg bg-white text-slate-950 hover:bg-blue-50 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              See All Offers
            </Link>
          </div>
        )}

        {data && data.reviews.length > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                Verified Buyer Reviews
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Reviews are unlocked exclusively for customers with completed, delivered purchases.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.reviews.slice(0, 3).map((review) => (
                <article
                  key={review._id}
                  className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: review.rating }).map((_, idx) => (
                        <Star key={idx} className="w-4 h-4 fill-amber-500" />
                      ))}
                    </div>
                    <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                      {review.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      “{review.comment}”
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{review.userName}</span>
                    {review.productSlug && (
                      <Link
                        to={`/product/${review.productSlug}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[160px]"
                      >
                        {review.productName}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
