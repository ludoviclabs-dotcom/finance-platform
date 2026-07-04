/**
 * Jeu de données démo UNIQUE (T0.5 du PLAN_ACTION_CARBONCO).
 *
 * Toutes les surfaces de démonstration (dashboard mockup, cas sectoriels, démo
 * 90 s, réponses copilote) doivent lire ces chiffres pour rester cohérentes.
 * Entreprise fictive « Exemplia Industrie » — clairement étiquetée.
 *
 * Invariants (vérifiés par tests/demo-dataset.test.ts) :
 *   - Σ scopes.tco2e = total_tco2e
 *   - Σ scopes.part_pct = 100 ; Σ postes.part_pct = 100
 *   - Σ postes.tco2e = total_tco2e
 */

import demo from "@/data/demo-dataset.json";

export interface DemoScope {
  id: string;
  label: string;
  tco2e: number;
  part_pct: number;
  yoy_pct: number;
}
export interface DemoPoste {
  id: string;
  label: string;
  tco2e: number;
  part_pct: number;
}

export const DEMO = demo;
export const DEMO_DISCLAIMER = demo.etiquette;

/** Formate un nombre en français avec séparateur de milliers (espace simple). */
export function fmtFr(n: number): string {
  return n.toLocaleString("fr-FR").replace(/[  ]/g, " ");
}

/** Total formaté, ex. « 12 847 ». */
export function demoTotal(): string {
  return fmtFr(demo.total_tco2e);
}

export function demoScopes(): DemoScope[] {
  return demo.scopes as DemoScope[];
}

export function demoPostes(): DemoPoste[] {
  return demo.postes as DemoPoste[];
}

/** Réponse copilote « répartition par scope », construite depuis le jeu unique. */
export function demoScopeAnswer(): string {
  const [s1, s2, s3] = demo.scopes;
  return (
    `Vos émissions totales s'élèvent à **${demoTotal()} tCO₂e** sur les 12 derniers mois.\n\n` +
    `- **Scope 1** : ${fmtFr(s1.tco2e)} tCO₂e (${s1.part_pct} %) — en baisse de ${Math.abs(s1.yoy_pct)} %\n` +
    `- **Scope 2** : ${fmtFr(s2.tco2e)} tCO₂e (${s2.part_pct} %) — en baisse de ${Math.abs(s2.yoy_pct)} %\n` +
    `- **Scope 3** : ${fmtFr(s3.tco2e)} tCO₂e (${s3.part_pct} %) — en baisse de ${Math.abs(s3.yoy_pct)} %\n\n` +
    `Le Scope 3 reste votre principal levier de réduction. Je recommande de cibler les achats de ` +
    `biens & services et le transport amont.`
  );
}
