export interface RoiInputs {
  sector: string;
  branches: string[];
  users: number;
  frequency: string;
}

export interface RoiTier {
  label: string;
  basePrice: number;
  perBranchPrice: number;
}

export interface RoiResult {
  tier: RoiTier;
  neuralMonthly: number;
  hoursSavedMonth: number;
  monthlySavings: number;
  etpEquivalent: number;
  monthlyRoi: number;
  paybackMonths: number;
  roiPct: number;
  activeUsers: number;
}

export const ROI_SECTORS = [
  { id: "luxe", label: "Luxe / Mode" },
  { id: "transport", label: "Transport / Logistique" },
  { id: "aero", label: "Aéronautique / Défense" },
  { id: "banque", label: "Banque / Asset Management" },
  { id: "assurance", label: "Assurance / Mutuelle" },
  { id: "saas", label: "SaaS / Tech" },
] as const;

export const ROI_BRANCHES = [
  { id: "finance", label: "Finance / Comptabilité", impact: 1.2 },
  { id: "rh", label: "Ressources Humaines", impact: 1.1 },
  { id: "marketing", label: "Marketing", impact: 1.0 },
  { id: "communication", label: "Communication", impact: 1.0 },
  { id: "supply-chain", label: "Supply Chain", impact: 1.15 },
  { id: "si", label: "Systèmes d'Information", impact: 0.95 },
  { id: "comptabilite", label: "Comptabilité spécialisée", impact: 1.1 },
] as const;

export const ROI_FREQUENCIES = [
  {
    id: "occasionnel",
    label: "Occasionnel",
    description: "Quelques fois par semaine, ponctuel",
    hoursPerUserMonth: 1.5,
  },
  {
    id: "regulier",
    label: "Régulier",
    description: "Quotidien sur des tâches structurées",
    hoursPerUserMonth: 4,
  },
  {
    id: "intensif",
    label: "Intensif",
    description: "Workflow opérationnel critique, multi-fois par jour",
    hoursPerUserMonth: 10,
  },
] as const;

export const ETP_HOURLY_LOADED = 38; // €/h chargé moyen mid-cap français

export function getForfaitTier(users: number): RoiTier {
  if (users < 500) {
    return { label: "Starter — AI Essentials", basePrice: 800, perBranchPrice: 200 };
  }
  if (users < 2000) {
    return { label: "Business — AI Accelerator", basePrice: 9500, perBranchPrice: 1500 };
  }
  return { label: "Enterprise — AI Transformation", basePrice: 65000, perBranchPrice: 8000 };
}

export function computeRoi(inputs: RoiInputs): RoiResult {
  const tier = getForfaitTier(inputs.users);
  const brancheCount = inputs.branches.length;

  const brancheImpact =
    inputs.branches
      .map((id) => ROI_BRANCHES.find((b) => b.id === id)?.impact ?? 1)
      .reduce((acc, v) => acc + v, 0) / Math.max(brancheCount, 1);

  const freq = ROI_FREQUENCIES.find((f) => f.id === inputs.frequency);
  const hoursPerUserMonth = freq?.hoursPerUserMonth ?? 4;

  const neuralMonthly = tier.basePrice + brancheCount * tier.perBranchPrice;

  const adoptionRate = 0.35;
  const activeUsers = inputs.users * adoptionRate;
  const hoursSavedMonth = activeUsers * brancheCount * hoursPerUserMonth * brancheImpact;

  const monthlySavings = hoursSavedMonth * ETP_HOURLY_LOADED;

  const etpEquivalent = hoursSavedMonth / 150;

  const monthlyRoi = monthlySavings - neuralMonthly;

  const setupCost = neuralMonthly * 2;
  const paybackMonths = monthlyRoi > 0 ? Math.ceil(setupCost / monthlyRoi) : Number.POSITIVE_INFINITY;

  const annualSavings = monthlySavings * 12;
  const annualCost = neuralMonthly * 12 + setupCost;
  const roiPct = ((annualSavings - annualCost) / annualCost) * 100;

  return {
    tier,
    neuralMonthly,
    hoursSavedMonth: Math.round(hoursSavedMonth),
    monthlySavings: Math.round(monthlySavings),
    etpEquivalent: Math.round(etpEquivalent * 10) / 10,
    monthlyRoi: Math.round(monthlyRoi),
    paybackMonths,
    roiPct: Math.round(roiPct),
    activeUsers: Math.round(activeUsers),
  };
}

export function describeRoiInputs(inputs: RoiInputs): Array<{ key: string; value: string }> {
  const sector = ROI_SECTORS.find((s) => s.id === inputs.sector)?.label ?? inputs.sector;
  const branches = inputs.branches
    .map((id) => ROI_BRANCHES.find((b) => b.id === id)?.label ?? id)
    .join(", ");
  const freq = ROI_FREQUENCIES.find((f) => f.id === inputs.frequency);
  return [
    { key: "Secteur", value: sector },
    { key: "Branches activées", value: branches || "—" },
    { key: "Utilisateurs cible", value: new Intl.NumberFormat("fr-FR").format(inputs.users) },
    { key: "Fréquence d'usage", value: freq ? `${freq.label} — ${freq.description}` : inputs.frequency },
  ];
}
