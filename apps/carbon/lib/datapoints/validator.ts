/**
 * Datapoints Validator — moteur de règles ESRS Set 2.
 *
 * Vérifie cohérence et complétude d'un état datapoints :
 *  - Inégalités entre datapoints (Scope 2 LB >= Scope 2 MB)
 *  - Sommes (waste_total ≈ diverted + directed à tolérance près)
 *  - Bornes de valeurs (pourcentages 0-100, valeurs >= 0)
 *  - Complétude par standard (% obligatoires saisis)
 *  - Cohérence d'unités (intensité = numérateur / dénominateur)
 *  - Dépendances déclarées dans le JSON (champ `dependencies`)
 *
 * Utilisation :
 *   import { runValidation } from "@/lib/datapoints/validator";
 *   import { RULES_SET2 } from "@/lib/datapoints/rules-set2";
 *   const findings = runValidation(state, RULES_SET2);
 */

import {
  type DatapointState,
  type EsrsDatapointDef,
  type ExtractedDatapoint,
  ESRS_SET2,
} from "@/lib/esrs/schema";

// ────────────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────────────

export type Severity = "error" | "warning" | "info";
export type RuleScope = "datapoint" | "standard" | "global";

export interface ValidationFinding {
  /** Identifiant stable de la règle (ex: "E1-scope2-LB-gte-MB"). */
  ruleId: string;
  severity: Severity;
  scope: RuleScope;
  /** Datapoints impliqués dans le constat (ordre signifiant : 1er = principal). */
  datapointIds: string[];
  message: string;
  suggestion?: string;
  /** Valeurs calculées utiles à l'auditeur (expected/actual/delta). */
  computed?: {
    expected?: number | string | boolean | null;
    actual?: number | string | boolean | null;
    deltaPct?: number;
  };
}

export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  scope: RuleScope;
  /** Standards concernés par la règle (ex: ["E1"]). Vide = tous. */
  standards?: string[];
  evaluate: (ctx: ValidatorContext) => ValidationFinding[];
}

export interface ValidatorContext {
  state: DatapointState;
  defs: EsrsDatapointDef[];
  /** Lookup id → ExtractedDatapoint | undefined. */
  get: (id: string) => ExtractedDatapoint | undefined;
  /** Numerique typé safe (null si valeur absente / non extraite / non numérique). */
  num: (id: string) => number | null;
  /** Texte typé safe. */
  str: (id: string) => string | null;
  /** Boolean typé safe. */
  bool: (id: string) => boolean | null;
}

