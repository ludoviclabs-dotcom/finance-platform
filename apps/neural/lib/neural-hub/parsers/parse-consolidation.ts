// ============================================================
// Parser: NEURAL_Consolidation_Groupe.xlsx
// Extracts entities, FX rates, goodwill, impairment, bilans, P&L
// ============================================================

import * as XLSX from 'xlsx';
import path from 'path';
import {
  EntityFinancials,
  ExchangeRateSet,
  MonthlyRate,
  GoodwillData,
  ImpairmentTest,
} from '../types';

const FILE = path.join(process.cwd(), 'data', 'NEURAL_Consolidation_Groupe.xlsx');

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

// ── Parse entity directory from 01_PARAMETRES ──
function parseEntities(rows: unknown[][]): Array<{
  code: string; name: string; country: string; currency: string;
  ownershipPct: number; controlPct: number; method: 'Mère' | 'IG' | 'MEE';
  acquisitionDate: string; sector: string;
}> {
  // Find the entity table header row (contains "Code" and "Dénomination" or "Denomination")
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && str(row[0]).toLowerCase() === 'code' && row.some(c => str(c).toLowerCase().includes('nomination'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const entities: Array<{
    code: string; name: string; country: string; currency: string;
    ownershipPct: number; controlPct: number; method: 'Mère' | 'IG' | 'MEE';
    acquisitionDate: string; sector: string;
  }> = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0]) || str(r[0]).startsWith('─') || str(r[0]).startsWith('=')) break;
    const code = str(r[0]);
    if (!code || code.length > 10) break; // stop at non-entity rows

    const methodRaw = str(r[10]).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    let method: 'Mère' | 'IG' | 'MEE' = 'IG';
    if (methodRaw.includes('MERE')) method = 'Mère';
    else if (methodRaw.includes('MEE')) method = 'MEE';

    // Acquisition date may be Excel serial
    let acqDate = '';
    if (typeof r[11] === 'number') {
      const d = new Date((r[11] - 25569) * 86400000);
      acqDate = d.toISOString().slice(0, 10);
    } else {
      acqDate = str(r[11]);
    }

    entities.push({
      code,
      name: str(r[1]),
      country: str(r[2]),
      currency: str(r[4]),
      ownershipPct: num(r[8]) > 1 ? num(r[8]) / 100 : num(r[8]),
      controlPct: num(r[9]) > 1 ? num(r[9]) / 100 : num(r[9]),
      method,
      acquisitionDate: acqDate,
      sector: str(r[13]),
    });
  }
  return entities;
}

// ── Parse FX rates from 01_PARAMETRES ──
function parseFxRates(rows: unknown[][]): {
  closing: Record<string, number>;
  average: Record<string, number>;
  opening: Record<string, number>;
  historical: Record<string, number>;
} {
  // Find row containing "Devise" and "Taux clôture" or "Taux cloture"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && str(row[0]).toLowerCase() === 'devise' && row.some(c => str(c).toLowerCase().includes('cl') && str(c).toLowerCase().includes('ture'))) {
      headerIdx = i;
      break;
    }
  }

  const closing: Record<string, number> = { EUR: 1 };
  const average: Record<string, number> = { EUR: 1 };
  const opening: Record<string, number> = { EUR: 1 };
  const historical: Record<string, number> = { EUR: 1 };

  if (headerIdx < 0) return { closing, average, opening, historical };

  for (let i = headerIdx + 1; i < headerIdx + 15; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const ccy = str(r[0]).toUpperCase();
    if (ccy === 'EUR') continue;
    closing[ccy] = num(r[1]);
    average[ccy] = num(r[2]);
    opening[ccy] = num(r[3]);
    historical[ccy] = num(r[4]);
  }

  return { closing, average, opening, historical };
}

// ── Parse monthly rates from 02_TAUX_BCE ──
function parseMonthlyRates(rows: unknown[][]): MonthlyRate[] {
  // Find header row with "Mois" and "EUR/USD"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && str(row[0]).toLowerCase().includes('mois') && row.some(c => str(c).includes('EUR/USD'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const monthly: MonthlyRate[] = [];
  for (let i = headerIdx + 1; i < headerIdx + 15; i++) {
    const r = rows[i];
    if (!r || !str(r[0]) || str(r[0]).toLowerCase().includes('synth')) break;
    const month = str(r[0]);
    // Date might be Excel serial or string
    let date = '';
    if (typeof r[1] === 'number') {
      const d = new Date((r[1] - 25569) * 86400000);
      date = d.toISOString().slice(0, 10);
    } else {
      date = str(r[1]);
    }
    monthly.push({
      month,
      date,
      rates: {
        USD: num(r[2]),
        GBP: num(r[3]),
        JPY: num(r[4]),
        CHF: num(r[5]),
        CNY: num(r[6]),
        AED: num(r[7]),
        HKD: num(r[8]),
      },
    });
  }
  return monthly;
}

