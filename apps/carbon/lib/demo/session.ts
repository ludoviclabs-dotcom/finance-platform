/** Paramètres partagés de la session démo locale. */

export const DEMO_SESSION_COOKIE = "cc_demo_session";
export const DEMO_SESSION_TTL_SECONDS = 2 * 60 * 60;

export const DEMO_SESSION_USER = {
  email: "demo-session@exemplia-industrie.invalid",
  role: "viewer",
  companyId: 0,
} as const;
