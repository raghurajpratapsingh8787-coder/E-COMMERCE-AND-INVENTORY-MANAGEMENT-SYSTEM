import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { env, isAllowedOrigin } from '../config/env.ts';
import { db } from '../db/store.ts';

let ioInstance: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  ioInstance = new SocketIOServer(httpServer, {
    path: '/socket.io',
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      const requestHost =
        (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
      if (isAllowedOrigin(origin, requestHost)) {
        return callback(null, true);
      }
      return callback('Origin not allowed', false);
    },
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token.length > 0) {
      try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
        const liveUser = db.getState().users.find((u) => u._id === decoded.sub && u.isActive);
        if (!liveUser) {
          socket.disconnect(true);
          return;
        }
        socket.join(`user:${liveUser._id}`);
        socket.join(`role:${liveUser.role}`);
      } catch {
        // Invalid/expired token stays out of authenticated rooms
      }
    }
  });

  return ioInstance;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitRealtimeEvent(
  targets: { userId?: string; roles?: string[]; broadcast?: boolean },
  eventName: string,
  payload: Record<string, unknown>
): void {
  if (!ioInstance) return;
  if (targets.broadcast) {
    ioInstance.emit(eventName, payload);
    return;
  }
  if (targets.userId) {
    ioInstance.to(`user:${targets.userId}`).emit(eventName, payload);
  }
  if (targets.roles) {
    for (const role of targets.roles) {
      ioInstance.to(`role:${role}`).emit(eventName, payload);
    }
  }
}
