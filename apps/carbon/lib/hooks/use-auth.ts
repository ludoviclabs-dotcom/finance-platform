"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import {
  fetchMe,
  loginRequest,
  logoutRequest,
  refreshTokenRequest,
  setAuthToken,
  setOnTokenExpired,
} from "@/lib/api";

const SESSION_KEY = "carbonco_session_v2";

// Access token TTL côté front (14 min — légèrement inférieur aux 15 min serveur
// pour éviter les courses entre expiration et appel réseau)
const ACCESS_TOKEN_REFRESH_MS = 14 * 60 * 1000;

export type AuthState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string; role: string; companyId: number };

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

interface StoredSession {
  token: string;
  email: string;
  role: string;
  companyId: number;
  expiresAt: number;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token || Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function sessionFromResponse(res: Awaited<ReturnType<typeof loginRequest>>): StoredSession {
  const expiresAt = Date.parse(res.expiresAt);
  return {
    token: res.accessToken,
    email: res.user.email,
    role: res.user.role,
    companyId: res.user.company_id ?? 1,
    expiresAt: Number.isFinite(expiresAt)
      ? expiresAt
      : Date.now() + ACCESS_TOKEN_REFRESH_MS,
  };
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "unauthenticated" });
  const [ready, setReady] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Rotation silencieuse du token
  // ---------------------------------------------------------------------------
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await refreshTokenRequest();
      const session = sessionFromResponse(res);
      saveSession(session);
      setAuthToken(session.token);
      setAuth({ status: "authenticated", email: session.email, role: session.role, companyId: session.companyId });
      scheduleRefresh(session.expiresAt);
      return session.token;
    } catch {
      clearSession();
      setAuthToken(null);
      setOnTokenExpired(null);
      setAuth({ status: "unauthenticated" });
      return null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Planifier la rotation proactive (avant expiration)
  // ---------------------------------------------------------------------------
  function scheduleRefresh(expiresAt: number) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(0, expiresAt - Date.now() - 60_000); // 1 min avant expiration
    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Hydratation au montage
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setReady(true);
      return;
    }

    setAuthToken(session.token);
    setOnTokenExpired(silentRefresh);
    setAuth({ status: "authenticated", email: session.email, role: session.role, companyId: session.companyId });
    scheduleRefresh(session.expiresAt);

    // Revalidation contre /auth/me (détecte rotation de secret JWT ou révocation)
    fetchMe()
      .then((res) => {
        setAuth({
          status: "authenticated",
          email: res.user.email,
          role: res.user.role,
          companyId: res.user.company_id ?? 1,
        });
      })
      .catch(async () => {
        // Access token expiré → tentative de refresh silencieux
        const newToken = await silentRefresh();
        if (!newToken) {
          setReady(true);
        }
      })
      .finally(() => setReady(true));

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const res = await loginRequest(email, password);
        const session = sessionFromResponse(res);
        saveSession(session);
        setAuthToken(session.token);
        setOnTokenExpired(silentRefresh);
        setAuth({ status: "authenticated", email: session.email, role: session.role, companyId: session.companyId });
        scheduleRefresh(session.expiresAt);
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur de connexion.";
        return { ok: false, error: message };
      }
    },
    [silentRefresh] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    logoutRequest(); // best-effort — révoque le cookie côté serveur
    clearSession();
    setAuthToken(null);
    setOnTokenExpired(null);
    setAuth({ status: "unauthenticated" });
  }, []);

  return { auth, ready, login, logout };
}
