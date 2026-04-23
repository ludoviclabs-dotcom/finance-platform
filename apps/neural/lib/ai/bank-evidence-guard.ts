/**
 * NEURAL — AG-B006 BankEvidenceGuard (Sprint 6)
 *
 * Service transverse de résolution de sources admissibles. Consommé par
 * AG-B001..B004 avant toute génération. Contrat : aucune sortie ne peut
 * être acceptée sans un `EvidencePackage` valide.
 *
 * Pas de LLM : logique pure, déterministe, auditable, reproductible. Chaque
 * décision est traçable via `match_reasons` (pourquoi une source est
 * retenue) et `rejection_reasons` (pourquoi elle est écartée).
 *
 * Algorithme :
 *  1. Filtrer par `applicable_comm_types` (le comm_type doit être inclus)
 *  2. Filtrer par `juridictions_effective` (la jurisdiction doit être incluse)
 *  3. Calculer l'intersection des `subjects` demandés vs. les subjects de la source
 *     → score subject_match / subjects.length
 *  4. Appliquer la freshness policy : si review_date > max_age_days → STALE
 *  5. Scorer = priority_weight × subject_match × freshness_factor
 *  6. Trier, retourner le top-K, et lever des drapeaux si aucune source.
 */

import { z } from "zod";

import {
  BANK_COMMS_SOURCES,
  EVIDENCE_EXPANDED,
  EVIDENCE_RESOLVER_TESTSET,
  getFreshnessPolicy,
} from "@/lib/data/bank-comms-catalog";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const ResolveQuerySchema = z.object({
  communication_type: z.string(),
  jurisdiction: z.string(),
  subjects: z.array(z.string()).max(20),
  freshness_policy: z.string().default("FRESH-STANDARD"),
  top_k: z.number().int().min(1).max(20).default(10),
});
export type ResolveQuery = z.infer<typeof ResolveQuerySchema>;

export const ResolvedSourceSchema = z.object({
  source_id: z.string(),
  autorite: z.string(),
  titre: z.string(),
  url: z.string().nullable(),
  juridiction: z.string(),
  status: z.string(),
  review_date: z.string().nullable(),
  score: z.number(),
  subject_match: z.number(),
  freshness_label: z.enum(["FRESH", "STALE_WARNING", "STALE"]),
  age_days: z.number().nullable(),
  match_reasons: z.array(z.string()),
});
export type ResolvedSource = z.infer<typeof ResolvedSourceSchema>;

export const EvidencePackageSchema = z.object({
  query: ResolveQuerySchema,
  policy: z.object({
    policy_id: z.string(),
    max_age_days: z.number(),
    stale_warning_days: z.number(),
  }),
  sources: z.array(ResolvedSourceSchema),
  rejection_reasons: z.array(
    z.object({
      source_id: z.string(),
      reason: z.string(),
    }),
  ),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  verdict: z.enum(["READY", "PARTIAL", "BLOCKED"]),
  summary: z.string(),
});
export type EvidencePackage = z.infer<typeof EvidencePackageSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Main resolver ───────────────────────────────────────────────────────────

