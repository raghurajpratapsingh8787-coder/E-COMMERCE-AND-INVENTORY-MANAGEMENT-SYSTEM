import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, MapPin, Plus, ShieldCheck, Trash2, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiRequest } from '../../lib/api';
import type { Address, User } from '../../types';

interface MeResponse {
  user: User;
  addresses: Address[];
}

export function ProfilePage() {
  const { user, logout, refreshAuth, pushToast } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['profile-me', user?.id],
    queryFn: () => apiRequest<MeResponse>('/api/auth/me'),
    enabled: Boolean(user),
  });

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addr, setAddr] = useState({
    label: 'Home',
    fullName: user?.name || '',
    phone: user?.phone || '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    isDefault: true,
  });

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <UserIcon className="w-10 h-10 mx-auto text-slate-300" />
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Sign in to manage your account
        </h1>
        <Link to="/auth?next=/profile" className="inline-flex px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-sm font-semibold">
          Sign In
        </Link>
      </main>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone }),
      });
      await refreshAuth();
      pushToast('success', 'Profile updated');
    } catch (err) {
      pushToast('error', 'Update failed', err instanceof Error ? err.message : 'Unable to save');
    } finally {
      setSaving(false);
    }
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/addresses', {
        method: 'POST',
        body: JSON.stringify(addr),
      });
      setShowAddrForm(false);
      setAddr({ ...addr, street: '', city: '', state: '', postalCode: '' });
      await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
      pushToast('success', 'Delivery address saved');
    } catch (err) {
      pushToast('error', 'Could not save address', err instanceof Error ? err.message : 'Check required fields');
    }
  }

  async function deleteAddress(id: string) {
    await apiRequest(`/api/auth/addresses/${id}`, { method: 'DELETE' });
    await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
    pushToast('info', 'Address removed');
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
            Account Profile
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {user.email} · Role: <span className="capitalize font-medium">{user.role.replace('_', ' ')}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(user.role === 'super_admin' || user.role === 'store_manager') && (
            <Link
              to="/admin"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              Open Admin Console
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <form
          onSubmit={saveProfile}
          className="md:col-span-5 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Personal Details</h2>

          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Account status: Active {user.isEmailVerified ? '· Email verified' : '· Verification pending'}</span>
          </div>

          <div>
            <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              id="prof-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label htmlFor="prof-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Phone
            </label>
            <input
              id="prof-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-sm font-semibold hover:bg-blue-600 cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <section className="md:col-span-7 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Saved Addresses</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowAddrForm((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Address</span>
            </button>
          </div>

          {showAddrForm && (
            <form onSubmit={addAddress} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Label (Home, Office)" required value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input placeholder="Recipient Name" required value={addr.fullName} onChange={(e) => setAddr({ ...addr, fullName: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input placeholder="Phone" required value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input placeholder="Street Address" required value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input placeholder="City" required value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input placeholder="State" required value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input placeholder="Postal Code" required value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white cursor-pointer">
                Save Address
              </button>
            </form>
          )}

          {data?.addresses && data.addresses.length > 0 ? (
            <div className="space-y-3">
              {data.addresses.map((a) => (
                <div
                  key={a._id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {a.label} {a.isDefault ? '· Default' : ''}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {a.fullName} · {a.phone}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {a.street}, {a.city}, {a.state} {a.postalCode}, {a.country}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteAddress(a._id)}
                    aria-label={`Delete ${a.label} address`}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No saved delivery addresses yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
