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

// localStorage pode estar bloqueado (aba anônima, iframe): cai para memória.
const memory = new Map<string, string>();
const store = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set: (key: string, value: string) => {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* fica só em memória */
    }
  },
  remove: (key: string) => {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignora */
    }
  },
};

export const session = {
  get token() {
    return store.get(TOKEN_KEY);
  },
  get user(): SessionUser | null {
    const raw = store.get(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save(token: string, user: SessionUser) {
    store.set(TOKEN_KEY, token);
    store.set(USER_KEY, JSON.stringify(user));
  },
  clear() {
    store.remove(TOKEN_KEY);
    store.remove(USER_KEY);
  },
};

export const isDemo = import.meta.env.VITE_DEMO === '1';

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  if (isDemo) {
    const { demoRequest } = await import('./demo/mock');
    const result = await demoRequest(method, path, body as Record<string, unknown> | undefined, headers, session.token);
    if (result.status >= 400) {
      if (result.status === 401) session.clear();
      throw { status: result.status, code: result.body?.code, message: result.body?.message } as ApiError;
    }
    return result.body as T;
  }
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
