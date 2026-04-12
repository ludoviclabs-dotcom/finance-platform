export type ScreenId = "overview" | "scopes" | "kpis" | "postes" | "actions" | "rapports";

export const HOTSPOT_TO_SCREEN: Record<string, ScreenId> = {
  scopes: "scopes",
  kpis: "kpis",
  postes: "postes",
  actions: "actions",
  rapports: "rapports",
};

export const KPI_DATA = [
  { label: "Total tCO2e", value: "12 847", change: "-12%", color: "#16a34a", trend: [85, 82, 78, 72, 68, 62] },
  { label: "Scope 1", value: "3 210", change: "-8%", color: "#0891b2", trend: [30, 29, 28, 26, 25, 24] },
  { label: "Scope 2", value: "2 415", change: "-18%", color: "#7c3aed", trend: [25, 23, 20, 18, 17, 15] },
  { label: "Scope 3", value: "7 222", change: "-9%", color: "#ea580c", trend: [55, 53, 50, 48, 46, 44] },
];

export const SCOPE_DATA = [
  { name: "Scope 1 – Direct", value: 3210, pct: 25, color: "#0891b2", details: "Combustion fixe et mobile, fuites de gaz" },
  { name: "Scope 2 – Energie", value: 2415, pct: 19, color: "#7c3aed", details: "Electricite, chaleur, vapeur achetees" },
  { name: "Scope 3 – Indirect", value: 7222, pct: 56, color: "#ea580c", details: "Achats, transport, deplacements, numerique" },
];

export const POSTES_DATA = [
  { name: "Energie", pct: 28, value: "3 597", color: "#16a34a", icon: "⚡" },
  { name: "Transport", pct: 34, value: "4 368", color: "#0891b2", icon: "🚛" },
  { name: "Achats", pct: 22, value: "2 826", color: "#7c3aed", icon: "📦" },
  { name: "Numerique", pct: 16, value: "2 056", color: "#ea580c", icon: "💻" },
];

export const ACTIONS_DATA = [
  { text: "Migrer vers electricite verte", impact: "-840 tCO2e", priority: "Haute", status: "En cours", progress: 65, color: "#16a34a" },
  { text: "Optimiser flotte vehicules", impact: "-520 tCO2e", priority: "Moyenne", status: "Planifie", progress: 20, color: "#0891b2" },
  { text: "Reduire deplacements pro", impact: "-310 tCO2e", priority: "Haute", status: "En cours", progress: 45, color: "#7c3aed" },
  { text: "Serveurs cloud optimises", impact: "-180 tCO2e", priority: "Basse", status: "A venir", progress: 0, color: "#ea580c" },
];

export const RAPPORTS_DATA = [
  { name: "E1 – Climat", status: "Pret", date: "12 avr. 2026", progress: 100, color: "#16a34a" },
  { name: "S1 – Social", status: "Pret", date: "10 avr. 2026", progress: 100, color: "#0891b2" },
  { name: "G1 – Gouvernance", status: "Pret", date: "8 avr. 2026", progress: 100, color: "#7c3aed" },
  { name: "E2 – Pollution", status: "En cours", date: "—", progress: 72, color: "#ea580c" },
];
