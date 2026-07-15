import { clearToken, getToken, setToken } from './auth-storage';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildHeaders(options: RequestInit, token: string | null): HeadersInit {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  const isFormData = options.body instanceof FormData;
  if (options.body && !isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function rawFetch(path: string, options: RequestInit, token: string | null) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: buildHeaders(options, token),
    credentials: 'include',
  });
}

let refreshing: Promise<string | null> | null = null;
function tryRefresh(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        setToken(data.accessToken);
        return data.accessToken as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// The auth handshake itself must never trigger refresh-and-retry. Everything
// else — including /auth/me — may refresh an expired access token in place.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const skipRefresh = NO_REFRESH_PATHS.some((p) => path.startsWith(p));
  let token = getToken();
  let res = await rawFetch(path, options, token);

  if (res.status === 401 && !skipRefresh) {
    const newToken = await tryRefresh();
    if (newToken) res = await rawFetch(path, options, newToken);
  }

  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    if (res.status === 401 && !skipRefresh) {
      clearToken();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    throw new ApiError(res.status, body?.message ?? `Request failed (${res.status})`, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiFetch<T>(path, { method: 'POST', body: fd });
  },
};

/** Build an absolute URL for an uploaded file path returned by the API. */
export function fileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${path}`;
}
