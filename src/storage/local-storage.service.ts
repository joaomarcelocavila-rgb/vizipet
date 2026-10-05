import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { AppConfig } from '../config/app-config.service';
import { StorageService } from './storage.service';

export const STORED_PATH = /^(photos|documents)\/[0-9a-f-]{36}\.(pdf|jpg|png)$/;

/** Driver de desenvolvimento e testes: grava em disco e assina links com HMAC. */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly root: string;
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    super();
    this.root = resolve(config.get('STORAGE_LOCAL_DIR'));
    this.key = Buffer.from(`storage:${config.get('JWT_ACCESS_SECRET')}`);
  }

  protected async write(path: string, buffer: Buffer): Promise<void> {
    const target = this.resolvePath(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer, { flag: 'wx', mode: 0o600 });
  }

  async remove(path: string): Promise<void> {
    await rm(this.resolvePath(path), { force: true });
  }

  async createSignedUrl(path: string, ttlSeconds: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = this.sign(path, expires);
    return `/api/v1/storage/files?path=${encodeURIComponent(path)}&expires=${expires}&signature=${signature}`;
  }

  verify(path: string, expires: number, signature: string): boolean {
    if (!STORED_PATH.test(path) || !Number.isFinite(expires) || expires < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(path, expires));
    const received = Buffer.from(signature ?? '');
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  read(path: string): Promise<Buffer> {
    return readFile(this.resolvePath(path));
  }

  private sign(path: string, expires: number): string {
    return createHmac('sha256', this.key).update(`${path}:${expires}`).digest('hex');
  }

  private resolvePath(path: string): string {
    const target = resolve(this.root, path);
    if (!target.startsWith(this.root + sep)) throw new Error('Caminho fora do diretório de armazenamento');
    return target;
  }
}
