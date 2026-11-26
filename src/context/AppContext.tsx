import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiRequest, getAccessToken, setAccessToken } from '../lib/api';
import type { CartItem, CartState, Product, User } from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface BootstrapStatus {
  adminClaimed: boolean;
  hasSession?: boolean;
  ownerName: string;
  ownerEmail: string;
  razorpayConfigured: boolean;
  cloudinaryConfigured: boolean;
  smtpConfigured: boolean;
  mongoConnected: boolean;
}

interface AppContextValue {
  user: User | null;
  authLoading: boolean;
  bootstrap: BootstrapStatus | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  cart: CartState;
  wishlistIds: string[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  quickViewProduct: Product | null;
  setQuickViewProduct: (p: Product | null) => void;
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], title: string, description?: string) => void;
  dismissToast: (id: string) => void;
  refreshAuth: () => Promise<void>;
  refreshCart: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  refreshBootstrap: () => Promise<BootstrapStatus | null>;
  setSession: (user: User, accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  addToCart: (product: Product, quantity?: number, variantLabel?: string) => Promise<boolean>;
  updateCartQty: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  applyCartCoupon: (code: string) => Promise<{ ok: boolean; error?: string }>;
  toggleWishlist: (productId: string) => Promise<void>;
}

const EMPTY_CART: CartState = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  discount: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  couponCode: null,
};

const AppContext = createContext<AppContextValue | null>(null);

