"use client";

/**
 * AuthContext — expose l'état d'auth déjà hydraté par le SEUL `useAuth()` du
 * layout `(app)` aux pages enfants, en lecture seule.
 *
 * Motivation : `use-demo-access` rappelle qu'il ne doit y avoir « qu'un seul
 * useAuth() par arbre » (sinon deux cycles d'hydratation concurrents peuvent se
 * marcher dessus). Une page qui a seulement besoin de savoir si la session est
 * une démo lit donc ce contexte plutôt que d'instancier un second useAuth().
 */

import { createContext, useContext, type ReactNode } from "react";
import type { AuthState } from "./use-auth";

const AuthContext = createContext<AuthState>({ status: "unauthenticated" });

export function AuthProvider({ value, children }: { value: AuthState; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** État d'auth courant (lecture seule), tel que fourni par le layout `(app)`. */
export function useAuthState(): AuthState {
  return useContext(AuthContext);
}

/**
 * `true` uniquement pour une session de démonstration produit (tenant Asterion,
 * JWT à claim `demo`). Sert à afficher le contexte démo (bannière, état vide
 * dédié) — jamais à débloquer une capacité ni à exposer un interne d'admin.
 */
export function useIsDemoSession(): boolean {
  const auth = useContext(AuthContext);
  return auth.status === "authenticated" && auth.isDemo;
}
