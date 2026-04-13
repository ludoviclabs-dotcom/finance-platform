import { convertToModelMessages, streamText, type UIMessage } from "ai";

import type { AiContextResponse } from "@/lib/api";

export const maxDuration = 60;

function buildVariantSystemPrompt(ctx: AiContextResponse): string {
  const factsBlock =
    ctx.allowedFacts.length > 0
      ? ctx.allowedFacts
          .map((f) => `- **${f.label}** : ${f.magnitude}`)
          .join("\n")
      : "_Aucun indicateur quantifié disponible pour ce filtre._";

  return [
    "Tu es un expert en stratégie ESG pour entreprises francophones.",
    "Ta mission : reformuler le message ci-dessous pour le rendre plus percutant,",
    "en t'adaptant au registre et aux préoccupations du profil indiqué.",
    "",
    "RÈGLES ABSOLUES :",
    "1. Tu ne peux citer QUE les chiffres listés dans la section « Faits autorisés » ci-dessous.",
    "   Ne jamais inventer ni extrapoler de valeurs numériques.",
    "2. Conserve le sens et les affirmations du message original — reformule, n'invente pas.",
    "3. Réponds toujours en français, avec un style adapté au profil.",
    "4. Structure : une accroche courte (headline), puis 3 points d'appui.",
    "5. Format markdown : **gras** pour les chiffres, listes à puces pour les points d'appui.",
    "",
    "=== PROFIL CIBLE ===",
    `${ctx.personaLabel}`,
    "",
    "=== MESSAGE DE RÉFÉRENCE ===",
    `**Accroche :** ${ctx.baseHeadline}`,
    "",
    "Points d'appui originaux :",
    ...ctx.baseSupporting.map((s) => `- ${s}`),
    "",
    "=== FAITS AUTORISÉS (seuls chiffres citables) ===",
    factsBlock,
    "",
    "=== INSTRUCTION ===",
    "Produis une variante reformulée du message ci-dessus.",
    "Commence par l'accroche reformulée en gras, puis les 3 points d'appui.",
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    aiContext: AiContextResponse;
  };

  const { messages, aiContext } = body;

  const result = streamText({
    model: "anthropic/claude-sonnet-4.6",
    system: buildVariantSystemPrompt(aiContext),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
