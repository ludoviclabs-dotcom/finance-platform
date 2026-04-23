/**
 * NEURAL — RegBankComms export pack (Sprint 2)
 * POST /api/demo/reg-bank-comms/export
 * Body : { scenario_id: string }
 *
 * Produit un pack défendable au format Markdown + hash SHA-256, retourné
 * en text/markdown (téléchargement direct). Contenu :
 *   - métadonnées (scenario, date, agent, version)
 *   - draft original (titre, période, corps, chiffres cités, sources citées)
 *   - résultat des 4 gates déterministes (PASS/FAIL + raison + offending refs)
 *   - verdict final
 *   - liste des sources ACTIVE utilisables comme preuve
 *   - checklist reviewer (points_to_validate)
 *   - reformulation suggérée le cas échéant
 *   - hash SHA-256 calculé sur le corps du pack
 *
 * Toujours scenario-id only (correctif #2). Aucun texte libre.
 */
import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { checkRegBankScenario } from "@/lib/ai/reg-bank-comms";
import {
  BANK_COMMS_SOURCES,
  REG_BANK_SCENARIOS,
  getRegBankScenario,
} from "@/lib/data/bank-comms-catalog";
import { withGuardrails } from "@/lib/security";

const PACK_VERSION = "1.0";

function buildMarkdown({
  scenarioId,
  createdAt,
  scenario,
  verdict,
  meta,
}: {
  scenarioId: string;
  createdAt: string;
  scenario: ReturnType<typeof getRegBankScenario>;
  verdict: Awaited<ReturnType<typeof checkRegBankScenario>>;
  meta: { mode: string; latencyMs: number; traceId: string };
}): string {
  if (!scenario || !verdict.ok) {
    return "# Export indisponible\n\nScénario inconnu ou vérification échouée.";
  }
  const r = verdict.result;
  const blockers = r.blockers.length ? r.blockers.join(", ") : "—";
  const warnings = r.warnings.length ? r.warnings.join(", ") : "—";
  const numbersBlock = scenario.draft.numbers
    .map(
      (n) =>
        `| ${n.label} | ${n.value} | ${n.status} | ${n.source_id ?? "—"} |`,
    )
    .join("\n");
  const gatesBlock = r.gates
    .map(
      (g) =>
        `### ${g.gate_id} — ${g.passed ? "PASS ✅" : g.blocking ? "FAIL ❌ (bloquant)" : "FAIL ⚠ (non bloquant)"}\n\n` +
        `**${g.label}**\n\n` +
        (g.reason ? `Raison : ${g.reason}\n\n` : "") +
        (g.offending_refs.length
          ? `Offending refs : \`${g.offending_refs.join("`, `")}\`\n`
          : ""),
    )
    .join("\n");
  const ptvBlock = r.points_to_validate.length
    ? r.points_to_validate.map((p) => `- [ ] ${p}`).join("\n")
    : "_Aucun point à valider signalé._";
  const sourcesBlock = BANK_COMMS_SOURCES.map(
    (s) =>
      `- **${s.source_id}** · ${s.autorite} · ${s.titre} (${s.juridiction}, review ${s.review_date ?? "n/a"})`,
  ).join("\n");
  const rewriteBlock = r.suggested_rewrite
    ? r.suggested_rewrite
    : "_Le draft passe les gates ; aucune reformulation requise._";

  return `# NEURAL — Pack d'export RegBankComms

- **Agent** : AG-B001 · RegBankComms
- **Pack version** : ${PACK_VERSION}
- **Scénario** : \`${scenarioId}\` — ${scenario.label}
- **Type de communication** : ${scenario.communication_type}${scenario.communication_subtype ? ` · ${scenario.communication_subtype}` : ""}
- **Date d'export** : ${createdAt}
- **Trace ID** : \`${meta.traceId}\`
- **Mode** : ${meta.mode}
- **Latence** : ${meta.latencyMs} ms

---

## Verdict

- **Décision** : **${r.decision}**
- **Blockers** : ${blockers}
- **Warnings** : ${warnings}

> ${r.reviewer_comment}

---

## Draft analysé

**${scenario.draft.title}**
Période : ${scenario.draft.period}
Information privilégiée déclarée : ${scenario.draft.contains_privileged_info ? "OUI ⚠" : "non"}

${scenario.draft.body_fr}

### Chiffres cités

| Libellé | Valeur | Statut | Source |
|---|---|---|---|
${numbersBlock || "| (aucun) | | | |"}

### Sources citées

${scenario.draft.cited_sources.length ? scenario.draft.cited_sources.map((s) => `- \`${s}\``).join("\n") : "_(aucune)_"}

---

## Résultats des gates (${r.gates.filter((g) => g.passed).length}/${r.gates.length} PASS)

${gatesBlock}

---

## Checklist reviewer

${ptvBlock}

---

## Reformulation suggérée

${rewriteBlock}

---

## Registre de sources ACTIVE (référentiel à la date du pack)

${sourcesBlock}

---

*Pack généré par NEURAL — toutes les décisions gates sont calculées côté serveur de manière déterministe. Le LLM n'a pas le pouvoir de modifier la décision finale.*
`;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

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
  const allowed = new Set(REG_BANK_SCENARIOS.map((s) => s.scenario_id));
  if (!allowed.has(scenarioId)) {
    return NextResponse.json(
      { error: `Scénario inconnu. Valeurs admises : ${[...allowed].join(", ")}.` },
      { status: 400 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;
  const scenario = getRegBankScenario(scenarioId);
  const verdict = await checkRegBankScenario({ scenarioId, userId });

  const createdAt = new Date().toISOString();
  const bodyMd = buildMarkdown({
    scenarioId,
    createdAt,
    scenario,
    verdict,
    meta:
      verdict.ok
        ? {
            mode: verdict.meta.mode,
            latencyMs: verdict.meta.latencyMs,
            traceId: verdict.meta.traceId,
          }
        : { mode: "n/a", latencyMs: 0, traceId: "n/a" },
  });
  const hash = sha256(bodyMd);
  const pack = `${bodyMd}\n\n---\n\n**Hash SHA-256 du pack** : \`${hash}\`\n`;

  const filename = `neural-regbank-${scenarioId}-${createdAt.slice(0, 10)}.md`;
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
