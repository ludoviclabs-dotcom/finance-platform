/**
 * asterion-motion-tour.ts — manifeste du parcours guidé « Asterion Motion ».
 *
 * 10 étapes (situation → Evidence Pack), 3 modes (guided / director / explore).
 * Chaque étape propose « Explorer dans l'application » (lien vers la vraie page
 * du tenant démo). Le mode director enchaîne automatiquement (~2 min).
 */

import { ASTERION_METRICS, type DemoMetric } from "./asterion-motion-data";

export type TourMode = "guided" | "director" | "explore";

export const TOUR_MODES: { id: TourMode; label: string; help: string }[] = [
  { id: "guided", label: "Guidé", help: "Pas-à-pas, à votre rythme." },
  { id: "director", label: "Réalisateur", help: "Enchaînement automatique (~2 min)." },
  { id: "explore", label: "Explorer", help: "Navigation libre." },
];

export interface TourStep {
  id: string;
  index: number;
  title: string;
  narration: string;
  /** Lien « Explorer dans l'application » (page réelle du tenant démo). */
  exploreHref: string;
  /** Métrique mise en avant (count-up + badge de statut). */
  metric?: DemoMetric;
  /** Durée en mode réalisateur (ms). */
  durationMs: number;
  /** Étape IA : affiche la trace fonctionnelle + la revue citée. */
  isAiStep?: boolean;
  /** Discriminant de corps personnalisé (ex. séquence Ressources, PR-M2D) — le
   *  shell délègue le rendu à `renderStepBody(step)` quand il est fourni. */
  beat?: string;
}

export const ASTERION_TOUR: TourStep[] = [
  {
    id: "situation", index: 1, title: "Situation",
    narration: "Asterion Motion assemble 12 000 moteurs E-Drive X4 par an. Enjeux CSRD/ESRS : climat, ressources critiques, eau, double matérialité.",
    exploreHref: "/dashboard", metric: ASTERION_METRICS.motors, durationMs: 11000,
  },
  {
    id: "import", index: 2, title: "Import des achats",
    narration: "5,8 M€ d'achats importés. Nomenclature E-Drive X4 : aimants NdFeB, cuivre, aluminium. Chaque ligne porte source, date et statut.",
    exploreHref: "/fournisseurs/scope3", metric: ASTERION_METRICS.purchases, durationMs: 12000,
  },
  {
    id: "scope3", index: 3, title: "Scope 3 — hotspots",
    narration: "3 480 tCO₂e sur les achats. Les aimants concentrent 61,8 % des émissions : hotspot n°1, calculé de façon déterministe.",
    exploreHref: "/scopes", metric: ASTERION_METRICS.magnetsShare, durationMs: 14000,
  },
  {
    id: "crma", index: 4, title: "CRMA — matières critiques",
    narration: "Les aimants NdFeB sont critiques ET stratégiques (CRMA-2024). Dépendance aux terres rares lourdes estimée à 92 % — un chiffre estimé, jamais présenté comme vérifié.",
    exploreHref: "/crma", metric: ASTERION_METRICS.dependency, durationMs: 13000,
  },
  {
    id: "scope2", index: 5, title: "Scope 2 — double reporting",
    narration: "Location-based 1 860 tCO₂e, market-based 1 090 tCO₂e. La couverture contractuelle bas-carbone atteint 54 %. Résultats déterministes, jamais recalculés par l'IA.",
    exploreHref: "/scopes", metric: ASTERION_METRICS.scope2Mb, durationMs: 13000,
  },
  {
    id: "eau-nature", index: 6, title: "Eau & nature",
    narration: "72 000 m³ prélevés. Le site siège est en stress hydrique élevé (confiance 0,81). Le risque et la confiance sont deux dimensions séparées.",
    exploreHref: "/water", metric: ASTERION_METRICS.water, durationMs: 12000,
  },
  {
    id: "iro", index: 7, title: "IRO — double matérialité",
    narration: "Un IRO candidat émerge : « Dépendance critique aux aimants terres rares ». Exposition financière indicative 1,4 M€. Impact et finance restent des panneaux séparés.",
    exploreHref: "/iro", metric: ASTERION_METRICS.exposure, durationMs: 13000,
  },
  {
    id: "ia", index: 8, title: "Revue IA citée",
    narration: "L'assistant IA analyse l'IRO : il sélectionne les preuves autorisées, résout chaque citation, confronte claims et preuves — et étiquette soutenu, partiellement, contredit, non étayé. Aucune décision automatique.",
    exploreHref: "/iro", durationMs: 18000, isAiStep: true,
  },
  {
    id: "decision", index: 9, title: "Décision humaine",
    narration: "Le relecteur accepte, rejette ou modifie — avec justification. Accepter déclenche le geste métier (créer un IRO candidate), jamais une publication automatique.",
    exploreHref: "/iro", durationMs: 12000,
  },
  {
    id: "evidence-pack", index: 10, title: "Evidence Pack",
    narration: "Le dossier auditable rassemble sources, dates, statuts et méthodes. Estimé ≠ vérifié ; risque ≠ confiance ; chaque chiffre remonte à sa preuve.",
    exploreHref: "/intelligence/sources", durationMs: 12000,
  },
];

/** Durée totale du mode réalisateur (~2 min). */
export const DIRECTOR_TOTAL_MS = ASTERION_TOUR.reduce((sum, s) => sum + s.durationMs, 0);