// ── Parse individual balance sheets from 03_BILANS_IND ──
function parseBalanceSheets(rows: unknown[][], entityCodes: string[]): Record<string, Record<string, number>> {
  // Find header row with entity codes
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.some(c => str(c) === 'MA-FR')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return {};

  // Map entity codes to column indices (entities are at cols 2, 4, 6, 8, 10, 12, 14)
  const header = rows[headerIdx];
  const entityCols: Record<string, number> = {};
  if (header) {
    for (let c = 0; c < header.length; c++) {
      const val = str(header[c]);
      if (entityCodes.includes(val)) {
        entityCols[val] = c;
      }
    }
  }

  const result: Record<string, Record<string, number>> = {};
  for (const code of Object.keys(entityCols)) {
    result[code] = {};
  }

  // Read each balance sheet line
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) continue;
    const poste = str(r[0]);
    if (poste.startsWith('═') || poste.startsWith('─')) continue;

    for (const [code, col] of Object.entries(entityCols)) {
      result[code][poste] = num(r[col]);
    }
  }

  return result;
}

// ── Parse goodwill from 06_GOODWILL ──
function parseGoodwill(rows: unknown[][]): GoodwillData[] {
  // Find header row containing "Entité acquise"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const norm = row ? row.map(c => str(c).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) : [];
    if (norm.some(c => c.includes('entite acquise'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const result: GoodwillData[] = [];
  for (let i = headerIdx + 1; i < headerIdx + 15; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const name = str(r[0]);
    if (name.toLowerCase().includes('total') || name.startsWith('─')) break;

    // Date may be Excel serial
    let acqDate = '';
    if (typeof r[1] === 'number' && r[1] > 30000) {
      const d = new Date((r[1] - 25569) * 86400000);
      acqDate = d.toISOString().slice(0, 10);
    } else {
      acqDate = str(r[1]);
    }

    result.push({
      entityCode: name,
      entityName: name,
      acquisitionDate: acqDate,
      pctAcquired: num(r[2]),
      purchasePrice: num(r[3]),
      nciAtAcquisition: num(r[4]),
      priorParticipation: num(r[5]),
      fairValueNetAssets: num(r[6]),
      goodwillInitial: num(r[7]),
      currency: str(r[9]),
      goodwillInCurrency: num(r[10]),
      closingRate: num(r[11]),
      goodwillConverted: num(r[12]),
    });
  }
  return result;
}

// ── Parse impairment tests from 06_GOODWILL ──
function parseImpairmentTests(rows: unknown[][]): ImpairmentTest[] {
  // Find "UGT" header
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && str(row[0]).toUpperCase() === 'UGT') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const result: ImpairmentTest[] = [];
  for (let i = headerIdx + 1; i < headerIdx + 15; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const name = str(r[0]);
    if (name.toLowerCase().includes('total') || name.startsWith('─')) break;

    const cashFlows: number[] = [];
    // Cash flows are typically in columns 4-8 (N+1 to N+5)
    for (let c = 4; c <= 8; c++) {
      if (r[c] != null) cashFlows.push(num(r[c]));
    }

    result.push({
      ugtName: name,
      goodwillAllocated: num(r[1]),
      netAssetsUGT: num(r[2]),
      carryingValue: num(r[3]),
      cashFlows,
      terminalValue: num(r[9]),
      npv: num(r[10]),
      recoverableAmount: num(r[11]),
      surplus: num(r[12]),
      impairment: num(r[13]),
    });
  }
  return result;
}

// ── Parse consolidated balance sheet from 09_BILAN_CONSO ──
function parseConsolidatedBS(rows: unknown[][]): {
  lines: Array<{ poste: string; ref: string; brut: number; eliminations: number; consolide: number; n1: number }>;
  totalAssets: number;
  totalEquityGroup: number;
  totalNCI: number;
} {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && str(row[0]).toLowerCase().includes('poste') && row.some(c => str(c).toLowerCase().includes('consolid'))) {
      headerIdx = i;
      break;
    }
  }

  const lines: Array<{ poste: string; ref: string; brut: number; eliminations: number; consolide: number; n1: number }> = [];
  let totalAssets = 0;
  let totalEquityGroup = 0;
  let totalNCI = 0;

  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || (!str(r[0]) && !num(r[4]))) continue;
      const poste = str(r[0]);
      if (poste.startsWith('═')) continue;

      const line = {
        poste,
        ref: str(r[1]),
        brut: num(r[2]),
        eliminations: num(r[3]),
        consolide: num(r[4]),
        n1: num(r[5]),
      };
      lines.push(line);

      const lower = poste.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes('total actif') && !lower.includes('non')) totalAssets = line.consolide;
      if (lower.includes('total') && lower.includes('part') && lower.includes('groupe') && (lower.includes('cp') || lower.includes('capitaux'))) totalEquityGroup = line.consolide;
      if (lower.includes('int') && lower.includes('non contr')) totalNCI = line.consolide;
    }
  }

  return { lines, totalAssets, totalEquityGroup, totalNCI };
}

