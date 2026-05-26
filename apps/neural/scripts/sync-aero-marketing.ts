/**
 * NEURAL - Sync Aero / Marketing workbooks -> JSON frozen
 *
 * Lit les 5 workbooks dans data/aero-marketing/ et genere un set de JSON
 * dans content/aero-marketing/ consommes par l'app (server components et
 * API /api/demo/aero-export-check).
 *
 * Les JSON sont committes en git pour :
 *  - determinisme du build (pas de parsing xlsx a chaque SSR),
 *  - revue humaine du payload expose publiquement,
 *  - decouplage site / runtime xlsx.
 *
 * Usage :
 *   pnpm tsx scripts/sync-aero-marketing.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as XLSX from "xlsx";

const ROOT = resolve(__dirname, "..");
const DATA_DIR = join(ROOT, "data", "aero-marketing");
const OUT_DIR = join(ROOT, "content", "aero-marketing");

type SheetPick = {
  sheet: string;
  headerStartRow: number;
  columns: string[];
  numericCols?: string[];
  dateCols?: string[];
  maxRows?: number;
};

type WorkbookSpec = {
  file: string;
  outName: string;
  picks: SheetPick[];
};

const AGENT_PICKS: SheetPick[] = [
  {
    sheet: "AGENT_META",
    headerStartRow: 4,
    columns: ["key", "value"],
    maxRows: 30,
  },
  {
    sheet: "SOURCES",
    headerStartRow: 4,
    columns: ["source_id", "authority", "domain", "title", "date", "impact"],
  },
  {
    sheet: "RULES",
    headerStartRow: 4,
    columns: ["rule_id", "agent_slug", "regle", "niveau", "source_ref", "lang"],
  },
  {
    sheet: "SCENARIOS",
    headerStartRow: 4,
    columns: [
      "scenario_id",
      "agent_slug",
      "label",
      "input_line",
      "verdict",
      "summary",
      "metrics_json",
    ],
  },
];

const WORKBOOKS: WorkbookSpec[] = [
  {
    file: "AeroTechContent_NEURAL.xlsx",
    outName: "am-a001-tech",
    picks: AGENT_PICKS,
  },
  {
    file: "DefenseCommsGuard_NEURAL.xlsx",
    outName: "am-a002-defense",
    picks: AGENT_PICKS,
  },
  {
    file: "AeroEventAI_NEURAL.xlsx",
    outName: "am-a003-event",
    picks: AGENT_PICKS,
  },
  {
    file: "AeroSustainabilityComms_NEURAL.xlsx",
    outName: "am-a004-sustainability",
    picks: AGENT_PICKS,
  },
  {
    file: "Aero_Marketing_OVERVIEW_NEURAL.xlsx",
    outName: "master",
    picks: [
      {
        sheet: "MASTER_AGENTS",
        headerStartRow: 4,
        columns: [
          "agent_id",
          "slug",
          "name",
          "owner",
          "mission",
          "primary_rule",
          "workbook",
          "kpis",
        ],
      },
      {
        sheet: "MASTER_SOURCES",
        headerStartRow: 4,
        columns: ["source_id", "authority", "domain", "title", "date", "impact"],
      },
      {
        sheet: "MASTER_SCENARIOS",
        headerStartRow: 4,
        columns: [
          "scenario_id",
          "agent_slug",
          "label",
          "input_line",
          "verdict",
          "summary",
          "metrics_json",
        ],
      },
      {
        sheet: "MASTER_SERVICES",
        headerStartRow: 4,
        columns: ["service_id", "name", "mission"],
      },
      {
        sheet: "MASTER_PROBLEMS",
        headerStartRow: 4,
        columns: ["agent_id", "problem", "solution"],
      },
    ],
  },
];

function colLetter(idx: number): string {
  let s = "";
  idx += 1;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    idx = Math.floor((idx - 1) / 26);
  }
  return s;
}

function excelDateToIso(n: unknown): string | null {
  if (n == null || n === "") return null;
  if (typeof n === "string") {
    const parsed = new Date(n);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  }
  if (typeof n !== "number") return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + n * 86400_000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function readSheet(ws: XLSX.WorkSheet, pick: SheetPick): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const maxRows = pick.maxRows ?? 1000;
  const numericSet = new Set(pick.numericCols ?? []);
  const dateSet = new Set(pick.dateCols ?? []);

  for (let r = pick.headerStartRow; r < pick.headerStartRow + maxRows; r++) {
    const row: Record<string, unknown> = {};
    let hasValue = false;
    for (let c = 0; c < pick.columns.length; c++) {
      const addr = `${colLetter(c)}${r + 1}`;
      const cell = ws[addr];
      const key = pick.columns[c];
      if (cell === undefined) {
        row[key] = null;
        continue;
      }
      let v: unknown = cell.v;
      if (cell.f !== undefined && cell.w !== undefined) {
        v = cell.w;
      }
      if (v === undefined) {
        row[key] = null;
        continue;
      }
      if (dateSet.has(key)) {
        v = excelDateToIso(v);
      } else if (numericSet.has(key)) {
        const n = typeof v === "number" ? v : Number(v);
        v = Number.isFinite(n) ? n : null;
      } else if (typeof v === "string") {
        v = v.trim();
        if (v === "") v = null;
      }
      if (v !== null && v !== undefined && v !== "") {
        hasValue = true;
      }
      row[key] = v ?? null;
    }
    if (!hasValue) break;
    out.push(row);
  }
  return out;
}

function ensureDir(d: string) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function main() {
  ensureDir(OUT_DIR);
  const manifest: Record<
    string,
    { file: string; sheets: string[]; rows: Record<string, number> }
  > = {};

  for (const spec of WORKBOOKS) {
    const fp = join(DATA_DIR, spec.file);
    if (!existsSync(fp)) {
      console.error(`[SKIP] missing ${spec.file}`);
      continue;
    }
    const buf = readFileSync(fp);
    const wb = XLSX.read(buf, { type: "buffer", cellFormula: false, cellDates: false });

    const payload: Record<string, Array<Record<string, unknown>>> = {};
    const rowCounts: Record<string, number> = {};

    for (const pick of spec.picks) {
      const ws = wb.Sheets[pick.sheet];
      if (!ws) {
        console.warn(`  [${spec.outName}] sheet "${pick.sheet}" absente, skip`);
        continue;
      }
      const rows = readSheet(ws, pick);
      payload[pick.sheet] = rows;
      rowCounts[pick.sheet] = rows.length;
    }

    const out = {
      _meta: {
        sourceFile: spec.file,
        generatedAt: "2026-05-26",
        sheets: Object.keys(payload),
      },
      data: payload,
    };

    const outFp = join(OUT_DIR, `${spec.outName}.json`);
    writeFileSync(outFp, JSON.stringify(out, null, 2), "utf8");
    manifest[spec.outName] = {
      file: spec.file,
      sheets: Object.keys(payload),
      rows: rowCounts,
    };
    console.log(
      `[OK] ${spec.outName.padEnd(22)} ${spec.file.padEnd(42)} -> ${outFp}  (${Object.values(
        rowCounts,
      ).reduce((a, b) => a + b, 0)} lignes)`,
    );
  }

  writeFileSync(
    join(OUT_DIR, "_manifest.json"),
    JSON.stringify({ generatedAt: "2026-05-26", workbooks: manifest }, null, 2),
    "utf8",
  );
  console.log(`\n[OK] manifest ecrit -> ${join(OUT_DIR, "_manifest.json")}`);
}

main();
