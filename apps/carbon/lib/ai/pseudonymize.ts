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

/** Valeurs texte des champs identifiants trouvées dans les contextes (raison sociale, SIREN…). */
export function collectIdentifyingValues(...contexts: unknown[]): string[] {
  const found = new Set<string>();
  const walk = (data: unknown) => {
    if (Array.isArray(data)) return data.forEach(walk);
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (isIdentifyingKey(key) && (typeof value === "string" || typeof value === "number")) {
          const text = String(value).trim();
          if (text.length >= 2) found.add(text);
        } else {
          walk(value);
        }
      }
    }
  };
  contexts.forEach(walk);
  // Les plus longues d'abord : « Acme Industries SA » avant « Acme ».
  return [...found].sort((a, b) => b.length - a.length);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const IDENTIFIER_PLACEHOLDER = "[identifiant masqué]";

/**
 * Identifiants reconnaissables sans contexte. Le SIREN (9 chiffres) et le LEI
 * ne sont remplacés que précédés de leur libellé (conservé), pour ne pas
 * confondre un indicateur chiffré avec un identifiant.
 */
const IDENTIFIER_PATTERNS: Array<[RegExp, string]> = [
  [/\b(SIREN|SIRET)(\s*(?:n[°o]\s*)?:?\s*)\d(?:\s?\d){8,13}\b/gi, `$1$2${IDENTIFIER_PLACEHOLDER}`],
  [/\b(LEI)(\s*:?\s*)[A-Z0-9]{20}\b/gi, `$1$2${IDENTIFIER_PLACEHOLDER}`],
  [/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/g, IDENTIFIER_PLACEHOLDER], // SIRET seul
  [/\bFR\s?[0-9A-Z]{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g, IDENTIFIER_PLACEHOLDER], // TVA intracom. FR
];

/**
 * Remplace dans un texte libre les valeurs identifiantes connues (par l'alias)
 * et les identifiants reconnaissables (par un marqueur neutre).
 */
export function pseudonymizeText(text: string, knownValues: readonly string[] = []): string {
  let out = text;
  for (const value of knownValues) {
    const replacement = /^[\d\s]+$/.test(value) ? IDENTIFIER_PLACEHOLDER : COMPANY_ALIAS;
    out = out.replace(new RegExp(escapeRegExp(value), "gi"), replacement);
  }
  for (const [pattern, replacement] of IDENTIFIER_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Pseudonymise le texte des messages de conversation (parties `text`) : la
 * question d'un utilisateur peut contenir la raison sociale ou un identifiant.
 */
export function pseudonymizeMessages<M extends { parts?: readonly unknown[] }>(
  messages: readonly M[],
  knownValues: readonly string[] = [],
): M[] {
  return messages.map((message) => {
    if (!Array.isArray(message.parts)) return message;
    return {
      ...message,
      parts: message.parts.map((part) => {
        const p = part as { type?: unknown; text?: unknown };
        return p && p.type === "text" && typeof p.text === "string"
          ? { ...p, text: pseudonymizeText(p.text, knownValues) }
          : part;
      }),
    };
  });
}
