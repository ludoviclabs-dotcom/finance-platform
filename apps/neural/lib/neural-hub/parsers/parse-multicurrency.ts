// ============================================================
// Parser: NEURAL_MultiCurrency_IAS21.xlsx
// Extracts FX rates, operations, conversion, hedging, sensitivity
// ============================================================

import * as XLSX from 'xlsx';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'NEURAL_MultiCurrency_IAS21.xlsx');

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

function excelDate(v: unknown): string {
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return str(v);
}

// ── Types ──
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  country: string;
  closingRate: number;
  averageRate: number;
  openingRate: number;
  source: string;
}

export interface FxOperation {
  id: string;
  dateOp: string;
  dateComptable: string;
  description: string;
  entite: string;
  contrepartie: string;
  devise: string;
  montantDevise: number;
  tauxSpot: number;
  montantEurInitial: number;
  typeElement: string;
  categorieIas21: string;
  compteDebit: string;
  compteCredit: string;
  sensFlux: string;
  dateReglement: string;
  tauxReglement: number;
  montantEurReglement: number;
  ecartRealise: number;
  statut: string;
}

export interface ConversionLine {
  id: string;
  description: string;
  devise: string;
  montantDevise: number;
  typeElement: string;
  tauxInitial: number;
  valeurEurInitiale: number;
  tauxCloture: number;
  valeurEurCloture: number;
  ecartBrut: number;
  ecartPnl: number;
  ecartOci: number;
  refIas21: string;
  impactIs: number;
}

export interface HedgeInstrument {
  id: string;
  type: string;
  devise: string;
  notionnel: number;
  direction: string;
  dateConclusion: string;
  dateMaturite: string;
  tauxContractuel: number;
  tauxSpotActuel: number;
  justeValeur: number;
  typeCouverture: string;
  elementCouvert: string;
  statut: string;
  dureeResidJours: number;
  jvActualisee: number;
}

export interface EffectivenessTest {
  id: string;
  elementCouvert: string;
  varJvCouvert: number;
  varJvInstrument: number;
  ratio: number;
  partieEfficace: number;
  partieInefficace: number;
  relationEco: boolean;
  risqueCredit: boolean;
  ratioCoherent: boolean;
  qualifie: boolean;
}

export interface FxSummary {
  nbOperations: number;
  volumeTotal: number;
  jvPortefeuille: number;
  partieEfficace: number;
  partieInefficace: number;
  expositionResiduelle: number;
  totalPnlImpact: number;
  totalOciImpact: number;
  parDevise: Array<{
    devise: string;
    volume: number;
    ecartRealise: number;
    ecartLatent: number;
    jvCouverture: number;
    expositionResiduelle: number;
  }>;
}

// ── Parse currencies from 01_PARAMETRES ──
function parseCurrencies(rows: unknown[][]): CurrencyInfo[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && str(r[0]).toLowerCase().includes('code iso')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const currencies: CurrencyInfo[] = [];
  for (let i = headerIdx + 1; i < headerIdx + 12; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    currencies.push({
      code: str(r[0]),
      name: str(r[1]),
      symbol: str(r[2]),
      country: str(r[3]),
      closingRate: num(r[4]),
      averageRate: num(r[5]),
      openingRate: num(r[6]),
      source: str(r[7]),
    });
  }
  return currencies;
}

