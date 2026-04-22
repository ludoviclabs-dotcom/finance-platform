/**
 * NEURAL — AG-004 HeritageComms live (Sprint 4)
 *
 * Expose `quoteHeritage()` : cherche un fait historique dans APPROVED_FACTS +
 * HERITAGE_SOURCES, renvoie citation formatee + narrative block propose.
 *
 * REGLE ABSOLUE : jamais d'hallucination. Si aucun fait approuve ne matche,
 * usable = false + listing des sources actives comme suggestion.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import {
  APPROVED_FACTS,
  HERITAGE_SOURCES,
  NARRATIVE_BLOCKS,
  resolveHeritageStatus,
} from "@/lib/data/luxe-comms-catalog";
import { env } from "@/lib/env";
import { flushLangfuse, getLangfuseClient } from "@/lib/ai/langfuse";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const CITATION_FORMATS = ["Maison-style", "Chicago", "APA", "Juridique"] as const;
export type CitationFormat = (typeof CITATION_FORMATS)[number];

export const HeritageQuoteSchema = z.object({
  fact: z
    .string()
    .describe("Le fait historique exact (extrait d'APPROVED_FACTS uniquement, jamais invente)."),
  fact_id: z.string().nullable().describe("FC-XXX si match direct APPROVED_FACTS, sinon null."),
  year: z.number().int().nullable(),
  source_id: z.string().nullable().describe("SRC-XXX du catalogue — JAMAIS null si usable=true."),
  source_title: z.string().nullable(),
  source_type: z.enum(["PRIMARY", "SECONDARY", "TERTIARY"]).nullable(),
  source_status: z.enum(["ACTIVE", "STALE", "REJECTED"]).nullable(),
  citation_formatted: z
    .string()
    .describe("Citation au format demande ; vide si usable=false."),
  usable: z
    .boolean()
    .describe("TRUE si une source ACTIVE a ete matchee. FALSE sinon — NE PAS inventer."),
  narrative_block: z
    .string()
    .describe("2-3 phrases utilisables dans un communique, ou message d'impossibilite si usable=false."),
  alternative_source_ids: z
    .array(z.string())
    .describe("Autres SRC-XXX qui pourraient etre pertinents pour la query."),
});
export type HeritageQuoteResult = z.infer<typeof HeritageQuoteSchema>;

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildSystemPrompt(format: CitationFormat): string {
  const facts = APPROVED_FACTS.map(
    (f) => `- ${f.fact_id} [${f.annee ?? "?"}] "${f.fait}" (sources: ${[f.source_1, f.source_2, f.source_3].filter(Boolean).join(", ")})`
  ).join("\n");

  const sources = HERITAGE_SOURCES.map((s) => {
    const status = resolveHeritageStatus(s);
    return `- ${s.source_id} [${s.type}, ${status}] "${s.titre}" (${s.annee ?? "?"}) cote=${s.cote_archive ?? "?"}`;
  }).join("\n");

  const blocks = NARRATIVE_BLOCKS.slice(0, 6)
    .map((b) => `- ${b.block_id} [${b.theme}] "${b.titre}" — sources: ${b.sources}`)
    .join("\n");

  return `Tu es HeritageComms (AG-004), l'agent NEURAL de sourcing patrimonial.

REGLE ABSOLUE : tu ne peux **JAMAIS** inventer un fait, une date ou une source.
Si la query ne matche aucun APPROVED_FACT, tu retournes usable=false + liste les SRC-XXX proches.

FORMAT DE CITATION DEMANDE : ${format}

Formats autorises :
- Maison-style : "Archives maison [annee] (cote [cote])"
- Chicago : "Nom auteur, Titre, [annee], [cote]"
- APA : "Auteur (annee). Titre. [cote]"
- Juridique : "[Cote archive], [annee]"

FACTS APPROUVES (source unique de verite) :
${facts}

SOURCES CATALOGUEES :
${sources}

BLOCS NARRATIFS DEJA REDIGES (reutilisables) :
${blocks}

Ta reponse :
- Matche la query contre les APPROVED_FACTS (lis bien la date + le theme).
- Si match : renvoie le fait tel quel, la source principale, la citation formatee, le bloc narratif.
- Si pas de match direct mais une source catalogued est pertinente : propose en alternative_source_ids.
- Si aucun fait ni source ne matche : usable=false + narrative_block explique poliment l'impossibilite.

JAMAIS : inventer une date, un nom, un chiffre. JAMAIS : utiliser une source STALE ou REJECTED sans le signaler.`;
}

function buildUserPrompt(query: string): string {
  return `Query patrimoniale : """${query.trim()}"""\n\nCherche dans le catalogue, retourne le verdict structure.`;
}

// ─── Fallback ────────────────────────────────────────────────────────────────

function deterministicQuote(query: string, format: CitationFormat): HeritageQuoteResult {
  const lower = query.toLowerCase();
  const fact = APPROVED_FACTS.find((f) => {
    const hay = `${f.fait} ${f.annee ?? ""}`.toLowerCase();
    // match simple par mots-cles
    const keywords = lower.split(/\s+/).filter((w) => w.length > 3);
    return keywords.some((k) => hay.includes(k));
  });

  if (!fact) {
    // suggere les 3 sources ACTIVE les plus pertinentes
    const alternatives = HERITAGE_SOURCES.filter((s) => resolveHeritageStatus(s) === "ACTIVE")
      .slice(0, 3)
      .map((s) => s.source_id);
    return {
      fact: "",
      fact_id: null,
      year: null,
      source_id: null,
      source_title: null,
      source_type: null,
      source_status: null,
      citation_formatted: "",
      usable: false,
      narrative_block:
        "Aucun fait approuve ne matche la query. Cette affirmation ne peut pas etre diffusee sans ajout explicite au sourcebook (AG-004 respecte la regle zero-hallucination).",
      alternative_source_ids: alternatives,
    };
  }

  const srcId = fact.source_1 ?? "";
  const src = HERITAGE_SOURCES.find((s) => s.source_id === srcId);
  const status = src ? resolveHeritageStatus(src) : null;

  function formatCitation(): string {
    if (!src) return "";
    switch (format) {
      case "Maison-style":
        return `Archives maison ${src.annee ?? ""} (cote ${src.cote_archive ?? "?"}).`;
      case "Chicago":
        return `${src.auteur ?? "Anonyme"}, ${src.titre}, ${src.annee ?? "?"}, ${src.cote_archive ?? "?"}.`;
      case "APA":
        return `${src.auteur ?? "Anonyme"} (${src.annee ?? "?"}). ${src.titre}. ${src.cote_archive ?? "?"}.`;
      case "Juridique":
        return `${src.cote_archive ?? "?"}, ${src.annee ?? "?"}.`;
    }
  }

  return {
    fact: fact.fait,
    fact_id: fact.fact_id,
    year: fact.annee ?? null,
    source_id: src?.source_id ?? null,
    source_title: src?.titre ?? null,
    source_type: (src?.type as "PRIMARY" | "SECONDARY" | "TERTIARY") ?? null,
    source_status: status,
    citation_formatted: formatCitation(),
    usable: status === "ACTIVE",
    narrative_block: status === "ACTIVE"
      ? `${fact.fait} ${formatCitation()} Cette reference est disponible pour les communications presse et evenementielles.`
      : `Fait identifie, mais source ${status} — revalidation necessaire avant usage public.`,
    alternative_source_ids: [],
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

export type HeritageQuoteMeta = {
  traceId: string;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
};

export async function quoteHeritage({
  query,
  format = "Maison-style",
  userId,
}: {
  query: string;
  format?: CitationFormat;
  userId: string;
}): Promise<{ result: HeritageQuoteResult; meta: HeritageQuoteMeta }> {
  const traceId = randomUUID();
  const startedAt = Date.now();

  if (!env.ai.gatewayReady) {
    return {
      result: deterministicQuote(query, format),
      meta: { traceId, mode: "fallback", latencyMs: Date.now() - startedAt },
    };
  }

  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    id: traceId,
    name: "luxe-heritage-quote",
    userId,
    tags: ["agent:heritage-comms", `format:${format}`, "sprint:4"],
    input: { query_length: query.length, format },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: HeritageQuoteSchema,
      system: buildSystemPrompt(format),
      prompt: buildUserPrompt(query),
      temperature: 0.1, // tres deterministe pour sourcing
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:luxe-heritage-quote"],
        },
      },
    });

    trace?.update({
      output: { usable: object.usable, fact_id: object.fact_id, source_id: object.source_id },
    });
    trace?.generation({
      name: "generate-object",
      model: MODEL,
      usage: usage
        ? { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
        : undefined,
    });
    void flushLangfuse();

    return {
      result: object,
      meta: { traceId, mode: "gateway", model: MODEL, latencyMs: Date.now() - startedAt },
    };
  } catch (err) {
    console.warn("[heritage-quote] gateway error, fallback:", err instanceof Error ? err.message : err);
    void flushLangfuse();
    return {
      result: deterministicQuote(query, format),
      meta: { traceId, mode: "fallback", latencyMs: Date.now() - startedAt },
    };
  }
}
