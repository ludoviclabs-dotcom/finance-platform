"use client";

/**
 * WiMatrices — secteurs/dépendances, innovations/adaptation, territoires,
 * chronologie.
 *
 * ## L'invariant partagé par ces quatre blocs
 *
 * **Aucun chiffre n'y est publié.** Les intensités sont ordinales et nommées,
 * jamais notées ; aucune ligne ni colonne ne porte de total ; aucun secteur
 * n'est classé devant un autre. Deux cases « structurante » ne sont pas
 * comparables entre elles, et la matrice ne prétend pas les départager.
 *
 * La raison tient en une phrase : un rang publié sans méthode sourcée devient
 * une référence citée. Ces matrices décrivent la NATURE d'une dépendance, ce
 * qui se vérifie par lecture — pas son ampleur, qui se mesure sur site.
 */

import { useState } from "react";

import {
  CLIMATE_EVENTS,
  CLIMATE_EVENT_KINDS,
  CLIMATE_EVENT_REQUIREMENTS,
  EVIDENCE_LABELS,
  INNOVATION_AXES,
  INNOVATION_FAMILIES,
  INTENSITY_LABELS,
  INTENSITY_RANK,
  SECTORS,
  SECTOR_DIMENSIONS,
  type Intensity,
  type SectorDimensionId,
} from "@/lib/water-intelligence/editorial-matrices";

/**
 * Cellule d'intensité.
 *
 * Trois signaux simultanés : un libellé texte, un nombre de pastilles pleines
 * et une teinte. Le libellé suffit seul — les deux autres sont des renforts.
 * Une matrice qui ne coderait l'intensité que par la couleur serait illisible
 * pour une part de ses lecteurs, et ambiguë pour tous les autres.
 */
function IntensityCell({ value }: { value: Intensity }) {
  const rank = INTENSITY_RANK[value];
  return (
    <span className="wi-intensity" data-intensity={value}>
      <span className="wi-intensity-dots" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} data-on={step <= rank ? "true" : "false"} />
        ))}
      </span>
      <span className="wi-intensity-label">{INTENSITY_LABELS[value]}</span>
    </span>
  );
}

/* ==========================================================================
   Secteurs et dépendances
   ========================================================================== */

