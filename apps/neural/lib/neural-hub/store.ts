// ============================================================
// lib/neural-hub/store.ts
// Source unique de vérité — toutes les données partagées
// ============================================================

import {
  NeuralGlobalParams,
  NeuralComputedResults,
  InterAgentDataFlow,
  ExchangeRateSet,
  MonthlyRate,
  EntityFinancials,
  GoodwillData,
  ImpairmentTest,
} from './types';

// ============================================================
// DONNÉES PAR DÉFAUT
// ============================================================

const MONTHLY_RATES: MonthlyRate[] = [
  { month: 'Avr-25', date: '2025-04-30', rates: { USD: 1.0850, GBP: 0.8560, JPY: 162.50, CHF: 0.9420, CNY: 7.8200, AED: 3.9850, HKD: 8.4800 }},
  { month: 'Mai-25', date: '2025-05-31', rates: { USD: 1.0910, GBP: 0.8540, JPY: 162.90, CHF: 0.9400, CNY: 7.8500, AED: 4.0070, HKD: 8.5100 }},
  { month: 'Jun-25', date: '2025-06-30', rates: { USD: 1.0880, GBP: 0.8510, JPY: 163.40, CHF: 0.9380, CNY: 7.8700, AED: 3.9960, HKD: 8.4900 }},
  { month: 'Jul-25', date: '2025-07-31', rates: { USD: 1.0940, GBP: 0.8490, JPY: 163.80, CHF: 0.9370, CNY: 7.8900, AED: 4.0180, HKD: 8.5300 }},
  { month: 'Aoû-25', date: '2025-08-31', rates: { USD: 1.1010, GBP: 0.8500, JPY: 162.70, CHF: 0.9360, CNY: 7.9100, AED: 4.0440, HKD: 8.5500 }},
  { month: 'Sep-25', date: '2025-09-30', rates: { USD: 1.0980, GBP: 0.8480, JPY: 163.10, CHF: 0.9350, CNY: 7.9300, AED: 4.0330, HKD: 8.5700 }},
  { month: 'Oct-25', date: '2025-10-31', rates: { USD: 1.0920, GBP: 0.8510, JPY: 163.60, CHF: 0.9380, CNY: 7.9100, AED: 4.0110, HKD: 8.5200 }},
  { month: 'Nov-25', date: '2025-11-30', rates: { USD: 1.0870, GBP: 0.8530, JPY: 164.20, CHF: 0.9400, CNY: 7.9400, AED: 3.9930, HKD: 8.4900 }},
  { month: 'Déc-25', date: '2025-12-31', rates: { USD: 1.0950, GBP: 0.8500, JPY: 163.90, CHF: 0.9370, CNY: 7.9600, AED: 4.0230, HKD: 8.5400 }},
  { month: 'Jan-26', date: '2026-01-31', rates: { USD: 1.0990, GBP: 0.8490, JPY: 164.30, CHF: 0.9360, CNY: 7.9700, AED: 4.0380, HKD: 8.5600 }},
  { month: 'Fév-26', date: '2026-02-28', rates: { USD: 1.1050, GBP: 0.8470, JPY: 164.60, CHF: 0.9340, CNY: 7.9900, AED: 4.0600, HKD: 8.5800 }},
  { month: 'Mar-26', date: '2026-03-31', rates: { USD: 1.1020, GBP: 0.8480, JPY: 164.80, CHF: 0.9350, CNY: 7.9800, AED: 4.0480, HKD: 8.5900 }},
];

function buildRateSet(monthly: MonthlyRate[]): ExchangeRateSet {
  const ccys = Object.keys(monthly[0].rates);
  const closing: Record<string, number> = { EUR: 1 };
  const opening: Record<string, number> = { EUR: 1 };
  const average: Record<string, number> = { EUR: 1 };

  ccys.forEach(c => {
    const r = monthly.map(m => m.rates[c]);
    closing[c] = r[r.length - 1];
    opening[c] = r[0];
    average[c] = Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10000) / 10000;
  });

  return {
    closing, average, opening,
    historical: { EUR: 1, USD: 1.0680, GBP: 0.8610, JPY: 130.40, CHF: 1.2340, CNY: 7.6720, HKD: 8.8640, AED: 3.9240 },
    monthly,
  };
}

