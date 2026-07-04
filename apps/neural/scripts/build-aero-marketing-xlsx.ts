/**
 * NEURAL - Build Aero / Marketing workbooks (.xlsx)
 *
 * Materialise les 5 workbooks declares dans AERO_MKT_WORKBOOKS depuis le
 * catalogue TypeScript apps/neural/lib/data/aero-marketing-catalog.ts.
 *
 * Sortie :
 *   apps/neural/data/aero-marketing/AeroTechContent_NEURAL.xlsx
 *   apps/neural/data/aero-marketing/DefenseCommsGuard_NEURAL.xlsx
 *   apps/neural/data/aero-marketing/AeroEventAI_NEURAL.xlsx
 *   apps/neural/data/aero-marketing/AeroSustainabilityComms_NEURAL.xlsx
 *   apps/neural/data/aero-marketing/Aero_Marketing_OVERVIEW_NEURAL.xlsx
 *
 * Chaque workbook agent contient 4 feuilles avec headerStartRow=4 (lignes
 * 1-3 = titre/sous-titre/section vide, ligne 4 = headers) compatibles avec
 * sync-aero-marketing.ts :
 *   - AGENT_META   key, value
 *   - SOURCES      source_id, authority, domain, title, date, impact
 *   - RULES        rule_id, agent_slug, regle, niveau, source_ref, lang
 *   - SCENARIOS    scenario_id, agent_slug, label, input_line, verdict, summary, metrics_json
 *
 * Le workbook OVERVIEW contient les memes feuilles prefixees MASTER_.
 *
 * Build idempotent : timestamp fige `2026-05-26` ecrit dans la cellule A1
 * de chaque feuille pour eviter la divergence d'octets entre runs.
 *
 * Usage :
 *   pnpm tsx scripts/build-aero-marketing-xlsx.ts
 */

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as XLSX from "xlsx";

import {
  AERO_MKT_AGENTS,
  AERO_MKT_PROBLEMS,
  AERO_MKT_SCENARIOS,
  AERO_MKT_SERVICES,
  AERO_MKT_SOURCES,
  AERO_MKT_SUMMARY,
} from "../lib/data/aero-marketing-catalog";

const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "data", "aero-marketing");

const BUILD_DATE = "2026-05-26";
const SUBTITLE = `Genere depuis aero-marketing-catalog.ts - veille ${AERO_MKT_SUMMARY.sourceDate}`;

function ensureDir(d: string) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/**
 * Construit une feuille avec la convention headerStartRow=4 :
 *   row 1 (A1) : titre principal (lu par sync mais ignore)
 *   row 2 (A2) : sous-titre / date de build
 *   row 3 (A3) : section vide
 *   row 4 (A4..) : headers
 *   row 5+ : data
 */
function buildSheet(title: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const aoa: Array<Array<string | number | null>> = [
    [title],
    [SUBTITLE],
    [`Build ${BUILD_DATE}`],
    headers,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Largeur de colonne raisonnable pour lisibilite humaine
  ws["!cols"] = headers.map(() => ({ wch: 28 }));
  return ws;
}

function agentSourceIdsFor(agentSlug: string): string[] {
  // Mapping editorial : chaque agent cite un sous-ensemble du sourcebook
  // (les 4 sont differents). Garde 100% des sources pour 'sustainability'.
  switch (agentSlug) {
    case "aero-tech-content":
      return ["AM-S006", "AM-S009", "AM-S010", "AM-S011"];
    case "defense-comms-guard":
      return ["AM-S001", "AM-S002", "AM-S003", "AM-S004", "AM-S005", "AM-S006", "AM-S010"];
    case "aero-event-ai":
      return ["AM-S006", "AM-S010", "AM-S012"];
    case "aero-sustainability-comms":
      return ["AM-S007", "AM-S008", "AM-S009", "AM-S006"];
    default:
      return AERO_MKT_SOURCES.map((s) => s.id);
  }
}

function buildAgentWorkbook(agentSlug: string) {
  const agent = AERO_MKT_AGENTS.find((a) => a.slug === agentSlug);
  if (!agent) throw new Error(`Agent inconnu : ${agentSlug}`);

  const wb = XLSX.utils.book_new();

  // AGENT_META
  const metaRows: Array<Array<string | number | null>> = [
    ["id", agent.id],
    ["slug", agent.slug],
    ["name", agent.name],
    ["owner", agent.owner],
    ["mission", agent.mission],
    ["primary_rule", agent.primaryRule],
    ["workbook", agent.workbook],
    ["kpi_1", agent.kpis[0] ?? null],
    ["kpi_2", agent.kpis[1] ?? null],
    ["kpi_3", agent.kpis[2] ?? null],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(`NEURAL ${agent.name} - AGENT_META`, ["key", "value"], metaRows),
    "AGENT_META",
  );

  // SOURCES (filtrees par mapping editorial)
  const sourceIds = new Set(agentSourceIdsFor(agent.slug));
  const sourcesRows = AERO_MKT_SOURCES.filter((s) => sourceIds.has(s.id)).map((s) => [
    s.id,
    s.authority,
    s.domain,
    s.title,
    s.date,
    s.impact,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      `NEURAL ${agent.name} - SOURCES`,
      ["source_id", "authority", "domain", "title", "date", "impact"],
      sourcesRows,
    ),
    "SOURCES",
  );

  // RULES (1 regle primaire par agent, complete par regles de couverture)
  const rulesRows: Array<Array<string | number | null>> = [
    [
      `${agent.id}-R001`,
      agent.slug,
      `Regle primaire ${agent.primaryRule} - controle bloquant avant diffusion.`,
      "BLOCK",
      sourceIds.size > 0 ? [...sourceIds][0] : null,
      "fr",
    ],
    [
      `${agent.id}-R002`,
      agent.slug,
      "Disclosure AI Act art. 50 obligatoire sur tout contenu marketing IA-genere.",
      "BLOCK",
      "AM-S006",
      "fr",
    ],
    [
      `${agent.id}-R003`,
      agent.slug,
      "Tonalite responsable conforme ASD Europe Charter (pas de glorification).",
      "REVIEW",
      "AM-S010",
      "fr",
    ],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      `NEURAL ${agent.name} - RULES`,
      ["rule_id", "agent_slug", "regle", "niveau", "source_ref", "lang"],
      rulesRows,
    ),
    "RULES",
  );

  // SCENARIOS (filtres par agent)
  const scnRows = AERO_MKT_SCENARIOS.filter((s) => s.agentSlug === agent.slug).map((s) => [
    s.id,
    s.agentSlug,
    s.label,
    s.inputLine,
    s.verdict,
    s.summary,
    JSON.stringify(s.metrics),
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      `NEURAL ${agent.name} - SCENARIOS`,
      ["scenario_id", "agent_slug", "label", "input_line", "verdict", "summary", "metrics_json"],
      scnRows,
    ),
    "SCENARIOS",
  );

  return wb;
}