export interface ValidationReport {
  cid: string;
  generatedAt: string;
  totalDatapoints: number;
  filledDatapoints: number;
  mandatoryFilledPct: number;
  findings: ValidationFinding[];
  /** Compteurs par sévérité, utile pour badge UI. */
  counts: { error: number; warning: number; info: number };
  /** Score audit-grade 0-100 (100 = aucun error/warning, complétude obligatoire 100 %). */
  auditScore: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ────────────────────────────────────────────────────────────────────────────

function buildContext(state: DatapointState, defs: EsrsDatapointDef[]): ValidatorContext {
  const get = (id: string) => state.datapoints[id];
  const num = (id: string): number | null => {
    const dp = get(id);
    if (!dp) return null;
    if (dp.status !== "extracted" && dp.status !== "validated") return null;
    if (typeof dp.value === "number" && Number.isFinite(dp.value)) return dp.value;
    return null;
  };
  const str = (id: string): string | null => {
    const dp = get(id);
    if (!dp) return null;
    if (typeof dp.value === "string" && dp.value.trim().length > 0) return dp.value;
    return null;
  };
  const bool = (id: string): boolean | null => {
    const dp = get(id);
    if (!dp) return null;
    if (typeof dp.value === "boolean") return dp.value;
    return null;
  };
  return { state, defs, get, num, str, bool };
}

function deltaPct(actual: number, expected: number): number {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return ((actual - expected) / Math.abs(expected)) * 100;
}

// ────────────────────────────────────────────────────────────────────────────
// Fabriques de règles (factories) — bibliothèque réutilisable par rules-set2.ts
// ────────────────────────────────────────────────────────────────────────────

/**
 * `a >= b`. Trigger si les deux sont extraits ET a < b.
 * Cas d'usage : Scope 2 location-based >= Scope 2 market-based.
 */
export function ruleGte(opts: {
  id: string;
  description: string;
  a: string;
  b: string;
  severity?: Severity;
  standards?: string[];
  message?: (a: number, b: number) => string;
}): Rule {
  return {
    id: opts.id,
    description: opts.description,
    severity: opts.severity ?? "error",
    scope: "datapoint",
    standards: opts.standards,
    evaluate: (ctx) => {
      const va = ctx.num(opts.a);
      const vb = ctx.num(opts.b);
      if (va === null || vb === null) return [];
      if (va >= vb) return [];
      return [
        {
          ruleId: opts.id,
          severity: opts.severity ?? "error",
          scope: "datapoint",
          datapointIds: [opts.a, opts.b],
          message:
            opts.message?.(va, vb) ??
            `${opts.a} (${va}) doit être ≥ ${opts.b} (${vb}).`,
          suggestion: `Vérifier la cohérence des deux valeurs (méthodologie, unité, périmètre).`,
          computed: { expected: vb, actual: va, deltaPct: deltaPct(va, vb) },
        },
      ];
    },
  };
}

/**
 * `target ≈ Σ components` à la tolérance près.
 * Cas d'usage : E5-5_waste_total ≈ diverted + directed (±5 %).
 */
export function ruleSumWithinTolerance(opts: {
  id: string;
  description: string;
  target: string;
  components: string[];
  tolerancePct?: number; // default 5%
  severity?: Severity;
  standards?: string[];
}): Rule {
  return {
    id: opts.id,
    description: opts.description,
    severity: opts.severity ?? "warning",
    scope: "datapoint",
    standards: opts.standards,
    evaluate: (ctx) => {
      const target = ctx.num(opts.target);
      if (target === null) return [];
      const values: number[] = [];
      for (const c of opts.components) {
        const v = ctx.num(c);
        if (v === null) return []; // composantes incomplètes → on ne valide pas
        values.push(v);
      }
      const sum = values.reduce((a, b) => a + b, 0);
      const tolerance = opts.tolerancePct ?? 5;
      const delta = deltaPct(target, sum);
      if (Math.abs(delta) <= tolerance) return [];
      return [
        {
          ruleId: opts.id,
          severity: opts.severity ?? "warning",
          scope: "datapoint",
          datapointIds: [opts.target, ...opts.components],
          message: `${opts.target} (${target}) diffère de la somme des composantes (${sum.toFixed(2)}) de ${delta.toFixed(1)} % — tolérance ±${tolerance} %.`,
          suggestion: `Recalculer ${opts.target} = Σ(${opts.components.join(" + ")}) ou justifier l'écart.`,
          computed: { expected: sum, actual: target, deltaPct: delta },
        },
      ];
    },
  };
}

/**
 * Borne de valeur : `value ∈ [min, max]`.
 * Cas d'usage : pourcentages 0-100, valeurs ≥ 0.
 */
export function ruleValueRange(opts: {
  id: string;
  description: string;
  datapointId: string;
  min?: number;
  max?: number;
  severity?: Severity;
  standards?: string[];
}): Rule {
  return {
    id: opts.id,
    description: opts.description,
    severity: opts.severity ?? "error",
    scope: "datapoint",
    standards: opts.standards,
    evaluate: (ctx) => {
      const v = ctx.num(opts.datapointId);
      if (v === null) return [];
      if (opts.min !== undefined && v < opts.min) {
        return [
          {
            ruleId: opts.id,
            severity: opts.severity ?? "error",
            scope: "datapoint",
            datapointIds: [opts.datapointId],
            message: `${opts.datapointId} = ${v} < min autorisé (${opts.min}).`,
            suggestion: `Vérifier la valeur saisie ou re-extraire depuis la source.`,
            computed: { expected: opts.min, actual: v },
          },
        ];
      }
      if (opts.max !== undefined && v > opts.max) {
        return [
          {
            ruleId: opts.id,
            severity: opts.severity ?? "error",
            scope: "datapoint",
            datapointIds: [opts.datapointId],
            message: `${opts.datapointId} = ${v} > max autorisé (${opts.max}).`,
            suggestion: `Vérifier la valeur saisie ou re-extraire depuis la source.`,
            computed: { expected: opts.max, actual: v },
          },
        ];
      }
      return [];
    },
  };
}

/**
 * Complétude par standard : `% obligatoires saisis ≥ seuil`.
 * Cas d'usage : E1 doit avoir ≥ 80 % de ses obligatoires saisis avant freeze.
 */
export function ruleCompletenessByStandard(opts: {
  id: string;
  standard: string;
  minMandatoryPct: number; // 0-100
  severity?: Severity;
}): Rule {
  return {
    id: opts.id,
    description: `Complétude minimale ${opts.minMandatoryPct} % obligatoires sur ${opts.standard}`,
    severity: opts.severity ?? "warning",
    scope: "standard",
    standards: [opts.standard],
    evaluate: (ctx) => {
      const mandatoryDefs = ctx.defs.filter(
        (d) => d.standard === opts.standard && d.mandatory,
      );
      if (mandatoryDefs.length === 0) return [];
      const filled = mandatoryDefs.filter((d) => {
        const dp = ctx.get(d.id);
        return dp && dp.value !== null && dp.value !== "" && dp.status !== "rejected" && dp.status !== "empty";
      }).length;
      const pct = (filled / mandatoryDefs.length) * 100;
      if (pct >= opts.minMandatoryPct) return [];
      return [
        {
          ruleId: opts.id,
          severity: opts.severity ?? "warning",
          scope: "standard",
          datapointIds: mandatoryDefs.filter((d) => {
            const dp = ctx.get(d.id);
            return !dp || dp.value === null || dp.status === "empty" || dp.status === "rejected";
          }).map((d) => d.id),
          message: `Standard ${opts.standard} : ${filled}/${mandatoryDefs.length} obligatoires saisis (${pct.toFixed(0)} % < ${opts.minMandatoryPct} %).`,
          suggestion: `Compléter les datapoints obligatoires manquants avant freeze.`,
          computed: { expected: opts.minMandatoryPct, actual: Number(pct.toFixed(1)) },
        },
      ];
    },
  };
}

/**
 * Cohérence intensité : `numerator / denominator ≈ ratioDp` à tolérance.
 * Cas d'usage : E1-6_ghg_intensity = E1-6_total_ghg / revenue (M€).
 *
 * Si `revenueDpId` n'est pas un datapoint ESRS, on accepte une fonction qui le fournit
 * (ex: depuis un snapshot finance). Pour la version V1, on attend un datapoint
 * de type number référencé par id.
 */
export function ruleIntensityRatio(opts: {
  id: string;
  description: string;
  ratioDp: string;
  numeratorDp: string;
  denominatorDp: string;
  tolerancePct?: number;
  severity?: Severity;
  standards?: string[];
}): Rule {
  return {
    id: opts.id,
    description: opts.description,
    severity: opts.severity ?? "warning",
    scope: "datapoint",
    standards: opts.standards,
    evaluate: (ctx) => {
      const ratio = ctx.num(opts.ratioDp);
      const num = ctx.num(opts.numeratorDp);
      const den = ctx.num(opts.denominatorDp);
      if (ratio === null || num === null || den === null) return [];
      if (den === 0) return [];
      const expected = num / den;
      const tolerance = opts.tolerancePct ?? 5;
      const delta = deltaPct(ratio, expected);
      if (Math.abs(delta) <= tolerance) return [];
      return [
        {
          ruleId: opts.id,
          severity: opts.severity ?? "warning",
          scope: "datapoint",
          datapointIds: [opts.ratioDp, opts.numeratorDp, opts.denominatorDp],
          message: `${opts.ratioDp} (${ratio}) ≠ ${opts.numeratorDp}/${opts.denominatorDp} (${expected.toFixed(2)}) — écart ${delta.toFixed(1)} %.`,
          suggestion: `Recalculer ${opts.ratioDp} ou vérifier numérateur/dénominateur.`,
          computed: { expected, actual: ratio, deltaPct: delta },
        },
      ];
    },
  };
}

/**
 * Vérifie que les `dependencies` déclarées dans le JSON sont saisies si le datapoint principal l'est.
 * Cas d'usage : E1-6_total_ghg dépend de scope1+scope2_mb+scope3 → si total saisi, les 3 doivent l'être.
 */
export function ruleDependenciesPresent(opts: {
  id?: string;
  severity?: Severity;
}): Rule {
  return {
    id: opts.id ?? "dependencies-present",
    description: "Si un datapoint avec dependencies est saisi, ses dépendances doivent l'être aussi.",
    severity: opts.severity ?? "warning",
    scope: "global",
    evaluate: (ctx) => {
      const findings: ValidationFinding[] = [];
      for (const def of ctx.defs) {
        if (!def.dependencies || def.dependencies.length === 0) continue;
        const main = ctx.get(def.id);
        if (!main || main.value === null || main.status === "empty") continue;
        const missing: string[] = [];
        for (const dep of def.dependencies) {
          const sub = ctx.get(dep);
          if (!sub || sub.value === null || sub.status === "empty" || sub.status === "rejected") {
            missing.push(dep);
          }
        }
        if (missing.length > 0) {
          findings.push({
            ruleId: opts.id ?? "dependencies-present",
            severity: opts.severity ?? "warning",
            scope: "datapoint",
            datapointIds: [def.id, ...missing],
            message: `${def.id} est saisi mais ses dépendances ne le sont pas : ${missing.join(", ")}.`,
            suggestion: `Saisir ou extraire les datapoints dépendants pour assurer l'auditabilité.`,
          });
        }
      }
      return findings;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Runner principal
// ────────────────────────────────────────────────────────────────────────────

/**
 * Exécute toutes les règles fournies et agrège les findings.
 * Calcule complétude obligatoire globale et un score audit-grade 0-100.
 */
export function runValidation(
  state: DatapointState,
  rules: Rule[],
  defs: EsrsDatapointDef[] = ESRS_SET2.datapoints,
): ValidationReport {
  const ctx = buildContext(state, defs);
  const findings: ValidationFinding[] = [];
  for (const r of rules) {
    try {
      findings.push(...r.evaluate(ctx));
    } catch (err) {
      findings.push({
        ruleId: r.id,
        severity: "info",
        scope: "global",
        datapointIds: [],
        message: `Règle '${r.id}' a échoué à l'exécution : ${err instanceof Error ? err.message : String(err)}.`,
      });
    }
  }

  const counts = {
    error: findings.filter((f) => f.severity === "error").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  // Complétude globale obligatoire
  const mandatoryDefs = defs.filter((d) => d.mandatory);
  const filledMandatory = mandatoryDefs.filter((d) => {
    const dp = ctx.get(d.id);
    return dp && dp.value !== null && dp.value !== "" && dp.status !== "rejected" && dp.status !== "empty";
  }).length;
  const mandatoryFilledPct = mandatoryDefs.length === 0 ? 100 : (filledMandatory / mandatoryDefs.length) * 100;

  // Score audit-grade : complétude (50 %) + absence d'erreurs (40 %) + warnings (10 %)
  const completenessScore = mandatoryFilledPct * 0.5;
  const errorPenalty = Math.min(40, counts.error * 4); // 1 error = -4 pts, max -40
  const warningPenalty = Math.min(10, counts.warning * 1); // 1 warning = -1 pt, max -10
  const auditScore = Math.max(
    0,
    Math.min(100, completenessScore + 40 - errorPenalty + 10 - warningPenalty),
  );

  return {
    cid: state.cid,
    generatedAt: new Date().toISOString(),
    totalDatapoints: defs.length,
    filledDatapoints: Object.values(state.datapoints).filter(
      (dp) => dp.value !== null && dp.status !== "empty" && dp.status !== "rejected",
    ).length,
    mandatoryFilledPct: Number(mandatoryFilledPct.toFixed(1)),
    findings,
    counts,
    auditScore: Number(auditScore.toFixed(1)),
  };
}