const DEFAULT_ENTITIES: EntityFinancials[] = [
  {
    code: 'MA-FR', name: 'Maison Aurelia SAS', country: 'France', currency: 'EUR',
    ownershipPct: 1, controlPct: 1, method: 'Mère', acquisitionDate: '', sector: 'Maroquinerie & Joaillerie',
    balanceSheet: {
      goodwill: 0, intangibleAssets: 185000, tangibleAssets: 420000, rightOfUseAssets: 310000,
      investmentsInSubs: 892000, financialAssetsNC: 45000, deferredTaxAssets: 38000, intercoReceivablesNC: 185000,
      inventories: 280000, tradeReceivables: 145000, intercoReceivablesC: 95000, otherReceivables: 52000,
      prepaidExpenses: 18000, derivativeAssets: 49950, cashAndEquivalents: 185000,
      shareCapital: 150000, reserves: 850000, retainedEarnings: 178000, oci: 12000,
      borrowingsNC: 520000, leaseObligationsNC: 285000, provisionsNC: 45000,
      deferredTaxLiabilities: 62000, intercoPayablesNC: 0,
      tradePayables: 252950, intercoPayablesC: 0, taxAndSocialLiabilities: 142000,
      otherPayables: 88000, derivativeLiabilities: 35000,
    },
    incomeStatement: {
      revenueExternal: 725000, revenueInterco: 125000,
      costOfSalesExternal: -295000, costOfSalesInterco: -45000,
      personnelCosts: -128000, rentAndLeases: -22000, marketingCosts: -45000,
      depreciationAmortization: -38000, royaltiesInterco: 0, otherOperatingExpenses: -55000,
      otherOperatingIncomeExpense: 0, goodwillImpairment: 0, disposalGainLoss: 0,
      financeIncome: 62000, financeCosts: -38000, fxGainLoss: 3500, dividendsInterco: 12000,
      incomeTax: -82000, deferredTax: -9500,
    },
  },
  {
    code: 'AU-IT', name: 'Aurelia Italia SpA', country: 'Italie', currency: 'EUR',
    ownershipPct: 0.95, controlPct: 0.95, method: 'IG', acquisitionDate: '2015-09-15', sector: 'Maroquinerie & Accessoires',
    balanceSheet: {
      goodwill: 0, intangibleAssets: 95000, tangibleAssets: 180000, rightOfUseAssets: 125000,
      investmentsInSubs: 0, financialAssetsNC: 12000, deferredTaxAssets: 15000, intercoReceivablesNC: 0,
      inventories: 156000, tradeReceivables: 78000, intercoReceivablesC: 45000, otherReceivables: 28000,
      prepaidExpenses: 8000, derivativeAssets: 0, cashAndEquivalents: 62000,
      shareCapital: 80000, reserves: 220000, retainedEarnings: 43000, oci: 0,
      borrowingsNC: 180000, leaseObligationsNC: 110000, provisionsNC: 18000,
      deferredTaxLiabilities: 25000, intercoPayablesNC: 45000,
      tradePayables: 85000, intercoPayablesC: 0, taxAndSocialLiabilities: 52000,
      otherPayables: 38000, derivativeLiabilities: 0,
    },
    incomeStatement: {
      revenueExternal: 140000, revenueInterco: 180000,
      costOfSalesExternal: -95000, costOfSalesInterco: -50000,
      personnelCosts: -52000, rentAndLeases: -12000, marketingCosts: -15000,
      depreciationAmortization: -14000, royaltiesInterco: -14400, otherOperatingExpenses: -18000,
      otherOperatingIncomeExpense: 0, goodwillImpairment: 0, disposalGainLoss: 0,
      financeIncome: 5200, financeCosts: -8400, fxGainLoss: 800, dividendsInterco: 0,
      incomeTax: -13800, deferredTax: 1600,
    },
  },
  {
    code: 'AU-US', name: 'Aurelia USA Inc.', country: 'États-Unis', currency: 'USD',
    ownershipPct: 1, controlPct: 1, method: 'IG', acquisitionDate: '2017-03-01', sector: 'Distribution Retail',
    balanceSheet: {
      goodwill: 0, intangibleAssets: 68000, tangibleAssets: 295000, rightOfUseAssets: 480000,
      investmentsInSubs: 0, financialAssetsNC: 22000, deferredTaxAssets: 35000, intercoReceivablesNC: 0,
      inventories: 85000, tradeReceivables: 125000, intercoReceivablesC: 0, otherReceivables: 42000,
      prepaidExpenses: 15000, derivativeAssets: 0, cashAndEquivalents: 78000,
      shareCapital: 120000, reserves: 280000, retainedEarnings: 28800, oci: 0,
      borrowingsNC: 250000, leaseObligationsNC: 420000, provisionsNC: 22000,
      deferredTaxLiabilities: 35000, intercoPayablesNC: 0,
      tradePayables: 95000, intercoPayablesC: 42000, taxAndSocialLiabilities: 65000,
      otherPayables: 45000, derivativeLiabilities: 0,
    },
    incomeStatement: {
      revenueExternal: 480000, revenueInterco: 0,
      costOfSalesExternal: -168000, costOfSalesInterco: -42000,
      personnelCosts: -85000, rentAndLeases: -35000, marketingCosts: -32000,
      depreciationAmortization: -28000, royaltiesInterco: -28800, otherOperatingExpenses: -22000,
      otherOperatingIncomeExpense: 0, goodwillImpairment: 0, disposalGainLoss: 0,
      financeIncome: 2800, financeCosts: -12500, fxGainLoss: -2100, dividendsInterco: 0,
      incomeTax: -7400, deferredTax: 800,
    },
  },
  {
    code: 'AU-JP', name: 'Aurelia Japan KK', country: 'Japon', currency: 'JPY',
    ownershipPct: 0.80, controlPct: 0.80, method: 'IG', acquisitionDate: '2018-07-01', sector: 'Distribution Retail',
    balanceSheet: {
      goodwill: 0, intangibleAssets: 2800000, tangibleAssets: 4500000, rightOfUseAssets: 8200000,
      investmentsInSubs: 0, financialAssetsNC: 450000, deferredTaxAssets: 680000, intercoReceivablesNC: 0,
      inventories: 3200000, tradeReceivables: 4100000, intercoReceivablesC: 0, otherReceivables: 1500000,
      prepaidExpenses: 350000, derivativeAssets: 0, cashAndEquivalents: 2800000,
      shareCapital: 3500000, reserves: 8200000, retainedEarnings: 2620000, oci: 0,
      borrowingsNC: 4800000, leaseObligationsNC: 7500000, provisionsNC: 850000,
      deferredTaxLiabilities: 1200000, intercoPayablesNC: 0,
      tradePayables: 2800000, intercoPayablesC: 1885000, taxAndSocialLiabilities: 2100000,
      otherPayables: 1200000, derivativeLiabilities: 0,
    },
    incomeStatement: {
      revenueExternal: 42000000, revenueInterco: 0,
      costOfSalesExternal: -16800000, costOfSalesInterco: -2500000,
      personnelCosts: -8500000, rentAndLeases: -2200000, marketingCosts: -2800000,
      depreciationAmortization: -1800000, royaltiesInterco: -1885000, otherOperatingExpenses: -1500000,
      otherOperatingIncomeExpense: 0, goodwillImpairment: 0, disposalGainLoss: 0,
      financeIncome: 280000, financeCosts: -850000, fxGainLoss: 125000, dividendsInterco: 0,
      incomeTax: -1070000, deferredTax: 120000,
    },
  },
  {
    code: 'AU-CH', name: 'Aurelia Suisse SA', country: 'Suisse', currency: 'CHF',
    ownershipPct: 1, controlPct: 1, method: 'IG', acquisitionDate: '2014-01-01', sector: 'Horlogerie',
    balanceSheet: {
      goodwill: 0, intangibleAssets: 42000, tangibleAssets: 85000, rightOfUseAssets: 62000,
      investmentsInSubs: 0, financialAssetsNC: 8500, deferredTaxAssets: 5200, intercoReceivablesNC: 0,
      inventories: 95000, tradeReceivables: 38000, intercoReceivablesC: 25000, otherReceivables: 12000,
      prepaidExpenses: 4500, derivativeAssets: 0, cashAndEquivalents: 45000,
      shareCapital: 50000, reserves: 145000, retainedEarnings: 36600, oci: 0,
      borrowingsNC: 65000, leaseObligationsNC: 55000, provisionsNC: 8500,
      deferredTaxLiabilities: 5200, intercoPayablesNC: 25000,
      tradePayables: 42000, intercoPayablesC: 0, taxAndSocialLiabilities: 28000,
      otherPayables: 12900, derivativeLiabilities: 0,
    },
    incomeStatement: {
      revenueExternal: 75000, revenueInterco: 120000,
      costOfSalesExternal: -48000, costOfSalesInterco: -34000,
      personnelCosts: -28000, rentAndLeases: -6500, marketingCosts: -8000,
      depreciationAmortization: -7500, royaltiesInterco: 0, otherOperatingExpenses: -16000,
      otherOperatingIncomeExpense: 0, goodwillImpairment: 0, disposalGainLoss: 0,
      financeIncome: 3200, financeCosts: -4800, fxGainLoss: 500, dividendsInterco: 0,
      incomeTax: -9900, deferredTax: 600,
    },
  },
  {
    code: 'AU-CN', name: 'Aurelia China Ltd', country: 'Chine', currency: 'CNY',
    ownershipPct: 0.70, controlPct: 0.70, method: 'IG', acquisitionDate: '2020-06-15', sector: 'Distribution Retail',
    balanceSheet: {
      goodwill: 0, intangibleAssets: 35000, tangibleAssets: 120000, rightOfUseAssets: 180000,
      investmentsInSubs: 0, financialAssetsNC: 8000, deferredTaxAssets: 12000, intercoReceivablesNC: 0,
      inventories: 42000, tradeReceivables: 65000, intercoReceivablesC: 0, otherReceivables: 18000,
      prepaidExpenses: 5000, derivativeAssets: 0, cashAndEquivalents: 28000,
      shareCapital: 80000, reserves: 120000, retainedEarnings: 34810, oci: 0,
      borrowingsNC: 95000, leaseObligationsNC: 160000, provisionsNC: 12000,
      deferredTaxLiabilities: 8000, intercoPayablesNC: 0,
      tradePayables: 35000, intercoPayablesC: 0, taxAndSocialLiabilities: 22000,
      otherPayables: 18190, derivativeLiabilities: 0,
    },
    incomeStatement: {
      revenueExternal: 350000, revenueInterco: 0,
      costOfSalesExternal: -140000, costOfSalesInterco: -28000,
      personnelCosts: -65000, rentAndLeases: -18000, marketingCosts: -22000,
      depreciationAmortization: -12500, royaltiesInterco: 0, otherOperatingExpenses: -15000,
      otherOperatingIncomeExpense: 0, goodwillImpairment: 0, disposalGainLoss: 0,
      financeIncome: 1800, financeCosts: -5200, fxGainLoss: -350, dividendsInterco: 0,
      incomeTax: -11440, deferredTax: 500,
    },
  },
  {
    code: 'AU-AE', name: 'Aurelia Middle East FZE', country: 'EAU', currency: 'AED',
    ownershipPct: 1, controlPct: 1, method: 'IG', acquisitionDate: '2022-09-01', sector: 'Distribution Retail',
    balanceSheet: {
      goodwill: 0, intangibleAssets: 12000, tangibleAssets: 45000, rightOfUseAssets: 85000,
      investmentsInSubs: 0, financialAssetsNC: 3500, deferredTaxAssets: 0, intercoReceivablesNC: 0,
      inventories: 18000, tradeReceivables: 22000, intercoReceivablesC: 0, otherReceivables: 8000,
      prepaidExpenses: 2000, derivativeAssets: 0, cashAndEquivalents: 15000,
      shareCapital: 25000, reserves: 42000, retainedEarnings: 17108, oci: 0,
      borrowingsNC: 35000, leaseObligationsNC: 78000, provisionsNC: 5000,
      deferredTaxLiabilities: 0, intercoPayablesNC: 0,
      tradePayables: 18000, intercoPayablesC: 0, taxAndSocialLiabilities: 8000,
      otherPayables: 4392, derivativeLiabilities: 0,
    },
    incomeStatement: {
      revenueExternal: 125000, revenueInterco: 0,
      costOfSalesExternal: -50000, costOfSalesInterco: -12000,
      personnelCosts: -18000, rentAndLeases: -8000, marketingCosts: -5500,
      depreciationAmortization: -4200, royaltiesInterco: 0, otherOperatingExpenses: -6000,
      otherOperatingIncomeExpense: 0, goodwillImpairment: 0, disposalGainLoss: 0,
      financeIncome: 500, financeCosts: -2800, fxGainLoss: -200, dividendsInterco: 0,
      incomeTax: -1692, deferredTax: 0,
    },
  },
];

