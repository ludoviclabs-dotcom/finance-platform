/**
 * NEURAL — RegBankComms demo API (Sprint 1)
 * POST /api/demo/reg-bank-comms
 * Body : { scenario_id: string }
 *
 * MODE SCÉNARIO-ID UNIQUEMENT — correctif #2 du blueprint :
 * la surface publique n'accepte AUCUN texte libre. Le client doit
 * envoyer un `scenario_id` parmi la liste figée dans
 * `content/bank-comms/agb001-regbank.json` (sheet 4_DRAFT_TESTSET).
 *
 * Cela prévient l'ingestion accidentelle ou malveillante d'un communiqué
 * bancaire non publié (info privilégiée non publique) via notre surface.
 */
import { NextRequest, NextResponse } from "next/server";

import { checkRegBankScenario } from "@/lib/ai/reg-bank-comms";
import { REG_BANK_SCENARIOS } from "@/lib/data/bank-comms-catalog";
import { withGuardrails } from "@/lib/security";

function validateBody(
  raw: unknown,
):
  | { ok: true; scenarioId: string }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body JSON manquant." };
  const r = raw as Record<string, unknown>;
  const scenarioId = r.scenario_id;
  if (typeof scenarioId !== "string" || !scenarioId.trim()) {
    return { ok: false, error: "`scenario_id` requis." };
  }
  const allowed = new Set(REG_BANK_SCENARIOS.map((s) => s.scenario_id));
  if (!allowed.has(scenarioId)) {
    return {
      ok: false,
      error: `Scénario inconnu. Valeurs admises : ${[...allowed].join(", ")}.`,
    };
  }
  return { ok: true, scenarioId };
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method === "GET") {
    // Expose la liste des scénarios (pour le client de démo).
    return NextResponse.json(
      {
        scenarios: REG_BANK_SCENARIOS.map((s) => ({
          scenario_id: s.scenario_id,
          label: s.label,
          communication_type: s.communication_type,
          communication_subtype: s.communication_subtype,
          expected_verdict: s.expected_verdict,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  if (req.method !== "POST") {
    return NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const v = validateBody(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;

  try {
    const out = await checkRegBankScenario({
      scenarioId: v.scenarioId,
      userId,
    });
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: 400 });
    }
    return NextResponse.json(
      { result: out.result, meta: out.meta },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "x-neural-regbank-mode": out.meta.mode,
          "x-neural-regbank-latency-ms": String(out.meta.latencyMs),
          "x-neural-regbank-trace": out.meta.traceId,
          "x-neural-regbank-scenario": out.meta.scenarioId,
        },
      },
    );
  } catch (err) {
     
    console.error("[reg-bank-comms] unexpected:", err);
    return NextResponse.json(
      { error: "Analyse momentanément indisponible. Réessayez." },
      { status: 500 },
    );
  }
}

export const GET = withGuardrails(handler);
export const POST = withGuardrails(handler);
