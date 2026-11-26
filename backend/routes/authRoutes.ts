import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.ts';
import { db } from '../db/store.ts';
import {
  authenticate,
  clearAuthCookies,
  hashToken,
  recordAuditLog,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
} from '../middleware/auth.ts';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Valid email address required').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  phone: z.string().trim().max(30).optional().default(''),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const bootstrapAdminSchema = z.object({
  password: z.string().min(8, 'Admin password must be at least 8 characters').max(100),
});

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default('Home'),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30),
  street: z.string().trim().min(4).max(200),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(80).default('United States'),
  isDefault: z.boolean().optional().default(false),
});

function sanitizeUser(u: {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    isActive: u.isActive,
    isEmailVerified: u.isEmailVerified,
    createdAt: u.createdAt,
  };
}

authRouter.get('/bootstrap-status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const state = db.getState();
  const admin = state.users.find((u) => u.role === 'super_admin');
  res.json({
    adminClaimed: Boolean(admin?.passwordHash) || Boolean(env.ADMIN_INITIAL_PASSWORD),
    hasSession: Boolean(req.cookies?.veltrix_refresh),
    ownerName: state.settings.ownerName,
    ownerEmail: admin?.email || state.settings.ownerEmail,
    razorpayConfigured: env.isRazorpayConfigured(),
    cloudinaryConfigured: env.isCloudinaryConfigured(),
    smtpConfigured: env.isSmtpConfigured(),
    mongoConnected: db.isMongoConnected(),
  });
});

/**
 * One-time atomic first-run Super Admin password claim route.
 * Locked immediately once claimed or whenever ADMIN_INITIAL_PASSWORD is set in env.
 */
