/**
 * NEURAL — Sync Luxe / Communication workbooks → JSON frozen
 *
 * Lit les 7 workbooks dans data/luxe-comms/ et genere un set de JSON dans
 * content/luxe-comms/ consommes par l'app (server components).
 *
 * Les JSON sont committes en git pour :
 *  - determinisme du build (pas de parsing xlsx a chaque SSR),
 *  - revue humaine du payload expose publiquement,
 *  - decouplage site / runtime xlsx.
 *
 * Usage :
 *   pnpm tsx scripts/sync-luxe-comms.ts
 *   ou :  npx tsx scripts/sync-luxe-comms.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as XLSX from "xlsx";

const ROOT = resolve(__dirname, "..");
const DATA_DIR = join(ROOT, "data", "luxe-comms");
const OUT_DIR = join(ROOT, "content", "luxe-comms");

// ----------------------------------------------------------------------------
// Declarations des workbooks a synchroniser
// ----------------------------------------------------------------------------

type SheetPick = {
  sheet: string;
  /** nombre de lignes en tete (titre + sous-titre + section + headers) a skipper */
  headerStartRow: number;
  /** noms des colonnes cibles dans le JSON, dans l'ordre A, B, C... */
  columns: string[];
  /** colonnes a parser comme nombre */
  numericCols?: string[];
  /** colonnes a parser comme date ISO YYYY-MM-DD */
  dateCols?: string[];
  /** limite max de lignes lues (garde-fou) */
  maxRows?: number;
};

type WorkbookSpec = {
  file: string;
  outName: string;
  picks: SheetPick[];
};

