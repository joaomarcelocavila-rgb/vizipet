import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { StorageService } from './storage.service';

/** Driver para o bucket privado do Supabase Storage (chave de serviço só no back end). */
@Injectable()
export class SupabaseStorageService extends StorageService {
  private readonly base: string;
  private readonly bucket: string;
  private readonly headers: Record<string, string>;

  constructor(config: AppConfig) {
    super();
    this.base = `${config.get('SUPABASE_URL').replace(/\/$/, '')}/storage/v1`;
    this.bucket = config.get('SUPABASE_BUCKET');
    const key = config.get('SUPABASE_SERVICE_ROLE_KEY');
    this.headers = { apikey: key, Authorization: `Bearer ${key}` };
  }

  protected async write(path: string, buffer: Buffer, mime: string): Promise<void> {
    const res = await fetch(`${this.base}/object/${this.bucket}/${path}`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': mime, 'x-upsert': 'false' },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) throw new Error(`Falha ao gravar no storage (${res.status})`);
  }

  async remove(path: string): Promise<void> {
    const res = await fetch(`${this.base}/object/${this.bucket}/${path}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok && res.status !== 404) throw new Error(`Falha ao remover do storage (${res.status})`);
  }

  async createSignedUrl(path: string, ttlSeconds: number): Promise<string> {
    const res = await fetch(`${this.base}/object/sign/${this.bucket}/${path}`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: ttlSeconds }),
    });
    if (!res.ok) throw new Error(`Falha ao assinar link (${res.status})`);
    const body = (await res.json()) as { signedURL: string };
    return `${this.base}${body.signedURL}`;
  }
}
