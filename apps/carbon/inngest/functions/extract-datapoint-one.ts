/**
 * Inngest function — `datapoints/extract.one` (worker).
 *
 * Extrait UN datapoint ESRS via le pipeline RAG + Claude tool_use.
 * Déduplique la logique de `app/api/datapoints/extract/route.ts` mais
 * adapté Inngest : chaque step est retryable, et l'état est poussé en
 * Redis pour suivi UI.
 *
 * Concurrence limitée à 8 datapoints simultanés (rate limit Anthropic
 * Messages API + Voyage AI).
 */

import Anthropic from "@anthropic-ai/sdk";
import { inngest } from "@/lib/queue/client";
import { updateItem } from "@/lib/queue/job-tracker";
import {
  findDatapoint,
  type EsrsDatapointDef,
  type SourceCitation,
  type ExtractedDatapoint,
} from "@/lib/esrs/schema";
import { embedQuery } from "@/lib/rag/embeddings";
import {
  querySimilar,
  tenantNamespace,
  type RagSearchResult,
} from "@/lib/rag/vector-store";
import { upsertExtraction } from "@/lib/datapoints/store";

const MODEL = "claude-sonnet-4-5-20250929";
const TOP_K = 8;

const RECORD_TOOL = {
  name: "record_datapoint",
  description:
    "Enregistre la valeur extraite d'un datapoint ESRS avec ses sources. À appeler exactement une fois.",
  input_schema: {
    type: "object" as const,
    properties: {
      value: {
        description:
          "Valeur du datapoint. Number pour les types numériques, string pour les types texte, boolean pour booléens, null si l'information n'a pas été trouvée.",
        anyOf: [
          { type: "number" },
          { type: "string" },
          { type: "boolean" },
          { type: "null" },
        ],
      },
      unit: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reasoning: { type: "string" },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            chunkId: { type: "string" },
            snippet: { type: "string" },
          },
          required: ["chunkId", "snippet"],
        },
      },
    },
    required: ["value", "confidence", "sources"],
  },
};

function buildPrompt(def: EsrsDatapointDef, chunks: RagSearchResult[]): string {
  const lines: string[] = [
    "Tu extrais un datapoint réglementaire ESRS Set 2 depuis des extraits de documents internes.",
    "Règles strictes :",
    "1. N'invente jamais une valeur. Si l'information n'est pas explicitement présente dans les extraits, retourne value=null avec confidence<=0.3.",
    "2. La valeur doit être strictement compatible avec le type attendu (number, text, boolean, enum).",
    "3. Si plusieurs sources concordent, augmente la confiance. Si elles se contredisent, baisse la confiance.",
    "4. Cite au moins une source dès que value n'est pas null.",
    "5. Réponds via l'outil record_datapoint uniquement, en un seul appel.",
    "",
    `## Datapoint cible (${def.standard} ${def.code})`,
    `- id : ${def.id}`,
    `- libellé : ${def.label_fr}`,
    `- type : ${def.type}${def.unit ? ` (unité ${def.unit})` : ""}`,
  ];
  if (def.description) lines.push(`- description : ${def.description}`);
  lines.push("", "## Extraits documentaires (top-k)");
  if (chunks.length === 0) {
    lines.push("_Aucun extrait pertinent n'a été trouvé. Retourne value=null avec confidence=0._");
  } else {
    chunks.forEach((c, i) => {
      const ref = `${c.metadata.filename}${c.metadata.page ? ` p.${c.metadata.page}` : ""}${c.metadata.sheet ? ` (feuille ${c.metadata.sheet})` : ""}`;
      lines.push(
        "",
        `### chunk ${i + 1} — id=${c.id} — ${ref}`,
        c.metadata.text.slice(0, 1500),
      );
    });
  }
  return lines.join("\n");
}

type ToolUseInput = {
  value: number | string | boolean | null;
  unit?: string;
  confidence: number;
  reasoning?: string;
  sources?: Array<{ chunkId: string; snippet: string }>;
};