// ============================================================
// MOTEUR DE CALCUL
// ============================================================

// Raw Excel data stored after hydration
export interface ExcelHydrationData {
  multiCurrency?: NeuralComputedResults['multiCurrency'];
  inventory?: NeuralComputedResults['inventory'];
  royalty?: NeuralComputedResults['royalty'];
  consolidation?: Partial<NeuralComputedResults['consolidation']>;
  // Raw parsed data for display on agent pages
  raw?: {
    consolidation?: unknown;
    inventaire?: unknown;
    multiCurrency?: unknown;
  };
}

export class NeuralStore {
  private params: NeuralGlobalParams;
  private entities: EntityFinancials[];
  private listeners: Set<() => void> = new Set();
  private excelData: ExcelHydrationData | null = null;
  private _rawExcel: unknown = null;

  constructor() {
    this.params = this.createDefaultParams();
    this.entities = DEFAULT_ENTITIES;
  }

  // Hydrate the store with real Excel data from /api/data
  hydrateFromExcel(apiResponse: {
    consolidation: { consolidatedBS: { totalAssets: number; totalEquityGroup: number; totalNCI: number };
                     consolidatedPL: { consolidatedRevenue: number; consolidatedNetIncome: number; groupShare: number; nciShare: number } };
    inventaire: { dashboard: { stockBrut: number }; nrvTests: Array<{ provision: number }>;
                  margins: Array<{ tauxMarge: number }> };
    multiCurrency: { summary: { totalPnlImpact: number; jvPortefeuille: number; partieEfficace: number; partieInefficace: number };
                     effectiveness: Array<{ partieEfficace: number; partieInefficace: number }> };
  }): void {
    const inv = apiResponse.inventaire;
    const mc = apiResponse.multiCurrency;
    const conso = apiResponse.consolidation;

    const totalProvision = inv.nrvTests.reduce((s, t) => s + (t.provision || 0), 0);
    const avgMargin = inv.margins.length > 0
      ? inv.margins.reduce((s, m) => s + (m.tauxMarge || 0), 0) / inv.margins.length
      : 0;

    this.excelData = {
      multiCurrency: {
        totalPnLImpact: mc.summary.totalPnlImpact || -42958,
        totalOCIImpact: 0,
        hedgingFairValue: mc.summary.jvPortefeuille || 136470,
        hedgingEffectivePart: mc.summary.partieEfficace || 122886,
        hedgingIneffectivePart: mc.summary.partieInefficace || 13584,
      },
      inventory: {
        netInventoryValue: inv.dashboard.stockBrut - totalProvision,
        totalImpairment: totalProvision,
        avgMarginOnFinishedGoods: avgMargin > 1 ? avgMargin / 100 : avgMargin,
      },
      royalty: {
        totalGrossRoyalties: 62050,
        totalWithholdingTax: 3325,
        totalNetRoyalties: 58725,
      },
      consolidation: {
        consolidatedRevenue: conso.consolidatedPL.consolidatedRevenue || undefined,
        consolidatedNetIncome: conso.consolidatedPL.consolidatedNetIncome || undefined,
        groupShare: conso.consolidatedPL.groupShare || undefined,
        nciShare: conso.consolidatedPL.nciShare || undefined,
        totalAssets: conso.consolidatedBS.totalAssets || undefined,
        totalEquityGroup: conso.consolidatedBS.totalEquityGroup || undefined,
        totalNCI: conso.consolidatedBS.totalNCI || undefined,
      },
      raw: apiResponse as unknown as ExcelHydrationData['raw'],
    };
    this._rawExcel = apiResponse;
    this.notify();
  }

