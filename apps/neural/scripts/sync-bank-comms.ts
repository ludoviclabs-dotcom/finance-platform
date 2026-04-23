/**
 * NEURAL — Sync Banque / Communication workbooks → JSON frozen
 *
 * Lit les workbooks `data/bank-comms/*.xlsx` et génère un set de JSON dans
 * `content/bank-comms/` consommés par l'app (server components).
 *
 * Miroir stricte de `sync-luxe-comms.ts`. En Sprint 0, les workbooks
 * n'existent pas encore : le script se contente alors de logger l'absence
 * et de préserver les squelettes JSON committés manuellement.
 *
 * Dès que les workbooks atterrissent dans `data/bank-comms/`, déclencher :
 *   pnpm tsx scripts/sync-bank-comms.ts
 *
 * Le script :
 *  - lit la feuille attendue et saute les `headerStartRow` lignes de titre
 *  - mappe les colonnes par ordre (A, B, C...) vers les noms cibles
 *  - parse nombre/date selon `numericCols` / `dateCols`
 *  - écrit le JSON dans content/bank-comms/{outName}.json
 *
 * Les specs ci-dessous sont des esquisses basées sur le blueprint.
 * Elles seront confirmées/ajustées une fois chaque workbook cadré.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as XLSX from "xlsx";

const ROOT = resolve(__dirname, "..");
const DATA_DIR = join(ROOT, "data", "bank-comms");
const OUT_DIR = join(ROOT, "content", "bank-comms");

type SheetPick = {
  sheet: string;
  headerStartRow: number;
  columns: string[];
  numericCols?: string[];
  dateCols?: string[];
  booleanCols?: string[];
  maxRows?: number;
};

type WorkbookSpec = {
  file: string;
  outName: string;
  picks: SheetPick[];
};

const WORKBOOKS: WorkbookSpec[] = [
  {
    file: "NEURAL_BANK_COMMS_FOUNDATIONS.xlsx",
    outName: "foundations",
    picks: [
      {
        sheet: "1_BANK_PROFILE",
        headerStartRow: 4,
        columns: ["key", "value", "note"],
        maxRows: 40,
      },
      {
        sheet: "2_SOURCEBOOK",
        headerStartRow: 4,
        columns: [
          "source_id",
          "autorite",
          "titre",
          "url",
          "juridiction",
          "status",
          "owner",
          "review_date",
          "expiry_date",
          "note",
        ],
        dateCols: ["review_date", "expiry_date"],
        maxRows: 500,
      },
      {
        sheet: "3_DISCLOSURE_RULES",
        headerStartRow: 4,
        columns: [
          "rule_id",
          "communication_type",
          "champ_obligatoire",
          "jurisdiction",
          "autorite",
          "severite",
          "blocking",
          "note",
        ],
        booleanCols: ["blocking"],
        maxRows: 500,
      },
      {
        sheet: "4_APPROVER_ROLES",
        headerStartRow: 4,
        columns: ["role_id", "label", "required_for"],
        maxRows: 50,
      },
      {
        sheet: "5_JURISDICTION_MATRIX",
        headerStartRow: 4,
        columns: ["jurisdiction", "autorites", "lang", "disclaimer_default"],
        maxRows: 50,
      },
    ],
  },
  {
    file: "NEURAL_BANK_COMMS_MASTER.xlsx",
    outName: "master",
    picks: [
      {
        sheet: "2_AGENT_REGISTRY",
        headerStartRow: 4,
        columns: ["agent_id", "slug", "name", "type", "priority", "sla_h", "owner", "status"],
        numericCols: ["sla_h"],
        maxRows: 50,
      },
      {
        sheet: "3_WORKFLOW_MAP",
        headerStartRow: 4,
        columns: ["step", "stage", "owner", "outcome"],
        numericCols: ["step"],
        maxRows: 50,
      },
      {
        sheet: "5_REVIEW_GATES",
        headerStartRow: 4,
        columns: ["gate_id", "label", "stage", "blocking"],
        booleanCols: ["blocking"],
        maxRows: 50,
      },
      {
        sheet: "6_RISK_REGISTER",
        headerStartRow: 4,
        columns: ["risk_id", "label", "impact", "probabilite", "score", "mitigation"],
        numericCols: ["impact", "probabilite", "score"],
        maxRows: 100,
      },
    ],
  },
  // AG-B001..AG-B004 : specs ajoutées au fur et à mesure que les workbooks
  // agents atterrissent. Sprint 0 = fondations + master uniquement.
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function pickSheet(ws: XLSX.WorkSheet, pick: SheetPick): Record<string, unknown>[] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const out: Record<string, unknown>[] = [];
  const maxRow = Math.min(range.e.r, pick.headerStartRow + (pick.maxRows ?? 1000));
  for (let r = pick.headerStartRow; r <= maxRow; r += 1) {
    const row: Record<string, unknown> = {};
    let hasAny = false;
    for (let c = 0; c < pick.columns.length; c += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      let v: unknown = cell ? cell.v : null;
      const colName = pick.columns[c];
      if (v !== null && v !== undefined && v !== "") {
        hasAny = true;
        if (pick.numericCols?.includes(colName)) {
          const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
          v = Number.isFinite(n) ? n : null;
        } else if (pick.booleanCols?.includes(colName)) {
          const s = String(v).toLowerCase();
          v = s === "true" || s === "1" || s === "oui" || s === "yes";
        } else if (pick.dateCols?.includes(colName)) {
          if (typeof v === "number") {
            const d = XLSX.SSF.parse_date_code(v);
            if (d) {
              v = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
            }
          }
        }
      } else {
        v = null;
      }
      row[colName] = v;
    }
    if (hasAny) out.push(row);
  }
  return out;
}

function ensureOutDir(): void {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function syncWorkbook(spec: WorkbookSpec): { built: boolean; rows: Record<string, number> } {
  const path = join(DATA_DIR, spec.file);
  if (!existsSync(path)) {
     
    console.warn(`[sync-bank-comms] ${spec.file} absent — skeleton JSON conservé.`);
    return { built: false, rows: {} };
  }
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const data: Record<string, unknown[]> = {};
  const rows: Record<string, number> = {};
  for (const pick of spec.picks) {
    const ws = wb.Sheets[pick.sheet];
    if (!ws) {
       
      console.warn(`[sync-bank-comms] ${spec.file} — feuille ${pick.sheet} introuvable.`);
      data[pick.sheet] = [];
      rows[pick.sheet] = 0;
      continue;
    }
    const picked = pickSheet(ws, pick);
    data[pick.sheet] = picked;
    rows[pick.sheet] = picked.length;
  }
  const payload = {
    _meta: {
      sourceFile: spec.file,
      generatedAt: new Date().toISOString(),
      sheets: spec.picks.map((p) => p.sheet),
    },
    data,
  };
  writeFileSync(join(OUT_DIR, `${spec.outName}.json`), JSON.stringify(payload, null, 2) + "\n");
  return { built: true, rows };
}

function writeManifest(results: Array<{ spec: WorkbookSpec; built: boolean; rows: Record<string, number> }>): void {
  const manifest = {
    _meta: {
      vertical: "bank-comms",
      generatedAt: new Date().toISOString(),
    },
    workbooks: Object.fromEntries(
      results.map(({ spec, built, rows }) => [
        spec.outName,
        {
          file: spec.file,
          status: built ? "built" : "not-yet-built",
          sheets: spec.picks.map((p) => p.sheet),
          rows,
        },
      ]),
    ),
  };
  writeFileSync(join(OUT_DIR, "_manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

function main(): void {
  ensureOutDir();
  if (!existsSync(DATA_DIR)) {
     
    console.warn(`[sync-bank-comms] ${DATA_DIR} absent — rien à synchroniser (Sprint 0 scaffold).`);
    return;
  }
  const results = WORKBOOKS.map((spec) => ({ spec, ...syncWorkbook(spec) }));
  writeManifest(results);
   
  console.log(
    `[sync-bank-comms] OK — ${results.filter((r) => r.built).length}/${results.length} workbooks synchronisés.`,
  );
}

main();
