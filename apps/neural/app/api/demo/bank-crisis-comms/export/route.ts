/**
 * NEURAL — BankCrisisComms export pack (Sprint 3)
 * POST /api/demo/bank-crisis-comms/export { scenario_id }
 *
 * Produit un pack Markdown + hash SHA-256 du même format que RegBankComms,
 * adapté au contexte crise : sévérité, SLA, holding statement de référence,
 * tree d'escalade, points à valider.
 */
import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { checkCrisisScenario } from "@/lib/ai/bank-crisis-comms";
import {
  BANK_CRISIS_SCENARIOS,
  getCrisisScenario,
  getHoldingStatementsFor,
} from "@/lib/data/bank-comms-catalog";
import { withGuardrails } from "@/lib/security";

const PACK_VERSION = "1.0";

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Body JSON manquant." }, { status: 400 });
  }
  const scenarioId = (raw as Record<string, unknown>).scenario_id;
  if (typeof scenarioId !== "string" || !scenarioId.trim()) {
    return NextResponse.json({ error: "`scenario_id` requis." }, { status: 400 });
  }
  const allowed = new Set(BANK_CRISIS_SCENARIOS.map((s) => s.scenario_id));
  if (!allowed.has(scenarioId)) {
    return NextResponse.json(
      { error: `Scénario inconnu. Valeurs admises : ${[...allowed].join(", ")}.` },
      { status: 400 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;
  const scenario = getCrisisScenario(scenarioId);
  const verdict = await checkCrisisScenario({ scenarioId, userId });
  const statements = scenario ? getHoldingStatementsFor(scenario.incident_type) : [];
  const createdAt = new Date().toISOString();

  const r = verdict.ok ? verdict.result : null;
  const body = r && scenario
    ? [
        `# NEURAL — Pack d'export BankCrisisComms`,
        ``,
        `- **Agent** : AG-B002 · BankCrisisComms`,
        `- **Pack version** : ${PACK_VERSION}`,
        `- **Scénario** : \`${scenarioId}\` — ${scenario.label}`,
        `- **Incident** : ${scenario.incident_type} · Sévérité : ${scenario.severity}`,
        `- **Date d'export** : ${createdAt}`,
        `- **Trace ID** : \`${verdict.ok ? verdict.meta.traceId : "n/a"}\``,
        `- **Mode** : ${verdict.ok ? verdict.meta.mode : "n/a"}`,
        ``,
        `---`,
        ``,
        `## Verdict`,
        ``,
        `- **Décision** : **${r.decision}**`,
        `- **Blockers** : ${r.blockers.length ? r.blockers.join(", ") : "—"}`,
        `- **Warnings** : ${r.warnings.length ? r.warnings.join(", ") : "—"}`,
        ``,
        `> ${r.reviewer_comment}`,
        ``,
        `## SLA`,
        ``,
        `| Sévérité | Écoulé | Deadline | Overdue |`,
        `|---|---|---|---|`,
        `| ${r.sla.severity} | ${r.sla.elapsed_minutes} min | ${r.sla.deadline_minutes} min | ${r.sla.overdue ? "⚠ OUI" : "non"} |`,
        ``,
        `## Draft analysé`,
        ``,
        `**${scenario.draft.title}**`,
        ``,
        scenario.draft.body_fr,
        ``,
        `### Flags`,
        ``,
        `- root_cause_stated : ${scenario.draft.root_cause_stated}`,
        `- uses_approved_message : ${scenario.draft.uses_approved_message}`,
        `- matched_statement_id : ${scenario.draft.matched_statement_id ?? "null"}`,
        `- regulator_coord_confirmed : ${scenario.draft.regulator_coord_confirmed}`,
        `- remediation_commitment : ${scenario.draft.remediation_commitment ?? "null"}`,
        `- minutes_since_incident : ${scenario.draft.minutes_since_incident}`,
        ``,
        `## Gates crise (${r.gates.filter((g) => g.passed).length}/${r.gates.length} PASS)`,
        ``,
        ...r.gates.map(
          (g) =>
            `### ${g.gate_id} — ${g.passed ? "PASS ✅" : g.blocking ? "FAIL ❌ (bloquant)" : "FAIL ⚠"}\n\n**${g.label}**\n\n${g.reason ? `Raison : ${g.reason}` : ""}`,
        ),
        ``,
        `## Points à valider`,
        ``,
        r.points_to_validate.length
          ? r.points_to_validate.map((p) => `- [ ] ${p}`).join("\n")
          : "_Aucun._",
        ``,
        `## Holding statement recommandé`,
        ``,
        r.recommended_statement_id
          ? `\`${r.recommended_statement_id}\``
          : "_Aucun — bibliothèque vide pour ce type d'incident._",
        ``,
        `## Reformulation dérivée`,
        ``,
        r.suggested_rewrite
          ? r.suggested_rewrite
          : "_Le draft passe les gates ; aucune reformulation requise._",
        ``,
        `## Bibliothèque de holding statements disponibles (${statements.length})`,
        ``,
        ...statements.map(
          (s) =>
            `- **${s.statement_id}** · ${s.lang} · approuvé par ${s.approver} le ${s.approved_at}`,
        ),
        ``,
        `---`,
        ``,
        `*Pack généré par NEURAL — les gates crise sont calculées côté serveur. Le LLM ne peut pas modifier la décision finale ni l'état du SLA.*`,
      ].join("\n")
    : `# Export indisponible\n\nScénario ${scenarioId} inconnu ou vérification échouée.`;

  const hash = createHash("sha256").update(body, "utf8").digest("hex");
  const pack = `${body}\n\n---\n\n**Hash SHA-256 du pack** : \`${hash}\`\n`;

  const filename = `neural-bankcrisis-${scenarioId}-${createdAt.slice(0, 10)}.md`;
  return new NextResponse(pack, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "x-neural-pack-version": PACK_VERSION,
      "x-neural-pack-hash": hash,
      "x-neural-pack-scenario": scenarioId,
    },
  });
}

export const POST = withGuardrails(handler);
