"use client";

import { useState, useEffect, useCallback } from "react";

import { fetchMe, loginRequest, setAuthToken } from "@/lib/api";

const SESSION_KEY = "carbonco_session_v2";

export type AuthState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string; role: string };

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

interface StoredSession {
  token: string;
  email: string;
  role: string;
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

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "unauthenticated" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setReady(true);
      return;
    }
    setAuthToken(session.token);
    setAuth({ status: "authenticated", email: session.email, role: session.role });

    // Best-effort revalidation against /auth/me — if the token was revoked or
    // the secret rotated, fall back to unauthenticated.
    fetchMe()
      .then((res) => {
        setAuth({
          status: "authenticated",
          email: res.user.email,
          role: res.user.role,
        });
      })
      .catch(() => {
        clearSession();
        setAuthToken(null);
        setAuth({ status: "unauthenticated" });
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const res = await loginRequest(email, password);
        const expiresAt = Date.parse(res.expiresAt);
        const session: StoredSession = {
          token: res.accessToken,
          email: res.user.email,
          role: res.user.role,
          expiresAt: Number.isFinite(expiresAt)
            ? expiresAt
            : Date.now() + 8 * 60 * 60 * 1000,
        };
        saveSession(session);
        setAuthToken(session.token);
        setAuth({
          status: "authenticated",
          email: session.email,
          role: session.role,
        });
        return { ok: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur de connexion.";
        return { ok: false, error: message };
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearSession();
    setAuthToken(null);
    setAuth({ status: "unauthenticated" });
  }, []);

  return { auth, ready, login, logout };
}