authRouter.post('/bootstrap-admin', async (req, res) => {
  if (env.ADMIN_INITIAL_PASSWORD) {
    res.status(403).json({ error: 'Admin password is already configured via environment secrets.' });
    return;
  }

  const parsed = bootstrapAdminSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password.' });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const outcome = await db.mutate((state) => {
    const admin = state.users.find((u) => u.role === 'super_admin');
    if (!admin) {
      return { ok: false as const, status: 404, error: 'Super Admin account not initialized.' };
    }
    if (admin.passwordHash || state.settings.adminClaimed) {
      return { ok: false as const, status: 409, error: 'Super Admin access has already been claimed.' };
    }
    admin.passwordHash = passwordHash;
    admin.updatedAt = new Date().toISOString();
    state.settings.adminClaimed = true;

    const authUser = { id: admin._id, email: admin.email, name: admin.name, role: admin.role };
    const accessToken = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);
    admin.refreshTokens.push({
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    });

    return { ok: true as const, admin, accessToken, refreshToken };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  setAuthCookies(req, res, outcome.accessToken, outcome.refreshToken);
  await recordAuditLog({
    actor: { id: outcome.admin._id, email: outcome.admin.email, name: outcome.admin.name, role: outcome.admin.role },
    action: 'SUPER_ADMIN_CLAIMED',
    entityType: 'User',
    entityId: outcome.admin._id,
    ipAddress: req.ip,
  });

  res.status(201).json({
    user: sanitizeUser(outcome.admin),
    accessToken: outcome.accessToken,
  });
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
    return;
  }

  const emailLower = parsed.data.email.toLowerCase();
  const existing = db.getState().users.find((u) => u.email === emailLower);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const verificationToken = crypto.randomBytes(20).toString('hex');
  const now = new Date().toISOString();

  const created = await db.mutate((state) => {
    const userId = db.newId('usr');
    const user = {
      _id: userId,
      name: parsed.data.name,
      email: emailLower,
      passwordHash,
      role: 'customer' as const,
      phone: parsed.data.phone || '',
      isActive: true,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      refreshTokens: [] as Array<{ tokenHash: string; expiresAt: string }>,
      createdAt: now,
      updatedAt: now,
    };

    const authUser = { id: user._id, email: user.email, name: user.name, role: user.role };
    const accessToken = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);
    user.refreshTokens.push({
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    });

    state.users.push(user);
    state.customerProfiles.push({
      _id: db.newId('cprof'),
      userId,
      totalOrders: 0,
      totalSpent: 0,
      newsletterSubscribed: false,
      supportNotes: '',
      createdAt: now,
      updatedAt: now,
    });
    state.carts.push({ _id: db.newId('cart'), userId, items: [], updatedAt: now });
    state.wishlists.push({ _id: db.newId('wish'), userId, productIds: [], notifyOnRestock: [], updatedAt: now });

    return { user, accessToken, refreshToken };
  });

  setAuthCookies(req, res, created.accessToken, created.refreshToken);
  res.status(201).json({
    user: sanitizeUser(created.user),
    accessToken: created.accessToken,
    verificationToken: env.isSmtpConfigured() ? undefined : verificationToken,
  });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email and password are required.' });
    return;
  }

  const emailLower = parsed.data.email.toLowerCase();
  const user = db.getState().users.find((u) => u.email === emailLower);
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: 'This account has been deactivated. Contact store support.' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const authUser = { id: user._id, email: user.email, name: user.name, role: user.role };
  const accessToken = signAccessToken(authUser);
  const refreshToken = signRefreshToken(authUser);

  await db.mutate((state) => {
    const target = state.users.find((u) => u._id === user._id);
    if (target) {
      const nowMs = Date.now();
      target.refreshTokens = target.refreshTokens.filter((t) => new Date(t.expiresAt).getTime() > nowMs).slice(-4);
      target.refreshTokens.push({
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(nowMs + 7 * 86400 * 1000).toISOString(),
      });
    }
  });

  setAuthCookies(req, res, accessToken, refreshToken);
  res.json({
    user: sanitizeUser(user),
    accessToken,
  });
});

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.veltrix_refresh;
  if (!token) {
    res.status(401).json({ error: 'No refresh session found.' });
    return;
  }

  try {
    const decoded = jwt.verify(String(token), env.JWT_REFRESH_SECRET) as { sub: string };
    const providedHash = hashToken(String(token));
    const result = await db.mutate((state) => {
      const user = state.users.find((u) => u._id === decoded.sub && u.isActive);
      if (!user) return null;
      const idx = user.refreshTokens.findIndex(
        (t) => t.tokenHash === providedHash && new Date(t.expiresAt).getTime() > Date.now()
      );
      if (idx === -1) return null;

      // Rotate refresh token
      user.refreshTokens.splice(idx, 1);
      const authUser = { id: user._id, email: user.email, name: user.name, role: user.role };
      const nextAccess = signAccessToken(authUser);
      const nextRefresh = signRefreshToken(authUser);
      user.refreshTokens.push({
        tokenHash: hashToken(nextRefresh),
        expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      });
      return { user, nextAccess, nextRefresh };
    });

    if (!result) {
      clearAuthCookies(req, res);
      res.status(401).json({ error: 'Refresh session expired or revoked.' });
      return;
    }

    setAuthCookies(req, res, result.nextAccess, result.nextRefresh);
    res.json({ user: sanitizeUser(result.user), accessToken: result.nextAccess });
  } catch {
    clearAuthCookies(req, res);
    res.status(401).json({ error: 'Invalid refresh token.' });
  }
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.veltrix_refresh;
  if (token) {
    const providedHash = hashToken(String(token));
    await db.mutate((state) => {
      for (const user of state.users) {
        user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== providedHash);
      }
    });
  }
  clearAuthCookies(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', authenticate, (req, res) => {
  const state = db.getState();
  const user = state.users.find((u) => u._id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const profile = state.customerProfiles.find((p) => p.userId === user._id);
  const addresses = state.addresses.filter((a) => a.userId === user._id);
  const notifications = state.notifications
    .filter((n) => n.recipientUserId === user._id || n.recipientRole === user.role)
    .slice(0, 20);

  res.json({
    user: sanitizeUser(user),
    profile: profile || null,
    addresses,
    notifications,
  });
});