// ── Parse FX operations from 03_JOURNAL_OPS ──
function parseOperations(rows: unknown[][]): FxOperation[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const norm = str(r?.[0]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('operation') && r?.some(c => str(c).toLowerCase().includes('date'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const ops: FxOperation[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const id = str(r[0]);
    if (id.toLowerCase().includes('total') || id.toLowerCase().includes('stat')) break;

    ops.push({
      id,
      dateOp: excelDate(r[1]),
      dateComptable: excelDate(r[2]),
      description: str(r[3]),
      entite: str(r[4]),
      contrepartie: str(r[5]),
      devise: str(r[6]),
      montantDevise: num(r[7]),
      tauxSpot: num(r[8]),
      montantEurInitial: num(r[9]),
      typeElement: str(r[10]),
      categorieIas21: str(r[11]),
      compteDebit: str(r[12]),
      compteCredit: str(r[13]),
      sensFlux: str(r[14]),
      dateReglement: excelDate(r[15]),
      tauxReglement: num(r[16]),
      montantEurReglement: num(r[17]),
      ecartRealise: num(r[18]),
      statut: str(r[19]),
    });
  }
  return ops;
}

// ── Parse conversion IAS 21 from 04_CONVERSION_IAS21 ──
function parseConversion(rows: unknown[][]): ConversionLine[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const norm = str(r?.[0]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('operation') && r?.some(c => str(c).toLowerCase().includes('devise'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const lines: ConversionLine[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const id = str(r[0]);
    if (id.toLowerCase().includes('total') || id.toLowerCase().includes('recap')) break;

    lines.push({
      id,
      description: str(r[1]),
      devise: str(r[2]),
      montantDevise: num(r[3]),
      typeElement: str(r[4]),
      tauxInitial: num(r[5]),
      valeurEurInitiale: num(r[6]),
      tauxCloture: num(r[7]),
      valeurEurCloture: num(r[8]),
      ecartBrut: num(r[9]),
      ecartPnl: num(r[12]),
      ecartOci: num(r[13]),
      refIas21: str(r[14]),
      impactIs: num(r[16]),
    });
  }
  return lines;
}

// ── Parse hedging from 07_COUVERTURE ──
function parseHedging(rows: unknown[][]): HedgeInstrument[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && str(r[0]).toLowerCase() === 'id') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const instruments: HedgeInstrument[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const id = str(r[0]);
    if (id.toLowerCase().includes('total') || id.toLowerCase().includes('port')) break;

    instruments.push({
      id,
      type: str(r[1]),
      devise: str(r[2]),
      notionnel: num(r[3]),
      direction: str(r[4]),
      dateConclusion: excelDate(r[5]),
      dateMaturite: excelDate(r[6]),
      tauxContractuel: num(r[7]),
      tauxSpotActuel: num(r[8]),
      justeValeur: num(r[9]),
      typeCouverture: str(r[10]),
      elementCouvert: str(r[11]),
      statut: str(r[12]),
      dureeResidJours: num(r[13]),
      jvActualisee: num(r[18]),
    });
  }
  return instruments;
}

// ── Parse effectiveness from 08_EFFICACITE ──
function parseEffectiveness(rows: unknown[][]): EffectivenessTest[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && str(r[0]).toLowerCase().includes('id couverture')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const tests: EffectivenessTest[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const id = str(r[0]);
    if (id.toLowerCase().includes('total')) break;

    tests.push({
      id,
      elementCouvert: str(r[1]),
      varJvCouvert: num(r[2]),
      varJvInstrument: num(r[3]),
      ratio: num(r[4]),
      partieEfficace: num(r[5]),
      partieInefficace: num(r[6]),
      relationEco: str(r[7]).toUpperCase() === 'OUI',
      risqueCredit: str(r[8]).toUpperCase() === 'OUI',
      ratioCoherent: str(r[9]).toUpperCase() === 'OUI',
      qualifie: str(r[10]).toUpperCase().includes('QUALIF'),
    });
  }
  return tests;
}

// ── Parse summary from 10_SYNTHESE ──
function parseSummary(rows: unknown[][]): FxSummary {
  const summary: FxSummary = {
    nbOperations: 0, volumeTotal: 0, jvPortefeuille: 0,
    partieEfficace: 0, partieInefficace: 0, expositionResiduelle: 0,
    totalPnlImpact: 0, totalOciImpact: 0, parDevise: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const label = str(r[0]).toLowerCase();

    if (label.includes('nombre') && label.includes('op')) summary.nbOperations = num(r[1]);
    else if (label.includes('volume') && !label.includes('devise')) summary.volumeTotal = num(r[1]);
    else if (label.includes('jv portefeuille') || label.includes('juste valeur')) summary.jvPortefeuille = num(r[1]);
    else if (label.includes('partie efficace') && !label.includes('in')) summary.partieEfficace = num(r[1]);
    else if (label.includes('partie inefficace') || label.includes('inefficace')) summary.partieInefficace = num(r[1]);
    else if (label.includes('exposition resid')) summary.expositionResiduelle = num(r[1]);
  }

  // Parse per-currency recap
  let deviseSectionIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && str(r[0]).toLowerCase().includes('devise') && r.some(c => str(c).toLowerCase().includes('volume'))) {
      deviseSectionIdx = i;
      break;
    }
  }

  if (deviseSectionIdx >= 0) {
    for (let i = deviseSectionIdx + 1; i < deviseSectionIdx + 12; i++) {
      const r = rows[i];
      if (!r || !str(r[0])) break;
      const devise = str(r[0]).toUpperCase();
      if (devise.includes('TOTAL') || devise.length > 5) break;
      summary.parDevise.push({
        devise,
        volume: num(r[1]),
        ecartRealise: num(r[2]),
        ecartLatent: num(r[3]),
        jvCouverture: num(r[4]),
        expositionResiduelle: num(r[5]),
      });
    }
  }

  // Calculate total PnL and OCI from ecarts
  summary.totalPnlImpact = summary.parDevise.reduce((s, d) => s + d.ecartRealise + d.ecartLatent, 0);

  return summary;
}

// ── Main export ──
export function parseMultiCurrency() {
  const wb = XLSX.readFile(FILE);
  const paramRows = readSheet(wb, '01_PARAMETRES');
  const opsRows = readSheet(wb, '03_JOURNAL_OPS');
  const convRows = readSheet(wb, '04_CONVERSION_IAS21');
  const hedgeRows = readSheet(wb, '07_COUVERTURE');
  const effRows = readSheet(wb, '08_EFFICACITE');
  const synthRows = readSheet(wb, '10_SYNTHESE');

  return {
    currencies: parseCurrencies(paramRows),
    operations: parseOperations(opsRows),
    conversion: parseConversion(convRows),
    hedging: parseHedging(hedgeRows),
    effectiveness: parseEffectiveness(effRows),
    summary: parseSummary(synthRows),
  };
}
