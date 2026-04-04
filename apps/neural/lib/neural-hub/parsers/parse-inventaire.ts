// ============================================================
// Parser: NEURAL_Inventaire_Luxe.xlsx
// Extracts inventory items, NRV tests, margins, risk analysis
// ============================================================

import * as XLSX from 'xlsx';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'NEURAL_Inventaire_Luxe.xlsx');

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
export interface InventoryItem {
  ref: string;
  article: string;
  maison: string;
  categorie: 'MP' | 'EC' | 'PF';
  unite: string;
  qte: number;
  coutUnit: number;
  coutTotal: number;
  methode: string;
  dateEntree: string;
  localisation: string;
  statut: string;
  ancienneteJours: number;
  alerte: string;
  prixVenteEst: number;
  coutsAchevement: number;
  coutsVente: number;
  prixPublic: number;
  nbVendus12m: number;
  qteReservee: number;
  qteDisponible: number;
  derniereSortie: string;
  joursSansMvt: number;
  txRotation: number;
  alerteRupture: string;
  risqueSurstock: string;
}

export interface NrvTest {
  ref: string;
  article: string;
  categorie: string;
  coutComptable: number;
  prixVenteEst: number;
  coutsAchevement: number;
  coutsVente: number;
  nrv: number;
  ecart: number;
  provision: number;
  statut: string;
}

export interface MarginItem {
  ref: string;
  produit: string;
  maison: string;
  coutProduction: number;
  prixVente: number;
  margeBrute: number;
  tauxMarge: number;
  qteStock: number;
  caPotentiel: number;
  contribution: number;
  nbVendus: number;
}

export interface RiskItem {
  type: string;
  niveau: string;
  impact: string;
  valeur: number;
  action: string;
}

export interface DashboardKPIs {
  stockBrut: number;
  stockImmobilise: number;
  rotationMoyenne: number;
  articlesSurstock: number;
  valeurMP: number;
  valeurEC: number;
  valeurPF: number;
  pctMP: number;
  pctEC: number;
  pctPF: number;
  parMaison: Array<{ maison: string; valeur: number; pct: number; nbRef: number }>;
}

// ── Parse Dashboard ──
function parseDashboard(rows: unknown[][]): DashboardKPIs {
  const kpis: DashboardKPIs = {
    stockBrut: 0, stockImmobilise: 0, rotationMoyenne: 0, articlesSurstock: 0,
    valeurMP: 0, valeurEC: 0, valeurPF: 0, pctMP: 0, pctEC: 0, pctPF: 0,
    parMaison: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const label = str(r[0]).toLowerCase();

    if (label.includes('stock brut')) kpis.stockBrut = num(r[1]);
    else if (label.includes('stock immobilis')) kpis.stockImmobilise = num(r[1]);
    else if (label.includes('rotation moyenne')) kpis.rotationMoyenne = num(r[1]);
    else if (label.includes('surstock')) kpis.articlesSurstock = num(r[1]);
    else if (label.includes('valeur mp') || label.includes('matieres 1ere') || label.includes('matieres premi')) {
      kpis.valeurMP = num(r[1]);
      kpis.pctMP = num(r[2]);
    }
    else if (label.includes('valeur ec') || label.includes('en-cours')) {
      kpis.valeurEC = num(r[1]);
      kpis.pctEC = num(r[2]);
    }
    else if (label.includes('valeur pf') || label.includes('produits finis')) {
      kpis.valeurPF = num(r[1]);
      kpis.pctPF = num(r[2]);
    }

    // Parse par maison section
    if (label.includes('hermes') || label.includes('patek') || label.includes('cartier') || label.includes('chanel')) {
      if (num(r[1]) > 0 && !label.includes('total')) {
        kpis.parMaison.push({
          maison: str(r[0]),
          valeur: num(r[1]),
          pct: num(r[2]),
          nbRef: num(r[3]),
        });
      }
    }
  }

  return kpis;
}

