/**
 * NEURAL — Press Angle API (Sprint 4)
 * POST /api/demo/press-angle
 * Body : { brief: string, mediaType: MediaType, lang?: "FR" | "EN" }
 */
import { NextRequest, NextResponse } from "next/server";

import { generatePressAngle, MEDIA_TYPES, type MediaType } from "@/lib/ai/press-angle";
import { withGuardrails, guardInput } from "@/lib/security";

const MAX_BRIEF = 800;
const MIN_BRIEF = 15;

function validateBody(raw: unknown):
  | { ok: true; brief: string; mediaType: MediaType; lang: "FR" | "EN" }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body JSON manquant." };
  const r = raw as Record<string, unknown>;
  const brief = r.brief;
  if (typeof brief !== "string" || !brief.trim()) return { ok: false, error: "`brief` requis." };
  const trimmed = brief.trim();
  if (trimmed.length < MIN_BRIEF) return { ok: false, error: `Brief trop court (min ${MIN_BRIEF}).` };
  if (trimmed.length > MAX_BRIEF) return { ok: false, error: `Brief trop long (max ${MAX_BRIEF}).` };

  const mediaType = r.mediaType;
  if (typeof mediaType !== "string" || !MEDIA_TYPES.includes(mediaType as MediaType)) {
    return { ok: false, error: `mediaType doit etre parmi ${MEDIA_TYPES.join(", ")}.` };
  }

  const lang = r.lang ?? "FR";
  if (lang !== "FR" && lang !== "EN") return { ok: false, error: "lang doit etre FR ou EN." };

  return { ok: true, brief: trimmed, mediaType: mediaType as MediaType, lang };
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

  const blocked = await guardInput(v.brief);
  if (blocked) return blocked;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;

  try {
    const { result, meta } = await generatePressAngle({
      brief: v.brief,
      mediaType: v.mediaType,
      lang: v.lang,
      userId,
    });
    return NextResponse.json(
      { result, meta },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "x-neural-press-angle-mode": meta.mode,
          "x-neural-press-angle-latency-ms": String(meta.latencyMs),
          "x-neural-press-angle-trace": meta.traceId,
        },
      }
    );
  } catch (err) {
    console.error("[press-angle] unexpected:", err);
    return NextResponse.json({ error: "Indisponible — reessayez." }, { status: 500 });
  }
}

export const POST = withGuardrails(handler);
