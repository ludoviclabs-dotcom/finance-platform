/**
 * lib/water-intelligence/basin-atlas.ts — modèle de couches du Basin Atlas
 * (WI-V3-04).
 *
 * ## Pourquoi ce module existe
 *
 * La carte ne doit montrer comme FACTUEL que ce que le modèle valide. Ce
 * fichier est l'endroit où cette validation se calcule — pas dans le JSX, où
 * elle deviendrait une affirmation éditoriale qu'aucun changement de document
 * ne viendrait démentir.
 *
 * ## La jointure commune → bassin n'est pas validée, et ce n'est pas un avis
 *
 * `basinJoin()` ne peut pas retourner `validated: true` par accident : il lui
 * faut DEUX faits, tirés du document canonique, et aucun des deux n'est vrai
 * aujourd'hui.
 *
 * 1. Au moins une couche géographique publiée — `coverage.layer_count` vaut 0,
 *    et le bloc pilote porte `geo_layers: "deferred"` (une littérale au
 *    schéma : le contrat lui-même interdit une autre valeur).
 * 2. Au moins une observation rattachée à une échelle de bassin — le contrat
 *    ne sait exprimer que `world`, `europe` et `france` (voir `MAP_SCOPES`).
 *    Aucune échelle « bassin » n'existe encore.
 *
 * Le jour où ces deux faits deviendront vrais, la carte le dira d'elle-même.
 * Tant qu'ils sont faux, elle affiche « Jointure bassin non validée » et rend
 * la couche correspondante désactivée, hachurée et explicitement différée.
 *
 * ## Trois types de couches, jamais mélangés
 *
 * - `published` : une observation ou un territoire effectivement publié ;
 * - `context`   : une géographie de REPÉRAGE, non métrique — un fond de carte
 *                 n'est pas une donnée, et ne doit jamais se teinter comme
 *                 s'il en portait une ;
 * - `deferred`  : une donnée attendue, ni validée ni instrumentée.
 */

import { PILOT_FILE, pilotIsPublished, type PilotFile } from "./pilot-snapshot";

/* ==========================================================================
   Jointure bassin
   ========================================================================== */

export interface WiBasinJoin {
  /** Vrai UNIQUEMENT si les deux faits canoniques ci-dessous sont réunis. */
  readonly validated: boolean;
  /** Libellé d'état, affichable tel quel. */
  readonly label: string;
  /** Ce qui manque, dérivé du document — jamais une phrase générique. */
  readonly reason: string;
  /** La démarche qui lèverait le blocage. Humaine, pas technique. */
  readonly nextStep: string;
  /** Nombre de couches géographiques publiées, lu au document. */
  readonly publishedLayerCount: number;
  /** Vrai si une observation est rattachée à une échelle de bassin. */
  readonly hasBasinScopedObservation: boolean;
}

/**
 * Échelles qui vaudraient rattachement à un bassin.
 *
 * Le paramètre est un `string` volontairement : `WaterGeographyScope` ne
 * contient aucune de ces valeurs aujourd'hui, et un type plus étroit ferait de
 * cette comparaison une erreur de compilation plutôt qu'un test qui échoue
 * honnêtement le jour où le contrat s'élargira.
 */
function isBasinScope(scope: string): boolean {
  return scope === "basin" || scope === "water_body" || scope === "masse_d_eau";
}

export function basinJoin(file: PilotFile = PILOT_FILE): WiBasinJoin {
  const published = pilotIsPublished(file);
  const publishedLayerCount = published ? file.coverage.layer_count : 0;
  const hasBasinScopedObservation = published
    ? (file.manifest?.observations ?? []).some((observation) =>
        isBasinScope(observation.geography.scope),
      )
    : false;

  const validated = publishedLayerCount > 0 && hasBasinScopedObservation;

  if (validated) {
    return {
      validated,
      label: "Jointure bassin validée",
      reason: "Une couche géographique publiée rattache le périmètre à un bassin.",
      nextStep: "Vérifier la méthode de rattachement avant toute lecture par bassin.",
      publishedLayerCount,
      hasBasinScopedObservation,
    };
  }

  return {
    validated,
    label: "Jointure bassin non validée",
    reason:
      publishedLayerCount === 0
        ? "Aucune couche géographique n'est publiée : le document porte zéro couche, et le bloc pilote déclare ses couches différées."
        : "Aucune observation n'est rattachée à une échelle de bassin : le contrat ne sait exprimer que monde, Europe et France.",
    nextStep:
      "Choisir un référentiel de contours de bassins, avec sa licence et sa version, puis faire signer la décision qui l'autorise. C'est une démarche humaine, pas un réglage.",
    publishedLayerCount,
    hasBasinScopedObservation,
  };
}

