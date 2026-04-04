// ============================================================
// Parser: NEURAL_LuxeCompBenchmark.xlsx
// Extracts compensation benchmarking — grille, benchmark marché,
// équité interne, coût employeur, dashboard KPIs
// ============================================================

import * as XLSX from 'xlsx';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'NEURAL_LuxeCompBenchmark.xlsx');

function readSheet(wb: XLSX.WorkBook, name: string): unknown[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function str(v: unknown): string {
  return v != null ? String(v).trim() : '';
}

function norm(v: unknown): string {
  return str(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Parse dashboard KPIs from 10_DASHBOARD ──
function parseDashboard(rows: unknown[][]): {
  masseSalariale: number;
  compaRatioMedian: number;
  ecartHF: number;
  cagrMoyen: number;
  coutMoyFrance: number;
  coutMoySuisse: number;
  ratioCHFR: number;
} {
  const kpis = {
    masseSalariale: 0,
    compaRatioMedian: 0,
    ecartHF: 0,
    cagrMoyen: 0,
    coutMoyFrance: 0,
    coutMoySuisse: 0,
    ratioCHFR: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    for (let c = 0; c < r.length; c++) {
      const label = norm(r[c]);
      if (label.includes('masse salariale') && label.includes('total')) kpis.masseSalariale = num(rows[i + 1]?.[c]);
      if (label.includes('compa-ratio') && label.includes('median')) kpis.compaRatioMedian = num(rows[i + 1]?.[c]);
      if (label.includes('ecart') && label.includes('h/f')) kpis.ecartHF = num(rows[i + 1]?.[c]);
      if (label.includes('cagr') && label.includes('moyen')) kpis.cagrMoyen = num(rows[i + 1]?.[c]);
    }
  }

  // Also parse from 08_COST_EMPLOYEUR header KPIs
  return kpis;
}

// ── Parse cost employer summary from 08_COST_EMPLOYEUR ──
function parseCostEmployeur(rows: unknown[][]): {
  masseSalarialeRef: number;
  coutMoyFR: number;
  coutMoyCH: number;
  ratioCHFR: number;
} {
  const cost = {
    masseSalarialeRef: 0,
    coutMoyFR: 0,
    coutMoyCH: 0,
    ratioCHFR: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    for (let c = 0; c < r.length; c++) {
      const label = norm(r[c]);
      if (label.includes('masse salariale') && label.includes('total')) cost.masseSalarialeRef = num(rows[i + 1]?.[c]);
      if (label.includes('cout moy') && label.includes('france')) cost.coutMoyFR = num(rows[i + 1]?.[c]);
      if (label.includes('cout moy') && label.includes('suisse')) cost.coutMoyCH = num(rows[i + 1]?.[c]);
      if (label.includes('ratio') && label.includes('ch') && label.includes('fr')) cost.ratioCHFR = num(rows[i + 1]?.[c]);
    }
  }

  // Fallback: check first rows which have raw values
  if (!cost.masseSalarialeRef && rows.length > 2) {
    cost.masseSalarialeRef = num(rows[2]?.[0]);
    cost.coutMoyFR = num(rows[2]?.[3]);
    cost.coutMoyCH = num(rows[2]?.[5]);
    cost.ratioCHFR = num(rows[2]?.[7]);
  }

  return cost;
}

// ── Parse equity alerts from 07_EQUITE_INTERNE ──
function parseEquity(rows: unknown[][]): {
  alertCount: number;
  ecartGlobal: number;
} {
  const eq = { alertCount: 0, ecartGlobal: 0 };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    for (let c = 0; c < r.length; c++) {
      const label = norm(r[c]);
      if (label.includes('alerte') && label.includes('equite')) eq.alertCount = num(rows[i + 1]?.[c]);
      if (label.includes('ecart') && label.includes('h/f') && label.includes('global')) eq.ecartGlobal = num(rows[i + 1]?.[c]);
    }
  }

  // Fallback: row 4 has raw KPIs
  if (!eq.alertCount && rows.length > 4) {
    eq.alertCount = num(rows[4]?.[0]);
    eq.ecartGlobal = num(rows[4]?.[3]);
  }

  return eq;
}

// ── Main export ──
export function parseCompBenchmark() {
  const wb = XLSX.readFile(FILE);
  const dashboardRows = readSheet(wb, '10_DASHBOARD');
  const costRows = readSheet(wb, '08_COST_EMPLOYEUR');
  const equityRows = readSheet(wb, '07_EQUITE_INTERNE');

  return {
    dashboard: parseDashboard(dashboardRows),
    costEmployeur: parseCostEmployeur(costRows),
    equity: parseEquity(equityRows),
    sheetCount: wb.SheetNames.length,
  };
}
