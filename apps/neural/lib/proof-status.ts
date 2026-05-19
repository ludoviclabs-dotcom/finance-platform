/**
 * Proof status — couche d'unification des 3 sources (refonte V2, PR 5).
 *
 * NEURAL expose 3 sources qui parlent toutes de "statut" d'un agent mais
 * répondent en réalité à 3 questions différentes :
 *
 *   1. `lib/data/agents-registry.ts`  → état technique des données
 *      "L'agent a-t-il un workbook Excel parsé ?" (live | planned)
 *
 *   2. `lib/public-catalog.ts`        → état commercial
 *      "L'agent a-t-il une surface publique testable ?" (live | demo | planned)
 *
 *   3. `lib/proof-catalog.ts`         → niveau de preuve (0-4)
 *      "Quelle est la preuve la plus aboutie publiée ?" (excel → client_ready)
 *
 * Ces 3 sources ne sont PAS ordonnées par précédence : elles éclairent 3
 * dimensions distinctes. C'est précisément ce qui avait conduit à la
 * "divergence" reg-bank-comms documentée dans `sources-consistency.test.ts` :
 * registry = planned (pas de workbook), public-catalog = live (démo réelle),
 * proof-catalog = score 3 (export signé) — chaque source disait juste.
 *
 * Ce module fournit l'API de lecture unifiée qui composera ces 3 dimensions
 * pour les besoins UI sans masquer leur nature distincte.
 */

import { MATRIX, type AgentDefinition, type Branch, type Sector } from "@/lib/data/agents-registry";
import {
  AGENT_ENTRIES,
  type PublicStatus,
} from "@/lib/public-catalog";
import {
  PROOF_SCORE_LABELS,
  PROOF_STATUS_LABELS,
  getAgentProofRecords,
  type AgentProofRecord,
  type AgentProofStatus,
  type ProofScore,
} from "@/lib/proof-catalog";

export type UnifiedStatusKind =
  | "client_ready"
  | "export_audit"
  | "public_demo"
  | "runtime_parsed"
  | "excel_created"
  | "planned"
  | "unknown";

export interface UnifiedAgentStatus {
  agentId: string;
  /** État technique côté registry MATRIX (planned si l'agent n'a pas de cellule). */
  registryStatus: "live" | "planned" | "unknown";
  /** État commercial côté public-catalog (unknown si pas d'entrée publique). */
  catalogStatus: PublicStatus | "unknown";
  /** Niveau de preuve 0-4 si l'agent est dans AGENT_ENTRIES, sinon null. */
  proofScore: ProofScore | null;
  /** Statut dérivé pour affichage UI (le plus représentatif de la maturité réelle). */
  displayStatus: UnifiedStatusKind;
  isClientReady: boolean;
  isExportAuditEligible: boolean;
  /** Cellule MATRIX si l'agent y figure (utile pour secteur/branche). */
  cell: { sector: Sector; branch: Branch } | null;
}

let cachedRecords: Map<string, AgentProofRecord> | null = null;

function getProofRecordIndex(): Map<string, AgentProofRecord> {
  if (cachedRecords) return cachedRecords;
  const index = new Map<string, AgentProofRecord>();
  for (const record of getAgentProofRecords()) {
    index.set(record.id, record);
  }
  cachedRecords = index;
  return index;
}

function locateInRegistry(agentId: string): {
  agent: AgentDefinition;
  cell: { sector: Sector; branch: Branch };
} | null {
  for (const cell of MATRIX) {
    const agent = cell.agents.find((a) => a.id === agentId);
    if (agent) {
      return { agent, cell: { sector: cell.sector, branch: cell.branch } };
    }
  }
  return null;
}

function deriveDisplayStatus(
  registryStatus: "live" | "planned" | "unknown",
  catalogStatus: PublicStatus | "unknown",
  proofScore: ProofScore | null,
): UnifiedStatusKind {
  // Le score de preuve, quand il existe, est le signal le plus précis.
  if (proofScore !== null) {
    switch (proofScore) {
      case 4: return "client_ready";
      case 3: return "export_audit";
      case 2: return "public_demo";
      case 1: return "runtime_parsed";
      case 0: return "excel_created";
    }
  }
  // Pas de score connu : on déduit du couple registry/catalog.
  if (catalogStatus === "live") return "public_demo";
  if (catalogStatus === "demo") return "public_demo";
  if (registryStatus === "live") return "runtime_parsed";
  if (catalogStatus === "planned" || registryStatus === "planned") return "planned";
  return "unknown";
}

