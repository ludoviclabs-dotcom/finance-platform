/**
 * Verdict affiché par /verify/[hash] — logique pure, testée.
 *
 * QA 2026-09-16, m-10 : l'intitulé « Hash vérifié » surmontait aussi une
 * empreinte inconnue ou mal formée. L'intitulé dépend désormais du verdict.
 */

export type HashVerdict = "authentic" | "unknown" | "invalid" | "unreachable";

/** Longueur maximale réaffichée pour une saisie invalide (URL arbitraire). */
export const MAX_DISPLAYED_HASH_LENGTH = 128;

export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

/**
 * - `invalid`     : la saisie n'est pas un SHA-256 hexadécimal (aucun appel API) ;
 * - `unreachable` : le service de vérification n'a pas répondu ;
 * - `authentic`   : l'API reconnaît l'empreinte ;
 * - `unknown`     : l'API répond mais ne connaît pas l'empreinte.
 */
export function resolveHashVerdict(hash: string, api: { verified: boolean } | null): HashVerdict {
  if (!isSha256Hex(hash)) return "invalid";
  if (api === null) return "unreachable";
  return api.verified ? "authentic" : "unknown";
}

const HEADINGS: Record<HashVerdict, string> = {
  authentic: "Empreinte vérifiée",
  unknown: "Empreinte inconnue",
  invalid: "Format d'empreinte invalide",
  unreachable: "Empreinte non vérifiée",
};

/** Intitulé du bloc qui réaffiche l'empreinte soumise. */
export function hashPanelHeading(verdict: HashVerdict): string {
  return HEADINGS[verdict];
}

/** Empreinte telle que réaffichée : tronquée si la saisie est démesurée. */
export function displayedHash(hash: string): string {
  return hash.length > MAX_DISPLAYED_HASH_LENGTH ? `${hash.slice(0, MAX_DISPLAYED_HASH_LENGTH)}…` : hash;
}
