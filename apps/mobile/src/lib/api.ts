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

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (auth && 'token' in auth) headers.authorization = `Bearer ${auth.token}`;
  if (auth && 'devUserId' in auth) headers['x-user-id'] = String(auth.devUserId);

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
