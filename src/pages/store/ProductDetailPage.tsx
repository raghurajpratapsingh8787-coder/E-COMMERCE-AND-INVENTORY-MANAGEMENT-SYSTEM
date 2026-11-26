import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Heart, ShoppingBag, Star } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProductCard } from '../../components/store/ProductCard';
import { ProductImage } from '../../components/store/ProductImage';
import { useApp } from '../../context/AppContext';
import { apiRequest, formatCurrency } from '../../lib/api';
import type { Product, Review } from '../../types';

interface ProductDetailResponse {
  product: Product;
  reviews: Review[];
  related: Product[];
  canReview: boolean;
}

export function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToCart, wishlistIds, toggleWishlist, user, pushToast } = useApp();

  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);

  // Review form state
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product-detail', slug],
    queryFn: () => apiRequest<ProductDetailResponse>(`/api/catalog/products/${slug}`),
    enabled: Boolean(slug),
  });

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 aspect-[4/3] rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
          <div className="lg:col-span-5 h-96 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
        </div>
      </main>
    );
  }

  if (isError || !data?.product) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Product not found
        </h1>
        <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </Link>
      </main>
    );
  }

  const { product, reviews, related, canReview } = data;
  const isWishlisted = wishlistIds.includes(product._id);
  const outOfStock = product.stockQuantity <= 0;
  const firstVariant =
    product.variants.length > 0
      ? [product.variants[0].color, product.variants[0].size].filter(Boolean).join(' / ')
      : undefined;
  const effectiveVariant = selectedVariant ?? firstVariant;

  async function handleBuyNow() {
    const ok = await addToCart(product, qty, effectiveVariant);
    if (ok) {
      navigate(user ? '/checkout' : '/auth?next=/checkout');
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await apiRequest(`/api/catalog/products/${product._id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, title: reviewTitle, comment: reviewComment }),
      });
      setReviewTitle('');
      setReviewComment('');
      pushToast('success', 'Review published', 'Thank you for your verified product review.');
      await queryClient.invalidateQueries({ queryKey: ['product-detail', slug] });
    } catch (err) {
      pushToast('error', 'Review failed', err instanceof Error ? err.message : 'Unable to submit review');
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <Link to="/shop" className="hover:text-slate-900 dark:hover:text-white">Shop</Link>
        <span>/</span>
        <Link to={`/shop?category=${product.categorySlug}`} className="hover:text-slate-900 dark:hover:text-white">
          {product.categoryName}
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-slate-200 truncate">{product.name}</span>
      </nav>

      {/* Main PDP Split: Sticky Gallery Left + Contiguous Purchase Module Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-24">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <ProductImage src={product.images[activeImgIdx] || product.images[0]} alt={product.name} />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {product.images.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  aria-label={`View image ${idx + 1} of ${product.name}`}
                  className={`w-24 aspect-[4/3] rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                    activeImgIdx === idx
                      ? 'border-blue-600'
                      : 'border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100'
                  }`}
                >
                  <ProductImage src={img} alt={`${product.name} thumbnail ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contiguous Purchase Module */}
        <div className="lg:col-span-5 space-y-6 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{product.brandName} · <span className="font-mono">{product.sku}</span></span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                {product.averageRating > 0 ? `${product.averageRating.toFixed(1)} (${product.reviewCount})` : 'No reviews yet'}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 pt-1 tabular-nums">
              <span className="font-mono text-2xl font-bold text-slate-950 dark:text-white">
                {formatCurrency(product.effectivePrice)}
              </span>
              {product.discountPercent > 0 && (
                <>
                  <span className="font-mono text-base text-slate-400 line-through">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    Save {product.discountPercent}%
                  </span>
                </>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {product.description}
          </p>

          {/* Variants */}
          {product.variants.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Select Configuration
              </span>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const label = [v.color, v.size].filter(Boolean).join(' / ');
                  const active = effectiveVariant === label;
                  return (
                    <button
                      key={v._id}
                      type="button"
                      onClick={() => setSelectedVariant(label)}
                      className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Availability & Quantity */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-medium">
              {outOfStock ? (
                <span className="text-rose-600 dark:text-rose-400">Currently out of stock</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                  In stock · {product.stockQuantity} unit(s) ready to ship
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="pdp-qty" className="text-xs text-slate-500 dark:text-slate-400">
                Qty
              </label>
              <input
                id="pdp-qty"
                type="number"
                min={1}
                max={Math.max(1, product.stockQuantity)}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(product.stockQuantity || 1, Number(e.target.value) || 1)))}
                className="w-16 px-2.5 py-1.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Primary Actions */}
          <div className="space-y-2.5">
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => void addToCart(product, qty, effectiveVariant)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
              </button>

              <button
                type="button"
                onClick={() => void toggleWishlist(product._id)}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                className={`w-12 h-12 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Heart className="w-5 h-5" fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
            </div>

            <button
              type="button"
              disabled={outOfStock}
              onClick={() => void handleBuyNow()}
              className="w-full py-3 px-5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40"
            >
              Buy Now
            </button>
          </div>

          {/* Specifications */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Technical Specifications
            </h2>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {Object.entries(product.specifications).map(([k, v]) => (
                <div key={k} className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{v}</dd>
                </div>
              ))}
              <div className="py-2 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Weight</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">{product.weightKg} kg</dd>
              </div>
              <div className="py-2 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Dimensions</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                  {product.dimensionsCm.length} × {product.dimensionsCm.width} × {product.dimensionsCm.height} cm
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Verified Reviews Section */}
      <section className="pt-10 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-4">
          <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Customer Reviews ({reviews.length})
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Every review is verified against a delivered order record in our database to prevent duplicate or unverified submissions.
          </p>

          {canReview ? (
            <form
              onSubmit={handleSubmitReview}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-4"
            >
              <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                Write a Verified Review
              </h3>
              <div>
                <label htmlFor="review-rating" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rating
                </label>
                <select
                  id="review-rating"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} Stars</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="review-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Headline
                </label>
                <input
                  id="review-title"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="review-comment" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Your experience
                </label>
                <textarea
                  id="review-comment"
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              >
                {submittingReview ? 'Submitting...' : 'Publish Review'}
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user
                ? 'Complete and receive an order containing this product to unlock verified review submission.'
                : 'Sign in with an account that has a delivered purchase of this product to submit a review.'}
            </p>
          )}
        </div>

        <div className="lg:col-span-7 space-y-4">
          {reviews.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
              No verified reviews yet for this product.
            </div>
          ) : (
            reviews.map((rev) => (
              <article
                key={rev._id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{rev.userName}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified Purchase
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: rev.rating }).map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-amber-500" />
                  ))}
                </div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{rev.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{rev.comment}</p>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="pt-10 border-t border-slate-200 dark:border-slate-800 space-y-6">
          <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Related Hardware
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}
    </main>
  );
}