  getRawExcel(): unknown { return this._rawExcel; }
  isHydrated(): boolean { return this.excelData !== null; }

  private createDefaultParams(): NeuralGlobalParams {
    return {
      groupName: 'Maison Aurelia',
      parentEntity: 'Maison Aurelia SAS',
      functionalCurrency: 'EUR',
      fiscalYearStart: '2025-04-01',
      fiscalYearEnd: '2026-03-31',
      closingDate: '2026-03-31',
      exchangeRates: buildRateSet(MONTHLY_RATES),
      taxRates: {
        'France':     { corporateTaxRate: 0.25,   withholdingDividends: 0,    withholdingRoyalties: 0,    withholdingInterest: 0, convention: '' },
        'Italie':     { corporateTaxRate: 0.24,   withholdingDividends: 0.05, withholdingRoyalties: 0.05, withholdingInterest: 0, convention: 'EU Directive' },
        'États-Unis': { corporateTaxRate: 0.21,   withholdingDividends: 0.05, withholdingRoyalties: 0,    withholdingInterest: 0, convention: 'FR-US 1994' },
        'Japon':      { corporateTaxRate: 0.3062, withholdingDividends: 0.05, withholdingRoyalties: 0,    withholdingInterest: 0, convention: 'FR-JP 1995' },
        'Suisse':     { corporateTaxRate: 0.14,   withholdingDividends: 0.05, withholdingRoyalties: 0.05, withholdingInterest: 0, convention: 'FR-CH 1966' },
        'Chine':      { corporateTaxRate: 0.25,   withholdingDividends: 0.05, withholdingRoyalties: 0.06, withholdingInterest: 0, convention: 'FR-CN 2013' },
        'EAU':        { corporateTaxRate: 0.09,   withholdingDividends: 0,    withholdingRoyalties: 0,    withholdingInterest: 0, convention: 'FR-EAU 1989' },
      },
      consolidation: { goodwillMethod: 'partial', wacc: 0.085, terminalGrowthRate: 0.02, planHorizon: 5 },
    };
  }

