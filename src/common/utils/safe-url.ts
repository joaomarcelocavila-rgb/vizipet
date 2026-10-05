import { isIP } from 'node:net';

const INTERNAL_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet'];

export type SafeUrlResult = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Aceita apenas HTTPS público: sem credenciais embutidas, sem IP literal e
 * sem nomes de host internos. Não resolve DNS; quem fizer a requisição de fato
 * (verificação de fonte) deve repetir a checagem do IP resolvido.
 */
export function checkPublicHttpsUrl(raw: string): SafeUrlResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL inválida.' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'Use um endereço HTTPS.' };
  if (url.username || url.password) return { ok: false, reason: 'A URL não pode conter credenciais.' };

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const bare = host.replace(/^\[|\]$/g, '');
  if (isIP(bare) !== 0) return { ok: false, reason: 'Endereços IP não são aceitos.' };
  if (!host.includes('.') || host === 'localhost' || INTERNAL_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'Endereço interno não é permitido.' };
  }
  if (url.port && url.port !== '443') return { ok: false, reason: 'Porta não permitida.' };
  return { ok: true, url };
}

/** IPs que nunca devem ser alvo de uma requisição disparada pelo servidor. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) return isPrivateAddress(ip.slice(7));
    return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith('ff');
  }
  return true;
}