function buildOverviewWorkbook() {
  const wb = XLSX.utils.book_new();

  // MASTER_AGENTS
  const agentsRows = AERO_MKT_AGENTS.map((a) => [
    a.id,
    a.slug,
    a.name,
    a.owner,
    a.mission,
    a.primaryRule,
    a.workbook,
    a.kpis.join(" | "),
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      "NEURAL Aero Marketing - MASTER_AGENTS",
      ["agent_id", "slug", "name", "owner", "mission", "primary_rule", "workbook", "kpis"],
      agentsRows,
    ),
    "MASTER_AGENTS",
  );

  // MASTER_SOURCES
  const sourcesRows = AERO_MKT_SOURCES.map((s) => [
    s.id,
    s.authority,
    s.domain,
    s.title,
    s.date,
    s.impact,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      "NEURAL Aero Marketing - MASTER_SOURCES",
      ["source_id", "authority", "domain", "title", "date", "impact"],
      sourcesRows,
    ),
    "MASTER_SOURCES",
  );

  // MASTER_SCENARIOS
  const scnRows = AERO_MKT_SCENARIOS.map((s) => [
    s.id,
    s.agentSlug,
    s.label,
    s.inputLine,
    s.verdict,
    s.summary,
    JSON.stringify(s.metrics),
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      "NEURAL Aero Marketing - MASTER_SCENARIOS",
      ["scenario_id", "agent_slug", "label", "input_line", "verdict", "summary", "metrics_json"],
      scnRows,
    ),
    "MASTER_SCENARIOS",
  );

  // MASTER_SERVICES
  const svcRows = AERO_MKT_SERVICES.map((s) => [s.id, s.name, s.mission]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      "NEURAL Aero Marketing - MASTER_SERVICES",
      ["service_id", "name", "mission"],
      svcRows,
    ),
    "MASTER_SERVICES",
  );

  // MASTER_PROBLEMS
  const pbRows = AERO_MKT_PROBLEMS.map((p) => [p.agent, p.problem, p.solution]);
  XLSX.utils.book_append_sheet(
    wb,
    buildSheet(
      "NEURAL Aero Marketing - MASTER_PROBLEMS",
      ["agent_id", "problem", "solution"],
      pbRows,
    ),
    "MASTER_PROBLEMS",
  );

  return wb;
}

function main() {
  ensureDir(OUT_DIR);

  const agentWorkbooks: Array<[string, string]> = [
    ["aero-tech-content", "AeroTechContent_NEURAL.xlsx"],
    ["defense-comms-guard", "DefenseCommsGuard_NEURAL.xlsx"],
    ["aero-event-ai", "AeroEventAI_NEURAL.xlsx"],
    ["aero-sustainability-comms", "AeroSustainabilityComms_NEURAL.xlsx"],
  ];

  for (const [slug, file] of agentWorkbooks) {
    const wb = buildAgentWorkbook(slug);
    const fp = join(OUT_DIR, file);
    XLSX.writeFile(wb, fp);
    const sheets = wb.SheetNames.join(", ");
    console.log(`[OK] ${file.padEnd(42)} -> ${fp}  (feuilles : ${sheets})`);
  }

  const overview = buildOverviewWorkbook();
  const overviewFp = join(OUT_DIR, "Aero_Marketing_OVERVIEW_NEURAL.xlsx");
  XLSX.writeFile(overview, overviewFp);
  console.log(
    `[OK] Aero_Marketing_OVERVIEW_NEURAL.xlsx       -> ${overviewFp}  (feuilles : ${overview.SheetNames.join(", ")})`,
  );

  console.log(`\n[DONE] 5 workbooks generes dans ${OUT_DIR}`);
}

main();