/* ==========================================================================
   Couches de l'atlas
   ========================================================================== */

export type WiLayerKind = "published" | "context" | "deferred";

export const LAYER_KIND_LABELS: Record<WiLayerKind, string> = {
  published: "Publié",
  context: "Repérage",
  deferred: "Différé",
};

/** Niveau dans la hiérarchie géographique : ouvrage → commune → bassin. */
export type WiLayerLevel = "ouvrage" | "commune" | "bassin" | "monde";

export interface WiAtlasLayer {
  readonly id: string;
  readonly label: string;
  readonly kind: WiLayerKind;
  readonly level: WiLayerLevel;
  /** Ce que la couche montre, ou pourquoi elle est absente. */
  readonly detail: string;
  /**
   * Une couche `deferred` n'est JAMAIS activable : il n'y a rien à afficher, et
   * un interrupteur qui n'allume rien est un mensonge d'interface.
   */
  readonly toggleable: boolean;
  readonly defaultVisible: boolean;
}

export interface AtlasLayerInput {
  readonly geographyCode: string;
  readonly periodLabel: string;
  readonly ouvrageCount: number;
  readonly join: WiBasinJoin;
}

/**
 * Les couches de l'atlas, dans l'ordre de la hiérarchie conceptuelle
 * (ouvrage → commune → bassin), le repérage ensuite.
 *
 * Aucun libellé ne porte de chiffre qui ne vienne des arguments, eux-mêmes
 * lus au document par l'appelant.
 */
export function atlasLayers({
  geographyCode,
  periodLabel,
  ouvrageCount,
  join,
}: AtlasLayerInput): readonly WiAtlasLayer[] {
  return [
    {
      id: "ouvrages",
      label: `Ouvrages déclarés (${ouvrageCount})`,
      kind: "published",
      level: "ouvrage",
      detail: `Les ${ouvrageCount} ouvrages du périmètre signé, portés par le document publié. Leur position exacte n'est pas cartographiée : seule la commune l'est.`,
      toggleable: false,
      defaultVisible: true,
    },
    {
      id: "commune",
      label: `Commune ${geographyCode}`,
      kind: "published",
      level: "commune",
      detail: `Le seul territoire publié, pour l'année ${periodLabel}. Un point, pas une surface : le contour communal lui-même n'est pas encore un référentiel retenu.`,
      toggleable: false,
      defaultVisible: true,
    },
    {
      id: "bassin",
      label: "Bassins et masses d'eau",
      kind: "deferred",
      level: "bassin",
      /* L'état de jointure ouvre le détail, avant son motif : « Jointure
         bassin non validée » est l'information, le reste l'explique. Un
         lecteur qui ne lit que la première phrase doit déjà savoir que la
         relation commune → bassin n'est pas établie. */
      detail: `${join.label} — ${join.reason}`,
      toggleable: false,
      defaultVisible: false,
    },
    {
      id: "autres-communes",
      label: "Autres communes",
      kind: "deferred",
      level: "commune",
      detail:
        "Aucune autre commune n'est publiée. Les afficher en gris se lirait comme une couverture à zéro, alors qu'il s'agit d'une absence de décision.",
      toggleable: false,
      defaultVisible: false,
    },
    {
      id: "metropole",
      label: "France métropolitaine",
      kind: "context",
      level: "monde",
      detail:
        "Silhouette de repérage, non métrique : elle situe la commune publiée, elle ne mesure rien et ne porte aucune valeur.",
      toggleable: true,
      defaultVisible: true,
    },
    {
      id: "monde",
      label: "Fond mondial",
      kind: "context",
      level: "monde",
      detail:
        "Contours des autres pays, en repérage. Jamais teintés : une teinte sur un pays sans donnée se lit comme une donnée.",
      toggleable: true,
      defaultVisible: true,
    },
  ];
}

/** Les identifiants des couches visibles par défaut. */
export function defaultVisibleLayers(layers: readonly WiAtlasLayer[]): readonly string[] {
  return layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id);
}
