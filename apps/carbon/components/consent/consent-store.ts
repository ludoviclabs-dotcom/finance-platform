/**
 * Consentement cookies — source de vérité UNIQUE du format stocké par la
 * bannière (components/cookie-banner.tsx) et lu par la mesure d'audience
 * (components/consent/consented-analytics.tsx).
 *
 * Format : localStorage["carbonco-cookie-consent"] ∈
 *   "accepted" | "rejected" | "essential-only"
 *
 * Politique (QA 2026-09-16, M-10) : la mesure d'audience exige un opt-in
 * explicite (« Tout accepter »). Toute autre valeur, une valeur absente ou
 * illisible, ou un stockage indisponible valent REFUS — rien n'est chargé par
 * défaut. Un choix fait dans l'onglet est diffusé par un événement DOM ; un
 * choix fait dans un autre onglet arrive par l'événement `storage`.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "carbonco-cookie-consent";

/** Émis sur `window` après chaque choix fait dans la bannière. */
export const COOKIE_CONSENT_CHANGE_EVENT = "carbonco:cookie-consent-change";

/** Émis pour rouvrir la bannière (lien « Gérer mes cookies »). */
export const COOKIE_PREFERENCES_OPEN_EVENT = "carbonco:cookie-preferences-open";

export const COOKIE_CONSENT_VALUES = ["accepted", "rejected", "essential-only"] as const;
export type CookieConsent = (typeof COOKIE_CONSENT_VALUES)[number];

type ConsentStorage = Pick<Storage, "getItem" | "setItem">;

/** Valeur brute → choix connu, ou `null` (absent, altéré, autre type). */
export function parseCookieConsent(raw: unknown): CookieConsent | null {
  return typeof raw === "string" && (COOKIE_CONSENT_VALUES as readonly string[]).includes(raw)
    ? (raw as CookieConsent)
    : null;
}

/** Seul un « Tout accepter » explicite autorise la mesure d'audience. */
export function allowsAudienceMeasurement(consent: CookieConsent | null | undefined): boolean {
  return consent === "accepted";
}

/**
 * Choix fait dans cette page alors que le stockage a échoué (mode privé,
 * quota) : il prime sur une valeur stockée devenue obsolète, et il est oublié
 * dès qu'un autre onglet modifie le stockage.
 */
let volatileConsent: CookieConsent | null = null;

function browserStorage(): ConsentStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // accès refusé (cookies bloqués)
  }
}

export function readCookieConsent(
  storage: ConsentStorage | null = browserStorage(),
): CookieConsent | null {
  if (volatileConsent) return volatileConsent;
  if (!storage) return null;
  try {
    return parseCookieConsent(storage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveCookieConsent(
  value: CookieConsent,
  storage: ConsentStorage | null = browserStorage(),
): void {
  volatileConsent = null;
  try {
    if (!storage) throw new Error("stockage indisponible");
    storage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
  } catch {
    // Le choix vaut au moins pour la page courante.
    volatileConsent = value;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: value }));
  }
}

/** Abonnement compatible `useSyncExternalStore`. */
export function subscribeCookieConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    // `key === null` : localStorage.clear() dans un autre onglet.
    if (event.key !== null && event.key !== COOKIE_CONSENT_STORAGE_KEY) return;
    volatileConsent = null;
    onChange();
  };
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Demande à la bannière de se rouvrir (retrait ou modification du choix). */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_OPEN_EVENT));
}

/* ── Activation des outils Vercel ─────────────────────────────────────────── */

export interface MeasurementEnv {
  NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS?: string;
  NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS?: string;
}

export interface MeasurementFlags {
  analytics: boolean;
  speedInsights: boolean;
}

/**
 * Chaque outil exige son drapeau explicite à "1" : Web Analytics et Speed
 * Insights s'activent séparément dans le projet Vercel, et un script appelé
 * sans l'activation correspondante répond 404 sur chaque page (QA m-08).
 */
export function resolveMeasurementFlags(env: MeasurementEnv): MeasurementFlags {
  return {
    analytics: env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "1",
    speedInsights: env.NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS === "1",
  };
}

// Accès littéraux : Next.js ne remplace `process.env.NEXT_PUBLIC_*` dans le
// bundle client que sous cette forme exacte.
export const MEASUREMENT_FLAGS: MeasurementFlags = resolveMeasurementFlags({
  NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS,
  NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS: process.env.NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS,
});

/** Événement de mesure autorisé maintenant (drapeau activé ET opt-in lu à l'instant). */
export function canSendAudienceEvent(
  flags: MeasurementFlags = MEASUREMENT_FLAGS,
  consent: CookieConsent | null = readCookieConsent(),
): boolean {
  return flags.analytics && allowsAudienceMeasurement(consent);
}

/**
 * Filtre `beforeSend` commun aux deux SDK : un script déjà chargé ne doit plus
 * rien émettre après un retrait du consentement.
 */
export function dropWithoutConsent<T>(event: T): T | null {
  return allowsAudienceMeasurement(readCookieConsent()) ? event : null;
}
