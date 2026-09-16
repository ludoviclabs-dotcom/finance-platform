/** Paramètres partagés de la session démo locale. */

export const DEMO_SESSION_COOKIE = "cc_demo_session";
export const DEMO_SESSION_TTL_SECONDS = 2 * 60 * 60;

export const DEMO_SESSION_USER = {
  email: "demo-session@exemplia-industrie.invalid",
  role: "viewer",
  companyId: 0,
} as const;

/** Surface publique ouverte par défaut par le bouton démo de /login. */
export const DEMO_HOME = "/demo";

/** Parcours de démonstration dédié aux Ressources stratégiques (public). */
export const DEMO_RESOURCES_TOUR = "/demo/asterion-resources";

/**
 * Destination du bouton démo de /login selon la page demandée (`next`).
 * La session démo est isolée : elle n'ouvre jamais le cockpit réel
 * (proxy.ts redirige toute route métier vers /demo). Pour /resources, on
 * ouvre donc le parcours fictif équivalent plutôt que l'accueil de la démo.
 */
export function demoEntryFor(safeNext: string): string {
  return safeNext === "/resources" || safeNext.startsWith("/resources/") || safeNext.startsWith("/resources?")
    ? DEMO_RESOURCES_TOUR
    : DEMO_HOME;
}
