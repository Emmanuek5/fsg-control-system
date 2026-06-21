const TOKEN_KEY = 'fsg_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
  // Lightweight presence cookie so middleware can gate routes at the edge.
  document.cookie = `${TOKEN_KEY}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
}
