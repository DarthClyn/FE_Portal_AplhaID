// Portal session: who is signed in. The check itself happens server side (server/auth.js); the browser only holds an
// HttpOnly cookie it cannot read, and asks /api/auth/me who it belongs to.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export interface User { username: string; name: string }

interface AuthState {
  user: User | null;
  checking: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Fired by the API client when the proxy says the session is gone (expired or signed out elsewhere). */
export const SIGNED_OUT = 'portal:signed-out';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setUser(b?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    const onOut = () => setUser(null);
    window.addEventListener(SIGNED_OUT, onOut);
    return () => window.removeEventListener(SIGNED_OUT, onOut);
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, remember }),
      });
    } catch {
      throw new Error('Could not reach the portal server. Check your connection and try again.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? 'Sign-in failed.');
    setUser(body.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, checking, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Pages inside the portal: send signed-out users to /login, then back to where they were. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
