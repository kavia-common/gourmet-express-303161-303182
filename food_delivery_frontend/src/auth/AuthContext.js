import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginApi, meApi } from "../api/auth";

const STORAGE_KEY = "gourmet_express_session_v1";

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
}

/**
 * PUBLIC_INTERFACE
 * AuthProvider provides:
 * - token + user
 * - login/logout
 * - role helpers
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredSession()?.token || null);
  const [user, setUser] = useState(() => readStoredSession()?.user || null);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(() => token, [token]);

  // On first mount: if we have a token, validate it via /auth/me.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = readStoredSession();
      if (!stored?.token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await meApi(() => stored.token);
        if (!cancelled) {
          setToken(stored.token);
          setUser(me);
          writeStoredSession({ token: stored.token, user: me });
        }
      } catch {
        // Token invalid/expired -> clear session.
        if (!cancelled) {
          setToken(null);
          setUser(null);
          writeStoredSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist token+user whenever they change.
  useEffect(() => {
    if (!token) {
      writeStoredSession(null);
      return;
    }
    writeStoredSession({ token, user });
  }, [token, user]);

  const roles = useMemo(() => {
    const r = user?.roles || [];
    return r.map((x) => x?.name).filter(Boolean);
  }, [user]);

  // PUBLIC_INTERFACE
  const login = useCallback(async (email, password) => {
    const res = await loginApi(email, password);
    const nextToken = res?.access_token;
    if (!nextToken) throw new Error("Login succeeded but token was not returned.");
    const me = await meApi(() => nextToken);
    setToken(nextToken);
    setUser(me);
    return { token: nextToken, user: me };
  }, []);

  // PUBLIC_INTERFACE
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    writeStoredSession(null);
  }, []);

  // PUBLIC_INTERFACE
  const hasRole = useCallback(
    (roleName) => roles.includes(roleName),
    [roles]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      roles,
      loading,
      getToken,
      login,
      logout,
      hasRole
    }),
    [token, user, roles, loading, getToken, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * PUBLIC_INTERFACE
 * Hook to access auth context.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider.");
  return ctx;
}
