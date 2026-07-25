/**
 * lib/water-decision/scenario-form.ts — saisie, validation et mise en requête
 * du calculateur financier hydrique (Wave E-Interface, commit F2).
 *
 * Module PUR : aucun React, aucun `fetch`, aucun stockage. Le formulaire est un
 * objet de chaînes ; la validation est une fonction ; la requête POST est son
 * produit. Tout le comportement du calculateur se teste donc sans DOM.
 *
 * ## Le formulaire est vide, et c'est le contrat
 *
 * `emptyScenarioDraft()` ne pose AUCUNE valeur : ni taux d'actualisation, ni
 * probabilité, ni marge, ni année. Pas de `placeholder` chiffré non plus dans
 * l'interface — un placeholder « 0,08 » se lit comme un taux recommandé, et
 * personne ne saurait dire ensuite qui l'a choisi.
 *
 * Le moteur exige déjà ces valeurs côté serveur ; les proposer ici les
 * transformerait en hypothèses de la maison, présentées au nom de
 * l'utilisateur.
 *
 * ## Les montants restent des chaînes
 *
 * `value` ne devient jamais un `number`. Un flottant binaire JavaScript
 * réintroduirait à la frontière l'imprécision que le moteur écarte
 * explicitement côté serveur (`ROUND_HALF_EVEN`, 2 décimales).
 *
 * `Number()` n'apparaît QUE dans les comparaisons de validation (un ratio
 * est-il dans [0, 1] ? une année est-elle postérieure à une autre ?). La chaîne
 * transmise reste celle que l'utilisateur a saisie, normalisée au seul point
 * décimal.
 *
 * ## Unités et obligation viennent du contrat
 *
 * Les huit paramètres, leurs unités et leur caractère obligatoire sont lus dans
 * `FINANCIAL_ENGINE` — le miroir du document émis par le backend. L'interface
 * ne peut donc pas dériver du moteur : si le contrat change, la saisie change
 * avec lui, ou le test de couverture échoue.
 */

import {
  WiFinancialScenarioRequestSchema,
  type WiFinancialScenarioRequest,
  type WiInputProvenance,
  type WiQuantityInput,
} from "@/lib/api/water-decision";
import {
  FINANCIAL_ENGINE,
  UNIT_LABELS,
  type WiEngineUnit,
} from "@/lib/water-intelligence/financial-engine";

/* ---------------------------------------------------------------- Modèle */

/** Les huit grandeurs du contrat moteur. */
export type QuantityField =
  | "outage_days"
  | "affected_capacity_share"
  | "revenue_per_day"
  | "margin_rate"
  | "additional_opex_per_day"
  | "adaptation_capex"
  | "discount_rate"
  | "probability";

/**
 * Une grandeur en cours de saisie.
 *
 * `provenance` accepte `""` — « non déclarée ». Ce n'est pas un défaut caché :
 * c'est l'absence de choix, et elle est refusée à la validation. Pré-cocher
 * « observé » ou « hypothèse » signerait une origine à la place de l'humain.
 */
export interface QuantityDraft {
  value: string;
  provenance: "" | WiInputProvenance;
  basis: string;
}

export interface ScenarioDraft {
  scenario_code: string;
  label: string;
  base_year: string;
  horizon_year: string;
  sensitivity_variation_pct: string;
  /** Un signal par ligne. Vide = aucun signal déclaré, jamais un signal supposé. */
  signals: string;
  quantities: Record<QuantityField, QuantityDraft>;
}

export const QUANTITY_ORDER: readonly QuantityField[] = [
  "outage_days",
  "affected_capacity_share",
  "revenue_per_day",
  "margin_rate",
  "additional_opex_per_day",
  "adaptation_capex",
  "discount_rate",
  "probability",
] as const;

/** Formulaire vierge. Nouvelle instance à chaque appel — aucun état partagé. */
export function emptyScenarioDraft(): ScenarioDraft {
  const quantities = Object.fromEntries(
    QUANTITY_ORDER.map((field) => [field, { value: "", provenance: "", basis: "" }]),
  ) as Record<QuantityField, QuantityDraft>;
  return {
    scenario_code: "",
    label: "",
    base_year: "",
    horizon_year: "",
    sensitivity_variation_pct: "",
    signals: "",
    quantities,
  };
}

