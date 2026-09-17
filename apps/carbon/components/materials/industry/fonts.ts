import type { CSSProperties } from "react";
import { Barlow, Barlow_Condensed } from "next/font/google";

/**
 * Polices du système « Industry », employées par la seule page /materials.
 * Déclarées ici plutôt que dans le layout racine : next/font ne les
 * précharge ainsi que sur les routes qui importent ce module.
 */
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

/**
 * Première famille de la pile next/font : la police web elle-même, sans le
 * repli métrique (un Arial retouché) que next/font place derrière elle.
 * Avec ce repli, les glyphes absents du sous-ensemble latin de Barlow (№, ≥,
 * →, ▲) sortaient en Arial ; la maquette les prend dans system-ui, sa pile
 * étant « Barlow, system-ui, sans-serif ». `adjustFontFallback: false` ne
 * suffit pas : Turbopack génère le repli quand même.
 */
function webFamily(font: { style: { fontFamily: string } }): string {
  return font.style.fontFamily.split(",")[0].trim();
}

/** À poser sur la racine de la peau : ses jetons --font-* s'y résolvent. */
export const industryFontVars = {
  "--font-barlow": webFamily(barlow),
  "--font-barlow-condensed": webFamily(barlowCondensed),
} as CSSProperties;
