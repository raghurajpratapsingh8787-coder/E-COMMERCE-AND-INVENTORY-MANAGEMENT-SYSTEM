import crypto from 'crypto';

const ephemeralAccessSecret = crypto.randomBytes(32).toString('hex');
const ephemeralRefreshSecret = crypto.randomBytes(32).toString('hex');

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  MONGODB_URI: process.env.MONGODB_URI?.trim() || '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET?.trim() || ephemeralAccessSecret,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET?.trim() || ephemeralRefreshSecret,
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD?.trim() || '',
  STORE_OWNER_NAME: process.env.STORE_OWNER_NAME?.trim() || 'Raghuraj Pratap Singh',
  STORE_OWNER_EMAIL: process.env.STORE_OWNER_EMAIL?.trim() || 'raghurajpratapsingh8787@gmail.com',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID?.trim() || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME?.trim() || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY?.trim() || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET?.trim() || '',
  SMTP_HOST: process.env.SMTP_HOST?.trim() || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER?.trim() || '',
  SMTP_PASS: process.env.SMTP_PASS?.trim() || '',
  SMTP_FROM: process.env.SMTP_FROM?.trim() || 'Veltrix Commerce <raghurajpratapsingh8787@gmail.com>',
  REDIS_URL: process.env.REDIS_URL?.trim() || '',
  isRazorpayConfigured(): boolean {
    return Boolean(this.RAZORPAY_KEY_ID && this.RAZORPAY_KEY_SECRET);
  },
  isCloudinaryConfigured(): boolean {
    return Boolean(this.CLOUDINARY_CLOUD_NAME && this.CLOUDINARY_API_KEY && this.CLOUDINARY_API_SECRET);
  },
  isSmtpConfigured(): boolean {
    return Boolean(this.SMTP_HOST && this.SMTP_USER && this.SMTP_PASS);
  },
};

/**
 * Strict URL-parsed CORS/Socket.IO origin check.
 * Allows exact matches against ALLOWED_ORIGINS, APP_URL, exact localhost/127.0.0.1,
 * or exact host match with the incoming request Host / X-Forwarded-Host header.
 */
export function isAllowedOrigin(origin: string | undefined, requestHost?: string): boolean {
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const normalizedOrigin = parsed.origin;
  if (env.ALLOWED_ORIGINS.includes(normalizedOrigin)) {
    return true;
  }
  if (env.APP_URL) {
    try {
      if (new URL(env.APP_URL).origin === normalizedOrigin) {
        return true;
      }
    } catch {
      // ignore invalid APP_URL
    }
  }
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    return true;
  }
  if (requestHost) {
    const cleanHost = requestHost.split(',')[0].trim().toLowerCase();
    if (cleanHost && parsed.host.toLowerCase() === cleanHost) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that an image URL is either a safe root-relative path or http(s) URL.
 * Rejects javascript:, data:, vbscript:, and protocol-relative (//) URIs.
 */
export function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

