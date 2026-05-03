export type AuthTokenGetter = () => Promise<string | null>;

let baseUrl = "";
let authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string) {
  baseUrl = url;
}

export function setAuthTokenGetter(getter: AuthTokenGetter) {
  authTokenGetter = getter;
}

export async function customFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = authTokenGetter ? await authTokenGetter() : null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
