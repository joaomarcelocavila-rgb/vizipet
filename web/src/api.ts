export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number; unread?: number };
}

const TOKEN_KEY = 'vizipet.token';
const USER_KEY = 'vizipet.user';

export interface SessionUser {
  id: string;
  name: string;
  role: 'TUTOR' | 'PROFESSIONAL' | 'ADMIN';
}

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save(token: string, user: SessionUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) session.clear();
    throw { status: res.status, code: json.code ?? 'ERROR', message: json.message ?? 'Algo deu errado.' } as ApiError;
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>('POST', path, body ?? {}, headers),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
};

export const money = (cents: number | null) =>
  cents === null ? 'Preço a combinar' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const tz = 'America/Recife';
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const fmtDay = (iso: string) =>
  capitalize(new Date(iso).toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' }));
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`;
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