export function resolveEvidence(rawQuery: unknown): EvidencePackage {
  const parsed = ResolveQuerySchema.parse(rawQuery);
  const policy = getFreshnessPolicy(parsed.freshness_policy) ?? {
    policy_id: parsed.freshness_policy,
    max_age_days: 730,
    stale_warning_days: 365,
    label: "fallback",
    applicable_to: "",
  };

  const resolved: ResolvedSource[] = [];
  const rejection_reasons: EvidencePackage["rejection_reasons"] = [];

  for (const src of BANK_COMMS_SOURCES) {
    const ext = EVIDENCE_EXPANDED.find((e) => e.source_id === src.source_id);
    if (!ext) {
      rejection_reasons.push({
        source_id: src.source_id,
        reason: "Non enrichi dans AGB006 (pas de subjects / applicable_comm_types).",
      });
      continue;
    }
    const applicableTypes = ext.applicable_comm_types.split(",").map((s) => s.trim());
    if (!applicableTypes.includes(parsed.communication_type)) {
      rejection_reasons.push({
        source_id: src.source_id,
        reason: `Non applicable au type ${parsed.communication_type} (types supportés : ${ext.applicable_comm_types}).`,
      });
      continue;
    }
    const applicableJuris = ext.juridictions_effective.split(",").map((s) => s.trim());
    if (!applicableJuris.includes(parsed.jurisdiction)) {
      rejection_reasons.push({
        source_id: src.source_id,
        reason: `Non applicable à la juridiction ${parsed.jurisdiction} (supportées : ${ext.juridictions_effective}).`,
      });
      continue;
    }
    const srcSubjects = ext.subjects.split(",").map((s) => s.trim());
    const matched = parsed.subjects.filter((s) => srcSubjects.includes(s));
    if (parsed.subjects.length > 0 && matched.length === 0) {
      rejection_reasons.push({
        source_id: src.source_id,
        reason: `Aucun subject demandé ne matche (demandés : ${parsed.subjects.join(", ")} ; source couvre : ${ext.subjects}).`,
      });
      continue;
    }
    if (src.status !== "ACTIVE") {
      rejection_reasons.push({
        source_id: src.source_id,
        reason: `Source ${src.source_id} status=${src.status} (non ACTIVE).`,
      });
      continue;
    }
    const age = daysSince(src.review_date);
    let freshnessLabel: ResolvedSource["freshness_label"] = "FRESH";
    let freshnessFactor = 1.0;
    if (age !== null) {
      if (age > policy.max_age_days) {
        rejection_reasons.push({
          source_id: src.source_id,
          reason: `Review obsolète : ${age}j > policy max ${policy.max_age_days}j.`,
        });
        continue;
      }
      if (age > policy.stale_warning_days) {
        freshnessLabel = "STALE_WARNING";
        freshnessFactor = 0.75;
      } else if (age > policy.stale_warning_days / 2) {
        freshnessFactor = 0.9;
      }
    }
    const subjectMatch =
      parsed.subjects.length === 0 ? 1 : matched.length / parsed.subjects.length;
    const score = Math.round(
      ext.priority_weight * subjectMatch * freshnessFactor,
    );
    const match_reasons = [
      `applicable à ${parsed.communication_type}`,
      `juridiction ${parsed.jurisdiction} couverte`,
      `subjects matchés : ${matched.join(", ") || "(aucun requis)"}`,
      `${ext.official_level} · priority_weight=${ext.priority_weight}`,
      `review ${src.review_date ?? "n/a"} (${age ?? "n/a"}j)`,
    ];
    resolved.push({
      source_id: src.source_id,
      autorite: src.autorite,
      titre: src.titre,
      url: src.url,
      juridiction: src.juridiction,
      status: src.status,
      review_date: src.review_date,
      score,
      subject_match: Math.round(subjectMatch * 100) / 100,
      freshness_label: freshnessLabel,
      age_days: age,
      match_reasons,
    });
  }

  resolved.sort((a, b) => b.score - a.score);
  const top = resolved.slice(0, parsed.top_k);

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (top.length === 0) {
    blockers.push("NO_SOURCE_MATCHED");
  }
  if (top.every((s) => s.freshness_label !== "FRESH") && top.length > 0) {
    warnings.push("ALL_SOURCES_STALE_WARNING");
  }

  const verdict: EvidencePackage["verdict"] =
    blockers.length > 0
      ? "BLOCKED"
      : top.length < 2 || warnings.length > 0
        ? "PARTIAL"
        : "READY";

  const summary =
    verdict === "BLOCKED"
      ? `Aucune source admissible pour ${parsed.communication_type}/${parsed.jurisdiction} sur subjects [${parsed.subjects.join(", ")}]. Demander extension du registre à Compliance.`
      : verdict === "PARTIAL"
        ? `${top.length} source(s) admissible(s) — vérifier fraîcheur / couverture subjects.`
        : `${top.length} sources admissibles, policy ${policy.policy_id}. Top score : ${top[0]?.score ?? 0}.`;

  return {
    query: parsed,
    policy: {
      policy_id: policy.policy_id,
      max_age_days: policy.max_age_days,
      stale_warning_days: policy.stale_warning_days,
    },
    sources: top,
    rejection_reasons,
    blockers,
    warnings,
    verdict,
    summary,
  };
}

// ─── Convenience : run testset ───────────────────────────────────────────────

export function runResolverTestset(): Array<{
  query_id: string;
  label: string;
  passed: boolean;
  expected_sources_min: number;
  actual_sources: number;
  expected_blockers: string[];
  actual_blockers: string[];
}> {
  return EVIDENCE_RESOLVER_TESTSET.map((t) => {
    const pkg = resolveEvidence(t.query);
    const actualSources = pkg.sources.length;
    const actualBlockers = pkg.blockers;
    const sourcesOk = actualSources >= t.expected_sources_min;
    const blockersOk =
      t.expected_blockers.every((b) => actualBlockers.includes(b)) &&
      actualBlockers.every((b) => t.expected_blockers.includes(b));
    return {
      query_id: t.query_id,
      label: t.label,
      passed: sourcesOk && blockersOk,
      expected_sources_min: t.expected_sources_min,
      actual_sources: actualSources,
      expected_blockers: t.expected_blockers,
      actual_blockers: actualBlockers,
    };
  });
}
