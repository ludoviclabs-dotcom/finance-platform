/**
 * POST /api/articles/[id]/generate
 *
 * Server-Sent Events stream of the full generation pipeline. Each event is
 * a JSON-encoded `GenerationEvent` (see article-orchestrator.ts).
 *
 * Client format:
 *   data: {"type":"phase","phase":"retrieve"}
 *
 *   data: {"type":"section-token","sectionId":"intro","delta":"…"}
 *
 *   …
 *
 *   event: end
 *   data: {}
 *
 * The client (Sprint 4 UI) parses each `data:` line, switches on `type`,
 * and updates Tiptap as section tokens arrive.
 */

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import {
  runArticleOrchestrator,
  type GenerationEvent,
} from "@/lib/generation/article-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // long-running streamed generation

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!env.database.ready) {
    return NextResponse.json({ error: "DATABASE_URL absent." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendEvent = (event: GenerationEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runArticleOrchestrator({ articleId: id })) {
          sendEvent(event);
          if (event.type === "error" || event.type === "done") break;
        }
      } catch (err) {
        sendEvent({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.enqueue(encoder.encode("event: end\ndata: {}\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