function computeGuestCart(items: CartItem[]): CartState {
  const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  const shipping = subtotal === 0 || subtotal >= 250 ? 0 : 18;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + shipping + tax) * 100) / 100;
  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotal,
    discount: 0,
    shipping,
    tax,
    total,
    couponCode: null,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [guestItems, setGuestItems] = useState<CartItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const pushToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const refreshBootstrap = useCallback(async (): Promise<BootstrapStatus | null> => {
    try {
      const data = await apiRequest<BootstrapStatus>('/api/auth/bootstrap-status', {}, false);
      setBootstrap(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const refreshCart = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const data = await apiRequest<CartState>('/api/commerce/cart');
      setCart(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const data = await apiRequest<{ productIds: string[] }>('/api/commerce/wishlist');
      setWishlistIds(data.productIds || []);
    } catch {
      // ignore
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const boot = await refreshBootstrap();
      if (!boot?.hasSession) {
        setAccessToken(null);
        setUser(null);
        return;
      }
      const data = await apiRequest<{ user: User; accessToken: string }>(
        '/api/auth/refresh',
        { method: 'POST' },
        false
      );
      setAccessToken(data.accessToken);
      setUser(data.user);
      const [cartData, wishData] = await Promise.all([
        apiRequest<CartState>('/api/commerce/cart'),
        apiRequest<{ productIds: string[] }>('/api/commerce/wishlist'),
      ]);
      setCart(cartData);
      setWishlistIds(wishData.productIds || []);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [refreshBootstrap]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  // Real-time Socket.IO subscription when authenticated
  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const token = getAccessToken();
    const socket = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('order:created', (data: { orderNumber: string; totalAmount: number; customerName: string }) => {
      pushToast('info', `New order ${data.orderNumber}`, `${data.customerName} — $${data.totalAmount.toFixed(2)}`);
    });

    socket.on('inventory:low-stock', (data: { productName: string; remaining: number }) => {
      pushToast('info', `Low stock alert`, `${data.productName} has ${data.remaining} unit(s) left.`);
    });

    socket.on('order:updated', (data: { orderNumber: string; status: string }) => {
      pushToast('info', `Order ${data.orderNumber} updated`, `Status is now ${data.status.replace(/_/g, ' ')}.`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, pushToast]);

  const setSession = useCallback(
    async (loggedInUser: User, accessToken: string) => {
      setAccessToken(accessToken);
      setUser(loggedInUser);
      await refreshBootstrap();

      // Merge any guest cart items into authenticated server cart
      if (guestItems.length > 0) {
        for (const item of guestItems) {
          try {
            await apiRequest('/api/commerce/cart/items', {
              method: 'POST',
              body: JSON.stringify({
                productId: item.productId,
                quantity: item.quantity,
                variantLabel: item.variantLabel,
              }),
            });
          } catch {
            // ignore stock conflicts during guest merge
          }
        }
        setGuestItems([]);
      }

      await Promise.all([refreshCart(), refreshWishlist()]);
    },
    [guestItems, refreshBootstrap, refreshCart, refreshWishlist]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' }, false);
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    setCart(EMPTY_CART);
    setGuestItems([]);
    setWishlistIds([]);
    pushToast('info', 'Signed out', 'Your session has been closed securely.');
  }, [pushToast]);

  const addToCart = useCallback(
    async (product: Product, quantity = 1, variantLabel?: string): Promise<boolean> => {
      if (product.stockQuantity <= 0) {
        pushToast('error', 'Out of stock', `${product.name} is currently unavailable.`);
        return false;
      }

      if (user) {
        try {
          const updated = await apiRequest<CartState>('/api/commerce/cart/items', {
            method: 'POST',
            body: JSON.stringify({ productId: product._id, quantity, variantLabel }),
          });
          setCart(updated);
          setCartOpen(true);
          pushToast('success', 'Added to cart', `${product.name} (${quantity})`);
          return true;
        } catch (err) {
          pushToast('error', 'Could not add to cart', err instanceof Error ? err.message : 'Stock limit reached');
          return false;
        }
      }

      // Guest session in memory (syncs to backend upon sign-in)
      const next = [...guestItems];
      const idx = next.findIndex((i) => i.productId === product._id && (i.variantLabel || '') === (variantLabel || ''));
      const desired = (idx >= 0 ? next[idx].quantity : 0) + quantity;
      if (desired > product.stockQuantity) {
        pushToast('error', 'Stock limit reached', `Only ${product.stockQuantity} unit(s) available.`);
        return false;
      }
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          quantity: desired,
          lineTotal: Math.round(next[idx].unitPrice * desired * 100) / 100,
        };
      } else {
        next.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          slug: product.slug,
          categoryId: product.categoryId,
          brandName: product.brandName,
          image: product.images[0] || '',
          unitPrice: product.effectivePrice,
          originalPrice: product.price,
          quantity,
          lineTotal: Math.round(product.effectivePrice * quantity * 100) / 100,
          stockQuantity: product.stockQuantity,
          variantLabel,
        });
      }
      setGuestItems(next);
      setCart(computeGuestCart(next));
      setCartOpen(true);
      pushToast('success', 'Added to cart', `${product.name} (${quantity})`);
      return true;
    },
    [user, guestItems, pushToast]
  );

  const updateCartQty = useCallback(
    async (productId: string, quantity: number) => {
      if (user) {
        try {
          const updated = await apiRequest<CartState>(`/api/commerce/cart/items/${productId}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity }),
          });
          setCart(updated);
        } catch (err) {
          pushToast('error', 'Update failed', err instanceof Error ? err.message : 'Unable to update quantity');
        }
        return;
      }
      const next =
        quantity <= 0
          ? guestItems.filter((i) => i.productId !== productId)
          : guestItems.map((i) =>
              i.productId === productId
                ? {
                    ...i,
                    quantity: Math.min(quantity, i.stockQuantity),
                    lineTotal: Math.round(i.unitPrice * Math.min(quantity, i.stockQuantity) * 100) / 100,
                  }
                : i
            );
      setGuestItems(next);
      setCart(computeGuestCart(next));
    },
    [user, guestItems, pushToast]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (user) {
        try {
          const updated = await apiRequest<CartState>(`/api/commerce/cart/items/${productId}`, {
            method: 'DELETE',
          });
          setCart(updated);
        } catch {
          // ignore
        }
        return;
      }
      const next = guestItems.filter((i) => i.productId !== productId);
      setGuestItems(next);
      setCart(computeGuestCart(next));
    },
    [user, guestItems]
  );

  const applyCartCoupon = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) {
        return { ok: false, error: 'Sign in to validate and apply coupons.' };
      }
      try {
        const updated = await apiRequest<CartState>('/api/commerce/cart/coupon', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        setCart(updated);
        if (code) {
          pushToast('success', 'Coupon applied', `Code ${code.toUpperCase()} activated.`);
        }
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid coupon';
        return { ok: false, error: message };
      }
    },
    [user, pushToast]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) {
        pushToast('info', 'Sign in to save wishlist', 'Create a customer account to persist saved items.');
        return;
      }
      try {
        const res = await apiRequest<{ saved: boolean; productIds: string[] }>('/api/commerce/wishlist/toggle', {
          method: 'POST',
          body: JSON.stringify({ productId }),
        });
        setWishlistIds(res.productIds);
        pushToast('success', res.saved ? 'Saved to wishlist' : 'Removed from wishlist');
      } catch (err) {
        pushToast('error', 'Wishlist error', err instanceof Error ? err.message : 'Unable to update wishlist');
      }
    },
    [user, pushToast]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        bootstrap,
        theme,
        toggleTheme,
        cart,
        wishlistIds,
        cartOpen,
        setCartOpen,
        quickViewProduct,
        setQuickViewProduct,
        toasts,
        pushToast,
        dismissToast,
        refreshAuth,
        refreshCart,
        refreshWishlist,
        refreshBootstrap,
        setSession,
        logout,
        addToCart,
        updateCartQty,
        removeFromCart,
        applyCartCoupon,
        toggleWishlist,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
