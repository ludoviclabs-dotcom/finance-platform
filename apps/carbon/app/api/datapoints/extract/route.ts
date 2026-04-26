import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { requireRole, verifyBearerToken } from "@/lib/verify-jwt";
import { findDatapoint, type EsrsDatapointDef, type SourceCitation, type ExtractedDatapoint } from "@/lib/esrs/schema";
import { embedQuery } from "@/lib/rag/embeddings";
import { querySimilar, tenantNamespace, type RagSearchResult } from "@/lib/rag/vector-store";
import { upsertExtraction } from "@/lib/datapoints/store";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-5-20250929";
const TOP_K = 8;

type ExtractBody = {
  datapointIds: string[];
};

type ExtractResult = {
  datapointId: string;
  status: "ok" | "skipped" | "error";
  extraction?: ExtractedDatapoint;
  detail?: string;
};

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
      unit: {
        type: "string",
        description: "Unité de la valeur (doit correspondre à l'unité attendue du datapoint).",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "Score de confiance entre 0 (aucune trace exploitable) et 1 (information explicite et cohérente).",
      },
      reasoning: {
        type: "string",
        description: "Justification courte (1-3 phrases) du choix de la valeur.",
      },
      sources: {
        type: "array",
        minItems: 0,
        items: {
          type: "object",
          properties: {
            chunkId: {
              type: "string",
              description: "Identifiant du chunk source utilisé (parmi ceux fournis).",
            },
            snippet: {
              type: "string",
              description: "Extrait littéral du chunk qui justifie la valeur (max 280 caractères).",
            },
          },
          required: ["chunkId", "snippet"],
        },
      },
    },
    required: ["value", "confidence", "sources"],
  },
};

function buildPrompt(def: EsrsDatapointDef, chunks: RagSearchResult[]): string {
  const lines: string[] = [];
  lines.push(
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
  );
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

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY manquant.");
  return key;
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

async function extractOne(
  client: Anthropic,
  cid: string,
  datapointId: string,
): Promise<ExtractResult> {
  const def = findDatapoint(datapointId);
  if (!def) {
    return { datapointId, status: "skipped", detail: "Datapoint inconnu" };
  }

  const queryText = `${def.label_fr} ${def.label_en} ${def.code} ${def.unit ?? ""}`.trim();
  const vec = await embedQuery(queryText);
  const chunks = await querySimilar(tenantNamespace(cid), vec, TOP_K);

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
    return { datapointId, status: "error", detail: "Réponse Claude sans tool_use" };
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

  const status =
    value === null ? "empty" : confidence < 0.5 ? "rejected" : "extracted";

  const extraction: ExtractedDatapoint = {
    datapointId,
    value,
    unit: input.unit ?? def.unit,
    confidence,
    reasoning: input.reasoning,
    sources,
    status,
    extractedAt: new Date().toISOString(),
  };

  await upsertExtraction(cid, extraction);
  return { datapointId, status: "ok", extraction };
}

export async function POST(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!requireRole(payload, ["admin", "analyst"])) {
    return NextResponse.json({ error: "Rôle insuffisant" }, { status: 403 });
  }

  let body: ExtractBody;
  try {
    body = (await req.json()) as ExtractBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const ids = (body.datapointIds ?? []).filter((s): s is string => typeof s === "string" && s.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "datapointIds manquant" }, { status: 400 });
  }
  if (ids.length > 60) {
    return NextResponse.json({ error: "Trop de datapoints (max 60 par batch)" }, { status: 400 });
  }

  let client: Anthropic;
  try {
    client = new Anthropic({ apiKey: getApiKey() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Configuration LLM invalide" },
      { status: 500 },
    );
  }

  const results: ExtractResult[] = [];
  for (const id of ids) {
    try {
      const r = await extractOne(client, String(payload.cid), id);
      results.push(r);
    } catch (err) {
      results.push({
        datapointId: id,
        status: "error",
        detail: err instanceof Error ? err.message : "Erreur extraction",
      });
    }
  }

  return NextResponse.json({ results });
}
