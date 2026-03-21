// ================================================================
// lib/calculs/defense.ts
// 6 calculateurs pour le module Défense & Drones
// ================================================================

import type {
  TCOInput, TCOResult,
  CPEInput, CPEResult,
  WargameInput, WargameResult,
} from '@/lib/types/defense';

// ─── 1. COURBE D'APPRENTISSAGE DE WRIGHT ──────────────────────
function learningCurveCost(firstUnitCost: number, unitNumber: number, learningRate: number): number {
  const exponent = Math.log(learningRate) / Math.log(2);
  return firstUnitCost * Math.pow(unitNumber, exponent);
}

function cumulativeCost(firstUnitCost: number, totalUnits: number, learningRate: number): number {
  let total = 0;
  for (let i = 1; i <= totalUnits; i++) {
    total += learningCurveCost(firstUnitCost, i, learningRate);
  }
  return total;
}

function averageUnitCost(firstUnitCost: number, totalUnits: number, learningRate: number): number {
  return totalUnits > 0 ? cumulativeCost(firstUnitCost, totalUnits, learningRate) / totalUnits : firstUnitCost;
}

export function generateLearningCurveData(
  firstUnitCost: number, maxUnits: number, learningRate: number, steps = 40
): { unit: number; cost: number; avgCost: number }[] {
  const data: { unit: number; cost: number; avgCost: number }[] = [];
  const step = Math.max(1, Math.floor(maxUnits / steps));
  for (let n = 1; n <= maxUnits; n += step) {
    data.push({
      unit: n,
      cost: Math.round(learningCurveCost(firstUnitCost, n, learningRate)),
      avgCost: Math.round(averageUnitCost(firstUnitCost, n, learningRate)),
    });
  }
  return data;
}

// ─── 2. CALCULATEUR TCO ───────────────────────────────────────
export function calculateTCO(input: TCOInput): TCOResult {
  const adjustedAcquisitionCost = cumulativeCost(input.unitCost, input.quantity, input.learningRate);
  const linearAcquisitionCost = input.unitCost * input.quantity;
  const totalTraining = input.trainingCostPerUnit * input.quantity;

  let totalMCO = 0;
  let replacementCost = 0;

  if (!input.isConsumable) {
    let activeFleet = input.quantity;
    for (let year = 1; year <= input.yearsOfService; year++) {
      const inflationFactor = Math.pow(1 + input.inflationRate, year);
      totalMCO += activeFleet * input.unitCost * (input.mcoAnnualPct / 100) * inflationFactor;
      const losses = Math.floor(activeFleet * (input.attritionRateAnnual / 100));
      replacementCost += losses * learningCurveCost(input.unitCost, input.quantity + losses * year, input.learningRate) * inflationFactor;
      activeFleet = Math.max(0, activeFleet - losses);
    }
  }

  const totalTCO = adjustedAcquisitionCost + totalMCO + totalTraining + replacementCost;

  const breakdown = [
    { label: 'Acquisition', value: adjustedAcquisitionCost, pct: 0 },
    { label: 'MCO', value: totalMCO, pct: 0 },
    { label: 'Formation', value: totalTraining, pct: 0 },
    { label: 'Remplacement', value: replacementCost, pct: 0 },
  ];
  for (const b of breakdown) b.pct = totalTCO > 0 ? (b.value / totalTCO) * 100 : 0;

  return {
    acquisitionCost: linearAcquisitionCost,
    adjustedAcquisitionCost,
    totalMCO,
    totalTraining,
    replacementCost,
    totalTCO,
    tcoPerUnit: input.quantity > 0 ? totalTCO / input.quantity : 0,
    tcoPerYear: input.yearsOfService > 0 ? totalTCO / input.yearsOfService : 0,
    savingsVsLinear: linearAcquisitionCost - adjustedAcquisitionCost,
    learningCurveData: generateLearningCurveData(input.unitCost, input.quantity, input.learningRate),
    tcoBreakdown: breakdown,
  };
}

// ─── 3. CALCULATEUR CPE (Coût Par Effet) ──────────────────────
export function calculateCPE(input: CPEInput): CPEResult {
  const pKill = input.pHit * input.pKillGivenHit;
  const costPerKill = pKill > 0 ? input.munitionCost / pKill : Infinity;
  const cpe = input.targetValue > 0 ? costPerKill / input.targetValue : Infinity;
  const exchangeRatio = costPerKill > 0 ? input.targetValue / costPerKill : 0;
  const expectedKillsPerMillion = costPerKill > 0 ? 1_000_000 / costPerKill : 0;

  return {
    cpe,
    exchangeRatio,
    costPerKill,
    expectedKillsPerMillion,
    isEconomicallyViable: cpe < 1,
  };
}

