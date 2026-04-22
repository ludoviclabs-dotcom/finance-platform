/**
 * NEURAL — Luxe Voice Score API (Sprint 3)
 *
 * POST /api/demo/voice-score
 * Body : { text: string, lang?: "FR" | "EN", context?: string }
 * Output : JSON VoiceScoreResult + x-neural-* headers pour debug/telemetry.
 *
 * Architecture :
 *   withGuardrails  → rate-limit (Upstash 20/min/IP) + X-RateLimit-Remaining
 *   handler         → parse body → validate → guardInput (Lakera)
 *                   → analyzeVoice() (AI Gateway or deterministic fallback)
 *                   → JSON response with mode header
 *
 * Pas de streaming : l'analyse dure ~1-3s, l'effet "live" est pris en charge
 * cote client par l'animation counter.
 */

import { NextRequest, NextResponse } from "next/server";

import { analyzeVoice } from "@/lib/ai/voice-guard";
import { withGuardrails, guardInput } from "@/lib/security";

// ── Validation ───────────────────────────────────────────────────────────────

const MAX_TEXT_LENGTH = 2_000;
const MIN_TEXT_LENGTH = 10;
const VALID_LANGS = new Set(["FR", "EN"]);

type ScoreBody = {
  text: string;
  lang?: "FR" | "EN";
  context?: string;
};

function validateBody(raw: unknown): { ok: true; body: ScoreBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body JSON manquant." };
  const r = raw as Record<string, unknown>;

  const text = r.text;
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: "Le champ `text` est requis (string non vide)." };
  }
  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    return { ok: false, error: `Texte trop court (min ${MIN_TEXT_LENGTH} caracteres).` };
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Texte trop long (max ${MAX_TEXT_LENGTH} caracteres).` };
  }

  const lang = r.lang;
  if (lang !== undefined && (typeof lang !== "string" || !VALID_LANGS.has(lang))) {
    return { ok: false, error: "`lang` doit etre 'FR' ou 'EN'." };
  }

  const context = r.context;
  if (context !== undefined && (typeof context !== "string" || context.length > 120)) {
    return { ok: false, error: "`context` doit etre une string <= 120 caracteres." };
  }

  return {
    ok: true,
    body: {
      text: trimmed,
      lang: (lang as "FR" | "EN" | undefined) ?? "FR",
      context: (context as string | undefined) ?? undefined,
    },
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return NextResponse.json({ error: "Methode non autorisee." }, { status: 405 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const v = validateBody(raw);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  // Input guard (Lakera si configure, sinon patterns) — n'accepte pas une
  // tentative d'injection prompt ou d'abus.
  const blocked = await guardInput(v.body.text);
  if (blocked) return blocked;

  // Pseudo userId = hash de l'IP pour la tracabilite Langfuse sans PII.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;

  try {
    const { result, meta } = await analyzeVoice({
      text: v.body.text,
      lang: v.body.lang,
      contextLabel: v.body.context,
      userId,
    });

    return NextResponse.json(
      { result, meta },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "x-neural-voice-score-mode": meta.mode,
          "x-neural-voice-score-latency-ms": String(meta.latencyMs),
          "x-neural-voice-score-model": meta.model ?? "deterministic",
          "x-neural-voice-score-trace": meta.traceId,
        },
      }
    );
  } catch (err) {
    console.error("[voice-score] unexpected error:", err);
    return NextResponse.json(
      { error: "Analyse momentanement indisponible. Reessayez dans un instant." },
      { status: 500 }
    );
  }
}

export const POST = withGuardrails(handler);
