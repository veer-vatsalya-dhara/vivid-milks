import type { Me, Role } from '@vivid-milks/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setApiUser } from './api';
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
  signIn: (user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
  setMode: (mode: Mode) => Promise<void>;
}

const USER_KEY = 'session.user';
const MODE_KEY = 'session.mode';

const SessionContext = createContext<SessionState | null>(null);

export function modesFor(role: Role): Mode[] {
  return role === 'admin' ? ['admin', 'customer', 'delivery'] : [role];
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mode, setModeState] = useState<Mode | null>(null);

  const apply = useCallback(
    async (next: SessionUser | null, nextMode: Mode | null) => {
      setApiUser(next?.id ?? null);
      queryClient.clear();
      setUser(next);
      setModeState(nextMode);
      if (next && nextMode) {
        await storage.set(USER_KEY, JSON.stringify(next));
        await storage.set(MODE_KEY, nextMode);
      } else {
        await storage.remove(USER_KEY);
        await storage.remove(MODE_KEY);
      }
    },
    [queryClient],
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.get(USER_KEY);
        if (!saved) return;
        const savedUser = JSON.parse(saved) as SessionUser;
        const savedMode = (await storage.get(MODE_KEY)) as Mode | null;
        setApiUser(savedUser.id);
        // Pick up role changes made by an admin since last time.
        const me = await api<Me>('/me').catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 401) return null;
          return { ...savedUser } as Pick<Me, 'id' | 'name' | 'role'>;
        });
        if (!me) return apply(null, null);
        const fresh = { id: me.id, name: me.name, role: me.role };
        const modes = modesFor(fresh.role);
        await apply(fresh, savedMode && modes.includes(savedMode) ? savedMode : modes[0]!);
      } finally {
        setReady(true);
      }
    })();
  }, [apply]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      user,
      mode,
      modes: user ? modesFor(user.role) : [],
      signIn: (next) => apply(next, modesFor(next.role)[0]!),
      signOut: () => apply(null, null),
      setMode: (next) => apply(user, next),
    }),
    [ready, user, mode, apply],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
