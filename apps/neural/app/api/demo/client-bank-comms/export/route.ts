/**
 * NEURAL — ClientBankComms export pack (Sprint 5)
 * POST /api/demo/client-bank-comms/export { scenario_id } → Markdown + hash SHA-256
 */
import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { checkClientScenario } from "@/lib/ai/client-bank-comms";
import {
  CLIENT_SCENARIOS,
  getClientScenario,
  getClientSegment,
  getClientUseCase,
  getNoticesRequiredFor,
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
  const allowed = new Set(CLIENT_SCENARIOS.map((s) => s.scenario_id));
  if (!allowed.has(scenarioId)) {
    return NextResponse.json(
      { error: `Scénario inconnu. Valeurs admises : ${[...allowed].join(", ")}.` },
      { status: 400 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;
  const scenario = getClientScenario(scenarioId);
  const verdict = await checkClientScenario({ scenarioId, userId });
  const createdAt = new Date().toISOString();

  const r = verdict.ok ? verdict.result : null;
  const uc = scenario ? getClientUseCase(scenario.use_case_id) : undefined;
  const seg = scenario ? getClientSegment(scenario.segment_id) : undefined;
  const required = scenario ? getNoticesRequiredFor(scenario.use_case_id) : [];

  const body =
    r && scenario
      ? [
          `# NEURAL — Pack d'export ClientBankComms`,
          ``,
          `- **Agent** : AG-B004 · ClientBankComms`,
          `- **Pack version** : ${PACK_VERSION}`,
          `- **Scénario** : \`${scenarioId}\` — ${scenario.label}`,
          `- **Use case** : ${uc?.label ?? scenario.use_case_id} (base légale : ${uc?.base_legale ?? "?"})`,
          `- **Segment** : ${seg?.label ?? scenario.segment_id}`,
          `- **Canal** : ${scenario.canal}`,
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
          `## Métriques`,
          ``,
          `| Métrique | Valeur | Seuil |`,
          `|---|---|---|`,
          `| Longueur message | ${r.metrics.char_count} chars | ${r.metrics.char_limit ?? "illimité"} (${scenario.canal}) |`,
          `| Lisibilité Flesch FR | ${r.metrics.reading_level_score} | ≥ ${Math.max(0, 100 - r.metrics.reading_level_max)} (${scenario.segment_id}) |`,
          `| Mentions manquantes | ${r.metrics.missing_notices.length} | 0 |`,
          `| Termes absolus | ${r.metrics.absolute_terms.length} | 0 |`,
          ``,
          `## Draft analysé`,
          ``,
          scenario.draft.subject ? `**Sujet** : ${scenario.draft.subject}` : "**Sujet** : _(aucun)_",
          ``,
          scenario.draft.body_fr,
          ``,
          `### Mentions déclarées incluses`,
          ``,
          scenario.draft.notices_included.length
            ? scenario.draft.notices_included.map((n) => `- \`${n}\``).join("\n")
            : "_(aucune)_",
          ``,
          `### Mentions requises pour ${scenario.use_case_id}`,
          ``,
          required.length
            ? required
                .map(
                  (n) =>
                    `- **${n.notice_id}** · ${n.label}\n  > «${n.text}»`,
                )
                .join("\n\n")
            : "_(aucune)_",
          ``,
          `## Gates client (${r.gates.filter((g) => g.passed).length}/${r.gates.length} PASS)`,
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
          `## Reformulation suggérée`,
          ``,
          r.suggested_rewrite
            ? r.suggested_rewrite
            : "_Draft conforme ; aucune reformulation requise._",
          ``,
          `---`,
          ``,
          `*Pack généré par NEURAL — gates, metrics, mentions manquantes, termes absolus sont calculés côté serveur. Le LLM ne peut pas modifier la décision finale.*`,
        ].join("\n")
      : `# Export indisponible\n\nScénario ${scenarioId} inconnu ou vérification échouée.`;

  const hash = createHash("sha256").update(body, "utf8").digest("hex");
  const pack = `${body}\n\n---\n\n**Hash SHA-256 du pack** : \`${hash}\`\n`;
  const filename = `neural-clientbank-${scenarioId}-${createdAt.slice(0, 10)}.md`;
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
