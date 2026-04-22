/**
 * NEURAL — Heritage Quote API (Sprint 4)
 * POST /api/demo/heritage-quote
 * Body : { query: string, format?: "Maison-style" | "Chicago" | "APA" | "Juridique" }
 */
import { NextRequest, NextResponse } from "next/server";

import { quoteHeritage, CITATION_FORMATS, type CitationFormat } from "@/lib/ai/heritage-quote";
import { withGuardrails, guardInput } from "@/lib/security";

const MAX_QUERY = 300;
const MIN_QUERY = 5;

function validateBody(raw: unknown):
  | { ok: true; query: string; format: CitationFormat }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body JSON manquant." };
  const r = raw as Record<string, unknown>;
  const query = r.query;
  if (typeof query !== "string" || !query.trim()) return { ok: false, error: "`query` requis." };
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY) return { ok: false, error: `Query trop courte (min ${MIN_QUERY}).` };
  if (trimmed.length > MAX_QUERY) return { ok: false, error: `Query trop longue (max ${MAX_QUERY}).` };

  const format = (r.format as string | undefined) ?? "Maison-style";
  if (!CITATION_FORMATS.includes(format as CitationFormat)) {
    return { ok: false, error: `format doit etre parmi ${CITATION_FORMATS.join(", ")}.` };
  }

  return { ok: true, query: trimmed, format: format as CitationFormat };
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return NextResponse.json({ error: "Methode non autorisee." }, { status: 405 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const v = validateBody(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const blocked = await guardInput(v.query);
  if (blocked) return blocked;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;

  try {
    const { result, meta } = await quoteHeritage({ query: v.query, format: v.format, userId });
    return NextResponse.json(
      { result, meta },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "x-neural-heritage-quote-mode": meta.mode,
          "x-neural-heritage-quote-latency-ms": String(meta.latencyMs),
          "x-neural-heritage-quote-trace": meta.traceId,
        },
      }
    );
  } catch (err) {
    console.error("[heritage-quote] unexpected:", err);
    return NextResponse.json({ error: "Indisponible — reessayez." }, { status: 500 });
  }
}

export const POST = withGuardrails(handler);