  // --- Accesseurs ---
  getParams(): NeuralGlobalParams { return this.params; }
  getEntities(): EntityFinancials[] { return this.entities; }

  getRate(ccy: string, type: 'closing' | 'average' | 'opening' | 'historical'): number {
    if (ccy === 'EUR') return 1;
    return this.params.exchangeRates[type]?.[ccy] ?? 1;
  }

  convertToEUR(amount: number, currency: string, rateType: 'closing' | 'average'): number {
    if (currency === 'EUR') return amount;
    const rate = this.getRate(currency, rateType);
    return Math.round((amount / rate) * 100) / 100;
  }

  // --- Goodwill ---
  computeGoodwill(): GoodwillData[] {
    const goodwillAcquisitions: Array<{
      code: string; name: string; date: string; pct: number;
      price: number; fvNetAssets: number; currency: string;
    }> = [
      { code: 'AU-IT', name: 'Aurelia Italia SpA',     date: '2015-09-15', pct: 0.95, price: 385000, fvNetAssets: 340000, currency: 'EUR' },
      { code: 'AU-US', name: 'Aurelia USA Inc.',        date: '2017-03-01', pct: 1.00, price: 142000, fvNetAssets: 98000,  currency: 'USD' },
      { code: 'AU-JP', name: 'Aurelia Japan KK',        date: '2018-07-01', pct: 0.80, price: 95000,  fvNetAssets: 62000,  currency: 'JPY' },
      { code: 'AU-CN', name: 'Aurelia China Ltd',       date: '2020-06-15', pct: 0.70, price: 48000,  fvNetAssets: 35000,  currency: 'CNY' },
      { code: 'AU-AE', name: 'Aurelia Middle East FZE', date: '2022-09-01', pct: 1.00, price: 18000,  fvNetAssets: 12500,  currency: 'AED' },
    ];

    const method = this.params.consolidation.goodwillMethod;

    return goodwillAcquisitions.map(acq => {
      const nci = method === 'partial'
        ? (1 - acq.pct) * acq.fvNetAssets
        : (1 - acq.pct) * (acq.price / acq.pct);
      const gwInitial = acq.price + nci + 0 - acq.fvNetAssets;

      const histRate = this.getRate(acq.currency, 'historical');
      const closRate = this.getRate(acq.currency, 'closing');
      const gwInCcy = acq.currency === 'EUR' ? gwInitial : gwInitial * histRate;
      const gwConverted = acq.currency === 'EUR' ? gwInitial : Math.round(gwInCcy / closRate);

      return {
        entityCode: acq.code,
        entityName: acq.name,
        acquisitionDate: acq.date,
        pctAcquired: acq.pct,
        purchasePrice: acq.price,
        nciAtAcquisition: Math.round(nci),
        priorParticipation: 0,
        fairValueNetAssets: acq.fvNetAssets,
        goodwillInitial: Math.round(gwInitial),
        currency: acq.currency,
        goodwillInCurrency: Math.round(gwInCcy),
        closingRate: closRate,
        goodwillConverted: gwConverted,
      };
    });
  }

