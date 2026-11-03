import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

/**
 * `EXPO_PUBLIC_API_URL` if set. Otherwise, a deployed web build uses its own origin
 * (the API is served under /api on the same site), and in development the API server
 * on the machine running Expo (so a phone on the same Wi-Fi reaches it).
 */
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return __DEV__ ? `http://${window.location.hostname}:${API_PORT}` : window.location.origin;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** How requests are signed in: a session token from Google sign-in, or a user id for development sign-in. */
export type ApiAuth = { token: string } | { devUserId: number } | null;

let auth: ApiAuth = null;

export function setApiAuth(next: ApiAuth) {
  auth = next;
}

function authHeaders(): Record<string, string> {
  if (auth && 'token' in auth) return { authorization: `Bearer ${auth.token}` };
  if (auth && 'devUserId' in auth) return { 'x-user-id': String(auth.devUserId) };
  return {};
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = authHeaders();
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Is it running?`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Downloads a file from the API in the browser (the request needs the sign-in headers, so a plain link won't do). */
export async function downloadFile(path: string, filename: string): Promise<void> {
  if (Platform.OS !== 'web') throw new ApiError(0, 'Downloading files works in the web app. Open it in a browser.');
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { headers: authHeaders() });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Is it running?`);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error ?? `Download failed (${res.status})`);
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
