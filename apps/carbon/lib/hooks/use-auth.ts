"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Demo credentials — Phase 0 only.
// Replace with a real auth backend before going to production.
// ---------------------------------------------------------------------------
const DEMO_CREDENTIALS = [
  { email: "demo@carbonco.fr", password: "CarbonCo2024!" },
  { email: "admin@carbonco.fr", password: "Admin2024!" },
];

const SESSION_KEY = "carbonco_session";

export type AuthState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string };

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "unauthenticated" });
  const [ready, setReady] = useState(false);

  // Rehydrate from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const { email, expiresAt } = JSON.parse(stored) as { email: string; expiresAt: number };
        if (Date.now() < expiresAt) {
          setAuth({ status: "authenticated", email });
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setReady(true);
  }, []);

  const login = useCallback((email: string, password: string): LoginResult => {
    const match = DEMO_CREDENTIALS.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password
    );
    if (!match) {
      return { ok: false, error: "Email ou mot de passe incorrect." };
    }
    // Session valid 8 hours
    const session = { email: match.email, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setAuth({ status: "authenticated", email: match.email });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setAuth({ status: "unauthenticated" });
  }, []);

  return { auth, ready, login, logout };
}