  // --- Test IAS 36 ---
  computeImpairmentTests(): ImpairmentTest[] {
    const goodwills = this.computeGoodwill();
    const { wacc, terminalGrowthRate: g } = this.params.consolidation;

    const ugtFlows: Array<{ name: string; gwCode: string; netAssets: number; flows: number[] }> = [
      { name: 'Maroquinerie Italie', gwCode: 'AU-IT', netAssets: 343000, flows: [65000, 70000, 75000, 78000, 82000] },
      { name: 'Distribution USA',   gwCode: 'AU-US', netAssets: 428800, flows: [55000, 60000, 65000, 68000, 72000] },
      { name: 'Distribution Japon', gwCode: 'AU-JP', netAssets: 260000, flows: [28000, 31000, 34000, 36000, 38000] },
      { name: 'Distribution Chine', gwCode: 'AU-CN', netAssets: 234810, flows: [35000, 40000, 45000, 48000, 52000] },
      { name: 'Distribution Dubai', gwCode: 'AU-AE', netAssets: 84108,  flows: [22000, 25000, 28000, 30000, 32000] },
    ];

    return ugtFlows.map(ugt => {
      const gw = goodwills.find(gw => gw.entityCode === ugt.gwCode);
      const gwAllocated = gw?.goodwillConverted ?? 0;
      const carryingValue = gwAllocated + ugt.netAssets;

      const lastFlow = ugt.flows[ugt.flows.length - 1];
      const terminalValue = (wacc > g) ? lastFlow * (1 + g) / (wacc - g) : lastFlow * 20;

      let npv = 0;
      ugt.flows.forEach((cf, i) => { npv += cf / Math.pow(1 + wacc, i + 1); });
      npv += terminalValue / Math.pow(1 + wacc, ugt.flows.length);
      npv = Math.round(npv);

      const surplus = npv - carryingValue;
      const impairment = surplus < 0 ? Math.min(Math.abs(surplus), gwAllocated) : 0;

      return {
        ugtName: ugt.name,
        goodwillAllocated: gwAllocated,
        netAssetsUGT: ugt.netAssets,
        carryingValue,
        cashFlows: ugt.flows,
        terminalValue: Math.round(terminalValue),
        npv,
        recoverableAmount: npv,
        surplus: Math.round(surplus),
        impairment,
      };
    });
  }

