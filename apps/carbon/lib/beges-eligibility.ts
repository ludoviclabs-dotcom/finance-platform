/**
 * Éligibilité BEGES — normalisation du bloc `eligibility` de GET /beges/status.
 *
 * Contrat courant de l'API : `{status, label, periodicity_years, legal_basis,
 * notes}` avec `status` ∈ obligatoire | obligatoire_outre_mer | sous_seuil |
 * indetermine (« indetermine » quand l'effectif n'est pas renseigné).
 *
 * Rétrocompatibilité : une API antérieure renvoyait seulement `{status,
 * label}` avec `volontaire` (→ sous_seuil) et `obligatoire_om`
 * (→ obligatoire_outre_mer). Tout statut inconnu devient `indetermine` : sans
 * information fiable, l'UI ne conclut ni à une obligation ni à une dispense.
 *
 * Les textes réglementaires (base légale, notes) viennent de l'API ; les
 * libellés ci-dessous ne servent que de repli quand elle n'en fournit pas.
 */

export type BegesEligibilityStatus =
  | "obligatoire"
  | "obligatoire_outre_mer"
  | "sous_seuil"
  | "indetermine";

export interface BegesEligibility {
  status: BegesEligibilityStatus;
  label: string;
  /** Périodicité du bilan en années, `null` si non applicable ou inconnue. */
  periodicityYears: number | null;
  /** Base légale citée par l'API, `null` si absente. */
  legalBasis: string | null;
  notes: string[];
}

const STATUS_ALIASES: Record<string, BegesEligibilityStatus> = {
  obligatoire: "obligatoire",
  obligatoire_outre_mer: "obligatoire_outre_mer",
  obligatoire_om: "obligatoire_outre_mer",
  sous_seuil: "sous_seuil",
  volontaire: "sous_seuil",
  indetermine: "indetermine",
};

const FALLBACK_LABELS: Record<BegesEligibilityStatus, string> = {
  obligatoire: "Bilan GES réglementaire obligatoire",
  obligatoire_outre_mer: "Bilan GES réglementaire obligatoire (outre-mer)",
  sous_seuil: "Sous les seuils de l'obligation réglementaire",
  indetermine: "Éligibilité indéterminée : effectif non renseigné",
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeBegesEligibility(raw: unknown): BegesEligibility {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawStatus = text(src.status)?.toLowerCase() ?? "";
  const status = STATUS_ALIASES[rawStatus] ?? "indetermine";

  let label = text(src.label) ?? FALLBACK_LABELS[status];
  // Sans effectif connu, rien ne permet d'affirmer une démarche volontaire.
  if (status === "indetermine" && /volontaire/i.test(label)) {
    label = FALLBACK_LABELS.indetermine;
  }

  const periodicity = src.periodicity_years;
  const notes = Array.isArray(src.notes)
    ? src.notes.map(text).filter((n): n is string => n !== null)
    : [];

  return {
    status,
    label,
    periodicityYears:
      typeof periodicity === "number" && Number.isFinite(periodicity) && periodicity > 0
        ? periodicity
        : null,
    legalBasis: text(src.legal_basis),
    notes,
  };
}
