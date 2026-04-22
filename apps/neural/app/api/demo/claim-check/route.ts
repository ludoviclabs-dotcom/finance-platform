/**
 * NEURAL — Claim Check API (Sprint 4)
 * POST /api/demo/claim-check
 * Body : { claim: string, juridiction: "EU"|"FR"|"UK"|"US"|"CH", context?: string }
 */
import { NextRequest, NextResponse } from "next/server";

import { checkClaim, JURISDICTIONS, type Jurisdiction } from "@/lib/ai/claim-check";
import { withGuardrails, guardInput } from "@/lib/security";

const MAX_CLAIM = 500;
const MIN_CLAIM = 8;

function validateBody(raw: unknown):
  | { ok: true; claim: string; juridiction: Jurisdiction; context?: string }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body JSON manquant." };
  const r = raw as Record<string, unknown>;

  const claim = r.claim;
  if (typeof claim !== "string" || !claim.trim()) return { ok: false, error: "Le champ `claim` est requis." };
  const trimmed = claim.trim();
  if (trimmed.length < MIN_CLAIM) return { ok: false, error: `Claim trop court (min ${MIN_CLAIM}).` };
  if (trimmed.length > MAX_CLAIM) return { ok: false, error: `Claim trop long (max ${MAX_CLAIM}).` };

  const juridiction = r.juridiction;
  if (typeof juridiction !== "string" || !JURISDICTIONS.includes(juridiction as Jurisdiction)) {
    return { ok: false, error: `Juridiction doit etre parmi ${JURISDICTIONS.join(", ")}.` };
  }

  const context = r.context;
  if (context !== undefined && (typeof context !== "string" || context.length > 120)) {
    return { ok: false, error: "`context` <= 120 chars." };
  }

  return {
    ok: true,
    claim: trimmed,
    juridiction: juridiction as Jurisdiction,
    context: context as string | undefined,
  };
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

  const blocked = await guardInput(v.claim);
  if (blocked) return blocked;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;

  try {
    const { result, meta } = await checkClaim({
      claim: v.claim,
      juridiction: v.juridiction,
      context: v.context,
      userId,
    });
    return NextResponse.json(
      { result, meta },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "x-neural-claim-check-mode": meta.mode,
          "x-neural-claim-check-latency-ms": String(meta.latencyMs),
          "x-neural-claim-check-trace": meta.traceId,
        },
      }
    );
  } catch (err) {
    console.error("[claim-check] unexpected:", err);
    return NextResponse.json(
      { error: "Analyse momentanement indisponible. Reessayez." },
      { status: 500 }
    );
  }
}

export const POST = withGuardrails(handler);
