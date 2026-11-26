import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { env } from '../config/env.ts';
import { createInitialSeedState, type DatabaseState } from './seedData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'veltrix-db.json');

class AsyncMutex {
  private chain: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.chain;
    this.chain = prev.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

class DataStore {
  private state: DatabaseState | null = null;
  private readonly writeLock = new AsyncMutex();
  private readonly stockLock = new AsyncMutex();
  private mongoConnected = false;

  async init(customDbPath?: string): Promise<void> {
    const targetFile = customDbPath || DB_FILE;

    if (env.MONGODB_URI && !customDbPath) {
      try {
        await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        this.mongoConnected = true;
      } catch {
        this.mongoConnected = false;
      }
    }

    if (!fs.existsSync(path.dirname(targetFile))) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    }

    if (fs.existsSync(targetFile)) {
      try {
        const raw = fs.readFileSync(targetFile, 'utf8');
        this.state = JSON.parse(raw) as DatabaseState;
      } catch {
        this.state = createInitialSeedState(env.STORE_OWNER_NAME, env.STORE_OWNER_EMAIL);
      }
    } else {
      this.state = createInitialSeedState(env.STORE_OWNER_NAME, env.STORE_OWNER_EMAIL);
    }

    // If ADMIN_INITIAL_PASSWORD is configured via environment secret, sync Super Admin hash securely
    if (env.ADMIN_INITIAL_PASSWORD) {
      const admin = this.state.users.find((u) => u.role === 'super_admin');
      if (admin) {
        const alreadyMatches =
          admin.passwordHash && (await bcrypt.compare(env.ADMIN_INITIAL_PASSWORD, admin.passwordHash));
        if (!alreadyMatches) {
          admin.passwordHash = await bcrypt.hash(env.ADMIN_INITIAL_PASSWORD, 10);
          admin.updatedAt = new Date().toISOString();
        }
        this.state.settings.adminClaimed = true;
      }
    } else {
      const admin = this.state.users.find((u) => u.role === 'super_admin');
      this.state.settings.adminClaimed = Boolean(admin?.passwordHash);
    }

    await this.persist(targetFile);
  }

  getState(): DatabaseState {
    if (!this.state) {
      this.state = createInitialSeedState(env.STORE_OWNER_NAME, env.STORE_OWNER_EMAIL);
    }
    return this.state;
  }

  isMongoConnected(): boolean {
    return this.mongoConnected;
  }

  newId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
  }

  async withStockLock<T>(fn: (state: DatabaseState) => Promise<T> | T): Promise<T> {
    return this.stockLock.runExclusive(() =>
      this.writeLock.runExclusive(async () => {
        const state = this.getState();
        const result = await fn(state);
        await this.persist();
        return result;
      })
    );
  }

  async mutate<T>(fn: (state: DatabaseState) => Promise<T> | T): Promise<T> {
    return this.writeLock.runExclusive(async () => {
      const state = this.getState();
      const result = await fn(state);
      await this.persist();
      return result;
    });
  }

  async resetForSeed(): Promise<void> {
    await this.writeLock.runExclusive(async () => {
      this.state = createInitialSeedState(env.STORE_OWNER_NAME, env.STORE_OWNER_EMAIL);
      if (env.ADMIN_INITIAL_PASSWORD) {
        const admin = this.state.users.find((u) => u.role === 'super_admin');
        if (admin) {
          admin.passwordHash = await bcrypt.hash(env.ADMIN_INITIAL_PASSWORD, 10);
          this.state.settings.adminClaimed = true;
        }
      }
      await this.persist();
    });
  }

  private async persist(targetFile: string = DB_FILE): Promise<void> {
    if (!this.state) return;
    if (!fs.existsSync(path.dirname(targetFile))) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    }
    const tmp = `${targetFile}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmp, targetFile);
  }
}

export const db = new DataStore();
