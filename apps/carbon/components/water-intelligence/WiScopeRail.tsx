/**
 * WiScopeRail.tsx — Provenance / Scope Rail (WI-V3-01).
 *
 * Bandeau compact sous le hero qui rend visibles, en un coup d'œil, les sept
 * faits qui bornent tout ce que la page affiche plus bas : territoire,
 * période, snapshot, compteurs de sources et statut de publication. Chaque
 * valeur est un PARAMÈTRE reçu du composant appelant (`app/water/page.tsx`),
 * jamais une constante recopiée ici — la page les calcule déjà tous pour le
 * hero et les sections qui suivent ; ce bandeau ne fait qu'en réafficher un
 * sous-ensemble à un endroit plus visible.
 *
 * ## Ce que ce bandeau N'inclut PAS, et pourquoi
 *
 * Le blueprint WI-V3-01 prévoyait un huitième champ, « Join bassin », mais
 * seulement « si un état canonique existe ». Il n'existe pas : la jointure par
 * code INSEE entre les trois sources Hub'Eau est un fait ÉDITORIAL, documenté
 * en prose dans `WiTerritory` (`WiMatrices.tsx`), pas un champ d'un document
 * canonique. L'ajouter ici en aurait fait une septième donnée réelle à côté
 * d'une huitième fabriquée — la clause conditionnelle du blueprint est prise
 * au mot.
 *
 * ## Server Component, comme `WiNav`
 *
 * Aucun état, aucun gestionnaire d'événement : chaque item est un `<a>` natif
 * vers `#preuves` (Evidence Registry), et son infobulle de contexte est
 * révélée en CSS pur, au survol ET au focus clavier (`:hover`,
 * `:focus-visible` — voir `water-intelligence.css`). La valeur elle-même
 * reste TOUJOURS visible, jamais cachée derrière le survol : sur un écran
 * tactile où rien ne survole, l'information essentielle est déjà là.
 *
 * Non sticky, par choix assumé : superposer un second bandeau collant sous
 * `.wi-nav` (déjà collante) exigerait de connaître sa hauteur réelle pour
 * positionner celui-ci juste en dessous — une coordination que ce composant,
 * en Server Component sans JavaScript, n'introduit pas pour un gain
 * accessoire. Voir le commentaire CSS de `.wi-rail`.
 */

import { WiStatusChip } from "./WiPrimitives";

export interface WiScopeRailProps {
  /** Code du périmètre géographique signé (ex. code commune INSEE). */
  readonly territoryCode: string;
  /** Année du périmètre observé. */
  readonly periodLabel: string;
  /** Date d'assemblage du snapshot, ou `null` tant qu'il n'est pas généré. */
  readonly snapshotDate: string | null;
  /** Nombre d'observations RÉELLEMENT publiées — lu au document. */
  readonly observationCount: number;
  /** Nombre de sources instrumentées. */
  readonly sourceCount: number;
  /** Nombre de sources autorisées à publier. */
  readonly publishableCount: number;
  /** `false` tant que le document pilote n'a pas été généré. */
  readonly published: boolean;
}

export function WiScopeRail({
  territoryCode,
  periodLabel,
  snapshotDate,
  observationCount,
  sourceCount,
  publishableCount,
  published,
}: WiScopeRailProps) {
  const items: ReadonlyArray<{ label: string; value: string; tip: string }> = [
    {
      label: "Territoire",
      value: `Commune ${territoryCode}`,
      tip: "Le périmètre géographique signé — une commune, jamais un territoire plus large.",
    },
    {
      label: "Période",
      value: periodLabel,
      tip: "L'année couverte par le périmètre signé.",
    },
    {
      label: "Snapshot",
      value: snapshotDate ?? "non généré",
      tip: "La date d'assemblage du document pilote, ou son absence tant que le workflow n'a pas tourné.",
    },
    {
      label: "Observations",
      value: String(observationCount),
      tip: "Le nombre d'observations réellement publiées — lu au document, jamais une constante.",
    },
    {
      label: "Sources instrumentées",
      value: String(sourceCount),
      tip: "Les sources officielles dont le connecteur a été construit et vérifié.",
    },
    {
      label: "Sources publiables",
      value: String(publishableCount),
      tip: "Parmi les sources instrumentées, celles qu'une décision humaine a explicitement autorisées à publier.",
    },
  ] as const;

  return (
    <section aria-label="Portée et provenance publiées" className="wi-rail" data-testid="wi-scope-rail">
      {items.map((item) => (
        <a key={item.label} href="#preuves" className="wi-rail-item">
          <span className="wi-rail-label">{item.label}</span>
          <span className="wi-rail-value">{item.value}</span>
          <span className="wi-rail-tip" role="tooltip">
            {item.tip}
          </span>
        </a>
      ))}

      <a href="#preuves" className="wi-rail-item">
        <span className="wi-rail-label">Publication</span>
        <span style={{ marginTop: "0.0625rem" }}>
          <WiStatusChip state={published ? "published" : "not_instrumented"} />
        </span>
        <span className="wi-rail-tip" role="tooltip">
          {published
            ? "Le document pilote est généré : les valeurs ci-dessus viennent d'une publication réelle."
            : "Le document pilote n'a pas encore été généré par le workflow — aucune observation n'est publiée."}
        </span>
      </a>
    </section>
  );
}
