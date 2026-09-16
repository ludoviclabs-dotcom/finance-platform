/**
 * Consentement cookies — source de vérité UNIQUE du format stocké par la
 * bannière (components/cookie-banner.tsx) et lu par la mesure d'audience
 * (components/consent/consented-analytics.tsx).
 *
 * Format : localStorage["carbonco-cookie-consent"] = JSON
 *   { "choice": "accepted" | "rejected" | "essential-only",
 *     "savedAt": "<date ISO 8601>" }
 *
 * Politique (QA 2026-09-16, M-10) : la mesure d'audience exige un opt-in
 * explicite (« Tout accepter »). Toute autre valeur, une valeur absente,
 * illisible ou expirée, ou un stockage indisponible valent REFUS — rien n'est
 * chargé par défaut. Un choix fait dans l'onglet est diffusé par un événement
 * DOM ; un choix fait dans un autre onglet arrive par l'événement `storage`.
 *
 * Durée de validité : un choix (consentement OU refus) vaut
 * CONSENT_VALIDITY_MONTHS mois, puis la bannière est de nouveau proposée.
 * La CNIL considère que conserver ces choix, « tant le consentement que le
 * refus », pendant 6 mois est une bonne pratique (recommandation « cookies et
 * autres traceurs », délibération n° 2020-092 du 17 septembre 2020, version
 * consolidée du 16 janvier 2026, partie « S'agissant de la conservation des
 * choix »).
 * L'ancien format (valeur brute, sans date) ne permet pas de dater le choix :
 * il est traité comme « aucun choix » et la bannière est reproposée une fois.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "carbonco-cookie-consent";

/** Émis sur `window` après chaque choix fait dans la bannière. */
export const COOKIE_CONSENT_CHANGE_EVENT = "carbonco:cookie-consent-change";

/** Émis pour rouvrir la bannière (lien « Gérer mes cookies »). */
export const COOKIE_PREFERENCES_OPEN_EVENT = "carbonco:cookie-preferences-open";

/** Durée de validité d'un choix, en mois calendaires. */
export const CONSENT_VALIDITY_MONTHS = 6;

/** Tolérance d'horloge : un choix daté de plus d'un jour dans le futur est altéré. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

export const COOKIE_CONSENT_VALUES = ["accepted", "rejected", "essential-only"] as const;
export type CookieConsent = (typeof COOKIE_CONSENT_VALUES)[number];

export interface CookieConsentRecord {
  choice: CookieConsent;
  savedAt: Date;
  expiresAt: Date;
}

type ConsentStorage = Pick<Storage, "getItem" | "setItem">;

function isCookieConsent(value: unknown): value is CookieConsent {
  return typeof value === "string" && (COOKIE_CONSENT_VALUES as readonly string[]).includes(value);
}

/**
 * Date d'expiration : même jour, CONSENT_VALIDITY_MONTHS mois plus tard (UTC),
 * ramené au dernier jour du mois si ce jour n'existe pas (31 août → 28/29 février).
 */
export function consentExpiresAt(savedAt: Date): Date {
  const target = new Date(savedAt.getTime());
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + CONSENT_VALIDITY_MONTHS);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/**
 * Valeur brute stockée → choix daté et encore valide, ou `null` (absent,
 * altéré, ancien format sans date, daté dans le futur, expiré).
 */
export function parseCookieConsentRecord(raw: unknown, now: number = Date.now()): CookieConsentRecord | null {
  if (typeof raw !== "string" || !raw.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { choice, savedAt } = parsed as { choice?: unknown; savedAt?: unknown };
  if (!isCookieConsent(choice) || typeof savedAt !== "string") return null;
  const saved = new Date(savedAt);
  if (Number.isNaN(saved.getTime()) || saved.getTime() > now + MAX_CLOCK_SKEW_MS) return null;
  const expiresAt = consentExpiresAt(saved);
  if (now >= expiresAt.getTime()) return null;
  return { choice, savedAt: saved, expiresAt };
}

/** Valeur brute stockée → choix encore valide, ou `null`. */
export function parseCookieConsent(raw: unknown, now: number = Date.now()): CookieConsent | null {
  return parseCookieConsentRecord(raw, now)?.choice ?? null;
}

export function serializeCookieConsent(choice: CookieConsent, now: number = Date.now()): string {
  return JSON.stringify({ choice, savedAt: new Date(now).toISOString() });
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
let volatileConsent: string | null = null;

function browserStorage(): ConsentStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // accès refusé (cookies bloqués)
  }
}

