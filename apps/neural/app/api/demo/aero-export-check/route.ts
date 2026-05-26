/**
 * NEURAL - Aéro / Marketing : Export Rule Checker API
 * POST /api/demo/aero-export-check
 * Body : { scenario_id: string }
 *
 * MODE SCÉNARIO-ID UNIQUEMENT — la surface publique n'accepte AUCUN texte
 * libre. Le client doit envoyer un `scenario_id` parmi la liste figée
 * dans content/aero-marketing/master.json (sheet MASTER_SCENARIOS).
 *
 * Le verdict, les règles déclenchées et les sources réglementaires citées
 * sont lus depuis les JSON synchronisés à partir des 5 workbooks Excel
 * (AeroTechContent, DefenseCommsGuard, AeroEventAI, AeroSustainabilityComms
 * et Aero_Marketing_OVERVIEW). Aucun appel LLM, aucun fetch externe :
 * réponse 100% déterministe.
 */
import { NextRequest, NextResponse } from "next/server";

import master from "@/content/aero-marketing/master.json";
import techJson from "@/content/aero-marketing/am-a001-tech.json";
import defenseJson from "@/content/aero-marketing/am-a002-defense.json";
import eventJson from "@/content/aero-marketing/am-a003-event.json";
import sustainabilityJson from "@/content/aero-marketing/am-a004-sustainability.json";

type Scenario = {
  scenario_id: string;
  agent_slug: string;
  label: string;
  input_line: string;
  verdict: string;
  summary: string;
  metrics_json: string;
};

type AgentMeta = {
  agent_id: string;
  slug: string;
  name: string;
  owner: string;
  mission: string;
  primary_rule: string;
  workbook: string;
  kpis: string;
};

type Rule = {
  rule_id: string;
  agent_slug: string;
  regle: string;
  niveau: string;
  source_ref: string | null;
  lang: string;
};

type Source = {
  source_id: string;
  authority: string;
  domain: string;
  title: string;
  date: string;
  impact: string;
};

const SCENARIOS = master.data.MASTER_SCENARIOS as unknown as Scenario[];
const AGENTS = master.data.MASTER_AGENTS as unknown as AgentMeta[];

const AGENT_JSON_BY_SLUG: Record<string, { RULES: Rule[]; SOURCES: Source[] }> = {
  "aero-tech-content": {
    RULES: techJson.data.RULES as unknown as Rule[],
    SOURCES: techJson.data.SOURCES as unknown as Source[],
  },
  "defense-comms-guard": {
    RULES: defenseJson.data.RULES as unknown as Rule[],
    SOURCES: defenseJson.data.SOURCES as unknown as Source[],
  },
  "aero-event-ai": {
    RULES: eventJson.data.RULES as unknown as Rule[],
    SOURCES: eventJson.data.SOURCES as unknown as Source[],
  },
  "aero-sustainability-comms": {
    RULES: sustainabilityJson.data.RULES as unknown as Rule[],
    SOURCES: sustainabilityJson.data.SOURCES as unknown as Source[],
  },
};

const ALLOWED_IDS = new Set<string>(SCENARIOS.map((s) => s.scenario_id));

function validateBody(
  raw: unknown,
): { ok: true; scenarioId: string } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body JSON manquant." };
  const r = raw as Record<string, unknown>;
  const scenarioId = r.scenario_id;
  if (typeof scenarioId !== "string" || !scenarioId.trim()) {
    return { ok: false, error: "`scenario_id` requis." };
  }
  if (!ALLOWED_IDS.has(scenarioId)) {
    return {
      ok: false,
      error: `Scénario inconnu. Valeurs admises : ${[...ALLOWED_IDS].join(", ")}.`,
    };
  }
  return { ok: true, scenarioId };
}

function parseMetrics(raw: string): Array<{ label: string; before: string; after: string }> {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is { label: string; before: string; after: string } =>
        m && typeof m.label === "string" && typeof m.before === "string" && typeof m.after === "string",
    );
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(
    {
      scenarios: SCENARIOS.map((s) => ({
        scenario_id: s.scenario_id,
        agent_slug: s.agent_slug,
        label: s.label,
        verdict: s.verdict,
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const v = validateBody(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const scenario = SCENARIOS.find((s) => s.scenario_id === v.scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Scénario introuvable." }, { status: 500 });
  }

  const agent = AGENTS.find((a) => a.slug === scenario.agent_slug);
  const bucket = AGENT_JSON_BY_SLUG[scenario.agent_slug];

  const rulesTriggered = bucket?.RULES ?? [];
  const sourcesCited = bucket?.SOURCES ?? [];
  const metrics = parseMetrics(scenario.metrics_json);

  const result = {
    scenario: {
      id: scenario.scenario_id,
      label: scenario.label,
      verdict: scenario.verdict,
      summary: scenario.summary,
      inputLine: scenario.input_line,
      metrics,
    },
    agent: agent
      ? {
          id: agent.agent_id,
          name: agent.name,
          owner: agent.owner,
          primaryRule: agent.primary_rule,
        }
      : null,
    rulesTriggered: rulesTriggered.map((r) => ({
      ruleId: r.rule_id,
      regle: r.regle,
      niveau: r.niveau,
      sourceRef: r.source_ref,
    })),
    sourcesCited: sourcesCited.map((s) => ({
      sourceId: s.source_id,
      authority: s.authority,
      domain: s.domain,
      title: s.title,
    })),
  };

  return NextResponse.json(
    {
      result,
      meta: {
        mode: "deterministic-scenario-id",
        latencyMs: Date.now() - start,
        sourceManifest: "content/aero-marketing/master.json",
      },
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "x-neural-aero-export-mode": "deterministic-scenario-id",
        "x-neural-aero-export-scenario": v.scenarioId,
      },
    },
  );
}
