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

let signedInUserId: number | null = null;

/** Development sign-in: the user id sent with every request. */
export function setApiUser(id: number | null) {
  signedInUserId = id;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (signedInUserId !== null) headers['x-user-id'] = String(signedInUserId);

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
