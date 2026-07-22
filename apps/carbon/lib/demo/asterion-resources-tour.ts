/**
 * asterion-resources-tour.ts — parcours « Dépendances industrielles étendues »
 * (MODULE 2, PR-M2D). Séquence SŒUR du tour Asterion Motion : 10 beats qui
 * suivent une ressource stratégique (silicium métal) de la détection à la
 * décision humaine, en rendant les VRAIS composants du cockpit /resources avec
 * des données 100 % fictives.
 *
 * Chaque étape porte un `beat` : le shell délègue son corps à `renderResourceBeat`.
 */

import type { TourStep } from "./asterion-motion-tour";

export const ASTERION_RESOURCES_TOUR: TourStep[] = [
  {
    id: "res-detected", index: 1, title: "Ressource détectée",
    narration:
      "Asterion cartographie ses dépendances industrielles étendues. Cinq ressources synthétiques émergent — silicium métal, hélium, xénon, hydrogène, charbon à coke. Toutes tenant-scoped, estimées, clairement fictives.",
    exploreHref: "/resources", durationMs: 11000, beat: "detected",
  },
  {
    id: "res-use", index: 2, title: "Usage industriel",
    narration:
      "Le silicium métal alimente l'électronique de puissance des moteurs E-Drive X4. Usage-secteur seulement — jamais une recette, une formulation ni un paramètre de fabrication.",
    exploreHref: "/resources/silicon-metal", durationMs: 11000, beat: "use",
  },
  {
    id: "res-exposure", index: 3, title: "Exposition — achat · BOM · activité",
    narration:
      "L'exposition se LIT depuis les modules existants : une ligne d'achat, un composant de nomenclature, une activité énergie. Le module oriente, il ne recopie ni ne recalcule aucun carbone (D-4).",
    exploreHref: "/resources/exposures", durationMs: 12000, beat: "exposure",
  },
  {
    id: "res-stage", index: 4, title: "Étape de chaîne — concentration pays",
    narration:
      "La concentration se calcule PAR ÉTAPE. À la fusion : HHI 6240 (barème DOJ 0-10000), premier pays CN, 100 % hors UE à l'extraction. Jamais de moyenne inter-étapes.",
    exploreHref: "/resources/silicon-metal", durationMs: 13000, beat: "stage",
  },
  {
    id: "res-source", index: 5, title: "Source & qualité",
    narration:
      "Chaque part porte son statut (estimé) et sa provenance (release d'evidence). Sourcé-ou-avoué : une donnée non sourcée est affichée comme telle, jamais présentée comme vérifiée.",
    exploreHref: "/intelligence/sources", durationMs: 11000, beat: "source-quality",
  },
  {
    id: "res-risk", index: 6, title: "Dimensions de risque",
    narration:
      "L'indice est SECONDAIRE et DÉCOMPOSABLE — jamais une jauge opaque. Chaque composante a sa barre, sa valeur, son poids et sa provenance : concentration par étape, dépendance hors UE, concentration fournisseur, couverture de stock.",
    exploreHref: "/resources/silicon-metal", durationMs: 15000, beat: "risk",
  },
  {
    id: "res-confidence", index: 7, title: "Confiance — axe séparé",
    narration:
      "Risque 70,6 et confiance 79,4 sont DEUX grandeurs distinctes, côte à côte, jamais fusionnées. Une confiance faible signalerait des données lacunaires — pas un risque faible.",
    exploreHref: "/resources/methodology", durationMs: 12000, beat: "confidence",
  },
  {
    id: "res-missing", index: 8, title: "Données manquantes",
    narration:
      "La substituabilité est absente : aucun substitut recensé. Elle est marquée « Donnée manquante », exclue du calcul et les poids renormalisés — jamais comptée comme un risque nul.",
    exploreHref: "/resources/silicon-metal", durationMs: 11000, beat: "missing",
  },
  {
    id: "res-action", index: 9, title: "Suggestion d'action",
    narration:
      "Le score déclenche un signal de dépendance élevée et propose des pistes — diversifier l'amont, renforcer le stock. Ce sont des SUGGESTIONS, jamais des actions appliquées automatiquement.",
    exploreHref: "/resources/assessments", durationMs: 12000, beat: "action",
  },
  {
    id: "res-decision", index: 10, title: "Décision humaine",
    narration:
      "L'analyste tranche : retenir, écarter ou différer — avec justification, en append-only. L'IA et le score proposent ; la matérialité reste une décision humaine, motivée et tracée.",
    exploreHref: "/iro", durationMs: 12000, beat: "decision",
  },
];
