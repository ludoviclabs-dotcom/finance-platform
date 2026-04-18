/**
 * NEURAL — Regulatory impact classifier (Sprint 7)
 *
 * Uses Claude Haiku (via Vercel AI Gateway) to classify each new regulatory
 * publication and assign:
 *   • impactScore    (0–1)  — how much does this affect NEURAL's agents?
 *   • affectedAgents ([])   — which agent categories are impacted?
 *   • summary        (str)  — one-sentence digest in French
 *
 * Design principles:
 *   • Haiku for speed + cost (classification, not generation)
 *   • Strict JSON output schema — retry once on parse failure
 *   • Timeout 8 s — classifier never blocks the cron more than ~10 s per item
 *   • Fails open: if classifier errors, impactScore = 0 and no agents affected
 */

import { generateText, gateway } from "ai";
import type { RawPublication, ClassifiedAlert, AffectedAgent } from "./types";

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un classificateur de publications réglementaires pour NEURAL, plateforme d'IA pour l'entreprise en France.

NEURAL propose des agents spécialisés dans ces domaines :
- ifrs-reporting  : IFRS 9 (ECL, dépréciations), IFRS 16 (leasing), IFRS 17 (assurance), consolidation IFRS
- tax-compliance  : TVA française, IS, CFE, CVAE, liasses fiscales, BOFiP
- banking-reg     : Bâle III/IV, CRR/CRD V, DORA, LCR, NSFR, ACPR
- consolidation   : consolidation multi-entités, intercos, retraitements PCG/IFRS
- payroll-hr      : paie française, charges sociales, URSSAF, DSN
- audit-risk      : contrôle interne, scoring de risque, conformité réglementaire

Pour chaque publication réglementaire fournie, tu dois retourner un objet JSON STRICT (sans markdown, sans explication) :
{
  "impactScore": <float entre 0.0 et 1.0>,
  "affectedAgents": [<liste parmi: ifrs-reporting, tax-compliance, banking-reg, consolidation, payroll-hr, audit-risk>],
  "summary": "<une phrase en français résumant l'impact sur NEURAL>"
}

Critères de scoring :
- 0.9-1.0 : changement majeur immédiat (nouveau règlement, modification de standard IFRS, etc.)
- 0.7-0.9 : impact significatif dans les 6 mois
- 0.5-0.7 : impact modéré à surveiller
- 0.3-0.5 : impact faible ou indirect
- 0.0-0.3 : publication non pertinente pour NEURAL

Ne retourne QUE le JSON. Aucun texte avant ou après.`;

// ── Classifier ────────────────────────────────────────────────────────────────

const VALID_AGENTS: AffectedAgent[] = [
  "ifrs-reporting",
  "tax-compliance",
  "banking-reg",
  "consolidation",
  "payroll-hr",
  "audit-risk",
];

type ClassifierOutput = {
  impactScore: number;
  affectedAgents: AffectedAgent[];
  summary: string;
};

function parseClassifierOutput(text: string): ClassifierOutput | null {
  try {
    // Strip potential markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const data = JSON.parse(cleaned) as Record<string, unknown>;

    const score = Number(data["impactScore"]);
    if (isNaN(score) || score < 0 || score > 1) return null;

    const agents = Array.isArray(data["affectedAgents"])
      ? (data["affectedAgents"] as unknown[])
          .filter((a): a is string => typeof a === "string")
          .filter((a): a is AffectedAgent => VALID_AGENTS.includes(a as AffectedAgent))
      : [];

    const summary = typeof data["summary"] === "string" && data["summary"].trim()
      ? data["summary"].trim()
      : "Publication réglementaire — analyse indisponible.";

    return { impactScore: score, affectedAgents: agents, summary };
  } catch {
    return null;
  }
}

async function callClassifier(pub: RawPublication): Promise<ClassifierOutput | null> {
  const userMessage = [
    `Source     : ${pub.source}`,
    `Titre      : ${pub.title}`,
    `URL        : ${pub.url}`,
    `Résumé     : ${pub.abstract ?? "(non disponible)"}`,
    `Publiée le : ${pub.publishedAt.toISOString().split("T")[0]}`,
  ].join("\n");

  const { text } = await generateText({
    model: gateway("anthropic/claude-haiku-3"),
    messages: [{ role: "user", content: userMessage }],
    system: SYSTEM_PROMPT,
    maxOutputTokens: 200,
    temperature: 0.1, // deterministic classification
    providerOptions: {
      gateway: {
        tags: ["regulatory-watch", "classifier", "product:neural"],
        cacheControl: "max-age=86400", // same text → same result for 24 h
      },
    },
  });

  return parseClassifierOutput(text);
}

// ── Public API ────────────────────────────────────────────────────────────────

const FALLBACK: ClassifierOutput = {
  impactScore: 0,
  affectedAgents: [],
  summary: "Classification indisponible — traitement différé.",
};

/**
 * Classify a single raw publication.
 * Retries once on JSON parse failure. Always returns a result (never throws).
 */
export async function classifyPublication(pub: RawPublication): Promise<ClassifiedAlert> {
  let result: ClassifierOutput | null = null;

  try {
    result = await callClassifier(pub);

    // Retry once if parse failed
    if (!result) {
      result = await callClassifier(pub);
    }
  } catch (err) {
    console.warn(
      `[regulatory/classifier] Failed for "${pub.title}":`,
      err instanceof Error ? err.message : err,
    );
  }

  const classification = result ?? FALLBACK;

  return {
    ...pub,
    ...classification,
  };
}

/**
 * Classify a batch of publications in parallel (max 5 concurrent to avoid
 * rate-limiting the AI Gateway during a large cron run).
 */
export async function classifyBatch(
  pubs: RawPublication[],
  concurrency = 5,
): Promise<ClassifiedAlert[]> {
  const results: ClassifiedAlert[] = [];

  for (let i = 0; i < pubs.length; i += concurrency) {
    const batch = pubs.slice(i, i + concurrency);
    const classified = await Promise.all(batch.map(classifyPublication));
    results.push(...classified);
  }

  return results;
}
