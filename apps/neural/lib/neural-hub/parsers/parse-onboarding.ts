// ============================================================
// Parser: NEURAL_LuxeOnboarding.xlsx
// Extracts onboarding data — parcours, évaluations, probation,
// dashboard KPIs
// ============================================================

import * as XLSX from 'xlsx';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'NEURAL_LuxeOnboarding.xlsx');

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

// ── Parse dashboard KPIs from 08_DASHBOARD ──
function parseDashboard(rows: unknown[][]): {
  avancementChecklist: number;
  scoreActuel: number;
  joursRestants: number;
  statutProbation: string;
  totalEtapes: number;
  etapesCompletes: number;
} {
  const kpis = {
    avancementChecklist: 0,
    scoreActuel: 0,
    joursRestants: 0,
    statutProbation: '',
    totalEtapes: 0,
    etapesCompletes: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    for (let c = 0; c < r.length; c++) {
      const label = norm(r[c]);
      if (label.includes('avancement') && label.includes('checklist')) kpis.avancementChecklist = num(rows[i + 1]?.[c]);
      if (label.includes('score') && label.includes('actuel')) kpis.scoreActuel = num(rows[i + 1]?.[c]);
      if (label.includes('jours') && label.includes('restant')) kpis.joursRestants = num(rows[i + 1]?.[c]);
      if (label.includes('statut') && label.includes('probation')) kpis.statutProbation = str(rows[i + 1]?.[c]);
    }
  }

  return kpis;
}

// ── Parse parcours steps from 02_PARCOURS ──
function parseParcours(rows: unknown[][]): {
  totalActions: number;
  completedActions: number;
  avancement: number;
  jalons: Array<{ jalon: string; action: string; responsable: string; fait: boolean }>;
} {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && norm(r[0]).includes('jalon') && r.some(c => norm(c).includes('action'))) {
      headerIdx = i;
      break;
    }
  }

  const jalons: Array<{ jalon: string; action: string; responsable: string; fait: boolean }> = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || (!str(r[0]) && !str(r[1]))) break;
      jalons.push({
        jalon: str(r[0]),
        action: str(r[1]),
        responsable: str(r[2]),
        fait: str(r[4]).toUpperCase() === 'OUI' || str(r[4]) === '✅',
      });
    }
  }

  const completed = jalons.filter(j => j.fait).length;

  // Also parse avancement from header area
  let avancement = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i];
    if (!r) continue;
    const txt = str(r[0]);
    const match = txt.match(/(\d+)%/);
    if (match) avancement = parseInt(match[1], 10);
  }

  return {
    totalActions: jalons.length,
    completedActions: completed,
    avancement: avancement || (jalons.length > 0 ? Math.round(completed / jalons.length * 100) : 0),
    jalons,
  };
}

// ── Parse évaluations from 06_EVALUATIONS ──
function parseEvaluations(rows: unknown[][]): {
  criteres: Array<{ critere: string; j30: number; j60: number; j90: number; j180: number; j365: number }>;
} {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && norm(r[0]).includes('critere') && r.some(c => str(c).includes('J+30') || str(c).includes('j+30'))) {
      headerIdx = i;
      break;
    }
  }

  const criteres: Array<{ critere: string; j30: number; j60: number; j90: number; j180: number; j365: number }> = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !str(r[0])) break;
      if (norm(r[0]).includes('moyenne') || norm(r[0]).includes('total')) break;

      criteres.push({
        critere: str(r[0]),
        j30: num(r[1]),
        j60: num(r[2]),
        j90: num(r[3]),
        j180: num(r[4]),
        j365: num(r[5]),
      });
    }
  }

  return { criteres };
}

// ── Main export ──
export function parseOnboarding() {
  const wb = XLSX.readFile(FILE);
  const dashboardRows = readSheet(wb, '08_DASHBOARD');
  const parcoursRows = readSheet(wb, '02_PARCOURS');
  const evalRows = readSheet(wb, '06_EVALUATIONS');

  return {
    dashboard: parseDashboard(dashboardRows),
    parcours: parseParcours(parcoursRows),
    evaluations: parseEvaluations(evalRows),
    sheetCount: wb.SheetNames.filter(s => s !== 'Claude Log' && s !== '_REF_POSTES').length,
  };
}
