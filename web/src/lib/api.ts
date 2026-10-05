export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number; unread?: number };
}

export type Role = 'TUTOR' | 'PROFESSIONAL' | 'ADMIN';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

const TOKEN_KEY = 'vizipet.token';
const USER_KEY = 'vizipet.user';

// localStorage pode estar bloqueado (aba anônima, iframe): cai para memória.
const memory = new Map<string, string>();
export const store = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? null;
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
    try {
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
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

// Avisa o App quando a sessão expira (401), para voltar à tela de entrada.
export const onUnauthorized = new EventTarget();

function fail(status: number, json: Record<string, unknown>): never {
  if (status === 401) {
    session.clear();
    onUnauthorized.dispatchEvent(new Event('logout'));
  }
  throw {
    status,
    code: (json.code as string) ?? 'ERROR',
    message: (json.message as string) ?? 'Algo deu errado. Tente de novo.',
    details: json.details,
  } satisfies ApiError;
}

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  if (isDemo) {
    const { demoRequest } = await import('../demo/mock');
    const result = await demoRequest(method, path, body as Record<string, unknown> | undefined, headers, session.token);
    if (result.status >= 400) fail(result.status, result.body ?? {});
    return result.body as T;
  }
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: {
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw { status: 0, code: 'OFFLINE', message: 'Sem conexão. Confira a internet e tente de novo.' } satisfies ApiError;
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) fail(res.status, json);
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>('POST', path, body ?? {}, headers),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export const qs = (params: Record<string, string | number | boolean | undefined | null>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
