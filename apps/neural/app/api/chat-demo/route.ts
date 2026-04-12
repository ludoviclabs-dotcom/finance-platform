import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Rate limiter — in-memory, per IP, 10 req/min
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateMap = new Map<string, number[]>();

// Purge stale entries every 5 min to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateMap) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateMap.delete(ip);
    else rateMap.set(ip, recent);
  }
}, 5 * 60_000);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_MESSAGES = 10;
const VALID_ROLES = new Set(["user", "assistant"]);

function validateMessages(
  body: unknown,
): { ok: true; messages: { role: "user" | "assistant"; content: string }[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || !("messages" in body)) {
    return { ok: false, error: "Le champ « messages » est requis." };
  }
  const { messages } = body as { messages: unknown };
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "« messages » doit être un tableau non vide." };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Maximum ${MAX_MESSAGES} messages autorisés.` };
  }
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return { ok: false, error: "Chaque message doit être un objet." };
    }
    const { role, content } = msg as { role: unknown; content: unknown };
    if (typeof role !== "string" || !VALID_ROLES.has(role)) {
      return { ok: false, error: "Rôle invalide (user | assistant)." };
    }
    if (typeof content !== "string" || content.length === 0) {
      return { ok: false, error: "Le contenu du message est requis." };
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères).` };
    }
  }
  return { ok: true, messages: messages as { role: "user" | "assistant"; content: string }[] };
}

// ---------------------------------------------------------------------------
// Anthropic client & system prompt
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return Response.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      { status: 429 },
    );
  }

  // Body parsing
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 },
    );
  }

  // Validation
  const result = validateMessages(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: result.messages.slice(-MAX_MESSAGES),
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
      { status: 500 },
    );
  }
}