  // --- Résultats consolidés ---
  computeResults(): NeuralComputedResults {
    const goodwills = this.computeGoodwill();
    const tests = this.computeImpairmentTests();
    const totalGW = goodwills.reduce((s, g) => s + g.goodwillConverted, 0);
    const totalImpairment = tests.reduce((s, t) => s + t.impairment, 0);

    const igEntities = this.entities.filter(e => e.method === 'IG' || e.method === 'Mère');

    let sumRevenue = 0;
    let sumIntercoRevenue = 0;
    let sumNetIncome = 0;

    igEntities.forEach(ent => {
      const is = ent.incomeStatement;
      const netIncome = is.revenueExternal + is.revenueInterco
        + is.costOfSalesExternal + is.costOfSalesInterco
        + is.personnelCosts + is.rentAndLeases + is.marketingCosts
        + is.depreciationAmortization + is.royaltiesInterco + is.otherOperatingExpenses
        + is.otherOperatingIncomeExpense + is.goodwillImpairment + is.disposalGainLoss
        + is.financeIncome + is.financeCosts + is.fxGainLoss + is.dividendsInterco
        + is.incomeTax + is.deferredTax;

      const revEUR = this.convertToEUR(is.revenueExternal + is.revenueInterco, ent.currency, 'average');
      const intercoEUR = this.convertToEUR(is.revenueInterco, ent.currency, 'average');
      const niEUR = this.convertToEUR(netIncome, ent.currency, 'average');

      sumRevenue += revEUR;
      sumIntercoRevenue += intercoEUR;
      sumNetIncome += niEUR;
    });

    const nciEntities = igEntities.filter(e => e.ownershipPct < 1);
    let nciShareIncome = 0;
    nciEntities.forEach(ent => {
      const is = ent.incomeStatement;
      const ni = is.revenueExternal + is.revenueInterco
        + is.costOfSalesExternal + is.costOfSalesInterco
        + is.personnelCosts + is.rentAndLeases + is.marketingCosts
        + is.depreciationAmortization + is.royaltiesInterco + is.otherOperatingExpenses
        + is.financeIncome + is.financeCosts + is.fxGainLoss
        + is.incomeTax + is.deferredTax;
      const niEUR = this.convertToEUR(ni, ent.currency, 'average');
      nciShareIncome += niEUR * (1 - ent.ownershipPct);
    });

    const consolidatedRevenue = Math.round(sumRevenue - sumIntercoRevenue);
    const groupShare = Math.round(sumNetIncome - nciShareIncome);

    return {
      multiCurrency: this.excelData?.multiCurrency ?? {
        totalPnLImpact: 550,
        totalOCIImpact: -12500,
        hedgingFairValue: 49553,
        hedgingEffectivePart: 45200,
        hedgingIneffectivePart: 4353,
      },
      inventory: this.excelData?.inventory ?? {
        netInventoryValue: 4147200,
        totalImpairment: 36000,
        avgMarginOnFinishedGoods: 0.78,
      },
      royalty: this.excelData?.royalty ?? {
        totalGrossRoyalties: 62050,
        totalWithholdingTax: 3325,
        totalNetRoyalties: 58725,
      },
      consolidation: {
        consolidatedRevenue: this.excelData?.consolidation?.consolidatedRevenue ?? consolidatedRevenue,
        consolidatedNetIncome: this.excelData?.consolidation?.consolidatedNetIncome ?? Math.round(sumNetIncome),
        groupShare: this.excelData?.consolidation?.groupShare ?? groupShare,
        nciShare: this.excelData?.consolidation?.nciShare ?? Math.round(nciShareIncome),
        totalAssets: this.excelData?.consolidation?.totalAssets ?? 5890000,
        totalEquityGroup: this.excelData?.consolidation?.totalEquityGroup ?? 2150000,
        totalNCI: this.excelData?.consolidation?.totalNCI ?? 185000,
        goodwillNet: totalGW - totalImpairment,
        totalGoodwillImpairment: totalImpairment,
        translationDifferences: this.excelData?.consolidation?.translationDifferences ?? -8200,
        eliminationsCount: this.excelData?.consolidation?.eliminationsCount ?? 12,
      },
    };
  }

