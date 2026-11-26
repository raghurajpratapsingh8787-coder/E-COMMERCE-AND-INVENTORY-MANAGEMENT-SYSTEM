import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { env, isAllowedOrigin } from './backend/config/env.ts';
import { db } from './backend/db/store.ts';
import { csrfProtection, sanitizeNoSql } from './backend/middleware/auth.ts';
import { initSocketServer } from './backend/realtime/socket.ts';
import { adminRouter } from './backend/routes/adminRoutes.ts';
import { authRouter } from './backend/routes/authRoutes.ts';
import { catalogRouter } from './backend/routes/catalogRoutes.ts';
import { commerceRouter } from './backend/routes/commerceRoutes.ts';

export async function createServerApp() {
  await db.init();

  const app = express();
  app.set('trust proxy', 1);

  // Security headers (iframe-compatible for preview environments)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Strict CORS allowlist (validates parsed origin against allowlist & exact request host)
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      const requestHost =
        (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
      const allowed = isAllowedOrigin(origin, requestHost);
      callback(null, { origin: allowed, credentials: true });
    })
  );

  app.use(cookieParser());
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(sanitizeNoSql);

  // Rate limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please wait and retry.' },
  });

  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Confined static serving for uploaded product images
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir, { dotfiles: 'deny', index: false }));

  // API Routes
  app.use('/api', apiLimiter, csrfProtection);
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mongoConnected: db.isMongoConnected() });
  });
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/commerce', commerceRouter);
  app.use('/api/admin', adminRouter);

  // API 404 & Error handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use(
    (
      err: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.status || 500;
      res.status(status).json({
        error: status >= 500 ? 'Internal server error.' : err.message,
      });
    }
  );

  // Mount Vite dev middleware in development, or serve dist/ in production
  if (env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

async function start() {
  const app = await createServerApp();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Veltrix Commerce running on http://0.0.0.0:${env.PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
