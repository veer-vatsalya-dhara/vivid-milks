import type { Me, Role } from '@vivid-milks/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setApiAuth, type ApiAuth } from './api';
import { storage } from './storage';

export interface SessionUser {
  id: number;
  name: string;
  role: Role;
}

/** Which part of the app is shown. Admins can switch between all three. */
export type Mode = Role;

interface SessionState {
  ready: boolean;
  user: SessionUser | null;
  mode: Mode | null;
  modes: Mode[];
  signIn: (user: SessionUser, auth: NonNullable<ApiAuth>) => Promise<void>;
  signOut: () => Promise<void>;
  setMode: (mode: Mode) => Promise<void>;
}

const SESSION_KEY = 'session';

interface StoredSession {
  user: SessionUser;
  auth: NonNullable<ApiAuth>;
  mode: Mode;
}

const SessionContext = createContext<SessionState | null>(null);

export function modesFor(role: Role): Mode[] {
  return role === 'admin' ? ['admin', 'customer', 'delivery'] : [role];
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);

  const apply = useCallback(
    async (next: StoredSession | null) => {
      setApiAuth(next?.auth ?? null);
      queryClient.clear();
      setSession(next);
      if (next) await storage.set(SESSION_KEY, JSON.stringify(next));
      else await storage.remove(SESSION_KEY);
    },
    [queryClient],
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.get(SESSION_KEY);
        if (!saved) return;
        const stored = JSON.parse(saved) as StoredSession;
        setApiAuth(stored.auth);
        // Pick up role changes (or removal) since last time; keep the saved session if offline.
        const me = await api<Me>('/me').catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 401) return null;
          return stored.user;
        });
        if (!me) return apply(null);
        const user = { id: me.id, name: me.name, role: me.role };
        const modes = modesFor(user.role);
        await apply({ ...stored, user, mode: modes.includes(stored.mode) ? stored.mode : modes[0]! });
      } catch {
        await apply(null);
      } finally {
        setReady(true);
      }
    })();
  }, [apply]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      user: session?.user ?? null,
      mode: session?.mode ?? null,
      modes: session ? modesFor(session.user.role) : [],
      signIn: (user, auth) => apply({ user, auth, mode: modesFor(user.role)[0]! }),
      signOut: () => apply(null),
      setMode: async (mode) => {
        if (session) await apply({ ...session, mode });
      },
    }),
    [ready, session, apply],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
