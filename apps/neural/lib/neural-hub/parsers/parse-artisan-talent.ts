// ============================================================
// Parser: NEURAL_LuxeArtisanTalent.xlsx
// Extracts artisan talent data — référentiel métiers, vivier,
// gaps, succession plans, dashboard KPIs
// ============================================================

import * as XLSX from 'xlsx';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'NEURAL_LuxeArtisanTalent.xlsx');

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
  artisansEnPoste: number;
  gapsCritiques: number;
  vivierActif: number;
  risquesSuccession: number;
  scoreMoyenEquipe: number;
  budgetFormation: number;
} {
  const kpis = {
    artisansEnPoste: 0,
    gapsCritiques: 0,
    vivierActif: 0,
    risquesSuccession: 0,
    scoreMoyenEquipe: 0,
    budgetFormation: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    for (let c = 0; c < r.length; c++) {
      const label = norm(r[c]);
      // Labels are in one row, values in the next
      if (label.includes('artisans') && label.includes('poste')) kpis.artisansEnPoste = num(rows[i + 1]?.[c]);
      if (label.includes('gaps') && label.includes('critiq')) kpis.gapsCritiques = num(rows[i + 1]?.[c]);
      if (label.includes('vivier') && label.includes('actif')) kpis.vivierActif = num(rows[i + 1]?.[c]);
      if (label.includes('risque') && label.includes('succession')) kpis.risquesSuccession = num(rows[i + 1]?.[c]);
      if (label.includes('score') && label.includes('moyen')) kpis.scoreMoyenEquipe = num(rows[i + 1]?.[c]);
      if (label.includes('budget') && label.includes('formation')) kpis.budgetFormation = num(rows[i + 1]?.[c]);
    }
  }

  return kpis;
}

// ── Parse référentiel métiers from 02_REF_METIERS ──
function parseMetiers(rows: unknown[][]): Array<{
  id: string; famille: string; metier: string; rarete: number;
  delaiFormation: string; risquePenurie: string;
}> {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && str(r[0]) === 'ID' && norm(r[2]).includes('metier')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const metiers: Array<{
    id: string; famille: string; metier: string; rarete: number;
    delaiFormation: string; risquePenurie: string;
  }> = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const id = str(r[0]);
    if (!id.startsWith('M')) break;

    metiers.push({
      id,
      famille: str(r[1]),
      metier: str(r[2]),
      rarete: num(r[3]),
      delaiFormation: str(r[4]),
      risquePenurie: str(r[5]),
    });
  }
  return metiers;
}

// ── Parse gap analysis from 07_GAP_ANALYSIS ──
function parseGapAnalysis(rows: unknown[][]): {
  postesDeficit: number;
  urgencesCritiques: number;
  postesSurplus: number;
  gapTotalBrut: number;
  departsRetraite: number;
} {
  const gaps = {
    postesDeficit: 0,
    urgencesCritiques: 0,
    postesSurplus: 0,
    gapTotalBrut: 0,
    departsRetraite: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    for (let c = 0; c < r.length; c++) {
      const label = norm(r[c]);
      if (label.includes('postes') && label.includes('deficit')) gaps.postesDeficit = num(rows[i + 1]?.[c]);
      if (label.includes('urgences') && label.includes('critiq')) gaps.urgencesCritiques = num(rows[i + 1]?.[c]);
      if (label.includes('postes') && label.includes('surplus')) gaps.postesSurplus = num(rows[i + 1]?.[c]);
      if (label.includes('gap') && label.includes('total')) gaps.gapTotalBrut = num(rows[i + 1]?.[c]);
      if (label.includes('depart') && label.includes('retraite')) gaps.departsRetraite = num(rows[i + 1]?.[c]);
    }
  }

  return gaps;
}

// ── Main export ──
export function parseArtisanTalent() {
  const wb = XLSX.readFile(FILE);
  const dashboardRows = readSheet(wb, '10_DASHBOARD');
  const metierRows = readSheet(wb, '02_REF_METIERS');
  const gapRows = readSheet(wb, '07_GAP_ANALYSIS');

  return {
    dashboard: parseDashboard(dashboardRows),
    metiers: parseMetiers(metierRows),
    gapAnalysis: parseGapAnalysis(gapRows),
    sheetCount: wb.SheetNames.filter(s => s !== 'Claude Log').length,
  };
}
