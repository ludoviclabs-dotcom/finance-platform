import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `Tu es l'assistant IA de NEURAL, une entreprise spécialisée dans
l'intégration de Claude AI en entreprise. Tu aides les visiteurs du site à comprendre :

1. Pourquoi 80% des projets IA échouent en entreprise
2. Comment NEURAL résout ce problème avec une approche structurée
3. Les 7 branches métier couvertes (SI, RH, Marketing, Communication, Comptabilité, Finance, Supply Chain)
4. Les 6 secteurs d'expertise (Transport, Luxe, Aéronautique, SaaS, Banque, Assurance)
5. Les forfaits disponibles (Starter, Business, Enterprise, Premium, High Value)

Sois concis, professionnel mais accessible. Utilise des données chiffrées quand possible.
Ne fais pas de promesses exagérées. Si la question dépasse ton périmètre,
suggère de prendre rendez-vous avec un consultant NEURAL.

Réponds toujours en français sauf si l'utilisateur écrit en anglais.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-10),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat demo error:", error);
    return Response.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
