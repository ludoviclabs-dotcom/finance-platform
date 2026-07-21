// Compagnon présentation de getChinaTier (dataLoader.ts) : couleurs/labels pour
// les 3 paliers de dépendance Chine. Séparé de dataLoader.ts pour garder ce
// dernier libre de toute couleur (il est couvert par materials-data-trust.test.ts,
// pas celui-ci).
import { getChinaTier, type ChinaTier } from "./dataLoader";

export const CHINA_TIER_META: Record<ChinaTier, { colorVar: string; label: string; desc: string }> = {
  high: {
    colorVar: "var(--mx-tier-high)",
    label: "Dominance critique",
    desc: "part chinoise ≥ 50 %",
  },
  mid: {
    colorVar: "var(--mx-tier-mid)",
    label: "Présence significative",
    desc: "part chinoise 20–49 %",
  },
  low: {
    colorVar: "var(--mx-tier-low)",
    label: "Approvisionnement diversifié",
    desc: "part chinoise < 20 %",
  },
};

export function chinaTierColorVar(share: number): string {
  return CHINA_TIER_META[getChinaTier(share)].colorVar;
}
