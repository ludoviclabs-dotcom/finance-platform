/** Input payload for the POST /calculate/ma backend endpoint. */
export interface MAApiInput {
  targetRevenue: number;
  targetEbitdaMargin: number;
  entryMultiple: number;
  netDebt: number;
  synergyAmount: number;
  purchasePremiumPct: number;
}

/** Response from the POST /calculate/ma backend endpoint. */
export interface MAApiOutput {
  ebitda: number;
  enterpriseValue: number;
  adjustedEnterpriseValue: number;
  acquisitionPrice: number;
  equityValue: number;
}