const WORKBOOKS: WorkbookSpec[] = [
  {
    file: "NEURAL_LUXE_COMMS_FOUNDATIONS.xlsx",
    outName: "foundations",
    picks: [
      {
        sheet: "1_MAISON_PROFILE",
        headerStartRow: 4,
        columns: ["key", "value", "note"],
        maxRows: 30,
      },
      {
        sheet: "2_BRAND_CHARTER",
        headerStartRow: 4,
        columns: ["rule_id", "categorie", "regle", "niveau", "poids", "lang", "exemple_ok", "exemple_ko"],
        numericCols: ["poids"],
      },
      {
        sheet: "3_BRAND_VOCAB_FR",
        headerStartRow: 4,
        columns: ["term_id", "terme", "term_type", "categorie", "niveau", "suggestion_remplacement", "contexte", "action"],
      },
      {
        sheet: "4_BRAND_VOCAB_EN",
        headerStartRow: 4,
        columns: ["term_id", "term", "term_type", "category", "severity", "replacement", "context", "action"],
      },
      {
        sheet: "5_HERITAGE_SOURCEBOOK",
        headerStartRow: 4,
        columns: ["source_id", "titre", "type", "annee", "auteur", "cote_archive", "manual_override", "review_date", "citation_format", "usage_count", "statut"],
        numericCols: ["annee", "usage_count"],
        dateCols: ["review_date"],
      },
      {
        sheet: "6_MEDIA_DIRECTORY",
        headerStartRow: 4,
        columns: ["media_id", "nom_media", "type", "vertical", "pays", "lang", "angle_editorial", "embargo_accepted", "relation_status", "priorite"],
      },
      {
        sheet: "7_CLAIMS_EVIDENCE_REGISTRY",
        headerStartRow: 4,
        columns: ["claim_id", "claim", "categorie", "wording_type", "evidence_title", "evidence_source", "juridiction", "evidence_date", "evidence_expiry", "owner", "manual_override", "status"],
        dateCols: ["evidence_date", "evidence_expiry"],
      },
      {
        sheet: "8_EVENTS_CALENDAR",
        headerStartRow: 4,
        columns: ["event_id", "nom", "type", "date_debut", "date_fin", "lieu", "audience", "vip_level", "claims_expected", "heritage_angle", "sensibilite_score", "statut"],
        dateCols: ["date_debut", "date_fin"],
        numericCols: ["sensibilite_score"],
      },
    ],
  },
  {
    file: "NEURAL_LUXE_COMMS_MASTER.xlsx",
    outName: "master",
    picks: [
      {
        sheet: "2_AGENT_REGISTRY",
        headerStartRow: 4,
        columns: ["agent_id", "agent_name", "mission", "owner", "status", "priority", "input_main", "output_main", "primary_gate", "dependencies", "data_required"],
      },
      {
        sheet: "3_WORKFLOW_MAP",
        headerStartRow: 4,
        columns: ["flow_id", "source", "destination", "trigger", "payload", "auto", "gate", "escalation", "sla_hours"],
        numericCols: ["sla_hours"],
      },
      {
        sheet: "5_REVIEW_GATES",
        headerStartRow: 4,
        columns: ["gate_id", "gate_type", "blocking", "approver_role", "sla_hours", "escalate_to", "crisis_fast_track_h", "note"],
        numericCols: ["sla_hours", "crisis_fast_track_h"],
      },
      {
        sheet: "11_RISK_REGISTER",
        headerStartRow: 4,
        columns: ["risk_id", "domaine", "description", "likelihood", "impact", "score", "owner", "mitigation", "statut", "next_review"],
        dateCols: ["next_review"],
      },
    ],
  },
  {
    file: "NEURAL_AG001_MaisonVoiceGuard.xlsx",
    outName: "ag001-voiceguard",
    picks: [
      {
        sheet: "3_BRAND_RULES",
        headerStartRow: 4,
        columns: ["rule_id", "categorie", "regle", "niveau", "poids", "lang", "detection_mode", "enabled"],
        numericCols: ["poids"],
      },
      {
        sheet: "4_HARD_FAIL_RULES",
        headerStartRow: 4,
        columns: ["hf_id", "pattern", "type", "lang", "categorie", "note"],
      },
      {
        sheet: "9_TESTSET",
        headerStartRow: 4,
        columns: ["test_id", "categorie", "lang", "texte_test", "expected_decision", "expected_hardfail", "observed_decision", "observed_hardfail", "pass_fail", "note"],
        numericCols: ["expected_hardfail", "observed_hardfail"],
      },
    ],
  },
  {
    file: "NEURAL_AG002_LuxePressAgent.xlsx",
    outName: "ag002-press",
    picks: [
      {
        sheet: "3_MEDIA_MATRIX",
        headerStartRow: 4,
        columns: ["media_type", "angle", "format_target", "length_words", "quote_ceo", "visuals_required", "embargo_recommand"],
        numericCols: ["length_words"],
      },
      {
        sheet: "11_PRESS_PICKUP",
        headerStartRow: 4,
        columns: ["pickup_id", "output_id", "media_repris", "pays", "lang", "date_reprise", "pickup", "reach", "sentiment", "tonalite"],
        dateCols: ["date_reprise"],
        numericCols: ["reach"],
      },
    ],
  },
  {
    file: "NEURAL_AG003_LuxeEventComms.xlsx",
    outName: "ag003-events",
    picks: [
      {
        sheet: "3_FORMAT_MATRIX",
        headerStartRow: 4,
        columns: ["event_type", "format", "mandatory", "mandatory_flag", "owner", "note"],
      },
    ],
  },
  {
    file: "NEURAL_AG004_HeritageComms.xlsx",
    outName: "ag004-heritage",
    picks: [
      {
        sheet: "4_APPROVED_FACTS",
        headerStartRow: 4,
        columns: ["fact_id", "fait", "annee", "source_1", "source_2", "source_3", "statut", "source_check"],
        numericCols: ["annee"],
      },
      {
        sheet: "5_NARRATIVE_BLOCKS",
        headerStartRow: 4,
        columns: ["block_id", "theme", "titre", "texte", "sources", "source_status", "usability", "usage_count"],
        numericCols: ["usage_count"],
      },
    ],
  },
  {
    file: "NEURAL_AG005_GreenClaimChecker.xlsx",
    outName: "ag005-greenclaim",
    picks: [
      {
        sheet: "3_CLAIM_LIBRARY",
        headerStartRow: 4,
        columns: ["lib_id", "pattern", "categorie", "wording_type", "autorisation", "evidence_required", "juridictions_ok", "note"],
      },
      {
        sheet: "9_TESTSET",
        headerStartRow: 4,
        columns: ["test_id", "claim_test", "wording_type", "evidence_expected", "juri", "expected_decision", "observed_decision", "pass_fail"],
      },
      {
        sheet: "10_JURIDICTION_MATRIX",
        headerStartRow: 4,
        columns: ["lib_id", "claim_pattern", "eu", "fr", "uk", "us", "ch"],
      },
    ],
  },
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Excel serial → ISO YYYY-MM-DD. Retourne null si non convertissable. */
function excelDateToIso(n: unknown): string | null {
  if (n == null || n === "") return null;
  if (typeof n === "string") {
    // deja une string (peut etre une date texte, parse ISO)
    const parsed = new Date(n);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  }
  if (typeof n !== "number") return null;
  // Excel epoch : 1899-12-30 (bug 1900 inclus)
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + n * 86400_000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

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

function readSheet(ws: XLSX.WorkSheet, pick: SheetPick): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const maxRows = pick.maxRows ?? 1000;
  const numericSet = new Set(pick.numericCols ?? []);
  const dateSet = new Set(pick.dateCols ?? []);

  for (let r = pick.headerStartRow; r < pick.headerStartRow + maxRows; r++) {
    // row index = r + 1 (Excel 1-indexed)
    const row: Record<string, unknown> = {};
    let hasValue = false;
    for (let c = 0; c < pick.columns.length; c++) {
      const addr = `${colLetter(c)}${r + 1}`;
      const cell = ws[addr];
      const key = pick.columns[c];
      // TOUJOURS initialiser la cle (null par defaut) pour que le JSON soit
      // un contrat stable. Les formules Excel non calculees par openpyxl
      // resteront null ; on recalcule cote JS (resolveClaimStatus, etc.).
      if (cell === undefined) {
        row[key] = null;
        continue;
      }
      let v: unknown = cell.v;
      // Resolved value for formula cells (si precalcule)
      if (cell.f !== undefined && cell.w !== undefined) {
        v = cell.w;
      }
      // Cas formule non calculee : cell.v === undefined, cell.f existe
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

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

function main() {
  ensureDir(OUT_DIR);
  const manifest: Record<string, { file: string; sheets: string[]; rows: Record<string, number> }> = {};

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
        generatedAt: new Date().toISOString(),
        sheets: Object.keys(payload),
      },
      data: payload,
    };

    const outFp = join(OUT_DIR, `${spec.outName}.json`);
    writeFileSync(outFp, JSON.stringify(out, null, 2), "utf8");
    manifest[spec.outName] = { file: spec.file, sheets: Object.keys(payload), rows: rowCounts };
    console.log(
      `[OK] ${spec.outName.padEnd(22)} ${spec.file.padEnd(42)} -> ${outFp}  (${Object.values(
        rowCounts
      ).reduce((a, b) => a + b, 0)} lignes)`
    );
  }

  // Manifest global pour intro traceability
  writeFileSync(
    join(OUT_DIR, "_manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), workbooks: manifest }, null, 2),
    "utf8"
  );
  console.log(`\n[OK] manifest ecrit -> ${join(OUT_DIR, "_manifest.json")}`);
}

main();
