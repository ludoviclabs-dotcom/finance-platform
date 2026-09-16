/**
 * Tableau de bord — règles pures qui décident de ce qui peut être affiché.
 *
 * - Données réelles seulement si le snapshot consolidé n'est PAS vide
 *   (total S1+S2+S3 > 0) : une réponse réseau réussie mais vide bascule sur
 *   la démonstration, clairement étiquetée.
 * - Score ESRS dérivé de la matrice de matérialité (même calcul que /esrs),
 *   sinon `null` (« — »), jamais un chiffre codé en dur.
 * - Veille réglementaire limitée à des faits datés et vérifiés.
 */

import type { AuditEvent, ConsolidatedSnapshot } from "@/lib/api";
import { formatRelativeTimeFr } from "@/lib/relative-time";

import type { ActivityRow, EsrsState, RegulatoryNote } from "./cockpit-sections";
import {
  deriveEsrsStandards,
  extractMaterialiteIssues,
  hasEsrsData,
  summarizeEsrs,
} from "./esrs-derivation";

export const ESRS_TARGET = 80;

/** Faits vérifiés (texte validé) — le lien renvoie à la source publique. */
export const REGULATORY_NOTES: RegulatoryNote[] = [
  {
    src: "Commission européenne",
    date: "03/07/2026",
    text:
      "Adoption de l'acte délégué ESRS simplifiés, applicables aux exercices ouverts à compter du 1er janvier 2027 (adoption anticipée possible pour 2026).",
    href:
      "https://www.efrag.org/en/news-and-calendar/news/european-commission-publishes-delegated-act-on-revised-esrs-and-voluntary-sustainability-reporting",
    hrefLabel: "Source EFRAG",
  },
  {
    // Libellé court : `.cc-reg-src` ne passe pas à la ligne.
    src: "Omnibus I",
    date: "26/02/2026",
    text:
      "Directive (UE) 2026/470 publiée au JOUE le 26/02/2026, en vigueur le 18/03/2026 ; périmètre CSRD : plus de 1 000 salariés et plus de 450 M€ de chiffre d'affaires net ; transposition des dispositions CSRD au plus tard le 19/03/2027.",
  },
];

/** Le snapshot porte-t-il de vraies émissions ? (vide ≠ réel) */
export function hasLiveCarbon(snapshot: ConsolidatedSnapshot | null | undefined): boolean {
  const total = snapshot?.carbon?.totalS123Tco2e;
  return typeof total === "number" && Number.isFinite(total) && total > 0;
}

/** Parts entières (%) de chaque scope ; valeurs non finies ou négatives comptées 0. */
export function scopeShares(totals: readonly number[]): number[] {
  const safe = totals.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  return safe.map((v) => (sum > 0 ? Math.round((v / sum) * 100) : 0));
}

const HEATMAP_LABELS: Record<string, string> = {
  "ESRS E1": "Climat",
  "ESRS E2": "Pollution",
  "ESRS E3": "Eau",
  "ESRS E4": "Biodiv.",
  "ESRS E5": "Écon. circ.",
  "ESRS S1": "Effectifs",
  "ESRS S2": "Chaîne val.",
  "ESRS S3": "Communautés",
  "ESRS S4": "Consomm.",
  "ESRS G1": "Gouvernance",
};

/**
 * Score et heatmap ESRS à partir du snapshot ESG brut du consolidé. Sans enjeu
 * rattaché à une norme : score `null` et heatmap vide.
 */
export function buildEsrsCockpitState(rawEsg: unknown, target = ESRS_TARGET): EsrsState {
  const standards = deriveEsrsStandards(extractMaterialiteIssues(rawEsg));
  if (!hasEsrsData(standards)) {
    return { score: null, target, compliant: 0, inProgress: 0, notStarted: 0, radial: [] };
  }
  const summary = summarizeEsrs(standards);
  return {
    score: summary.avg,
    target,
    compliant: summary.compliant,
    inProgress: summary.inProgress,
    notStarted: summary.notStarted,
    radial: standards
      .filter((s) => s.id in HEATMAP_LABELS)
      .map((s) => ({ k: s.id.replace("ESRS ", ""), label: HEATMAP_LABELS[s.id], v: s.progress })),
  };
}

function activityType(event: AuditEvent): ActivityRow["type"] {
  if (event.status === "error" || event.type === "error") return "alert";
  if (event.type === "upload" || event.type === "ingest") return "upload";
  if (event.type === "export") return "report";
  return "validation";
}

/**
 * Activité récente = journal d'audit réel (les connexions sont écartées, elles
 * noieraient le flux). Même source que /audit : les deux écrans concordent.
 */
export function auditEventsToActivity(
  events: readonly AuditEvent[],
  now: Date = new Date(),
  limit = 4,
): ActivityRow[] {
  return events
    .filter((e) => e.type !== "login")
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      type: activityType(e),
      title: e.title,
      desc: e.detail ?? "",
      time: formatRelativeTimeFr(e.timestamp, now) ?? "",
    }));
}