export function WiSectors() {
  const [dimension, setDimension] = useState<SectorDimensionId | "all">("all");
  const [openSector, setOpenSector] = useState<string | null>(null);

  const visible =
    dimension === "all"
      ? SECTOR_DIMENSIONS
      : SECTOR_DIMENSIONS.filter((entry) => entry.id === dimension);

  return (
    <div data-testid="wi-sectors">
      <div className="wi-viewswitch" role="group" aria-label="Filtrer les dimensions">
        <button
          type="button"
          className="wi-tab"
          aria-pressed={dimension === "all"}
          onClick={() => setDimension("all")}
        >
          Toutes les dimensions
        </button>
        {SECTOR_DIMENSIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="wi-tab"
            aria-pressed={dimension === entry.id}
            onClick={() => setDimension(entry.id)}
            title={entry.hint}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="wi-table-wrap" style={{ marginTop: "1rem" }} tabIndex={0}>
        <table className="wi-table">
          <caption>
            Dix secteurs, sept dimensions. Les intensités sont ordinales et
            qualitatives&nbsp;: aucune n&apos;est mesurée, aucun total n&apos;est
            calculé, et aucun secteur n&apos;est classé devant un autre.
          </caption>
          <thead>
            <tr>
              <th scope="col">Secteur</th>
              {visible.map((entry) => (
                <th key={entry.id} scope="col">
                  {entry.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTORS.map((sector) => (
              <tr key={sector.id}>
                <th scope="row">
                  <button
                    type="button"
                    className="wi-rowbutton"
                    aria-expanded={openSector === sector.id}
                    onClick={() =>
                      setOpenSector(openSector === sector.id ? null : sector.id)
                    }
                    data-testid={`wi-sector-${sector.id}`}
                  >
                    {sector.label}
                  </button>
                  {openSector === sector.id && (
                    <p className="wi-rownote wi-muted">
                      {sector.note}
                      <br />
                      <span className="wi-badge wi-badge-pending" style={{ marginTop: "0.5rem" }}>
                        <span aria-hidden="true">◷</span>
                        {EVIDENCE_LABELS[sector.evidenceLevel]}
                      </span>
                    </p>
                  )}
                </th>
                {visible.map((entry) => (
                  <td key={entry.id}>
                    <IntensityCell value={sector.dimensions[entry.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="wi-muted" style={{ marginTop: "1rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
        Aucun classement quantitatif n&apos;est publié. « Le textile consomme X litres
        par kilo » se recopie de source en source sans que personne ne remonte à la
        mesure&nbsp;: ce module dit ce qu&apos;il faudrait mesurer, et sur quel site.
      </p>
    </div>
  );
}

/* ==========================================================================
   Innovations et adaptation
   ========================================================================== */

export function WiInnovations() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div data-testid="wi-innovations">
      <div className="wi-table-wrap" tabIndex={0}>
        <table className="wi-table">
          <caption>
            Neuf familles de solutions. Chacune porte sa contrepartie au même
            niveau que son bénéfice&nbsp;: aucune n&apos;est présentée comme une
            performance garantie, et aucun volume d&apos;eau économisé n&apos;est
            chiffré — il dépend du procédé et du site, et ne se transpose pas.
          </caption>
          <thead>
            <tr>
              <th scope="col">Famille</th>
              {INNOVATION_AXES.map((axis) => (
                <th key={axis.id} scope="col">
                  {axis.label}
                </th>
              ))}
              <th scope="col">Niveau de preuve</th>
            </tr>
          </thead>
          <tbody>
            {INNOVATION_FAMILIES.map((family) => (
              <tr key={family.id}>
                <th scope="row">
                  <button
                    type="button"
                    className="wi-rowbutton"
                    aria-expanded={open === family.id}
                    onClick={() => setOpen(open === family.id ? null : family.id)}
                    data-testid={`wi-innovation-${family.id}`}
                  >
                    {family.label}
                  </button>
                  {open === family.id && (
                    <div className="wi-rownote">
                      <p className="wi-muted">
                        <strong>Principe.</strong> {family.principle}
                      </p>
                      <p className="wi-muted" style={{ marginTop: "0.5rem" }}>
                        <strong>Contrepartie.</strong> {family.tradeoff}
                      </p>
                      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
                        Secteurs concernés&nbsp;: {family.sectors.join(", ")}.
                      </p>
                    </div>
                  )}
                </th>
                {INNOVATION_AXES.map((axis) => (
                  <td key={axis.id}>
                    <IntensityCell value={family.axes[axis.id]} />
                  </td>
                ))}
                <td>
                  <span className="wi-badge wi-badge-pending">
                    <span aria-hidden="true">◷</span>
                    {EVIDENCE_LABELS[family.evidenceLevel]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================================================
   Territory Readiness — l'honnêteté cartographique
   ========================================================================== */

export interface WiTerritoryProps {
  geographyType: string;
  geographyCode: string;
  periodLabel: string;
  ouvrageCount: number;
  isPublished: boolean;
}

/**
 * Territory Readiness — ce qui remplace une carte que rien n'alimente.
 *
 * `geo_layers = deferred` est un état honnête, et une carte du monde vide en
 * serait une traduction trompeuse : un fond de carte sans données se lit comme
 * une couverture nulle, alors qu'il s'agit d'une absence de publication. Les
 * deux ne se corrigent pas de la même façon.
 *
 * Ce composant dit donc ce qui est prêt, ce qui manque, et quelle jointure
 * sera possible — sans dessiner un territoire que le module ne décrit pas.
 */
export function WiTerritory({
  geographyType,
  geographyCode,
  periodLabel,
  ouvrageCount,
  isPublished,
}: WiTerritoryProps) {
  return (
    <div className="wi-grid wi-grid-2" data-testid="wi-territory">
      <div className="wi-card wi-accent-water">
        <p className="wi-kicker">Périmètre publié</p>
        <dl className="wi-territory-facts">
          <div>
            <dt>Code commune</dt>
            <dd className="wi-mono">{geographyCode}</dd>
          </div>
          <div>
            <dt>Référentiel</dt>
            <dd className="wi-mono">{geographyType}</dd>
          </div>
          <div>
            <dt>Année</dt>
            <dd className="wi-num">{periodLabel}</dd>
          </div>
          <div>
            <dt>Ouvrages disponibles</dt>
            <dd className="wi-num" data-testid="wi-territory-ouvrages">
              {isPublished ? ouvrageCount : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="wi-card wi-accent-absent wi-absent-fill">
        <div className="wi-badge wi-badge-absent">
          <span aria-hidden="true">◇</span> Couches géographiques différées
        </div>
        <h3 className="wi-h3" style={{ marginTop: "0.75rem" }}>
          Aucune carte n&apos;est affichée, et c&apos;est volontaire
        </h3>
        <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
          Une carte du monde sans données se lit comme une couverture nulle. Or il
          s&apos;agit d&apos;une absence de <em>publication</em> — les deux ne se
          corrigent pas de la même façon, et confondre l&apos;une avec l&apos;autre
          ferait chercher une panne là où il y a une décision non prise.
        </p>
      </div>

      <div className="wi-card">
        <p className="wi-kicker">Jointures géographiques possibles</p>
        <ul className="wi-limit-list">
          <li>
            Les trois sources Hub&apos;Eau portent des identifiants officiels stables
            (commune INSEE, code BSS, code station). Une jointure <strong>par code</strong>
            sera donc possible.
          </li>
          <li>
            Aucune jointure par nom ne sera jamais nécessaire — et n&apos;est autorisée&nbsp;:
            un rattachement par libellé produit des correspondances plausibles et fausses.
          </li>
        </ul>
      </div>

      <div className="wi-card">
        <p className="wi-kicker">Prochaines sources nécessaires</p>
        <ul className="wi-limit-list">
          <li>
            Un référentiel de géométries communales, avec sa licence et sa version — il
            n&apos;est pas encore choisi.
          </li>
          <li>
            Les contours de bassins et sous-bassins, pour l&apos;échelle à laquelle la
            disponibilité se joue réellement.
          </li>
          <li>
            Une simplification de géométries compatible avec le budget de couche, qui est
            un budget distinct de celui du manifest.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ==========================================================================
   Chronologie climatique
   ========================================================================== */

/**
 * Chronologie — vide, et pédagogique plutôt que béante.
 *
 * Aucun événement n'est instruit. Plutôt qu'un grand bloc hachuré, la section
 * explique ce qu'un événement devra porter pour être affiché : c'est une
 * information réelle, et elle rend le critère vérifiable par le lecteur.
 */
export function WiTimeline() {
  if (CLIMATE_EVENTS.length > 0) {
    return (
      <ol className="wi-timeline" data-testid="wi-timeline">
        {CLIMATE_EVENTS.map((event) => (
          <li key={event.id} className="wi-timeline-item">
            <span className="wi-timeline-date wi-mono">{event.date}</span>
            <div>
              <h3 className="wi-h3">{event.title}</h3>
              <p className="wi-muted">
                {event.kind} · {event.territory}
              </p>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="wi-card wi-accent-data" data-testid="wi-timeline-empty">
      <div className="wi-badge wi-badge-pending">
        <span aria-hidden="true">◷</span> Aucun événement instruit
      </div>
      <h3 className="wi-h3" style={{ marginTop: "0.75rem" }}>
        Ce qu&apos;un événement devra porter pour apparaître ici
      </h3>
      <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
        Un événement climatique se raconte facilement et se vérifie difficilement.
        La chronologie n&apos;affichera donc que des entrées portant les cinq
        éléments suivants — l&apos;absence d&apos;un seul suffit à ne pas publier.
      </p>
      <ol className="wi-limit-list" style={{ marginTop: "0.75rem" }}>
        {CLIMATE_EVENT_REQUIREMENTS.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ol>
      <p className="wi-muted" style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
        Familles accueillies&nbsp;: {CLIMATE_EVENT_KINDS.join(", ")}.
      </p>
      <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
        Aucune causalité climatique ne sera déduite&nbsp;: un événement sera rapporté
        avec sa source, jamais expliqué par cette page.
      </p>
    </div>
  );
}
