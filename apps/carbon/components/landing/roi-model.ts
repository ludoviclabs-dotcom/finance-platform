/**
 * Modèle PUR du calculateur ROI de la homepage (components/landing/roi-calculator.tsx).
 *
 * Coût manuel   = jours-homme internes × TJM + consultant externe éventuel
 * Coût CarbonCo = forfait annuel (selon l'effectif) + jours-homme restants × TJM
 *
 * Chaque hypothèse est une constante nommée : le texte « Hypothèses » affiché
 * sous le résultat est DÉRIVÉ de ces valeurs (QA 2026-09-16, m-05 — le texte
 * annonçait −40 % la 1re année alors que le calcul appliquait −60 %).
 * Un écart négatif est un SURCOÛT, jamais une « économie » (M-09).
 */

export type Sector = "industrie" | "services" | "agro" | "btp" | "distribution";
export type Scope3Complexity = "simple" | "medium" | "complex";

export interface RoiInputs {
  /** Effectif total (ETP). */
  fte: number;
  /** Nombre de sites / établissements. */
  sites: number;
  sector: Sector;
  scope3: Scope3Complexity;
  hasConsultant: boolean;
}

export const SECTOR_BASE_DAYS: Record<Sector, number> = {
  industrie: 75,
  services: 45,
  agro: 80,
  btp: 65,
  distribution: 55,
};

export const SCOPE3_MULT: Record<Scope3Complexity, number> = {
  simple: 1.0,
  medium: 1.4,
  complex: 1.85,
};

export const SECTOR_LABELS: Record<Sector, string> = {
  industrie: "Industrie",
  services: "Services",
  agro: "Agroalimentaire",
  btp: "BTP / Construction",
  distribution: "Distribution",
};

export const SCOPE3_LABELS: Record<Scope3Complexity, string> = {
  simple: "Simple — peu de fournisseurs, produits homogènes",
  medium: "Modéré — chaîne de valeur classique",
  complex: "Complexe — multi-pays, multi-produits, services tiers",
};

/** Taux journalier interne (€/jour, charges comprises). */
export const TJM_INTERNAL = 600;
/** Consultant externe : part du coût interne ajoutée quand l'option est cochée. */
export const CONSULTANT_RATIO = 0.5;
/** Réduction des jours-homme internes avec CarbonCo — valeur UNIQUE appliquée au calcul. */
export const CARBONCO_DAYS_REDUCTION = 0.6;
/** Poids du nombre de sites : multiplicateur = 1 + SITES_LOG_WEIGHT × log10(sites). */
export const SITES_LOG_WEIGHT = 0.4;

export interface PlanTier {
  /** Effectif maximal couvert par le forfait (inclus) ; `null` = au-delà. */
  maxFte: number | null;
  plan: string;
  monthlyPrice: number;
}

/** Forfaits (€ / mois) par tranche d'effectif. */
export const PLAN_TIERS: readonly PlanTier[] = [
  { maxFte: 100, plan: "Starter", monthlyPrice: 490 },
  { maxFte: 500, plan: "Business", monthlyPrice: 1290 },
  { maxFte: null, plan: "Enterprise (estimation)", monthlyPrice: 2900 },
];

export interface IntegerBounds {
  min: number;
  max: number;
}

export const FTE_BOUNDS: IntegerBounds = { min: 1, max: 100_000 };
export const SITES_BOUNDS: IntegerBounds = { min: 1, max: 10_000 };

export function carbonCoPlan(fte: number): { plan: string; price: number } {
  const tier = PLAN_TIERS.find((t) => t.maxFte === null || fte <= t.maxFte) ?? PLAN_TIERS[PLAN_TIERS.length - 1];
  return { plan: tier.plan, price: tier.monthlyPrice * 12 };
}

export type RoiOutcome = "saving" | "extra-cost" | "even";

export interface RoiResult {
  days: number;
  reducedDays: number;
  manualTotal: number;
  carbonTotal: number;
  /** Coût manuel − coût CarbonCo : > 0 économie, < 0 surcoût. */
  delta: number;
  /** |delta| rapporté au coût manuel, en % arrondi. */
  deltaPct: number;
  outcome: RoiOutcome;
  planName: string;
}