authRouter.post('/verify-email', authenticate, async (req, res) => {
  const token = z.string().min(6).safeParse(req.body?.token);
  const state = db.getState();
  const user = state.users.find((u) => u._id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (user.isEmailVerified) {
    res.json({ ok: true, isEmailVerified: true });
    return;
  }
  if (!token.success || (user.emailVerificationToken && user.emailVerificationToken !== token.data)) {
    res.status(400).json({ error: 'Invalid email verification token.' });
    return;
  }
  await db.mutate((s) => {
    const u = s.users.find((item) => item._id === req.user!.id);
    if (u) {
      u.isEmailVerified = true;
      u.emailVerificationToken = undefined;
      u.updatedAt = new Date().toISOString();
    }
  });
  res.json({ ok: true, isEmailVerified: true });
});

authRouter.post('/forgot-password', async (req, res) => {
  const parsed = z.object({ email: z.string().trim().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email is required.' });
    return;
  }
  const resetToken = crypto.randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  let matched = false;

  await db.mutate((state) => {
    const user = state.users.find((u) => u.email === parsed.data.email.toLowerCase() && u.isActive);
    if (user) {
      user.passwordResetToken = hashToken(resetToken);
      user.passwordResetExpiresAt = expiresAt;
      matched = true;
    }
  });

  res.json({
    ok: true,
    message: env.isSmtpConfigured()
      ? 'If an account matches that email, a single-use password reset link has been sent.'
      : 'If an account matches that email, a reset token was created. Configure SMTP environment variables to deliver reset emails.',
    smtpConfigured: env.isSmtpConfigured(),
  });
  void matched;
});

authRouter.post('/reset-password', async (req, res) => {
  const parsed = z
    .object({
      token: z.string().min(10),
      password: z.string().min(8).max(100),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Valid reset token and password (min 8 chars) required.' });
    return;
  }

  const tokenHash = hashToken(parsed.data.token);
  const newHash = await bcrypt.hash(parsed.data.password, 10);
  const ok = await db.mutate((state) => {
    const user = state.users.find(
      (u) =>
        u.passwordResetToken === tokenHash &&
        u.passwordResetExpiresAt &&
        new Date(u.passwordResetExpiresAt).getTime() > Date.now()
    );
    if (!user) return false;
    user.passwordHash = newHash;
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    user.refreshTokens = [];
    user.updatedAt = new Date().toISOString();
    return true;
  });

  if (!ok) {
    res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    return;
  }

  res.json({ ok: true, message: 'Password updated. Please sign in with your new password.' });
});

authRouter.patch('/profile', authenticate, async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(30).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile fields.' });
    return;
  }

  const updated = await db.mutate((state) => {
    const user = state.users.find((u) => u._id === req.user!.id);
    if (!user) return null;
    if (parsed.data.name) user.name = parsed.data.name;
    if (parsed.data.phone !== undefined) user.phone = parsed.data.phone;
    user.updatedAt = new Date().toISOString();
    return user;
  });

  if (!updated) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user: sanitizeUser(updated) });
});

authRouter.post('/addresses', authenticate, async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid address.' });
    return;
  }
  const created = await db.mutate((state) => {
    if (parsed.data.isDefault) {
      for (const addr of state.addresses) {
        if (addr.userId === req.user!.id) addr.isDefault = false;
      }
    }
    const doc = {
      _id: db.newId('addr'),
      userId: req.user!.id,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    state.addresses.push(doc);
    return doc;
  });
  res.status(201).json({ address: created });
});

authRouter.delete('/addresses/:id', authenticate, async (req, res) => {
  const deleted = await db.mutate((state) => {
    const idx = state.addresses.findIndex((a) => a._id === req.params.id && a.userId === req.user!.id);
    if (idx === -1) return false;
    state.addresses.splice(idx, 1);
    return true;
  });
  if (!deleted) {
    res.status(404).json({ error: 'Address not found.' });
    return;
  }
  res.json({ ok: true });
});
