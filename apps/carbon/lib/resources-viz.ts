/**
 * resources-viz.ts — helpers PURS pour la refonte visuelle du cockpit Ressources.
 *
 * Toutes les couleurs de bande sont des couleurs de STATUT (risque/HHI/confiance)
 * — dans l'UI elles sont TOUJOURS accompagnées de leur libellé de bande (jamais
 * la couleur seule), conformément au guide dataviz. Elles reprennent les tons
 * déjà utilisés par `HHI_TONE` / `SEVERITY_TONE` de l'app (contraste ≥ 3:1 vérifié
 * sur la surface sombre du cockpit).
 *
 * Aucune donnée inventée : ces fonctions ne font que MAPPER des valeurs réelles
 * (score de risque, part pays, code pays) vers des attributs visuels.
 */

import { riskBand } from "@/lib/api/resources";

export type BandTone = "unknown" | "low" | "moderate" | "high" | "severe";

/** Bande de risque/HHI → hex (pour remplissage SVG). Miroir de `HHI_TONE`. */
export const BAND_HEX: Record<BandTone, string> = {
  unknown: "#8A99B0",
  low: "#34D399",
  moderate: "#FBBF24",
  high: "#FB923C",
  severe: "#F87171",
};

/** Couleur de la jauge de risque, par bande. `null` → gris « non calculé ». */
export function riskToneHex(risk: number | null): string {
  return BAND_HEX[riskBand(risk).tone];
}

/**
 * Couleur de la confiance documentaire (vocabulaire distinct du risque).
 * solide → vert · partielle → ambre · lacunaire → rouge · absente → gris.
 */
export function confidenceToneHex(confidence: number | null): string {
  if (confidence === null || Number.isNaN(confidence)) return BAND_HEX.unknown;
  if (confidence >= 70) return BAND_HEX.low;
  if (confidence >= 40) return BAND_HEX.moderate;
  return BAND_HEX.severe;
}

/**
 * Bande de la CONCENTRATION HHI (barème DOJ 0-10000). Même seuils que `hhiBand`.
 * Retourne la bande pour choisir la couleur ET afficher le libellé à côté.
 */
export function hhiTone(hhi: number | null): BandTone {
  if (hhi === null || Number.isNaN(hhi)) return "unknown";
  if (hhi >= 5000) return "severe";
  if (hhi >= 2500) return "high";
  if (hhi >= 1500) return "moderate";
  return "low";
}

// NOTE : la table Alpha-2 → ISO numérique partielle qui vivait ici a été
// remplacée par le référentiel ISO 3166-1 COMPLET de `lib/iso3166.ts` (P2 #137) :
// une table partielle rendait un pays valide mais absent (ex. SE, AR) visuellement
// identique à un pays sans donnée.

/** `true` si le code pays fait partie de l'UE-27 (pour lecture « hors UE »). */
const EU27 = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);
export function isEu(countryCode: string): boolean {
  return EU27.has(countryCode.toUpperCase());
}

/**
 * Rampe séquentielle AMBRE (une seule teinte) pour la magnitude d'une part pays.
 * Interpole du bas visible (#8A6D16) au vif (#FBBF24) selon `share/max`.
 * Utilisée par le choroplèthe ; les pays sans donnée reçoivent un neutre distinct
 * (teinte différente → discernables même à faible part).
 */
export function shareToAmber(share: number, max = 100): string {
  const t = Math.max(0, Math.min(1, max > 0 ? share / max : 0));
  const lo = [0x8a, 0x6d, 0x16];
  const hi = [0xfb, 0xbf, 0x24];
  const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * t));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Arrondi honnête d'une moyenne (ou `null` si non calculable). */
export function meanOrNull(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}