function buildSourceCitations(
  toolSources: ToolUseInput["sources"],
  chunks: RagSearchResult[],
): SourceCitation[] {
  if (!toolSources || toolSources.length === 0) return [];
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const out: SourceCitation[] = [];
  for (const s of toolSources) {
    const chunk = byId.get(s.chunkId);
    if (!chunk) continue;
    out.push({
      blobUrl: chunk.metadata.blobUrl,
      filename: chunk.metadata.filename,
      page: chunk.metadata.page,
      sheet: chunk.metadata.sheet,
      snippet: s.snippet.slice(0, 280),
    });
  }
  return out;
}

export const datapointExtractOne = inngest.createFunction(
  {
    id: "datapoint-extract-one",
    name: "Datapoint — Extract single ESRS datapoint",
    triggers: [{ event: "datapoints/extract.one" }],
    concurrency: { limit: 5 }, // 5 extractions parallèles (plan Inngest gratuit)
    retries: 3,
  },
  async ({ event, step }) => {
    const data = event.data as {
      cid: string;
      batchId: string;
      datapointId: string;
    };
    const { cid, batchId, datapointId } = data;

    const def = findDatapoint(datapointId);
    if (!def) {
      await step.run("mark-skipped", async () => {
        await updateItem(cid, batchId, datapointId, "error", "Datapoint inconnu");
      });
      return { datapointId, status: "skipped" as const };
    }

    await step.run("mark-running", async () => {
      await updateItem(cid, batchId, datapointId, "running");
    });

    try {
      // 1. Embedding de la requête + similarity search RAG
      const chunks = await step.run("rag-search", async () => {
        const queryText = `${def.label_fr} ${def.label_en} ${def.code} ${def.unit ?? ""}`.trim();
        const vec = await embedQuery(queryText);
        return await querySimilar(tenantNamespace(cid), vec, TOP_K);
      });

      // 2. Appel Claude avec tool_use forcé
      const extraction = await step.run("claude-extract", async () => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");
        const client = new Anthropic({ apiKey });

        const message = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          tool_choice: { type: "tool", name: RECORD_TOOL.name },
          tools: [RECORD_TOOL],
          messages: [{ role: "user", content: buildPrompt(def, chunks) }],
        });

        const toolBlock = message.content.find(
          (b): b is Anthropic.Messages.ToolUseBlock =>
            b.type === "tool_use" && b.name === RECORD_TOOL.name,
        );
        if (!toolBlock) {
          throw new Error("Réponse Claude sans tool_use");
        }

        const input = toolBlock.input as ToolUseInput;
        const sources = buildSourceCitations(input.sources, chunks);

        let value = input.value;
        if (def.type === "number" && typeof value === "string") {
          const parsed = Number(value.replace(/[^0-9.,-]/g, "").replace(",", "."));
          value = Number.isFinite(parsed) ? parsed : null;
        }
        if (def.type === "boolean" && typeof value === "string") {
          value = ["true", "oui", "yes"].includes(value.toLowerCase());
        }

        let confidence = Math.max(0, Math.min(1, input.confidence ?? 0));
        if (value !== null && sources.length === 0) confidence = Math.min(confidence, 0.3);
        if (value === null) confidence = Math.min(confidence, 0.3);

        const status = value === null ? "empty" : confidence < 0.5 ? "rejected" : "extracted";

        const e: ExtractedDatapoint = {
          datapointId,
          value,
          unit: input.unit ?? def.unit,
          confidence,
          reasoning: input.reasoning,
          sources,
          status,
          extractedAt: new Date().toISOString(),
        };
        return e;
      });

      // 3. Persist Vercel Blob (state.json per tenant)
      await step.run("persist", async () => {
        await upsertExtraction(cid, extraction);
      });

      // 4. Marqueur OK + meta confidence
      await step.run("mark-ok", async () => {
        await updateItem(cid, batchId, datapointId, "ok", undefined, {
          confidence: extraction.confidence,
          status: extraction.status,
        });
      });

      return { datapointId, status: "ok" as const, confidence: extraction.confidence };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Erreur extraction";
      await step.run("mark-error", async () => {
        await updateItem(cid, batchId, datapointId, "error", detail);
      });
      throw err;
    }
  },
);
