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

// Access token TTL côté front (14 min — légèrement inférieur aux 15 min serveur
// pour éviter les courses entre expiration et appel réseau)
const ACCESS_TOKEN_REFRESH_MS = 14 * 60 * 1000;

export type AuthState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string; role: string; companyId: number };

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

interface InMemorySession {
  token: string;
  email: string;
  role: string;
  companyId: number;
  expiresAt: number;
}

function sessionFromResponse(res: Awaited<ReturnType<typeof loginRequest>>): InMemorySession {
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

/**
 * useAuth — gestion d'auth côté client.
 *
 * SÉCURITÉ : aucun token n'est stocké dans localStorage ou sessionStorage.
 * - Le JWT d'accès vit uniquement en mémoire (variable module-level dans api.ts)
 * - Le refresh token est dans un cookie HttpOnly Secure SameSite=Lax (cc_refresh)
 * - Au montage, on tente une rotation silencieuse via le cookie pour rétablir
 *   la session sans demander de re-login si elle est encore valide
 * - Une éventuelle XSS ne peut donc plus voler le token (pas accessible JS)
 */
export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "unauthenticated" });
  const [ready, setReady] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Planifier la rotation proactive (avant expiration)
  // ---------------------------------------------------------------------------
  const scheduleRefresh = useCallback((expiresAt: number, refreshFn: () => Promise<string | null>) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(0, expiresAt - Date.now() - 60_000); // 1 min avant expiration
    refreshTimerRef.current = setTimeout(() => {
      refreshFn();
    }, delay);
  }, []);

  // ---------------------------------------------------------------------------
  // Rotation silencieuse du token via le cookie HttpOnly
  // ---------------------------------------------------------------------------
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await refreshTokenRequest();
      const session = sessionFromResponse(res);
      setAuthToken(session.token);
      setAuth({
        status: "authenticated",
        email: session.email,
        role: session.role,
        companyId: session.companyId,
      });
      scheduleRefresh(session.expiresAt, silentRefresh);
      return session.token;
    } catch {
      setAuthToken(null);
      setOnTokenExpired(null);
      setAuth({ status: "unauthenticated" });
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRefresh]);

  // ---------------------------------------------------------------------------
  // Hydratation au montage : tenter de rétablir la session via le cookie refresh
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    setOnTokenExpired(silentRefresh);

    silentRefresh()
      .then(async (token) => {
        if (cancelled) return;
        if (!token) {
          setReady(true);
          return;
        }
        // Revalidation contre /auth/me (détecte révocation côté serveur)
        try {
          const res = await fetchMe();
          if (!cancelled) {
            setAuth({
              status: "authenticated",
              email: res.user.email,
              role: res.user.role,
              companyId: res.user.company_id ?? 1,
            });
          }
        } catch {
          // /auth/me a échoué → la session est invalide
          if (!cancelled) {
            setAuthToken(null);
            setAuth({ status: "unauthenticated" });
          }
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [silentRefresh]);

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const res = await loginRequest(email, password);
        const session = sessionFromResponse(res);
        setAuthToken(session.token);
        setOnTokenExpired(silentRefresh);
        setAuth({
          status: "authenticated",
          email: session.email,
          role: session.role,
          companyId: session.companyId,
        });
        scheduleRefresh(session.expiresAt, silentRefresh);
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur de connexion.";
        return { ok: false, error: message };
      }
    },
    [silentRefresh, scheduleRefresh],
  );

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    logoutRequest(); // best-effort — révoque le cookie côté serveur
    setAuthToken(null);
    setOnTokenExpired(null);
    setAuth({ status: "unauthenticated" });
  }, []);

  return { auth, ready, login, logout };
}
