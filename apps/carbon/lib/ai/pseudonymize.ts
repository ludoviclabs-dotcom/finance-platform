/**
 * Pseudonymisation du contexte envoyé au modèle par le copilote NEURAL
 * (T9.2 du PLAN_ACTION_CSRD_2026-11).
 *
 * La page /trust/sub-processors annonce que le copilote reçoit des indicateurs
 * chiffrés avec un alias d'entreprise, sans raison sociale ni identifiant. Ce
 * module rend cette phrase vraie : il remplace, à toute profondeur, les champs
 * qui identifient l'entreprise par un alias stable, avant toute sérialisation
 * dans le prompt. Les indicateurs chiffrés ne sont pas modifiés.
 */

export const COMPANY_ALIAS = "Entreprise A";

/** Clés qui identifient l'entreprise cliente (comparaison insensible à la casse). */
const IDENTIFYING_KEYS = new Set(
  [
    "company",
    "companyName",
    "company_name",
    "raisonSociale",
    "raison_sociale",
    "legalName",
    "legal_name",
    "entreprise",
    "nomEntreprise",
    "siren",
    "siret",
    "lei",
    "vat",
    "tva",
    "tvaIntracom",
  ].map((k) => k.toLowerCase()),
);

export function isIdentifyingKey(key: string): boolean {
  return IDENTIFYING_KEYS.has(key.toLowerCase());
}

/** Copie profonde de `data` où chaque champ identifiant non vide vaut `COMPANY_ALIAS`. */
export function pseudonymizeContext<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => pseudonymizeContext(item)) as T;
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (isIdentifyingKey(key) && value !== null && value !== undefined && value !== "") {
        out[key] = COMPANY_ALIAS;
      } else {
        out[key] = pseudonymizeContext(value);
      }
    }
    return out as T;
  }
  return data;
}
