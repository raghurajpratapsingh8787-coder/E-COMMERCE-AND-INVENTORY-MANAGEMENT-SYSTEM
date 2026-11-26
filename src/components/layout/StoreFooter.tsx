import { Mail } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiRequest } from '../../lib/api';

export function StoreFooter() {
  const { bootstrap, pushToast } = useApp();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ownerName = bootstrap?.ownerName || 'Raghuraj Pratap Singh';
  const ownerEmail = bootstrap?.ownerEmail || 'raghurajpratapsingh8787@gmail.com';

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest('/api/catalog/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setEmail('');
      pushToast('success', 'Subscribed', 'You will receive seasonal product drops and restock updates.');
    } catch (err) {
      pushToast('error', 'Subscription failed', err instanceof Error ? err.message : 'Enter a valid email.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Brand & Store Ownership */}
        <div className="md:col-span-5 space-y-4">
          <Link to="/" className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Veltrix Commerce
          </Link>
          <p className="text-sm leading-relaxed max-w-sm">
            Precision hardware, architectural workspace lighting, and reference audio backed by real-time
            warehouse inventory control.
          </p>
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-medium text-slate-800 dark:text-slate-200">
              Owned &amp; Operated by {ownerName}
            </p>
            <p>
              Contact:{' '}
              <a
                href={`mailto:${ownerEmail}`}
                className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
              >
                {ownerEmail}
              </a>
            </p>
          </div>
        </div>

        {/* Storefront Links */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Storefront</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop" className="hover:text-slate-950 dark:hover:text-white transition-colors">Shop All</Link></li>
            <li><Link to="/categories" className="hover:text-slate-950 dark:hover:text-white transition-colors">Categories</Link></li>
            <li><Link to="/deals" className="hover:text-slate-950 dark:hover:text-white transition-colors">Special Offers</Link></li>
            <li><Link to="/wishlist" className="hover:text-slate-950 dark:hover:text-white transition-colors">Wishlist</Link></li>
          </ul>
        </div>

        {/* Account & Operations */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Account</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/orders" className="hover:text-slate-950 dark:hover:text-white transition-colors">My Orders</Link></li>
            <li><Link to="/profile" className="hover:text-slate-950 dark:hover:text-white transition-colors">Profile</Link></li>
            <li><Link to="/auth" className="hover:text-slate-950 dark:hover:text-white transition-colors">Sign In</Link></li>
            <li><Link to="/admin" className="hover:text-slate-950 dark:hover:text-white transition-colors">Admin Portal</Link></li>
          </ul>
        </div>

        {/* Newsletter */}
        <div className="md:col-span-3 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Release Dispatch</h3>
          <p className="text-xs leading-relaxed">
            Receive restock alerts and private seasonal invitations.
          </p>
          <form onSubmit={handleSubscribe} className="flex gap-2">
            <label htmlFor="footer-newsletter" className="sr-only">
              Email address for newsletter
            </label>
            <input
              id="footer-newsletter"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={submitting}
              aria-label="Subscribe to newsletter"
              className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-500">
          <span>© {new Date().getFullYear()} Veltrix Commerce · {ownerName} ({ownerEmail})</span>
          <span>Free express shipping on orders over $250 · Cash on Delivery &amp; Verified Payments</span>
        </div>
      </div>
    </footer>
  );
}
