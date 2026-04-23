/**
 * NEURAL — ESGBankComms export pack (Sprint 5)
 * POST /api/demo/esg-bank-comms/export { scenario_id } → Markdown + hash SHA-256
 */
import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { checkEsgScenario } from "@/lib/ai/esg-bank-comms";
import {
  ESG_SCENARIOS,
  bestEvidenceFor,
  getEsgScenario,
  matchEsgPatterns,
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
  const allowed = new Set(ESG_SCENARIOS.map((s) => s.scenario_id));
  if (!allowed.has(scenarioId)) {
    return NextResponse.json(
      { error: `Scénario inconnu. Valeurs admises : ${[...allowed].join(", ")}.` },
      { status: 400 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;
  const scenario = getEsgScenario(scenarioId);
  const verdict = await checkEsgScenario({ scenarioId, userId });
  const createdAt = new Date().toISOString();

  const r = verdict.ok ? verdict.result : null;
  const matches = scenario ? matchEsgPatterns(scenario.draft.claim_text) : [];
  const body =
    r && scenario
      ? [
          `# NEURAL — Pack d'export ESGBankComms`,
          ``,
          `- **Agent** : AG-B003 · ESGBankComms`,
          `- **Pack version** : ${PACK_VERSION}`,
          `- **Scénario** : \`${scenarioId}\` — ${scenario.label}`,
          `- **Juridiction** : ${scenario.draft.jurisdiction}`,
          `- **Date d'export** : ${createdAt}`,
          `- **Trace ID** : \`${verdict.ok ? verdict.meta.traceId : "n/a"}\``,
          `- **Mode** : ${verdict.ok ? verdict.meta.mode : "n/a"}`,
          ``,
          `---`,
          ``,
          `## Verdict`,
          ``,
          `- **Décision** : **${r.decision}**`,
          `- **Classe de risque** : ${r.risk_class}`,
          `- **Verdict juridiction** : ${r.jurisdiction_verdict}`,
          `- **Blockers** : ${r.blockers.length ? r.blockers.join(", ") : "—"}`,
          `- **Warnings** : ${r.warnings.length ? r.warnings.join(", ") : "—"}`,
          ``,
          `> ${r.reviewer_comment}`,
          ``,
          `## Claim analysé`,
          ``,
          `> «${scenario.draft.claim_text}»`,
          ``,
          `### Patterns library détectés (${matches.length})`,
          ``,
          matches.length
            ? matches
                .map(
                  (m) =>
                    `- **${m.lib_id}** · \`${m.pattern}\` · ${m.wording_type} · ${m.autorisation}${m.note ? ` — ${m.note}` : ""}`,
                )
                .join("\n")
            : "_(aucun pattern matché — revue humaine recommandée)_",
          ``,
          `### Preuve associée`,
          ``,
          r.evidence_summary
            ? [
                `- ID : \`${r.evidence_summary.evidence_id ?? "n/a"}\``,
                `- Status : **${r.evidence_summary.status}**`,
                `- Valeur : ${r.evidence_summary.valeur ?? "—"}`,
                `- Expiry : ${r.evidence_summary.expiry_date ?? "—"}`,
              ].join("\n")
            : "_(aucune preuve requise ou trouvée)_",
          ``,
          `## Gates ESG (${r.gates.filter((g) => g.passed).length}/${r.gates.length} PASS)`,
          ``,
          ...r.gates.map(
            (g) =>
              `### ${g.gate_id} — ${g.passed ? "PASS ✅" : g.blocking ? "FAIL ❌ (bloquant)" : "FAIL ⚠"}\n\n**${g.label}**\n\n${g.reason ? `Raison : ${g.reason}` : ""}`,
          ),
          ``,
          `## Régulations citées`,
          ``,
          r.regulation_citations.map((c) => `- ${c}`).join("\n"),
          ``,
          `## Reformulation qualifiée`,
          ``,
          r.qualified_rewrite
            ? r.qualified_rewrite
            : "_Claim conforme ; aucune reformulation requise._",
          ``,
          `---`,
          ``,
          `*Pack généré par NEURAL — gates, decision, evidence status, jurisdiction verdict sont calculés côté serveur. Le LLM ne peut pas modifier la décision finale.*`,
        ].join("\n")
      : `# Export indisponible\n\nScénario ${scenarioId} inconnu ou vérification échouée.`;

  const hash = createHash("sha256").update(body, "utf8").digest("hex");
  const pack = `${body}\n\n---\n\n**Hash SHA-256 du pack** : \`${hash}\`\n`;
  const filename = `neural-esgbank-${scenarioId}-${createdAt.slice(0, 10)}.md`;
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