function readRaw(storage: ConsentStorage | null): string | null {
  if (volatileConsent) return volatileConsent;
  if (!storage) return null;
  try {
    return storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readCookieConsentRecord(
  storage: ConsentStorage | null = browserStorage(),
  now: number = Date.now(),
): CookieConsentRecord | null {
  return parseCookieConsentRecord(readRaw(storage), now);
}

export function readCookieConsent(
  storage: ConsentStorage | null = browserStorage(),
  now: number = Date.now(),
): CookieConsent | null {
  return readCookieConsentRecord(storage, now)?.choice ?? null;
}

export function saveCookieConsent(
  value: CookieConsent,
  storage: ConsentStorage | null = browserStorage(),
  now: number = Date.now(),
): void {
  const raw = serializeCookieConsent(value, now);
  volatileConsent = null;
  try {
    if (!storage) throw new Error("stockage indisponible");
    storage.setItem(COOKIE_CONSENT_STORAGE_KEY, raw);
  } catch {
    // Le choix vaut au moins pour la page courante.
    volatileConsent = raw;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: value }));
  }
}

/** Plus long délai accepté par setTimeout (≈ 24,8 jours). */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Abonnement compatible `useSyncExternalStore`. Un minuteur prévient aussi
 * l'abonné à l'expiration du choix courant : un onglet resté ouvert repropose
 * la bannière et coupe la mesure d'audience sans rechargement.
 */
export function subscribeCookieConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const armExpiryTimer = () => {
    clearTimeout(timer);
    timer = undefined;
    const record = readCookieConsentRecord();
    if (!record) return;
    const delay = record.expiresAt.getTime() - Date.now();
    timer = setTimeout(() => {
      // Délai trop long pour un seul minuteur : on réarme sans notifier.
      if (delay <= MAX_TIMER_MS) onChange();
      armExpiryTimer();
    }, Math.max(0, Math.min(delay, MAX_TIMER_MS)));
  };
  const onLocalChange = () => {
    armExpiryTimer();
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    // `key === null` : localStorage.clear() dans un autre onglet.
    if (event.key !== null && event.key !== COOKIE_CONSENT_STORAGE_KEY) return;
    volatileConsent = null;
    onLocalChange();
  };
  armExpiryTimer();
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onLocalChange);
  window.addEventListener("storage", onStorage);
  return () => {
    clearTimeout(timer);
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onLocalChange);
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
 * Routes dont le 1er segment dynamique est un jeton d'accès (lien de
 * questionnaire fournisseur, partage d'audit) : il ne doit jamais partir vers
 * l'outil de mesure.
 */
const TOKEN_ROUTES: readonly string[] = ["q", "audit"];
const TOKEN_QUERY_PARAMS: readonly string[] = ["token", "code"];
const URL_BASE = "https://carbonco.invalid";

/** URL sans jeton : `/q/abc…` → `/q/[token]`, paramètres `token`/`code` retirés. */
export function redactSensitiveUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, URL_BASE);
  } catch {
    return url;
  }
  const segments = parsed.pathname.split("/");
  if (TOKEN_ROUTES.includes(segments[1] ?? "") && segments[2]) {
    segments[2] = "[token]";
    parsed.pathname = segments.join("/");
  }
  for (const key of TOKEN_QUERY_PARAMS) parsed.searchParams.delete(key);
  if (parsed.origin === URL_BASE && !url.startsWith(URL_BASE)) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return parsed.toString();
}

/**
 * Filtre `beforeSend` commun aux deux SDK : un script déjà chargé ne doit plus
 * rien émettre après un retrait (ou l'expiration) du consentement, et aucun
 * jeton présent dans l'URL n'est transmis.
 */
export function dropWithoutConsent<T extends { url: string }>(event: T): T | null {
  if (!allowsAudienceMeasurement(readCookieConsent())) return null;
  return { ...event, url: redactSensitiveUrl(event.url) };
}
