/**
 * NEURAL — Public chat demo API (Sprint 1 — guardrailed)
 *
 * Changes from Sprint 0:
 *   • In-memory rate limiter replaced by withGuardrails() (Upstash Redis,
 *     20 req/min per IP, persistent across function instances).
 *   • Input guard added before LLM call (pattern + optional Lakera Guard).
 *   • X-RateLimit-Remaining header added to every response.
 *
 * Architecture:
 *   withGuardrails  → rate-limit check (outer)
 *   handler         → parse → validate → guardInput → streamNeuralTextSurface
 */

import type { ModelMessage } from "ai";
import { NextRequest } from "next/server";

import { streamNeuralTextSurface } from "@/lib/ai/router";
import { withGuardrails, guardInput } from "@/lib/security";

// ── Validation ────────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_MESSAGES = 10;
const VALID_ROLES = new Set(["user", "assistant"]);

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function validateMessages(
  body: unknown,
): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || !("messages" in body)) {
    return { ok: false, error: "Le champ `messages` est requis." };
  }

  const { messages } = body as { messages: unknown };

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "`messages` doit être un tableau non vide." };
  }

  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Maximum ${MAX_MESSAGES} messages autorisés.` };
  }

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      return { ok: false, error: "Chaque message doit être un objet." };
    }

    const { role, content } = message as { role: unknown; content: unknown };

    if (typeof role !== "string" || !VALID_ROLES.has(role)) {
      return { ok: false, error: "Rôle invalide (user | assistant)." };
    }

    if (typeof content !== "string" || content.length === 0) {
      return { ok: false, error: "Le contenu du message est requis." };
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères).`,
      };
    }
  }

  return { ok: true, messages: messages as ChatMessage[] };
}

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

// ── SSE response builder ──────────────────────────────────────────────────────

function buildSseResponse({
  textStream,
  surfaceId,
  authMode,
  primaryModel,
  fallbackModels,
}: {
  textStream: AsyncIterable<string>;
  surfaceId: string;
  authMode: string;
  primaryModel: string;
  fallbackModels: readonly string[];
}) {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
          );
        }
      } catch (error) {
        console.error("Chat demo stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error:
                "La réponse a été interrompue. Réessayez ou utilisez la page contact.",
            })}\n\n`,
          ),
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-neural-ai-surface": surfaceId,
      "x-neural-ai-runtime": "vercel-ai-gateway",
      "x-neural-ai-auth": authMode,
      "x-neural-ai-primary-model": primaryModel,
      "x-neural-ai-fallback-models": fallbackModels.join(","),
    },
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: NextRequest): Promise<Response> {
  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 },
    );
  }

  // Structure validation
  const validation = validateMessages(body);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  // ── Input guard — check the last user message before hitting the LLM ────────
  const lastUserMessage = validation.messages
    .filter((m) => m.role === "user")
    .at(-1);

  if (lastUserMessage) {
    const blocked = await guardInput(lastUserMessage.content);
    if (blocked) return blocked;
  }

  // ── LLM call ─────────────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  try {
    const { result, surface, authMode } = await streamNeuralTextSurface({
      surfaceId: "public-chat-demo",
      messages: toModelMessages(validation.messages.slice(-MAX_MESSAGES)),
      userId: ip,
    });

    return buildSseResponse({
      textStream: result.textStream,
      surfaceId: surface.id,
      authMode,
      primaryModel: surface.primaryModel,
      fallbackModels: surface.fallbackModels,
    });
  } catch (error) {
    console.error("Chat demo error:", error);

    const message =
      error instanceof Error &&
      error.message.includes("AI Gateway n'est pas configuré")
        ? error.message
        : "Une erreur est survenue. Veuillez réessayer.";

    return Response.json(
      { error: message },
      {
        status:
          error instanceof Error &&
          error.message.includes("AI Gateway n'est pas configuré")
            ? 503
            : 500,
      },
    );
  }
}

// ── Export — wrapped with rate limiter + guardrails ───────────────────────────
export const POST = withGuardrails(handler);
