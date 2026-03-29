// ============================================================
// lib/neural-hub/types.ts
// NEURAL DATA HUB — Types globaux partagés par tous les agents
// ============================================================

export interface NeuralGlobalParams {
  groupName: string;
  parentEntity: string;
  functionalCurrency: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  closingDate: string;
  exchangeRates: ExchangeRateSet;
  taxRates: TaxRatesByCountry;
  consolidation: ConsolidationParams;
}

export interface ExchangeRateSet {
  closing: Record<string, number>;
  average: Record<string, number>;
  opening: Record<string, number>;
  historical: Record<string, number>;
  monthly: MonthlyRate[];
}

export interface MonthlyRate {
  month: string;
  date: string;
  rates: Record<string, number>;
}

export interface TaxRatesByCountry {
  [country: string]: {
    corporateTaxRate: number;
    withholdingDividends: number;
    withholdingRoyalties: number;
    withholdingInterest: number;
    convention: string;
  };
}

export interface ConsolidationParams {
  goodwillMethod: 'partial' | 'full';
  wacc: number;
  terminalGrowthRate: number;
  planHorizon: number;
}

export interface EntityFinancials {
  code: string;
  name: string;
  country: string;
  currency: string;
  ownershipPct: number;
  controlPct: number;
  method: 'Mère' | 'IG' | 'MEE';
  acquisitionDate: string;
  sector: string;
  balanceSheet: BalanceSheetData;
  incomeStatement: IncomeStatementData;
}

export interface BalanceSheetData {
  goodwill: number;
  intangibleAssets: number;
  tangibleAssets: number;
  rightOfUseAssets: number;
  investmentsInSubs: number;
  financialAssetsNC: number;
  deferredTaxAssets: number;
  intercoReceivablesNC: number;
  inventories: number;
  tradeReceivables: number;
  intercoReceivablesC: number;
  otherReceivables: number;
  prepaidExpenses: number;
  derivativeAssets: number;
  cashAndEquivalents: number;
  shareCapital: number;
  reserves: number;
  retainedEarnings: number;
  oci: number;
  borrowingsNC: number;
  leaseObligationsNC: number;
  provisionsNC: number;
  deferredTaxLiabilities: number;
  intercoPayablesNC: number;
  tradePayables: number;
  intercoPayablesC: number;
  taxAndSocialLiabilities: number;
  otherPayables: number;
  derivativeLiabilities: number;
}

export interface IncomeStatementData {
  revenueExternal: number;
  revenueInterco: number;
  costOfSalesExternal: number;
  costOfSalesInterco: number;
  personnelCosts: number;
  rentAndLeases: number;
  marketingCosts: number;
  depreciationAmortization: number;
  royaltiesInterco: number;
  otherOperatingExpenses: number;
  otherOperatingIncomeExpense: number;
  goodwillImpairment: number;
  disposalGainLoss: number;
  financeIncome: number;
  financeCosts: number;
  fxGainLoss: number;
  dividendsInterco: number;
  incomeTax: number;
  deferredTax: number;
}

export interface GoodwillData {
  entityCode: string;
  entityName: string;
  acquisitionDate: string;
  pctAcquired: number;
  purchasePrice: number;
  nciAtAcquisition: number;
  priorParticipation: number;
  fairValueNetAssets: number;
  goodwillInitial: number;
  currency: string;
  goodwillInCurrency: number;
  closingRate: number;
  goodwillConverted: number;
}

export interface ImpairmentTest {
  ugtName: string;
  goodwillAllocated: number;
  netAssetsUGT: number;
  carryingValue: number;
  cashFlows: number[];
  terminalValue: number;
  npv: number;
  recoverableAmount: number;
  surplus: number;
  impairment: number;
}

export interface InterAgentDataFlow {
  closingRates: Record<string, number>;
  averageRates: Record<string, number>;
  fxPnLImpact: number;
  hedgingOCI: number;
  derivativeAssets: number;
  derivativeLiabilities: number;
  parentInventoryValue: number;
  internalMarginRate: number;
  royaltyElimination: number;
  royaltyByEntity: Array<{
    licenseeCode: string;
    grossAmount: number;
    currency: string;
  }>;
}

export interface NeuralComputedResults {
  multiCurrency: {
    totalPnLImpact: number;
    totalOCIImpact: number;
    hedgingFairValue: number;
    hedgingEffectivePart: number;
    hedgingIneffectivePart: number;
  };
  inventory: {
    netInventoryValue: number;
    totalImpairment: number;
    avgMarginOnFinishedGoods: number;
  };
  royalty: {
    totalGrossRoyalties: number;
    totalWithholdingTax: number;
    totalNetRoyalties: number;
  };
  consolidation: {
    consolidatedRevenue: number;
    consolidatedNetIncome: number;
    groupShare: number;
    nciShare: number;
    totalAssets: number;
    totalEquityGroup: number;
    totalNCI: number;
    goodwillNet: number;
    totalGoodwillImpairment: number;
    translationDifferences: number;
    eliminationsCount: number;
  };
}
