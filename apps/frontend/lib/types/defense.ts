// ================================================================
// lib/types/defense.ts
// Types complets pour le module Défense & Drones
// ================================================================

export type SystemCategory =
  | 'FPV' | 'Loitering_Munition' | 'MALE' | 'HALE' | 'UCAV'
  | 'Loyal_Wingman' | 'Naval_USV' | 'UGV'
  | 'C-UAS_Kinetic' | 'C-UAS_Laser' | 'C-UAS_EW'
  | 'Missile_Cruise' | 'SAM' | 'Nano_Micro';

export type SystemStatus =
  | 'Concept' | 'Development' | 'Prototype' | 'Testing'
  | 'Production' | 'Operational' | 'Combat_Proven' | 'Retired';

export type PropulsionType =
  | 'Electric' | 'Piston' | 'Turboprop' | 'Turbojet'
  | 'Turbofan' | 'Rocket' | 'Ramjet' | 'Hybrid' | 'None';

export interface SystemScores {
  cost: number;
  range: number;
  precision: number;
  stealth: number;
  ai_autonomy: number;
  ew_resistance: number;
  scalability: number;
  combat_proven: number;
}

export interface DefenseSystem {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  manufacturer: string;
  category: SystemCategory;
  status: SystemStatus;
  specs: {
    mass_kg: number;
    max_speed_kmh?: number;
    range_km: number;
    endurance_hours?: number;
    ceiling_m?: number;
    payload_kg?: number;
    warhead_kg?: number;
    propulsion: PropulsionType;
    guidance: string[];
  };
  costs: {
    unit_cost_usd: number;
    unit_cost_display: string;
    mco_annual_pct?: number;
    learning_rate?: number;
    training_cost_usd?: number;
  };
  scores: SystemScores;
  operational: {
    combat_proven: boolean;
    conflicts_used?: string[];
    operators: string[];
    total_produced?: number;
    attrition_rate?: number;
  };
  supply_chain: {
    critical_components: number;
    max_dependency_pct: number;
    main_dependency_country: string;
    weak_point: string;
  };
  description: string;
}

export interface TCOInput {
  unitCost: number;
  quantity: number;
  learningRate: number;
  mcoAnnualPct: number;
  trainingCostPerUnit: number;
  attritionRateAnnual: number;
  yearsOfService: number;
  inflationRate: number;
  isConsumable: boolean;
}

export interface TCOResult {
  acquisitionCost: number;
  adjustedAcquisitionCost: number;
  totalMCO: number;
  totalTraining: number;
  replacementCost: number;
  totalTCO: number;
  tcoPerUnit: number;
  tcoPerYear: number;
  savingsVsLinear: number;
  learningCurveData: { unit: number; cost: number; avgCost: number }[];
  tcoBreakdown: { label: string; value: number; pct: number }[];
}

export interface CPEInput {
  munitionCost: number;
  pHit: number;
  pKillGivenHit: number;
  targetValue: number;
}

export interface CPEResult {
  cpe: number;
  exchangeRatio: number;
  costPerKill: number;
  expectedKillsPerMillion: number;
  isEconomicallyViable: boolean;
}

export interface WargameAttacker {
  systemId: string;
  name: string;
  quantity: number;
  unitCost: number;
  pHit: number;
  pKill: number;
}

export interface WargameDefender {
  systemId: string;
  name: string;
  quantity: number;
  unitCost: number;
  pIntercept: number;
  maxEngagements: number;
}

export interface WargameTarget {
  name: string;
  value: number;
  quantity: number;
  hardness: number;
}

export interface WargameInput {
  attackSystems: WargameAttacker[];
  defenseSystems: WargameDefender[];
  targets: WargameTarget[];
}

export interface WargamePhase {
  phase: string;
  threatsIn: number;
  threatsOut: number;
  intercepted: number;
  cost: number;
}

export interface WargameResult {
  totalAttackCost: number;
  totalDefenseCost: number;
  threatsLaunched: number;
  threatsIntercepted: number;
  threatsPenetrating: number;
  expectedDamageValue: number;
  attackerRatio: number;
  defenderRatio: number;
  conclusion: string;
  phaseBreakdown: WargamePhase[];
}

export interface CriticalMaterial {
  id: string;
  name: string;
  defense_usage: string;
  world_production_tons: number;
  china_share_pct: number;
  west_share_pct: number;
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low';
  substitution_delay_months: number;
  alternative: string;
}

export interface StockEntry {
  id: string;
  country: string;
  system_name: string;
  system_id: string;
  estimated_stock: number;
  monthly_production: number;
  annual_production: number;
  surge_capacity_18m: number;
  monthly_wartime_consumption?: number;
  months_of_stock_wartime?: number;
  limiting_factor: string;
  confidence_level: number;
}

export interface Doctrine {
  country: string;
  countryCode: string;
  dronization_level: number;
  employment_concept: string;
  budget_2025_bds: number;
  pct_gdp_2025: number;
  drone_share_pct: number;
  objective_2030_pct: number;
  strategic_focus: string;
  key_systems: string[];
}

export type Mission = 'ISR / Surveillance' | 'Frappe de pr\u00E9cision' | 'Lutte anti-drone (C-UAS)' | 'Appui logistique';
export type Theatre = "Europe de l'Est" | 'Moyen-Orient' | 'Mer de Chine m\u00E9ridionale' | 'Sahel';
