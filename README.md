# Veltrix Commerce — E-Commerce & Inventory Management System

**Author & Store Owner:** Raghuraj Pratap Singh (`raghurajpratapsingh8787@gmail.com`)

A full-stack E-Commerce storefront and real-time Inventory Management System built with React, TypeScript, Tailwind CSS v4, Motion (Framer Motion), Recharts, TanStack Query, Express.js, Mongoose (21 schemas), JWT RBAC authentication, and Socket.IO.

---

## Architecture Overview

- **`src/` (Frontend SPA)**: Responsive light/dark storefront (`Home`, `Shop`, `Categories`, `Deals`, `Product Details`, `Wishlist`, `Checkout`, `My Orders` with 6-step tracking & printable invoices, `Profile`, `Auth`) and collapsible 14-section Admin Console (`Dashboard`, `Products`, `Categories`, `Inventory`, `Orders`, `Customers`, `Suppliers`, `Purchases`, `Payments`, `Coupons`, `Analytics`, `Notifications`, `Settings`, `Logout`).
- **`backend/` (Express REST API & Domain Logic)**:
  - `backend/models/mongooseModels.ts`: All 21 Mongoose schemas with ObjectId references, unique SKU/orderNumber indexes, compound indexes, text search indexes, and timestamps.
  - `backend/db/store.ts`: Supports MongoDB Atlas (`MONGODB_URI`) and includes an atomic, mutex-locked persistent datastore (`data/veltrix-db.json`) so concurrent stock operations work reliably out of the box.
  - `backend/domain/pricing.ts`: Pure server-side pricing, coupon validation, stock math, Razorpay HMAC-SHA256 verification, magic-byte file signature checks, and RBAC matrix.
  - `backend/realtime/socket.ts`: Socket.IO server attached to the port 3000 HTTP server for real-time low-stock and order notifications.

---

## Roles & Access Setup

1. **Super Admin** (`raghurajpratapsingh8787@gmail.com`): Full system control, store settings, audit logs, and Store Manager provisioning.
   - Set `ADMIN_INITIAL_PASSWORD` in `.env`, **or** claim Super Admin access once via the inline **First-Run Super Admin Setup** panel on `/auth` (permanently locks once claimed).
2. **Store Manager**: Provisioned by Super Admin under **Admin → Customers**; manages products, inventory, orders, suppliers, and purchase orders.
3. **Customer**: Self-registers on `/auth` to shop, persist carts/wishlists, place orders, track deliveries, and submit verified purchase reviews.

---

## Installation & Scripts

```bash
npm install
cp .env.example .env
npm run seed      # Optional: resets & seeds initial catalog, suppliers, coupons, and sample orders
npm run dev       # Runs Express + Socket.IO + Vite on http://localhost:3000
npm run test      # Runs node:test unit & concurrency test suite
npm run build     # Production frontend build
npm run lint      # TypeScript type-checking
```

---

## Key REST API Endpoints

### Auth (`/api/auth`)
- `GET /bootstrap-status` — First-run setup and integration posture
- `POST /bootstrap-admin` — One-time atomic Super Admin password claim
- `POST /register` | `POST /login` | `POST /refresh` | `POST /logout`
- `GET /me` | `PATCH /profile` | `POST /addresses` | `DELETE /addresses/:id`
- `POST /verify-email` | `POST /forgot-password` | `POST /reset-password`

### Catalog (`/api/catalog`)
- `GET /storefront` | `GET /categories` | `GET /products` | `GET /products/:slugOrId`
- `POST /products/:id/reviews` (verified delivered purchase required)
- `POST /uploads` (magic-byte verified JPEG/PNG/WebP/GIF upload, max 5MB)
- `POST /newsletter`

### Commerce (`/api/commerce`)
- `GET /cart` | `POST /cart/items` | `PATCH /cart/items/:productId` | `DELETE /cart/items/:productId` | `POST /cart/coupon`
- `GET /wishlist` | `POST /wishlist/toggle` | `POST /wishlist/move-to-cart`
- `POST /coupons/validate`
- `POST /orders` (atomic stock lock + idempotency key + server-side pricing)
- `GET /orders` | `GET /orders/:id` (strict ownership enforcement) | `POST /orders/:id/cancel` (atomic stock restore)
- `POST /payments/razorpay/create-order` | `POST /payments/razorpay/verify` | `POST /payments/razorpay/webhook`

### Admin & Inventory (`/api/admin`, RBAC protected)
- `GET /dashboard/analytics?range=7d|30d|90d|1y`
- `POST/PATCH/DELETE /products`, `POST/DELETE /categories`, `POST /brands`
- `GET /inventory` | `POST /inventory/:productId/adjust`
- `GET /orders` | `PATCH /orders/:id/status`
- `GET /payments` | `POST /payments/manual`
- `GET /customers` | `PATCH /users/:id/status` | `POST /managers`
- `GET/POST/PATCH /suppliers`, `GET/POST /purchase-orders`, `POST /purchase-orders/:id/receive`
- `GET/POST/PATCH /coupons`, `GET/PATCH /reviews`, `GET/PATCH /notifications`, `GET /audit-logs`, `GET/PATCH /settings`

---

## Security Controls

- bcrypt password hashing (`bcryptjs`)
- Short-lived JWT access tokens held in JS memory + rotating HttpOnly cookies (no `localStorage` tokens)
- CSRF verification (`X-Requested-With` / Origin check), Helmet headers, strict CORS allowlist, rate limiting, and NoSQL key sanitization
- Zod input validation and server-side price, coupon, and atomic stock calculations
- Constant-time HMAC-SHA256 Razorpay signature verification & idempotency protection
- Immutable security audit logs for sensitive administrative mutations
