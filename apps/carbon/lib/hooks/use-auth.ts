"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import {
  clearDemoSessionRequest,
  demoLoginRequest,
  fetchMe,
  getDemoSessionRequest,
  getAuthToken,
  loginRequest,
  logoutRequest,
  refreshTokenRequest,
  setAuthToken,
  setOnTokenExpired,
  SERVICE_UNAVAILABLE_MESSAGE,
  verifyTotpRequest,
} from "@/lib/api";

// Access token TTL côté front (14 min — légèrement inférieur aux 15 min serveur
// pour éviter les courses entre expiration et appel réseau)
const ACCESS_TOKEN_REFRESH_MS = 14 * 60 * 1000;

export type AuthState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string; role: string; companyId: number; isDemo: boolean };

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string }
  // 2FA : le mot de passe est correct mais un code TOTP est requis (étape 2).
  | { ok: false; totpRequired: true; preAuthToken: string };

interface InMemorySession {
  token: string;
  email: string;
  role: string;
  companyId: number;
  isDemo: boolean;
  expiresAt: number;
}

/**
 * Les requêtes d'authentification de lib/api ne lèvent que des `Error` au
 * message présentable. Un TypeError (réseau imprévu, réponse de forme
 * inattendue) ou un SyntaxError (corps non JSON) n'a pas de message
 * montrable : il devient le message de repli.
 */