/** Vrai si aucun caractère n'a été saisi nulle part. */
export function isDraftPristine(draft: ScenarioDraft): boolean {
  const scalars = [
    draft.scenario_code,
    draft.label,
    draft.base_year,
    draft.horizon_year,
    draft.sensitivity_variation_pct,
    draft.signals,
  ];
  if (scalars.some((v) => v !== "")) return false;
  return QUANTITY_ORDER.every((field) => {
    const q = draft.quantities[field];
    return q.value === "" && q.provenance === "" && q.basis === "";
  });
}

/* ------------------------------------------------------------- Étapes */

export type StepId = "interruption" | "activite" | "adaptation" | "revue";

export interface StepDefinition {
  readonly id: StepId;
  readonly title: string;
  readonly purpose: string;
  readonly quantities: readonly QuantityField[];
}

/**
 * Quatre étapes. La troisième porte l'adaptation ET les descripteurs du
 * scénario (identifiant, années, amplitude de sensibilité) : ce sont des
 * caractéristiques du scénario, pas des grandeurs d'exploitation, et son titre
 * les annonce.
 */
export const STEPS: readonly StepDefinition[] = [
  {
    id: "interruption",
    title: "Interruption",
    purpose: "Durée de l’arrêt envisagé et part de la capacité réellement touchée.",
    quantities: ["outage_days", "affected_capacity_share"],
  },
  {
    id: "activite",
    title: "Activité",
    purpose: "Grandeurs d’exploitation de l’activité exposée.",
    quantities: ["revenue_per_day", "margin_rate", "additional_opex_per_day"],
  },
  {
    id: "adaptation",
    title: "Adaptation et scénario",
    purpose:
      "Investissement envisagé, horizon, taux d’actualisation fourni et probabilité facultative fournie.",
    quantities: ["adaptation_capex", "discount_rate", "probability"],
  },
  {
    id: "revue",
    title: "Revue",
    purpose: "Toutes les hypothèses, leurs unités, leur origine et les avertissements.",
    quantities: [],
  },
] as const;

export const STEP_COUNT = STEPS.length;
export const REVIEW_STEP_INDEX = STEPS.findIndex((s) => s.id === "revue");

/** Déplacement borné : ni avant la première étape, ni après la dernière. */
export function clampStep(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), STEP_COUNT - 1);
}

/* ------------------------------------------- Métadonnées issues du contrat */

export interface QuantityMeta {
  readonly field: QuantityField;
  readonly label: string;
  readonly unit: WiEngineUnit;
  readonly unitLabel: string;
  readonly required: boolean;
  readonly description: string;
}

const QUANTITY_LABELS: Record<QuantityField, string> = {
  outage_days: "Jours d’arrêt",
  affected_capacity_share: "Part de capacité affectée",
  revenue_per_day: "Revenu journalier",
  margin_rate: "Taux de marge",
  additional_opex_per_day: "Surcoût OPEX journalier",
  adaptation_capex: "CAPEX d’adaptation",
  discount_rate: "Taux d’actualisation",
  probability: "Probabilité (facultative)",
};

/**
 * Unités et obligation LUES DANS LE CONTRAT, jamais réécrites ici. Un paramètre
 * du moteur sans entrée correspondante fait échouer la construction — donc le
 * build et les tests.
 */
export const QUANTITY_META: Record<QuantityField, QuantityMeta> = (() => {
  const byName = new Map(FINANCIAL_ENGINE.parameters.map((p) => [p.name, p]));
  const entries = QUANTITY_ORDER.map((field): [QuantityField, QuantityMeta] => {
    const parameter = byName.get(field);
    if (!parameter) {
      throw new Error(
        `Paramètre « ${field} » absent du contrat moteur : la saisie et le moteur ont divergé.`,
      );
    }
    return [
      field,
      {
        field,
        label: QUANTITY_LABELS[field],
        unit: parameter.unit,
        unitLabel: UNIT_LABELS[parameter.unit],
        required: parameter.required,
        description: parameter.description,
      },
    ];
  });
  return Object.fromEntries(entries) as Record<QuantityField, QuantityMeta>;
})();

