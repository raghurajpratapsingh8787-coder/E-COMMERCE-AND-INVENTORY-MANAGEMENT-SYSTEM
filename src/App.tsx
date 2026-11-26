import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ToastContainer } from './components/common/ToastContainer';
import { StoreFooter } from './components/layout/StoreFooter';
import { StoreHeader } from './components/layout/StoreHeader';
import { CartDrawer } from './components/store/CartDrawer';
import { QuickViewModal } from './components/store/QuickViewModal';
import { AppProvider } from './context/AppContext';
import { AdminAnalyticsPage, AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminInventory } from './pages/admin/AdminInventory';
import { AdminLayout } from './pages/admin/AdminLayout';
import {
  AdminCategoriesPage,
  AdminCouponsPage,
  AdminCustomersPage,
  AdminNotificationsPage,
  AdminOrdersPage,
  AdminPaymentsPage,
  AdminPurchasesPage,
  AdminSettingsPage,
  AdminSuppliersPage,
} from './pages/admin/AdminOperations';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AuthPage } from './pages/auth/AuthPage';
import { CategoriesPage, DealsPage } from './pages/store/CategoriesDealsPages';
import { CheckoutPage } from './pages/store/CheckoutPage';
import { HomePage } from './pages/store/HomePage';
import { OrdersPage } from './pages/store/OrdersPage';
import { ProductDetailPage } from './pages/store/ProductDetailPage';
import { ProfilePage } from './pages/store/ProfilePage';
import { ShopPage } from './pages/store/ShopPage';
import { WishlistPage } from './pages/store/WishlistPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
    },
  },
});

function StorefrontShell() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <StoreHeader />
      <div className="flex-1">
        <Outlet />
      </div>
      <StoreFooter />
      <CartDrawer />
      <QuickViewModal />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Customer Storefront Routes */}
            <Route element={<StorefrontShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/product/:slug" element={<ProductDetailPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/auth" element={<AuthPage />} />
            </Route>

            {/* Role-Protected Admin Console Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="customers" element={<AdminCustomersPage />} />
              <Route path="suppliers" element={<AdminSuppliersPage />} />
              <Route path="purchases" element={<AdminPurchasesPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="coupons" element={<AdminCouponsPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer />
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  );
}
