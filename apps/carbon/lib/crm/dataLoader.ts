// Abstraction source de données CRM — swapper l'import pour passer en mode live
// STATIC : lit le JSON local
// LIVE   : décommenter le fetch() et ajouter NEXT_PUBLIC_CRM_API_URL dans .env

export type Producer = { country: string; share_pct: number };
export type PriceSnapshot = { date: string; value: number; unit: string; trend_3m_pct: number } | null;

export interface Material {
  id: string;
  name_fr: string;
  category: string;
  criticality_eu: "Stratégique" | "Critique";
  criticality_score: number;
  china_dominant: boolean;
  main_uses: string[];
  top_producers: Producer[];
  price_snapshot: PriceSnapshot;
  data_quality: "verified" | "estimated" | "manual";
}

export interface CRMDataset {
  snapshot_date: string;
  total_materials: number;
  strategic_count: number;
  materials: Material[];
}

export async function getMaterials(): Promise<CRMDataset> {
  // ── MODE STATIQUE (actif) ──
  const { default: snapshot } = await import("@/data/crm_full_34_snapshot_2026-06-30.json");
  return snapshot as CRMDataset;

  // ── MODE LIVE (décommenter quand API prête) ──
  // const res = await fetch(process.env.NEXT_PUBLIC_CRM_API_URL!, { next: { revalidate: 3600 } });
  // if (!res.ok) throw new Error(`CRM API error: ${res.status}`);
  // return res.json();
}

export function getChinaShare(m: Material): number {
  return m.top_producers.find(p => p.country === "Chine")?.share_pct ?? 0;
}

export function isVolatile(m: Material, threshold = 15): boolean {
  return Math.abs(m.price_snapshot?.trend_3m_pct ?? 0) >= threshold;
}

export function getAlerts(materials: Material[], threshold = 15) {
  return materials
    .filter(m => isVolatile(m, threshold))
    .sort((a, b) => Math.abs(b.price_snapshot!.trend_3m_pct) - Math.abs(a.price_snapshot!.trend_3m_pct));
}
