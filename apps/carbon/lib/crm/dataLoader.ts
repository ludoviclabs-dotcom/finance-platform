// Abstraction source de données CRM — swapper l'import pour passer en mode live
// STATIC : lit le JSON local
// LIVE   : décommenter le fetch() et ajouter NEXT_PUBLIC_CRM_API_URL dans .env
//
// ⚠ Le snapshot est un jeu de DÉMONSTRATION : toutes les matières sont
// `data_quality: "estimated"` (voir methodology_note). Aucune valeur n'est
// vérifiée ni destinée à un usage normatif tant qu'un flux sourcé ne les
// remplace pas.

export type Producer = { country: string; share_pct: number };
export type PriceSnapshot = { date: string; value: number; unit: string; trend_3m_pct: number } | null;
// Un point réel d'historique = un price_snapshot daté, re-copié depuis le
// snapshot LOCAL par .github/workflows/materials-price-history.yml (dédup par
// date — jamais de point inventé, aucune source externe interrogée). Tant qu'un
// nouveau snapshot daté n'est pas publié, la série reste à un seul point et
// n'est donc jamais affichée comme une tendance (voir hasRenderableHistory).
export type PricePoint = { date: string; value: number; unit: string };

export type DataQuality = "verified" | "estimated" | "manual";

export interface Material {
  id: string;
  name_fr: string;
  category: string;
  // Statut réglementaire CRMA — non exclusif : toute matière stratégique est
  // aussi critique. Dérivé du snapshot, jamais présenté comme une classification
  // que CarbonCo aurait produite.
  is_critical_eu: boolean;
  is_strategic_eu: boolean;
  regulation_version: string | null;
  // Score maison de risque d'approvisionnement — PAS un score officiel UE.
  carbonco_supply_risk_score: number | null;
  score_methodology_version: string | null;
  score_confidence: number | null;
  main_uses: string[];
  top_producers: Producer[];
  price_snapshot: PriceSnapshot;
  data_quality: DataQuality;
  price_history: PricePoint[];
}

export interface CRMDataset {
  snapshot_date: string;
  total_materials: number;
  strategic_count: number;
  methodology_note: string;
  materials: Material[];
}

export async function getMaterials(): Promise<CRMDataset> {
  // ── MODE STATIQUE (actif) ──
  const { default: snapshot } = await import("@/data/crm_full_34_snapshot_2026-06-30.json");
  const { default: history } = await import("@/data/crm_price_history.json");
  const hist = history as Record<string, PricePoint[]>;
  const ds = snapshot as Omit<CRMDataset, "materials"> & { materials: Omit<Material, "price_history">[] };
  return {
    ...ds,
    materials: ds.materials.map(m => ({ ...m, price_history: hist[m.id] ?? [] })),
  };

  // ── MODE LIVE (décommenter quand API prête) ──
  // const res = await fetch(process.env.NEXT_PUBLIC_CRM_API_URL!, { next: { revalidate: 3600 } });
  // if (!res.ok) throw new Error(`CRM API error: ${res.status}`);
  // return res.json();
}

export async function getMaterialById(id: string): Promise<Material | null> {
  const { materials } = await getMaterials();
  return materials.find(m => m.id === id) ?? null;
}

// Seuil de « concentration Chine » affiché. Le snapshot ne distingue pas encore
// extraction / raffinage / transformation : ce ratio agrège toutes les étapes,
// ce que l'UI doit signaler explicitement (avertissement de stade).
export const CHINA_DOMINANCE_THRESHOLD = 50;

export function getChinaShare(m: Material): number {
  return m.top_producers.find(p => p.country === "Chine")?.share_pct ?? 0;
}

// Statut « concentration Chine » DÉRIVÉ des producteurs (remplace l'ancien champ
// figé china_dominant). Vaut pour le stade de production agrégé disponible.
export function isChinaConcentrated(m: Material, threshold = CHINA_DOMINANCE_THRESHOLD): boolean {
  return getChinaShare(m) >= threshold;
}

