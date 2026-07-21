import { convertToModelMessages, streamText, type UIMessage } from "ai";

import type { AiContextResponse } from "@/lib/api";
import { isLiveAi, demoStreamResponse } from "@/lib/ai/provider";
import { checkCopilotRateLimit } from "@/lib/rate-limit";
import { verifyBearerToken } from "@/lib/verify-jwt";

export const maxDuration = 60;

/** Variante scriptée (mode démonstration, sans appel modèle). */
function buildDemoVariant(ctx: AiContextResponse): string {
  const facts =
    ctx.allowedFacts.length > 0
      ? ctx.allowedFacts.map((f) => `- **${f.label}** : ${f.magnitude}`).join("\n")
      : "_Aucun indicateur quantifié disponible pour ce filtre._";
  return (
    "> 🟡 **Démonstration — réponse préenregistrée.** La reformulation IA en direct " +
    "s'active avec `NEURAL_MODE=live`.\n\n" +
    `**${ctx.baseHeadline}**\n\n` +
    `_Adapté au profil : ${ctx.personaLabel}._\n\n` +
    ctx.baseSupporting.map((s) => `- ${s}`).join("\n") +
    "\n\n**Chiffres citables (faits autorisés) :**\n" +
    facts
  );
}

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

  // --- Sécurité (PR-11) -----------------------------------------------------
  // Ce endpoint sert la vitrine marketing publique (panneau « Variante IA »
  // sans session). Le chemin DÉMO par défaut (NEURAL_MODE != "live") reste donc
  // ouvert et NE fait AUCUN appel modèle payant.
  //
  // Le chemin LIVE (payant) est en revanche protégé : il exige une session
  // authentifiée ET reste sous rate-limit. Une requête LIVE anonyme retombe sur
  // la réponse démo — jamais d'exécution payante anonyme.
  if (!isLiveAi()) {
    return demoStreamResponse(buildDemoVariant(aiContext));
  }

  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    // Live activé mais appel non authentifié → démo, jamais d'appel payant.
    return demoStreamResponse(buildDemoVariant(aiContext));
  }

  const rl = await checkCopilotRateLimit(`u:${payload.sub}`);
  if (!rl.success) {
    return new Response(
      JSON.stringify({
        error: "rate_limited",
        message: "Trop de requêtes. Réessayez dans quelques instants.",
        retryAfterSeconds: rl.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(rl.retryAfterSeconds),
          "x-ratelimit-limit": String(rl.limit),
          "x-ratelimit-remaining": String(rl.remaining),
          "x-ratelimit-reset": String(rl.reset),
        },
      },
    );
  }

  const result = streamText({
    model: "anthropic/claude-sonnet-4.6",
    system: buildVariantSystemPrompt(aiContext),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
