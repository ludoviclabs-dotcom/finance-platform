/**
 * Avancement ESRS dérivé de la matrice de matérialité (snapshot ESG).
 *
 * Source UNIQUE du calcul pour /esrs et pour le score de conformité du
 * tableau de bord : les deux écrans affichent désormais le même chiffre (le
 * tableau de bord montrait un 62 codé en dur quand /esrs indiquait 0 %).
 *
 * Par norme : moyenne des scores d'impact (échelle 0-5) ramenée en %, sinon
 * part des enjeux jugés matériels. Aucune valeur n'est inventée : sans enjeu
 * rattaché à une norme, l'avancement de cette norme vaut 0.
 */

import type { MaterialiteIssue } from "@/lib/api";

export const ESRS_STANDARD_IDS = [
  "ESRS E1",
  "ESRS E2",
  "ESRS E3",
  "ESRS E4",
  "ESRS E5",
  "ESRS S1",
  "ESRS S2",
  "ESRS S3",
  "ESRS S4",
  "ESRS G1",
  "ESRS 1",
  "ESRS 2",
] as const;

export type EsrsStandardId = (typeof ESRS_STANDARD_IDS)[number];
export type EsrsProgressStatus = "compliant" | "in_progress" | "not_started";

export interface DerivedEsrsStandard {
  id: EsrsStandardId;
  /** 0-100. */
  progress: number;
  status: EsrsProgressStatus;
  /** Enjeux de la matrice rattachés à la norme. */
  issueCount: number;
  materialIssues: { code: string; label: string; score: number }[];
}

export interface EsrsSummary {
  /** Moyenne des avancements, 0-100. */
  avg: number;
  compliant: number;
  inProgress: number;
  notStarted: number;
}

export function classifyEsrsProgress(progress: number): EsrsProgressStatus {
  if (progress >= 80) return "compliant";
  if (progress >= 40) return "in_progress";
  return "not_started";
}

/**
 * Libellé de norme libre (« ESRS E1 », « E1 — Climat », « ESRS2 »…) → norme.
 * Le code thématique doit être précédé d'un non-lettre : sans cette garde,
 * « ESRS2 » était lu comme S2 et « ESRS1 » comme S1.
 */
export function normalizeNorme(raw: unknown): EsrsStandardId | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  const topical = trimmed.match(/(?:^|[^A-Z])(E[1-5]|S[1-4]|G1)(?![0-9])/);
  if (topical) return `ESRS ${topical[1]}` as EsrsStandardId;
  const general = trimmed.match(/(?:^|[^A-Z])ESRS\s*([12])(?![0-9])/);
  if (general) return general[1] === "1" ? "ESRS 1" : "ESRS 2";
  return null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function issueScore(issue: MaterialiteIssue): number | null {
  return finiteOrNull(issue.scoreImpactTotal) ?? finiteOrNull(issue.scoreImpact);
}

/** Les 12 normes, dans l'ordre de ESRS_STANDARD_IDS. */
export function deriveEsrsStandards(issues: readonly MaterialiteIssue[]): DerivedEsrsStandard[] {
  const buckets = new Map<EsrsStandardId, MaterialiteIssue[]>();
  for (const issue of issues) {
    const id = normalizeNorme(issue.normeEsrs);
    if (!id) continue;
    const bucket = buckets.get(id);
    if (bucket) bucket.push(issue);
    else buckets.set(id, [issue]);
  }

  return ESRS_STANDARD_IDS.map((id) => {
    const bucket = buckets.get(id) ?? [];
    const scored = bucket.map(issueScore).filter((v): v is number => v !== null);
    const materiels = bucket.filter((i) => i.materiel === true).length;
    let progress = 0;
    if (scored.length > 0) {
      const avg = scored.reduce((s, v) => s + v, 0) / scored.length;
      progress = Math.max(0, Math.min(100, Math.round((avg / 5) * 100)));
    } else if (bucket.length > 0) {
      progress = Math.round((materiels / bucket.length) * 100);
    }
    return {
      id,
      progress,
      status: classifyEsrsProgress(progress),
      issueCount: bucket.length,
      materialIssues: bucket
        .filter((i) => i.materiel === true)
        .slice(0, 6)
        .map((i) => ({ code: i.code, label: i.label ?? i.code, score: issueScore(i) ?? 0 })),
    };
  });
}

export function summarizeEsrs(standards: readonly DerivedEsrsStandard[]): EsrsSummary {
  const n = standards.length;
  return {
    avg: n > 0 ? Math.round(standards.reduce((a, s) => a + s.progress, 0) / n) : 0,
    compliant: standards.filter((s) => s.status === "compliant").length,
    inProgress: standards.filter((s) => s.status === "in_progress").length,
    notStarted: standards.filter((s) => s.status === "not_started").length,
  };
}

/** Au moins un enjeu rattaché à une norme : sinon, rien de réel à afficher. */
export function hasEsrsData(standards: readonly DerivedEsrsStandard[]): boolean {
  return standards.some((s) => s.issueCount > 0);
}

/**
 * Enjeux de matérialité d'un snapshot ESG brut (ex. `rawEsg` du snapshot
 * consolidé). Lecture défensive : toute forme inattendue donne une liste vide.
 */
export function extractMaterialiteIssues(rawEsg: unknown): MaterialiteIssue[] {
  if (!rawEsg || typeof rawEsg !== "object") return [];
  const materialite = (rawEsg as { materialite?: unknown }).materialite;
  if (!materialite || typeof materialite !== "object") return [];
  const issues = (materialite as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.filter(
    (i): i is MaterialiteIssue =>
      typeof i === "object" && i !== null && typeof (i as { code?: unknown }).code === "string",
  );
}
