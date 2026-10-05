import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { checkPublicHttpsUrl, isPrivateAddress } from '../common/utils/safe-url';

export type SourceCheck = 'VALID' | 'UNREACHABLE';

export abstract class SourceChecker {
  abstract check(url: string): Promise<SourceCheck>;
}

/**
 * Confere se a fonte oficial responde. Antes de qualquer requisição resolve o DNS e
 * recusa endereços privados, para o cron nunca servir de ponte para a rede interna.
 */
@Injectable()
export class HttpSourceChecker extends SourceChecker {
  async check(raw: string): Promise<SourceCheck> {
    const parsed = checkPublicHttpsUrl(raw);
    if (!parsed.ok) return 'UNREACHABLE';
    try {
      const addresses = await lookup(parsed.url.hostname, { all: true });
      if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) return 'UNREACHABLE';

      for (const method of ['HEAD', 'GET']) {
        const res = await fetch(parsed.url, { method, redirect: 'manual', signal: AbortSignal.timeout(8000) });
        await res.body?.cancel();
        if (res.status < 400) return 'VALID';
        if (method === 'HEAD' && res.status !== 405 && res.status !== 501) break;
      }
      return 'UNREACHABLE';
    } catch {
      return 'UNREACHABLE';
    }
  }
}