// ── Parse consolidated P&L from 10_PNL_CONSO ──
function parseConsolidatedPL(rows: unknown[][]): {
  lines: Array<{ poste: string; ref: string; brut: number; eliminations: number; consolide: number; n1: number }>;
  consolidatedRevenue: number;
  consolidatedNetIncome: number;
  groupShare: number;
  nciShare: number;
} {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && str(row[0]).toLowerCase().includes('poste') && row.some(c => str(c).toLowerCase().includes('consolid'))) {
      headerIdx = i;
      break;
    }
  }

  const lines: Array<{ poste: string; ref: string; brut: number; eliminations: number; consolide: number; n1: number }> = [];
  let consolidatedRevenue = 0;
  let consolidatedNetIncome = 0;
  let groupShare = 0;
  let nciShare = 0;

  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const poste = str(r[0]);
      if (!poste || poste.startsWith('═')) continue;

      const line = {
        poste,
        ref: str(r[1]),
        brut: num(r[2]),
        eliminations: num(r[3]),
        consolide: num(r[4]),
        n1: num(r[5]),
      };
      lines.push(line);

      const lower = poste.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes('total revenus consolid')) {
        consolidatedRevenue = line.consolide;
      }
      if (lower.includes('resultat net') && !lower.includes('part') && !lower.includes('inc') && !lower.includes('dont')) {
        consolidatedNetIncome = line.consolide;
      }
      if (lower.includes('part du groupe') || (lower.includes('dont') && lower.includes('part') && lower.includes('groupe'))) {
        if (line.consolide !== 0) groupShare = line.consolide;
      }
      if ((lower.includes('dont') && lower.includes('int') && lower.includes('non contr')) || (lower.includes('dont') && lower.includes('inc'))) {
        if (line.consolide !== 0) nciShare = line.consolide;
      }
    }
  }

  return { lines, consolidatedRevenue, consolidatedNetIncome, groupShare, nciShare };
}

// ── Main export ──
export function parseConsolidation() {
  const wb = XLSX.readFile(FILE);
  const paramRows = readSheet(wb, '01_PARAMETRES');
  const tauxRows = readSheet(wb, '02_TAUX_BCE');
  const bilanRows = readSheet(wb, '03_BILANS_IND');
  const pnlRows = readSheet(wb, '04_PNL_IND');
  const goodwillRows = readSheet(wb, '06_GOODWILL');
  const bilanConsoRows = readSheet(wb, '09_BILAN_CONSO');
  const pnlConsoRows = readSheet(wb, '10_PNL_CONSO');

  const entityMeta = parseEntities(paramRows);
  const fxRates = parseFxRates(paramRows);
  const monthly = parseMonthlyRates(tauxRows.length > 0 ? tauxRows : paramRows);

  const exchangeRates: ExchangeRateSet = {
    ...fxRates,
    monthly,
  };

  const entityCodes = entityMeta.map(e => e.code);
  const balanceSheets = parseBalanceSheets(bilanRows, entityCodes);
  const goodwill = parseGoodwill(goodwillRows);
  const impairmentTests = parseImpairmentTests(goodwillRows);
  const consolidatedBS = parseConsolidatedBS(bilanConsoRows);
  const consolidatedPL = parseConsolidatedPL(pnlConsoRows);

  return {
    entityMeta,
    exchangeRates,
    balanceSheets,
    goodwill,
    impairmentTests,
    consolidatedBS,
    consolidatedPL,
  };
}