export const PROVENANCE_LABELS: Record<WiInputProvenance, string> = {
  observed: "Observé — constaté sur des données de l’entreprise",
  assumption: "Hypothèse — posée par l’auteur du scénario",
};

/* --------------------------------------------------------- Normalisation */

const DECIMAL = /^-?\d+(?:[.,]\d+)?$/;
const YEAR = /^\d{4}$/;

/**
 * Normalise le séparateur décimal sans rien recalculer.
 *
 * Une virgule française devient un point ; les espaces d'extrémité tombent.
 * Aucun arrondi, aucune conversion numérique : la chaîne reste une chaîne.
 */
export function normalizeDecimal(raw: string): string {
  return raw.trim().replace(",", ".");
}

/** Vrai si la chaîne est un décimal saisissable (après normalisation). */
export function isDecimalString(raw: string): boolean {
  return DECIMAL.test(raw.trim());
}

/* --------------------------------------------------------- Validation */

export type FieldErrors = Readonly<Record<string, string>>;

export interface ValidationResult {
  readonly errors: FieldErrors;
  /** `null` dès qu'une erreur existe : rien de partiel n'est envoyé. */
  readonly request: WiFinancialScenarioRequest | null;
}

/** Clé d'erreur d'un sous-champ de grandeur — sert aussi d'`aria-describedby`. */
export function quantityErrorKey(
  field: QuantityField,
  part: "value" | "provenance" | "basis",
): string {
  return `${field}.${part}`;
}

/** Champs scalaires du scénario, tous portés par l'étape « Adaptation et scénario ». */
const SCALAR_KEYS: ReadonlySet<string> = new Set([
  "scenario_code",
  "label",
  "base_year",
  "horizon_year",
  "sensitivity_variation_pct",
  "signals",
]);

/**
 * Première étape portant une erreur.
 *
 * Le récapitulatif d'erreurs est affiché sur l'étape de revue, mais les champs
 * fautifs vivent sur les étapes précédentes : annoncer « 7 points à corriger »
 * sans ramener l'utilisateur là où ils se trouvent laisserait un message sans
 * issue. Le calculateur reconduit donc la saisie sur la première étape
 * concernée.
 *
 * Sans erreur localisable, on reste sur la revue.
 */
export function firstStepWithError(errors: FieldErrors): number {
  const keys = Object.keys(errors);
  if (keys.length === 0) return REVIEW_STEP_INDEX;
  for (let index = 0; index < STEPS.length; index += 1) {
    const step = STEPS[index];
    const owns = keys.some((key) => {
      const field = key.split(".")[0] as QuantityField;
      if (step.quantities.includes(field)) return true;
      return step.id === "adaptation" && SCALAR_KEYS.has(key);
    });
    if (owns) return index;
  }
  return REVIEW_STEP_INDEX;
}

const RATIO_FIELDS: ReadonlySet<QuantityField> = new Set([
  "affected_capacity_share",
  "margin_rate",
  "discount_rate",
  "probability",
]);

/** Une grandeur facultative entièrement vierge est omise, pas envoyée vide. */
function isQuantityUntouched(q: QuantityDraft): boolean {
  return q.value.trim() === "" && q.provenance === "" && q.basis.trim() === "";
}