// ── Parse Inventaire items ──
function parseInventaireItems(rows: unknown[][]): InventoryItem[] {
  // Find header row with "Réf." or "Ref."
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const norm = str(r?.[0]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('ref') && r?.some(c => str(c).toLowerCase().includes('article'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const items: InventoryItem[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const ref = str(r[0]);
    if (ref.toLowerCase().includes('total') || ref.toLowerCase().includes('kpi')) break;

    items.push({
      ref,
      article: str(r[1]),
      maison: str(r[2]),
      categorie: str(r[3]) as 'MP' | 'EC' | 'PF',
      unite: str(r[4]),
      qte: num(r[5]),
      coutUnit: num(r[6]),
      coutTotal: num(r[7]),
      methode: str(r[8]),
      dateEntree: excelDate(r[9]),
      localisation: str(r[10]),
      statut: str(r[11]),
      ancienneteJours: num(r[12]),
      alerte: str(r[13]),
      prixVenteEst: num(r[14]),
      coutsAchevement: num(r[15]),
      coutsVente: num(r[16]),
      prixPublic: num(r[17]),
      nbVendus12m: num(r[18]),
      qteReservee: num(r[19]),
      qteDisponible: num(r[20]),
      derniereSortie: excelDate(r[21]),
      joursSansMvt: num(r[22]),
      txRotation: num(r[23]),
      alerteRupture: str(r[24]),
      risqueSurstock: str(r[25]),
    });
  }
  return items;
}

// ── Parse Test NRV IAS 2 ──
function parseNrvTests(rows: unknown[][]): NrvTest[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const norm = str(r?.[0]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('ref') && r?.some(c => str(c).toUpperCase().includes('NRV'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const tests: NrvTest[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const ref = str(r[0]);
    if (ref.toLowerCase().includes('total') || ref.toLowerCase().includes('indicat')) break;

    tests.push({
      ref,
      article: str(r[1]),
      categorie: str(r[2]),
      coutComptable: num(r[3]),
      prixVenteEst: num(r[4]),
      coutsAchevement: num(r[5]),
      coutsVente: num(r[6]),
      nrv: num(r[7]),
      ecart: num(r[8]),
      provision: num(r[9]),
      statut: str(r[10]),
    });
  }
  return tests;
}

// ── Parse Marges PF ──
function parseMargins(rows: unknown[][]): MarginItem[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const norm = str(r?.[0]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('ref') && r?.some(c => str(c).toLowerCase().includes('marge'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const margins: MarginItem[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    const ref = str(r[0]);
    if (ref.toLowerCase().includes('total')) break;

    margins.push({
      ref,
      produit: str(r[1]),
      maison: str(r[2]),
      coutProduction: num(r[3]),
      prixVente: num(r[4]),
      margeBrute: num(r[5]),
      tauxMarge: num(r[6]),
      qteStock: num(r[7]),
      caPotentiel: num(r[8]),
      contribution: num(r[9]),
      nbVendus: num(r[10]),
    });
  }
  return margins;
}

// ── Parse Risk Analysis ──
function parseRisks(rows: unknown[][]): RiskItem[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && str(r[0]).toLowerCase().includes('type risque')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const risks: RiskItem[] = [];
  for (let i = headerIdx + 1; i < headerIdx + 10; i++) {
    const r = rows[i];
    if (!r || !str(r[0])) break;
    risks.push({
      type: str(r[0]),
      niveau: str(r[1]),
      impact: str(r[2]),
      valeur: num(r[3]),
      action: str(r[4]),
    });
  }
  return risks;
}

// ── Main export ──
export function parseInventaire() {
  const wb = XLSX.readFile(FILE);
  const dashRows = readSheet(wb, 'Dashboard');
  const invRows = readSheet(wb, 'Inventaire');
  const nrvRows = readSheet(wb, 'Test_NRV_IAS2');
  const margesRows = readSheet(wb, 'Marges_PF');
  const risksRows = readSheet(wb, 'Analyse_Risques');

  return {
    dashboard: parseDashboard(dashRows),
    items: parseInventaireItems(invRows),
    nrvTests: parseNrvTests(nrvRows),
    margins: parseMargins(margesRows),
    risks: parseRisks(risksRows),
  };
}