export function computeRoi(inputs: RoiInputs): RoiResult {
  const fte = clampInteger(inputs.fte, FTE_BOUNDS);
  const sites = clampInteger(inputs.sites, SITES_BOUNDS);

  const sitesMult = 1 + Math.log10(sites) * SITES_LOG_WEIGHT;
  const days = Math.round(SECTOR_BASE_DAYS[inputs.sector] * sitesMult * SCOPE3_MULT[inputs.scope3]);
  const internalCost = days * TJM_INTERNAL;
  const consultantCost = inputs.hasConsultant ? Math.round(internalCost * CONSULTANT_RATIO) : 0;
  const manualTotal = internalCost + consultantCost;

  const plan = carbonCoPlan(fte);
  const reducedDays = Math.round(days * (1 - CARBONCO_DAYS_REDUCTION));
  const carbonTotal = plan.price + reducedDays * TJM_INTERNAL;

  const delta = manualTotal - carbonTotal;
  const deltaPct = manualTotal > 0 ? Math.round((Math.abs(delta) / manualTotal) * 100) : 0;
  const outcome: RoiOutcome = delta > 0 ? "saving" : delta < 0 ? "extra-cost" : "even";

  return { days, reducedDays, manualTotal, carbonTotal, delta, deltaPct, outcome, planName: plan.plan };
}

/* ── Présentation ─────────────────────────────────────────────────────────── */

const NBSP = " ";

export function formatEuros(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")}${NBSP}€`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}${NBSP}%`;
}

export type RoiTone = "positive" | "warning" | "neutral";

export interface RoiSummary {
  label: string;
  /** Montant toujours positif : le sens est porté par le libellé. */
  amount: string;
  detail: string;
  tone: RoiTone;
  note?: string;
}

export function describeRoi(result: RoiResult): RoiSummary {
  const pct = `${result.deltaPct}${NBSP}%`;
  switch (result.outcome) {
    case "saving":
      return {
        label: "Économie annuelle estimée",
        amount: formatEuros(result.delta),
        detail: `soit ${pct} du coût manuel`,
        tone: "positive",
      };
    case "extra-cost":
      return {
        label: "Surcoût annuel estimé",
        amount: formatEuros(-result.delta),
        detail: `soit +${pct} par rapport au coût manuel`,
        tone: "warning",
        note:
          "Avec ces hypothèses, le forfait CarbonCo dépasse la valeur du temps interne économisé : pas d'économie à attendre pour ce profil.",
      };
    default:
      return {
        label: "Coût équivalent",
        amount: formatEuros(0),
        detail: "aucun écart avec le coût manuel",
        tone: "neutral",
      };
  }
}

/** Hypothèses affichées — dérivées des constantes réellement utilisées. */
export function roiAssumptions(): string[] {
  const [starter, business] = PLAN_TIERS;
  return [
    `TJM interne : ${formatEuros(TJM_INTERNAL)} par jour, charges comprises.`,
    "Base sectorielle calibrée sur retours d'expérience ETI 2024-2025.",
    `Multiplicateur sites : 1 + ${String(SITES_LOG_WEIGHT).replace(".", ",")} × log10(nombre de sites).`,
    `Consultant externe (si coché) : +${formatPercent(CONSULTANT_RATIO)} du coût interne.`,
    `Réduction CarbonCo : −${formatPercent(CARBONCO_DAYS_REDUCTION)} de jours-homme internes (hypothèse unique, sans période de montée en charge).`,
    `Forfait annuel CarbonCo selon l'effectif : ${starter.plan} jusqu'à ${starter.maxFte} ETP, ${business.plan} jusqu'à ${business.maxFte} ETP, Enterprise au-delà (estimation).`,
  ];
}

/* ── Saisie des champs entiers (QA m-04) ──────────────────────────────────── */

export type IntegerInput =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "ok"; value: number };

/**
 * Chiffres uniquement. Les espaces (y compris insécables) sont tolérés comme
 * séparateurs de milliers ; tout le reste — notation exponentielle « 1e3 »,
 * décimales, signe, lettres — est refusé au lieu d'être tronqué en silence
 * comme le faisait parseInt (« 1e3 » → 1).
 */
export function parseIntegerInput(raw: string): IntegerInput {
  const compact = raw.replace(/[\s  ]/g, "");
  if (compact === "") return { kind: "empty" };
  if (!/^\d+$/.test(compact)) return { kind: "invalid" };
  return { kind: "ok", value: Number(compact) };
}

export function clampInteger(n: number, bounds: IntegerBounds): number {
  if (Number.isNaN(n)) return bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(n)));
}

/** Valeur retenue à la sortie du champ : saisie bornée, ou dernière valeur valide. */
export function commitIntegerInput(raw: string, bounds: IntegerBounds, fallback: number): number {
  const parsed = parseIntegerInput(raw);
  return parsed.kind === "ok" ? clampInteger(parsed.value, bounds) : clampInteger(fallback, bounds);
}

export function formatInteger(n: number): string {
  return n.toLocaleString("fr-FR");
}