function validateQuantity(
  field: QuantityField,
  draft: QuantityDraft,
  errors: Record<string, string>,
): WiQuantityInput | null {
  const meta = QUANTITY_META[field];
  const rawValue = draft.value.trim();

  if (rawValue === "") {
    errors[quantityErrorKey(field, "value")] =
      `${meta.label} est obligatoire — aucune valeur par défaut n’est proposée.`;
  } else if (!isDecimalString(rawValue)) {
    errors[quantityErrorKey(field, "value")] =
      `${meta.label} doit être un nombre décimal (point ou virgule).`;
  } else if (RATIO_FIELDS.has(field)) {
    // Comparaison seulement : la chaîne transmise reste celle de l'utilisateur.
    const asNumber = Number(normalizeDecimal(rawValue));
    if (asNumber < 0 || asNumber > 1) {
      errors[quantityErrorKey(field, "value")] =
        `${meta.label} s’exprime en ratio entre 0 et 1 (unité du contrat : ${meta.unitLabel}).`;
    }
  } else if (Number(normalizeDecimal(rawValue)) < 0) {
    errors[quantityErrorKey(field, "value")] = `${meta.label} ne peut pas être négatif.`;
  }

  if (draft.provenance === "") {
    errors[quantityErrorKey(field, "provenance")] =
      `Déclarez l’origine de « ${meta.label} » : observée ou hypothèse.`;
  }

  const basis = draft.basis.trim();
  if (basis === "") {
    errors[quantityErrorKey(field, "basis")] =
      `Indiquez sur quoi repose « ${meta.label} » — la base de l’hypothèse est exigée par le moteur.`;
  } else if (basis.length > 500) {
    errors[quantityErrorKey(field, "basis")] = "La base ne peut pas dépasser 500 caractères.";
  }

  if (
    errors[quantityErrorKey(field, "value")] ||
    errors[quantityErrorKey(field, "provenance")] ||
    errors[quantityErrorKey(field, "basis")]
  ) {
    return null;
  }
  return {
    value: normalizeDecimal(rawValue),
    provenance: draft.provenance as WiInputProvenance,
    basis,
  };
}

/** Découpe les signaux — une ligne, un signal ; les lignes vides ne comptent pas. */
export function parseSignals(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * Valide l'intégralité de la saisie et construit la requête.
 *
 * Aucune valeur n'est inventée en chemin : un champ vide produit une erreur,
 * jamais une valeur de remplacement.
 */
export function validateScenarioDraft(draft: ScenarioDraft): ValidationResult {
  const errors: Record<string, string> = {};

  const scenarioCode = draft.scenario_code.trim();
  if (scenarioCode === "") errors.scenario_code = "Le code du scénario est obligatoire.";
  else if (scenarioCode.length > 64) errors.scenario_code = "64 caractères au maximum.";

  const label = draft.label.trim();
  if (label === "") errors.label = "L’intitulé du scénario est obligatoire.";
  else if (label.length > 200) errors.label = "200 caractères au maximum.";

  const baseYear = draft.base_year.trim();
  if (baseYear === "") errors.base_year = "L’année de référence est obligatoire.";
  else if (!YEAR.test(baseYear)) errors.base_year = "Année sur quatre chiffres attendue.";

  const horizonYear = draft.horizon_year.trim();
  if (horizonYear === "") errors.horizon_year = "L’horizon est obligatoire.";
  else if (!YEAR.test(horizonYear)) errors.horizon_year = "Année sur quatre chiffres attendue.";
  else if (YEAR.test(baseYear) && Number(horizonYear) < Number(baseYear)) {
    errors.horizon_year = "L’horizon ne peut pas précéder l’année de référence.";
  }

  const variation = draft.sensitivity_variation_pct.trim();
  if (variation === "") {
    errors.sensitivity_variation_pct =
      "L’amplitude de sensibilité est obligatoire — aucune amplitude n’est suggérée.";
  } else if (!isDecimalString(variation)) {
    errors.sensitivity_variation_pct = "Amplitude décimale attendue (point ou virgule).";
  } else if (Number(normalizeDecimal(variation)) <= 0) {
    errors.sensitivity_variation_pct = "L’amplitude doit être strictement positive.";
  }

  const signals = parseSignals(draft.signals);
  if (signals.length > 20) errors.signals = "20 signaux au maximum.";

  const quantities: Partial<Record<QuantityField, WiQuantityInput>> = {};
  for (const field of QUANTITY_ORDER) {
    const meta = QUANTITY_META[field];
    const value = draft.quantities[field];
    // Facultative et intacte : omise. Facultative mais entamée : validée comme
    // les autres — on ne complète rien à la place de l'auteur.
    if (!meta.required && isQuantityUntouched(value)) continue;
    const parsed = validateQuantity(field, value, errors);
    if (parsed) quantities[field] = parsed;
  }

  if (Object.keys(errors).length > 0) return { errors, request: null };

  const candidate = {
    scenario_code: scenarioCode,
    label,
    base_year: Number(baseYear),
    horizon_year: Number(horizonYear),
    outage_days: quantities.outage_days!,
    affected_capacity_share: quantities.affected_capacity_share!,
    revenue_per_day: quantities.revenue_per_day!,
    margin_rate: quantities.margin_rate!,
    additional_opex_per_day: quantities.additional_opex_per_day!,
    adaptation_capex: quantities.adaptation_capex!,
    discount_rate: quantities.discount_rate!,
    ...(quantities.probability ? { probability: quantities.probability } : {}),
    sensitivity_variation_pct: normalizeDecimal(variation),
    signals,
  };

  const parsed = WiFinancialScenarioRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      errors: { form: "La requête reste hors contrat après validation locale." },
      request: null,
    };
  }
  return { errors: {}, request: parsed.data };
}