  getInterAgentFlow(): InterAgentDataFlow {
    const results = this.computeResults();
    return {
      closingRates: this.params.exchangeRates.closing,
      averageRates: this.params.exchangeRates.average,
      fxPnLImpact: results.multiCurrency.totalPnLImpact,
      hedgingOCI: results.multiCurrency.hedgingEffectivePart,
      derivativeAssets: Math.max(0, results.multiCurrency.hedgingFairValue),
      derivativeLiabilities: Math.min(0, results.multiCurrency.hedgingFairValue),
      parentInventoryValue: results.inventory.netInventoryValue,
      internalMarginRate: results.inventory.avgMarginOnFinishedGoods,
      royaltyElimination: results.royalty.totalGrossRoyalties,
      royaltyByEntity: [
        { licenseeCode: 'AU-US', grossAmount: 28800, currency: 'USD' },
        { licenseeCode: 'AU-JP', grossAmount: 18850, currency: 'JPY' },
        { licenseeCode: 'AU-IT', grossAmount: 14400, currency: 'EUR' },
      ],
    };
  }

  // --- Mise à jour ---
  updateParams(updates: Partial<NeuralGlobalParams>): void {
    this.params = { ...this.params, ...updates };
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }
}

// Singleton
let instance: NeuralStore | null = null;
export function getNeuralStore(): NeuralStore {
  if (!instance) instance = new NeuralStore();
  return instance;
}
