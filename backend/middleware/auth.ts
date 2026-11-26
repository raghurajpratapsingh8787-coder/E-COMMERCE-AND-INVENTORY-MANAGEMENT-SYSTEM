import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { db } from '../db/store.ts';
import { hasRolePermission, type Permission, type UserRole } from '../domain/pricing.ts';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

export function signRefreshToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, role: user.role, jti: crypto.randomBytes(16).toString('hex') },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export function setAuthCookies(req: Request, res: Response, accessToken: string, refreshToken: string): void {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSite: 'none' | 'lax' = isSecure ? 'none' : 'lax';
  const baseOpts = {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/',
  };
  res.cookie('veltrix_access', accessToken, { ...baseOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('veltrix_refresh', refreshToken, { ...baseOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(req: Request, res: Response): void {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSite: 'none' | 'lax' = isSecure ? 'none' : 'lax';
  res.clearCookie('veltrix_access', { httpOnly: true, secure: isSecure, sameSite, path: '/' });
  res.clearCookie('veltrix_refresh', { httpOnly: true, secure: isSecure, sameSite, path: '/' });
}

/**
 * Recursively strips keys starting with `$` or containing `.` to prevent NoSQL operator injection.
 */
function stripDangerousKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDangerousKeys);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
        continue;
      }
      clean[key] = stripDangerousKeys(val);
    }
    return clean;
  }
  return value;
}

export function sanitizeNoSql(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = stripDangerousKeys(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete req.query[key];
      }
    }
  }
  next();
}

/**
 * CSRF protection for cookie-authenticated state-changing requests.
 * Requires either Bearer token auth, custom X-Requested-With header, or matching Origin/Host.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  // Webhook endpoints use cryptographic HMAC signatures instead of browser cookies
  if (req.path.includes('/webhook')) {
    return next();
  }
  const hasBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
  if (hasBearer) {
    return next();
  }
  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith === 'XMLHttpRequest') {
    return next();
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        return next();
      }
    } catch {
      // fall through to reject
    }
  }
  // If no auth cookies are attached at all (public form submission from same app), allow if no cookie present
  if (!req.cookies?.veltrix_access && !req.cookies?.veltrix_refresh) {
    return next();
  }
  res.status(403).json({ error: 'CSRF validation failed. Include X-Requested-With header.' });
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.cookies?.veltrix_access) {
    return String(req.cookies.veltrix_access);
  }
  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; email: string; name: string; role: UserRole };
    const user = db.getState().users.find((u) => u._id === payload.sub);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account is inactive or unavailable.' });
      return;
    }
    req.user = { id: user._id, email: user.email, name: user.name, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token.' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
      const user = db.getState().users.find((u) => u._id === payload.sub && u.isActive);
      if (user) {
        req.user = { id: user._id, email: user.email, name: user.name, role: user.role };
      }
    } catch {
      // ignore invalid optional token
    }
  }
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!hasRolePermission(req.user.role, permission)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions.' });
      return;
    }
    next();
  };
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: role not authorized.' });
      return;
    }
    next();
  };
}

export async function recordAuditLog(params: {
  actor?: AuthUser;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  await db.mutate((state) => {
    state.auditLogs.unshift({
      _id: db.newId('aud'),
      actorId: params.actor?.id || 'system',
      actorEmail: params.actor?.email || 'system',
      actorRole: params.actor?.role || 'system',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details || {},
      ipAddress: params.ipAddress || 'unknown',
      createdAt: new Date().toISOString(),
    });
    if (state.auditLogs.length > 500) {
      state.auditLogs.length = 500;
    }
  });
}