function presentableAuthError(err: unknown, fallback = SERVICE_UNAVAILABLE_MESSAGE): string {
  if (err instanceof TypeError || err instanceof SyntaxError) return fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function sessionFromResponse(res: Awaited<ReturnType<typeof loginRequest>>): InMemorySession {
  const expiresAt = Date.parse(res.expiresAt);
  return {
    token: res.accessToken,
    email: res.user.email,
    role: res.user.role,
    companyId: res.user.company_id ?? 1,
    isDemo: res.user.is_demo ?? false,
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
  const silentRefreshRef = useRef<() => Promise<string | null>>(async () => null);

  // ---------------------------------------------------------------------------
  // Planifier la rotation proactive (avant expiration)
  // ---------------------------------------------------------------------------
  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(0, expiresAt - Date.now() - 60_000); // 1 min avant expiration
    refreshTimerRef.current = setTimeout(() => {
      void silentRefreshRef.current();
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
        isDemo: session.isDemo,
      });
      scheduleRefresh(session.expiresAt);
      return session.token;
    } catch {
      setAuthToken(null);
      setOnTokenExpired(null);
      setAuth({ status: "unauthenticated" });
      return null;
    }
  }, [scheduleRefresh]);

  useEffect(() => {
    silentRefreshRef.current = silentRefresh;
  }, [silentRefresh]);

  // ---------------------------------------------------------------------------
  // Hydratation au montage.
  //
  // Ordre :
  //   1. Si un access token est déjà en mémoire (cas : navigation client après
  //      login fraîchement réussi sur une autre page), on valide via /auth/me
  //      directement. Évite un silentRefresh qui, en cas d'échec cookie cross-
  //      site (vercel.app sur PSL → cookie SameSite bloqué), écraserait
  //      `_authToken` à null et casserait la session.
  //   2. Sinon (premier mount, rechargement page), on tente la rotation
  //      silencieuse via le cookie refresh.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    setOnTokenExpired(silentRefresh);

    const hydrate = async (): Promise<void> => {
      const inMemoryToken = getAuthToken();

      // Cas 1 : token déjà présent → validation directe via /auth/me.
      if (inMemoryToken) {
        try {
          const res = await fetchMe();
          if (cancelled) return;
          setAuth({
            status: "authenticated",
            email: res.user.email,
            role: res.user.role,
            companyId: res.user.company_id ?? 1,
            isDemo: res.user.is_demo ?? false,
          });
          return;
        } catch {
          // Le token en mémoire est invalide → on tombe sur le path refresh.
          // setAuthToken(null) est volontairement omis ici : silentRefresh
          // s'en chargera si la rotation échoue aussi.
        }
      }

      // Cas 2 : tenter une rotation silencieuse via le cookie refresh.
      const token = await silentRefresh();
      if (cancelled) return;
      if (!token) {
        // La session démo est volontairement HttpOnly : on demande seulement
        // son état au Route Handler, jamais sa valeur au navigateur.
        try {
          const demo = await getDemoSessionRequest();
          if (!cancelled && demo) {
            setAuth({
              status: "authenticated",
              email: demo.user.email,
              role: demo.user.role,
              companyId: demo.user.company_id ?? 0,
              isDemo: true,
            });
          }
        } catch {
          // Une session démo absente ou indisponible laisse l'état déconnecté.
        }
        return;
      }

      // Le silentRefresh a déjà setAuth({authenticated}). On revalide quand
      // même via /auth/me pour détecter une révocation serveur immédiate.
      try {
        const res = await fetchMe();
        if (!cancelled) {
          setAuth({
            status: "authenticated",
            email: res.user.email,
            role: res.user.role,
            companyId: res.user.company_id ?? 1,
            isDemo: res.user.is_demo ?? false,
          });
        }
      } catch {
        if (!cancelled) {
          setAuthToken(null);
          setAuth({ status: "unauthenticated" });
        }
      }
    };

    hydrate().finally(() => {
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
  // Établit la session à partir d'une réponse de login/totp complète.
  const establishSession = useCallback(
    (res: Awaited<ReturnType<typeof loginRequest>>) => {
      const session = sessionFromResponse(res);
      setAuthToken(session.token);
      setOnTokenExpired(silentRefresh);
      setAuth({
        status: "authenticated",
        email: session.email,
        role: session.role,
        companyId: session.companyId,
        isDemo: session.isDemo,
      });
      scheduleRefresh(session.expiresAt);
    },
    [silentRefresh, scheduleRefresh],
  );

  const clearDemoBeforeRealSession = useCallback(async (): Promise<string | null> => {
    try {
      await clearDemoSessionRequest();
      return null;
    } catch {
      return "Connexion indisponible pour le moment. Réessayez.";
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const clearError = await clearDemoBeforeRealSession();
        if (clearError) return { ok: false, error: clearError };
        const res = await loginRequest(email, password);
        // 2FA activée : on s'arrête à l'étape mot de passe et on remonte le
        // token pré-auth ; la session n'est pas encore établie.
        if (res.requiresTotp && res.preAuthToken) {
          return { ok: false, totpRequired: true, preAuthToken: res.preAuthToken };
        }
        establishSession(res);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: presentableAuthError(err) };
      }
    },
    [clearDemoBeforeRealSession, establishSession],
  );

  // Session de démonstration produit : le JWT reste dans un cookie HttpOnly
  // same-origin ; il n'est jamais exposé au bundle ni envoyé aux APIs métier.
  const loginDemo = useCallback(async (): Promise<LoginResult> => {
    try {
      await demoLoginRequest();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      setAuthToken(null);
      setOnTokenExpired(null);
      setAuth({
        status: "authenticated",
        email: "demo-session@exemplia-industrie.invalid",
        role: "viewer",
        companyId: 0,
        isDemo: true,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: presentableAuthError(err, "Accès démo indisponible pour le moment.") };
    }
  }, []);

  // Quitte une session de démonstration : le cookie HttpOnly n'est effaçable
  // que côté serveur (DELETE /api/auth/demo). L'état local ne repasse à
  // « déconnecté » qu'une fois l'effacement confirmé, pour ne jamais afficher
  // un formulaire de connexion alors que la session démo reste active.
  const exitDemo = useCallback(async (): Promise<LoginResult> => {
    try {
      await clearDemoSessionRequest();
    } catch {
      return {
        ok: false,
        error: "Impossible de quitter la démonstration pour le moment. Réessayez dans quelques instants.",
      };
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setAuthToken(null);
    setAuth({ status: "unauthenticated" });
    return { ok: true };
  }, []);

  // Étape 2 du login : valide le code TOTP (ou un code de récupération).
  const verifyTotp = useCallback(
    async (preAuthToken: string, code: string): Promise<LoginResult> => {
      try {
        const clearError = await clearDemoBeforeRealSession();
        if (clearError) return { ok: false, error: clearError };
        const res = await verifyTotpRequest(preAuthToken, code);
        establishSession(res);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: presentableAuthError(err) };
      }
    },
    [clearDemoBeforeRealSession, establishSession],
  );

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    logoutRequest(); // best-effort — révoque le cookie côté serveur
    void clearDemoSessionRequest().catch(() => {
      // Le nettoyage est best-effort, comme la révocation backend.
    });
    setAuthToken(null);
    setOnTokenExpired(null);
    setAuth({ status: "unauthenticated" });
  }, []);

  return { auth, ready, login, loginDemo, exitDemo, verifyTotp, logout };
}
