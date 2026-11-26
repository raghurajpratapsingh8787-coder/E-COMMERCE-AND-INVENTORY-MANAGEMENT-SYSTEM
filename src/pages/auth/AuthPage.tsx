import { KeyRound, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiRequest } from '../../lib/api';
import type { User } from '../../types';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthPage() {
  const { bootstrap, setSession, pushToast } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nextPath = searchParams.get('next') || '';

  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login / Register state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // First-run Super Admin setup state
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [claimingAdmin, setClaimingAdmin] = useState(false);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ user: User; accessToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setSession(res.user, res.accessToken);
      pushToast('success', `Welcome back, ${res.user.name}`);
      if (nextPath) {
        navigate(nextPath);
      } else if (res.user.role === 'super_admin' || res.user.role === 'store_manager') {
        navigate('/admin');
      } else {
        navigate('/profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ user: User; accessToken: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone }),
      });
      await setSession(res.user, res.accessToken);
      pushToast('success', 'Account created', `Welcome to Veltrix Commerce, ${res.user.name}.`);
      navigate(nextPath || '/shop');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (adminPassword.length < 8) {
      setError('Admin password must be at least 8 characters.');
      return;
    }
    if (adminPassword !== adminConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setClaimingAdmin(true);
    try {
      const res = await apiRequest<{ user: User; accessToken: string }>('/api/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({ password: adminPassword }),
      });
      await setSession(res.user, res.accessToken);
      pushToast('success', 'Super Admin access claimed', 'Signed in to the Veltrix Admin Console.');
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim admin access.');
    } finally {
      setClaimingAdmin(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const res = await apiRequest<{ message: string }>(
        '/api/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email: resetEmail }) }
      );
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initiate reset.');
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      setInfo(res.message);
      setMode('login');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Main Customer / Staff Auth Card */}
      <section className="lg:col-span-7 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Customer Account' : 'Reset Password'}
          </h1>

          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-md cursor-pointer ${
                mode === 'login' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-md cursor-pointer ${
                mode === 'register' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        {info && (
          <div className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200">
            {info}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Forgot your password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                id="reg-name"
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone (Optional)
                </label>
                <input
                  id="reg-phone"
                  name="phone"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password (min. 8 characters)
              </label>
              <input
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Customer Account'}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <div className="space-y-6">
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <label htmlFor="rst-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                1. Request single-use reset token
              </label>
              <div className="flex gap-2">
                <input
                  id="rst-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Account email"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white cursor-pointer"
                >
                  Generate Token
                </button>
              </div>
            </form>

            <form onSubmit={handleResetPassword} className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                2. Apply token and set a new password
              </p>
              <input
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Reset token"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg text-xs font-semibold bg-blue-600 text-white cursor-pointer"
              >
                Update Password
              </button>
            </form>
          </div>
        )}
      </section>

      {/* First-Run Super Admin Claim Panel (or Role Access Guide once claimed) */}
      <aside className="lg:col-span-5 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-5">
        {bootstrap && !bootstrap.adminClaimed ? (
          <>
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  First-Run Super Admin Setup
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Claim ownership of the store Admin Console for{' '}
                  <strong className="text-slate-900 dark:text-white">{bootstrap.ownerName}</strong> (
                  <span className="font-mono">{bootstrap.ownerEmail}</span>). This setup locks permanently once
                  claimed.
                </p>
              </div>
            </div>

            <form onSubmit={handleClaimAdmin} className="space-y-3">
              <div>
                <label htmlFor="admin-claim-pw" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Choose Super Admin Password
                </label>
                <input
                  id="admin-claim-pw"
                  type="password"
                  required
                  minLength={8}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="admin-claim-confirm" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  id="admin-claim-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={adminConfirm}
                  onChange={(e) => setAdminConfirm(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={claimingAdmin}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {claimingAdmin ? 'Securing Super Admin...' : 'Claim Super Admin & Enter Dashboard'}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Role-Based Access Control
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Veltrix Commerce enforces server-side JWT verification with rotating HttpOnly refresh cookies across three roles:
                </p>
              </div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <li>
                <strong className="text-slate-900 dark:text-white">Super Admin</strong> ({bootstrap?.ownerEmail || 'raghurajpratapsingh8787@gmail.com'}) — Full system, manager provisioning, audit logs, and store settings.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Store Manager</strong> — Provisioned by Super Admin to manage products, inventory, orders, and suppliers.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Customer</strong> — Register above to shop, persist carts &amp; wishlists, place orders, and submit verified reviews.
              </li>
            </ul>
          </div>
        )}
      </aside>
    </main>
  );
}