// ─── 4. MOTEUR WARGAME ────────────────────────────────────────
export function runWargame(input: WargameInput): WargameResult {
  const totalAttackCost = input.attackSystems.reduce((s, a) => s + a.quantity * a.unitCost, 0);
  let remainingThreats = input.attackSystems.reduce((s, a) => s + a.quantity, 0);
  const threatsLaunched = remainingThreats;
  let totalDefenseCost = 0;
  const phaseBreakdown: WargameResult['phaseBreakdown'] = [];

  for (const def of input.defenseSystems) {
    const threatsIn = remainingThreats;
    const engagements = Math.min(def.quantity * def.maxEngagements, remainingThreats);
    const intercepted = Math.floor(engagements * def.pIntercept);
    const phaseCost = engagements * def.unitCost;
    remainingThreats -= intercepted;
    totalDefenseCost += phaseCost;
    phaseBreakdown.push({ phase: def.name, threatsIn, threatsOut: remainingThreats, intercepted, cost: phaseCost });
  }

  const threatsPenetrating = remainingThreats;
  const totalTargetValue = input.targets.reduce((s, t) => s + t.value * t.quantity, 0);
  const totalTargetQty = input.targets.reduce((s, t) => s + t.quantity, 0);
  const avgPKill = threatsLaunched > 0
    ? input.attackSystems.reduce((s, a) => s + a.pHit * a.pKill * a.quantity, 0) / threatsLaunched
    : 0;
  const avgHardness = input.targets.length > 0
    ? input.targets.reduce((s, t) => s + t.hardness, 0) / input.targets.length
    : 0;
  const damageRatio = Math.min(1, totalTargetQty > 0 ? (threatsPenetrating * avgPKill) / totalTargetQty : 0);
  const expectedDamageValue = totalTargetValue * damageRatio * (1 - avgHardness);

  const attackerRatio = totalAttackCost > 0 ? expectedDamageValue / totalAttackCost : 0;
  const defenderRatio = totalDefenseCost > 0 ? (totalTargetValue - expectedDamageValue) / totalDefenseCost : 0;

  let conclusion = '';
  if (attackerRatio > 10) conclusion = 'Avantage \u00E9crasant attaquant';
  else if (attackerRatio > 3) conclusion = 'Avantage significatif attaquant';
  else if (attackerRatio > 1) conclusion = 'Avantage mod\u00E9r\u00E9 attaquant';
  else if (attackerRatio > 0.5) conclusion = 'Engagement contest\u00E9';
  else conclusion = 'Avantage d\u00E9fenseur';

  return {
    totalAttackCost, totalDefenseCost, threatsLaunched,
    threatsIntercepted: threatsLaunched - threatsPenetrating,
    threatsPenetrating, expectedDamageValue, attackerRatio, defenderRatio,
    conclusion, phaseBreakdown,
  };
}

// ─── 5. INFLATION DÉFENSE ─────────────────────────────────────
const DEFENSE_INFLATION: Record<string, number> = {
  US: 0.035, EU: 0.036, TUR: 0.25, RUS: 0.10, CHN: 0.03, DEFAULT: 0.033,
};

export function adjustForInflation(baseCost: number, baseYear: number, targetYear: number, region = 'DEFAULT'): number {
  const rate = DEFENSE_INFLATION[region] ?? DEFENSE_INFLATION.DEFAULT;
  return baseCost * Math.pow(1 + rate, targetYear - baseYear);
}

// ─── 6. SURGE CAPACITY ───────────────────────────────────────
export function calculateSurgeTimeline(
  currentCapacity: number, targetCapacity: number, complexityFactor: number, months = 18
): { monthlyCapacity: number[]; monthToTarget: number; feasible: boolean; bottleneck: string } {
  const doublingTime = complexityFactor * 6;
  const monthlyCapacity: number[] = [];
  let current = currentCapacity;
  for (let m = 1; m <= months; m++) {
    current = Math.min(current + current * (Math.log(2) / doublingTime), targetCapacity);
    monthlyCapacity.push(Math.round(current));
  }
  const monthToTarget = monthlyCapacity.findIndex(c => c >= targetCapacity) + 1;
  return {
    monthlyCapacity,
    monthToTarget: monthToTarget || -1,
    feasible: monthToTarget > 0,
    bottleneck: complexityFactor >= 3
      ? 'Composants certifi\u00E9s / personnel qualifi\u00E9'
      : complexityFactor >= 2
        ? 'Supply chain composants'
        : 'Scaling lin\u00E9aire possible',
  };
}
