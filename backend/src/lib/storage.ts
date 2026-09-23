import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../env';

const ROOT = path.resolve(process.cwd(), env.UPLOADS_DIR);

/**
 * Local-disk implementation of the attachment storage abstraction.
 * Swap this module for an S3-compatible client later without touching
 * controllers - they only depend on the four functions below.
 */
export const storage = {
  async ensureReady(): Promise<void> {
    await fsp.mkdir(ROOT, { recursive: true });
  },

  /** Builds a collision-resistant relative key for a new file. */
  buildKey(originalName: string): string {
    const ext = path.extname(originalName);
    const datePart = new Date().toISOString().slice(0, 10);
    return path.posix.join(datePart, `${randomUUID()}${ext}`);
  },

  absolutePath(key: string): string {
    const resolved = path.resolve(ROOT, key);
    if (!resolved.startsWith(ROOT)) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  },

  async save(key: string, buffer: Buffer): Promise<void> {
    const dest = this.absolutePath(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, buffer);
  },

  async remove(key: string): Promise<void> {
    try {
      await fsp.unlink(this.absolutePath(key));
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
  },

  createReadStream(key: string): fs.ReadStream {
    return fs.createReadStream(this.absolutePath(key));
  },

  async exists(key: string): Promise<boolean> {
    try {
      await fsp.access(this.absolutePath(key));
      return true;
    } catch {
      return false;
    }
  },
};
