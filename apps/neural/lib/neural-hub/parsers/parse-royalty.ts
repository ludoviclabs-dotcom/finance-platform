// ============================================================
// Parser: NEURAL_Royalty_Accounting.xlsx
// Extracts contracts, royalties, WHT, Pillar 2, brand valuations
// ============================================================

import * as XLSX from 'xlsx';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'NEURAL_Royalty_Accounting.xlsx');

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
function parseDashboardKPIs(rows: unknown[][]): Record<string, number | string> {
  const kpis: Record<string, number | string> = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const label = norm(r[0]);

    if (label.includes('royalties brut') || label.includes('redevances brut')) kpis.totalGrossRoyalties = num(r[1]);
    if (label.includes('retenues') || label.includes('wht total')) kpis.totalWHT = num(r[1]);
    if (label.includes('royalties net') || label.includes('redevances net')) kpis.totalNetRoyalties = num(r[1]);
    if (label.includes('contrats actif')) kpis.activeContracts = num(r[1]);
    if (label.includes('top-up') || label.includes('pilier')) kpis.pillar2TopUp = num(r[1]);
    if (label.includes('valorisation') && label.includes('total')) kpis.brandValuationTotal = num(r[1]);

    // Also scan for KPI values in multi-column dashboard format
    for (let c = 0; c < (r.length || 0); c++) {
      const cellLabel = norm(r[c]);
      if (cellLabel.includes('royalties brut') && c + 1 < r.length) kpis.totalGrossRoyalties = kpis.totalGrossRoyalties || num(rows[i + 1]?.[c]);
      if (cellLabel.includes('contrats') && cellLabel.includes('actif') && c + 1 < r.length) kpis.activeContracts = kpis.activeContracts || num(rows[i + 1]?.[c]);
    }
  }

  return kpis;
}

// ── Parse contracts from 02_CONTRATS_LICENCES ──
function parseContracts(rows: unknown[][]): Array<{
  licensee: string; territory: string; brand: string;
  royaltyRate: number; startDate: string; endDate: string; status: string;
}> {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && r.some(c => norm(c).includes('licenci')) && r.some(c => norm(c).includes('taux') || norm(c).includes('rate'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const contracts: Array<{
    licensee: string; territory: string; brand: string;
    royaltyRate: number; startDate: string; endDate: string; status: string;
  }> = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    if (norm(r[0]).includes('total') || str(r[0]).startsWith('─')) break;

    contracts.push({
      licensee: str(r[0]),
      territory: str(r[1]),
      brand: str(r[2]),
      royaltyRate: num(r[3]),
      startDate: str(r[4]),
      endDate: str(r[5]),
      status: str(r[6]),
    });
  }
  return contracts;
}

// ── Main export ──
export function parseRoyalty() {
  const wb = XLSX.readFile(FILE);
  const dashboardRows = readSheet(wb, '10_DASHBOARD');
  const contractRows = readSheet(wb, '02_CONTRATS_LICENCES');

  return {
    dashboard: parseDashboardKPIs(dashboardRows),
    contracts: parseContracts(contractRows),
    sheetCount: wb.SheetNames.length,
    sheets: wb.SheetNames.filter(s => s !== 'Claude Log'),
  };
}