/**
 * API centrale : retourne le statut unifié d'un agent en composant les 3
 * sources, sans masquer les dimensions individuelles.
 */
export function getUnifiedStatus(agentId: string): UnifiedAgentStatus {
  const registry = locateInRegistry(agentId);
  const catalogEntry = AGENT_ENTRIES.find((entry) => entry.slug === agentId && entry.kind === "agent");
  const proofRecord = getProofRecordIndex().get(agentId);

  const registryStatus: UnifiedAgentStatus["registryStatus"] = registry?.agent.status ?? "unknown";
  const catalogStatus: UnifiedAgentStatus["catalogStatus"] = catalogEntry?.status ?? "unknown";
  const proofScore: ProofScore | null = proofRecord ? proofRecord.proofScore : null;
  const displayStatus = deriveDisplayStatus(registryStatus, catalogStatus, proofScore);

  return {
    agentId,
    registryStatus,
    catalogStatus,
    proofScore,
    displayStatus,
    isClientReady: proofScore === 4,
    isExportAuditEligible: proofScore !== null && proofScore >= 3,
    cell: registry?.cell ?? null,
  };
}

export function getProofScore(agentId: string): ProofScore | null {
  return getUnifiedStatus(agentId).proofScore;
}

export function isClientReady(agentId: string): boolean {
  return getUnifiedStatus(agentId).isClientReady;
}

export function isExportAuditEligible(agentId: string): boolean {
  return getUnifiedStatus(agentId).isExportAuditEligible;
}

/** Libellé court (Live/Démo/Prépa pattern) selon le displayStatus. */
export function getProofBadgeShort(status: UnifiedStatusKind): string {
  switch (status) {
    case "client_ready": return "Prêt client";
    case "export_audit": return "Export";
    case "public_demo": return "Démo";
    case "runtime_parsed": return "Runtime";
    case "excel_created": return "Excel";
    case "planned": return "Prépa";
    case "unknown": return "—";
  }
}

/** Libellé long pour pages preuve, dossier, hubs. */
export function getProofLabel(status: UnifiedStatusKind): string {
  if (status === "unknown") return "Statut inconnu";
  if (status === "planned") return "En préparation";
  // Les autres labels alignent sur PROOF_STATUS_LABELS pour rester cohérent
  // avec proof-catalog (source historique).
  return PROOF_STATUS_LABELS[status as AgentProofStatus];
}

/** Libellé "score" (Excel only / Parsé runtime / etc) pour timeline de maturité. */
export function getProofScoreLabel(score: ProofScore): string {
  return PROOF_SCORE_LABELS[score];
}

/** Description pédagogique du palier — utile pour tooltip ou page /proof. */
export function getProofDescription(status: UnifiedStatusKind): string {
  switch (status) {
    case "client_ready":
      return "Prêt à vendre avec contrat, support, security pack et ownership.";
    case "export_audit":
      return "Démo enrichie d'un export, d'une trace ou d'une preuve de sortie métier.";
    case "public_demo":
      return "Surface publique testable sans promettre la production client.";
    case "runtime_parsed":
      return "Workbook embarqué ou parsé par le site, metadata exploitable.";
    case "excel_created":
      return "Workbook créé, actif de conception mais pas encore en runtime.";
    case "planned":
      return "Combinaison structurellement possible mais non alimentée à ce jour.";
    case "unknown":
      return "Statut non renseigné — agent absent des 3 sources de vérité.";
  }
}

/**
 * CTA recommandé selon la maturité — utile pour les boutons d'action sur
 * les fiches agent (suggéré, le consommateur reste libre de surcharger).
 */
export function getProofCta(status: UnifiedStatusKind): { label: string; tone: "primary" | "secondary" | "ghost" } {
  switch (status) {
    case "client_ready":
      return { label: "Démarrer un pilot", tone: "primary" };
    case "export_audit":
      return { label: "Voir l'export signé", tone: "primary" };
    case "public_demo":
      return { label: "Tester la démo live", tone: "primary" };
    case "runtime_parsed":
      return { label: "Voir les données parsées", tone: "secondary" };
    case "excel_created":
      return { label: "Voir le workbook source", tone: "ghost" };
    case "planned":
      return { label: "Suivre la roadmap", tone: "ghost" };
    case "unknown":
      return { label: "Contact", tone: "ghost" };
  }
}