/* --------------------------------------------------------- Revue (étape 4) */

export interface ReviewRow {
  readonly field: string;
  readonly label: string;
  readonly value: string;
  readonly unitLabel: string;
  readonly origin: string;
  readonly basis: string;
}

/** Marqueur d'un champ non renseigné dans la revue — jamais un zéro. */
export const NOT_PROVIDED = "Non renseigné";

/** Toutes les hypothèses, y compris celles restées vides. */
export function buildReviewRows(draft: ScenarioDraft): ReviewRow[] {
  return QUANTITY_ORDER.map((field) => {
    const meta = QUANTITY_META[field];
    const q = draft.quantities[field];
    const value = q.value.trim();
    return {
      field,
      label: meta.label,
      value: value === "" ? NOT_PROVIDED : normalizeDecimal(value),
      unitLabel: meta.unitLabel,
      origin: q.provenance === "" ? "Origine non déclarée" : PROVENANCE_LABELS[q.provenance],
      basis: q.basis.trim() === "" ? NOT_PROVIDED : q.basis.trim(),
    };
  });
}

/**
 * Avertissements de revue — non bloquants, contrairement aux erreurs.
 *
 * Ils nomment ce que le résultat NE dira PAS, pour qu'on ne le lise pas dans
 * le chiffre après coup.
 */
export function buildReviewWarnings(draft: ScenarioDraft): string[] {
  const warnings: string[] = [];

  if (isQuantityUntouched(draft.quantities.probability)) {
    warnings.push(
      "Aucune probabilité n’est fournie : le résultat ne sera pas pondéré. Le moteur n’en produit aucune.",
    );
  }

  const assumed = QUANTITY_ORDER.filter(
    (field) => draft.quantities[field].provenance === "assumption",
  );
  if (assumed.length > 0) {
    warnings.push(
      `${assumed.length} grandeur(s) déclarée(s) comme hypothèse : ` +
        `${assumed.map((f) => QUANTITY_META[f].label).join(", ")}. Le résultat en hérite.`,
    );
  }

  if (parseSignals(draft.signals).length === 0) {
    warnings.push("Aucun signal qualitatif n’est déclaré : le moteur n’en supposera aucun.");
  }

  warnings.push(
    "Le calcul n’écrit rien : aucune écriture comptable, aucune persistance, aucun enregistrement du scénario.",
  );
  return warnings;
}

/* ------------------------------------------------------------- Résultat */

/**
 * Signaux comptables du contrat — IAS 36, IAS 37 et IFRIC 21 compris — rendus
 * comme des QUESTIONS à examiner. Le moteur ne conclut pas ; l'interface non
 * plus.
 */
export const ACCOUNTING_QUESTIONS = FINANCIAL_ENGINE.accounting_signals;

/** Libellés des composantes rendues par le moteur. */
export const COMPONENT_LABELS: Record<string, string> = {
  revenue_at_risk: "Revenu à risque",
  margin_at_risk: "Marge à risque",
  additional_opex: "Surcoût OPEX",
  gross_impact: "Impact brut",
  adaptation_capex: "CAPEX d’adaptation",
  discounted_impact: "Impact actualisé",
};

export function componentLabel(key: string): string {
  return COMPONENT_LABELS[key] ?? key;
}
