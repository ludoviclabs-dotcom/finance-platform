import { convertToModelMessages, streamText, type UIMessage } from "ai";

export const maxDuration = 60;

interface SnapshotContext {
  carbon?: unknown;
  vsme?: unknown;
  esg?: unknown;
  finance?: unknown;
}

function buildSystemPrompt(snapshots: SnapshotContext): string {
  const parts: string[] = [
    "Tu es CarbonCo Copilot, un assistant expert en reporting ESG, CSRD, VSME, Taxonomie UE, CBAM, SBTi et bilan carbone (méthode ADEME).",
    "Tu t'adresses à un responsable RSE / CFO francophone. Réponds toujours en français, de manière concise, structurée, factuelle.",
    "",
    "RÈGLES ABSOLUES :",
    "1. Utilise EXCLUSIVEMENT les données fournies ci-dessous pour tout chiffre cité. Ne jamais inventer ni estimer de valeurs.",
    "2. Si une donnée est absente (null ou manquante), dis-le explicitement au lieu de la deviner.",
    "3. Cite systématiquement tes sources : \"d'après votre snapshot Carbone\", \"selon la matérialité ESRS\", etc.",
    "4. Structure avec du markdown : listes, gras, sous-titres courts.",
    "5. Si la question sort du périmètre ESG/Finance/Carbone, redirige poliment.",
    "",
    "=== DONNÉES DU CLIENT (snapshots temps réel) ===",
  ];

  if (snapshots.carbon) {
    parts.push("", "## Snapshot Carbone", "```json", JSON.stringify(snapshots.carbon, null, 2), "```");
  } else {
    parts.push("", "## Snapshot Carbone", "_Non disponible_");
  }
  if (snapshots.vsme) {
    parts.push("", "## Snapshot VSME", "```json", JSON.stringify(snapshots.vsme, null, 2), "```");
  } else {
    parts.push("", "## Snapshot VSME", "_Non disponible_");
  }
  if (snapshots.esg) {
    parts.push("", "## Snapshot ESG / Matérialité", "```json", JSON.stringify(snapshots.esg, null, 2), "```");
  } else {
    parts.push("", "## Snapshot ESG / Matérialité", "_Non disponible_");
  }
  if (snapshots.finance) {
    parts.push("", "## Snapshot Finance", "```json", JSON.stringify(snapshots.finance, null, 2), "```");
  } else {
    parts.push("", "## Snapshot Finance", "_Non disponible_");
  }

  return parts.join("\n");
}

export async function POST(req: Request) {
  const {
    messages,
    snapshots,
  }: {
    messages: UIMessage[];
    snapshots?: SnapshotContext;
  } = await req.json();

  const result = streamText({
    model: "anthropic/claude-sonnet-4.6",
    system: buildSystemPrompt(snapshots ?? {}),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