// Une série n'est affichable comme tendance qu'à partir de 2 points datés
// indépendants. En deçà, aucun graphique ni badge ne doit simuler un historique.
export function hasRenderableHistory(series: PricePoint[] | undefined): boolean {
  return (series?.length ?? 0) >= 2;
}

// Seuil de « volatilité » affiché (tendance 3 mois estimée). Nommé comme
// CHINA_DOMINANCE_THRESHOLD pour être réutilisé cohéremment (résumé, module
// d'alertes) plutôt que recopié en dur à chaque appel.
export const VOLATILITY_THRESHOLD_PCT = 15;

export function isVolatile(m: Material, threshold = VOLATILITY_THRESHOLD_PCT): boolean {
  return Math.abs(m.price_snapshot?.trend_3m_pct ?? 0) >= threshold;
}

export function getAlerts(materials: Material[], threshold = VOLATILITY_THRESHOLD_PCT) {
  return materials
    .filter(m => isVolatile(m, threshold))
    .sort((a, b) => Math.abs(b.price_snapshot!.trend_3m_pct) - Math.abs(a.price_snapshot!.trend_3m_pct));
}

// Palier de dépendance Chine à 3 niveaux (vs le seuil binaire isChinaConcentrated) :
// high = dominance critique, mid = présence significative, low = diversifié.
export const CHINA_MID_TIER_THRESHOLD = 20;
export type ChinaTier = "high" | "mid" | "low";

export function getChinaTier(share: number): ChinaTier {
  if (share >= CHINA_DOMINANCE_THRESHOLD) return "high";
  if (share >= CHINA_MID_TIER_THRESHOLD) return "mid";
  return "low";
}

// Au-delà de ce délai, le snapshot est signalé comme potentiellement périmé.
export const STALE_AFTER_DAYS = 120;

// Calculée côté serveur (page /materials est prérendue statiquement) et jamais
// recalculée côté client, pour éviter tout mismatch d'hydratation entre le HTML
// figé au build et un nouveau calcul au moment où le navigateur affiche la page.
export function isSnapshotStale(snapshotDateIso: string, now: number = Date.now()): boolean {
  const then = new Date(snapshotDateIso).getTime();
  if (Number.isNaN(then)) return false;
  return Math.floor((now - then) / 86_400_000) > STALE_AFTER_DAYS;
}

// Âge en jours du snapshot. Calculé côté serveur (page prérendue) et passé en
// prop aux composants clients — jamais recalculé côté client, même discipline
// que isSnapshotStale (Date.now() encapsulé ici, hors du rendu d'un composant).
export function snapshotAgeDays(snapshotDateIso: string, now: number = Date.now()): number {
  const then = new Date(snapshotDateIso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

export interface MaterialsSummary {
  total: number;
  strategic: number;
  critical: number;
  chinaConcentrated: number;
  withPrice: number;
  estimatedPct: number;
  chinaThreshold: number;
  alerts: number;
  alertsThreshold: number;
}

// Indicateurs de tête — TOUS calculés depuis le dataset, aucun chiffre en dur.
// Utilisé par le hero /materials et la bande module de la landing.
export function summarize(materials: Material[]): MaterialsSummary {
  const total = materials.length;
  const estimated = materials.filter(m => m.data_quality === "estimated").length;
  return {
    total,
    strategic: materials.filter(m => m.is_strategic_eu).length,
    critical: materials.filter(m => m.is_critical_eu).length,
    chinaConcentrated: materials.filter(m => isChinaConcentrated(m)).length,
    withPrice: materials.filter(m => m.price_snapshot !== null).length,
    estimatedPct: total === 0 ? 0 : Math.round((estimated / total) * 100),
    chinaThreshold: CHINA_DOMINANCE_THRESHOLD,
    alerts: getAlerts(materials).length,
    alertsThreshold: VOLATILITY_THRESHOLD_PCT,
  };
}
