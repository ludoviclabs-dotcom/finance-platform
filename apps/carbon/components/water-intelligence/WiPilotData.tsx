"use client";

/**
 * WiPilotData — la première publication pilote BNPE.
 *
 * ## Trois formes, une seule donnée
 *
 * Table de preuve, cartes d'observation, comparaison visuelle. Les trois
 * rendent EXACTEMENT les mêmes trois valeurs, lues au même document. Ce n'est
 * pas une redondance : une table se relit et se copie, une carte se lit sur
 * mobile, un graphique se compare d'un coup d'œil. Aucune ne contient une
 * information que les autres n'ont pas.
 *
 * ## Ce que cette section NE produit pas
 *
 * Ni total, ni moyenne, ni classement, ni score, ni extrapolation.
 * `derived_use_allowed = false` au registre des décisions, et la raison est
 * concrète : la couverture BNPE est partielle par construction — les volumes
 * exonérés de redevance sont inconnus et les petits volumes ne sont pas
 * déclarés. Un total sur trois ouvrages présenterait une somme partielle
 * comme le prélèvement de la commune.
 *
 * ## Pourquoi la comparaison visuelle est légitime ici
 *
 * Elle ne l'est pas par défaut. Elle l'est parce que les trois valeurs
 * partagent la même unité (m³), la même année, la même métrique et la même
 * méthode : comparer trois volumes annuels d'ouvrages est sémantiquement
 * correct. Les barres sont proportionnelles à la valeur et **chaque barre
 * porte son nombre** — la longueur illustre, elle ne remplace pas.
 *
 * Aucune bibliothèque de visualisation : trois barres en CSS. Charger un
 * moteur de graphes pour trois valeurs coûterait plus cher que la page
 * entière.
 */

import { useState } from "react";

import {
  formatVolume,
  type PilotObservationRow,
} from "@/lib/water-intelligence/pilot-snapshot";

type ViewMode = "table" | "cards" | "compare";

const VIEWS: readonly { id: ViewMode; label: string }[] = [
  { id: "table", label: "Table de preuve" },
  { id: "cards", label: "Cartes d'observation" },
  { id: "compare", label: "Comparaison" },
];

const DATA_STATUS_LABELS: Record<string, string> = {
  manual: "Déclarée par l'exploitant",
  observed: "Observée",
  modelled: "Modélisée",
  estimated: "Estimée",
  fixture: "Fixture (jamais publiée)",
};

export interface WiPilotDataProps {
  observations: readonly PilotObservationRow[];
  coverageWarnings: readonly string[];
  scopeLabel: string;
  attribution: string | null;
  sourceUrl: string | null;
  isPublished: boolean;
  /** Message expliquant l'état non généré — jamais un faux snapshot. */
  notGeneratedExplanation: string;
}

export function WiPilotData({
  observations,
  coverageWarnings,
  scopeLabel,
  attribution,
  sourceUrl,
  isPublished,
  notGeneratedExplanation,
}: WiPilotDataProps) {
  const [view, setView] = useState<ViewMode>("table");

  if (!isPublished || observations.length === 0) {
    return (
      <div
        className="wi-card wi-accent-absent wi-absent-fill"
        data-testid="wi-pilot-not-generated"
      >
        <div className="wi-badge wi-badge-pending">
          <span aria-hidden="true">◷</span> Document pilote non généré
        </div>
        <h3 className="wi-h3" style={{ marginTop: "0.75rem" }}>
          La décision est signée, le document ne l&apos;est pas encore
        </h3>
        <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
          {notGeneratedExplanation}
        </p>
        <p className="wi-muted" style={{ marginTop: "0.75rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
          Rien n&apos;est affiché à la place. Un snapshot d&apos;attente, même étiqueté,
          se lirait comme une donnée — et cette page n&apos;en publie aucune qu&apos;elle
          n&apos;ait pas acquise, vérifiée et signée.
        </p>
      </div>
    );
  }

  /* La plus grande valeur sert d'ÉCHELLE au graphique, pas de référence
     éditoriale : elle n'est ni un maximum communal, ni un total. */
  const numericValues = observations
    .map((o) => (typeof o.value === "number" ? o.value : 0))
    .filter((v) => v > 0);
  const scale = numericValues.length ? Math.max(...numericValues) : 1;

  return (
    <div data-testid="wi-pilot-data">
      {/* ------------------------------------------------------- Sélecteur */}
      <div
        role="tablist"
        aria-label="Formes de présentation des trois observations"
        className="wi-viewswitch"
      >
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`wi-pilot-tab-${entry.id}`}
            aria-selected={view === entry.id}
            aria-controls={`wi-pilot-panel-${entry.id}`}
            className="wi-tab"
            onClick={() => setView(entry.id)}
            data-testid={`wi-pilot-tab-${entry.id}`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------- Table */}
      {view === "table" && (
        <div
          role="tabpanel"
          id="wi-pilot-panel-table"
          aria-labelledby="wi-pilot-tab-table"
          className="wi-table-wrap"
          style={{ marginTop: "1rem" }}
          /* Défilable au clavier : sans `tabindex`, une région qui déborde
             n'est pas atteignable sans souris. */
          tabIndex={0}
        >
          <table className="wi-table">
            <caption>
              Trois observations publiées — {scopeLabel}. Aucun total, aucune moyenne
              et aucun classement ne sont produits à partir de ces valeurs.
            </caption>
            <thead>
              <tr>
                <th scope="col">Ouvrage</th>
                <th scope="col">Année</th>
                <th scope="col" className="wi-th-num">
                  Volume
                </th>
                <th scope="col">Unité</th>
                <th scope="col">Statut de qualité</th>
                <th scope="col">Méthode</th>
                <th scope="col">Provenance</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((observation) => (
                <tr key={observation.ouvrageCode}>
                  <th scope="row" className="wi-mono">
                    {observation.ouvrageCode}
                  </th>
                  <td className="wi-num">{observation.periodStart.slice(0, 4)}</td>
                  <td className="wi-td-num">{formatVolume(observation.value)}</td>
                  <td>{observation.unit ?? "n.c."}</td>
                  <td>
                    {DATA_STATUS_LABELS[observation.dataStatus] ?? observation.dataStatus}
                  </td>
                  <td className="wi-mono">
                    {observation.methodCode} · {observation.methodVersion}
                  </td>
                  <td>
                    <span className="wi-mono">{observation.releaseKey}</span>
                    <br />
                    <span style={{ fontSize: "0.75rem", color: "var(--wi-subtle)" }}>
                      consultée le {observation.retrievedAt}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------------------------------------------------- Cartes */}
      {view === "cards" && (
        <div
          role="tabpanel"
          id="wi-pilot-panel-cards"
          aria-labelledby="wi-pilot-tab-cards"
          className="wi-grid wi-grid-3"
          style={{ marginTop: "1rem" }}
        >
          {observations.map((observation) => (
            <article
              key={observation.ouvrageCode}
              className="wi-card wi-accent-water"
              data-testid="wi-pilot-card"
            >
              <p className="wi-kicker" style={{ margin: 0 }}>
                Ouvrage
              </p>
              <p className="wi-mono" style={{ margin: "0.25rem 0 0" }}>
                {observation.ouvrageCode}
              </p>

              <p className="wi-pilot-value wi-num">
                {formatVolume(observation.value)}
                <span className="wi-pilot-unit">{observation.unit ?? "n.c."}</span>
              </p>

              <dl className="wi-pilot-meta">
                <div>
                  <dt>Période</dt>
                  <dd>
                    {observation.periodStart} → {observation.periodEnd}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>Hub&apos;Eau — BNPE</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>
                    {DATA_STATUS_LABELS[observation.dataStatus] ?? observation.dataStatus}
                  </dd>
                </div>
                <div>
                  <dt>Checksum</dt>
                  <dd className="wi-mono">{observation.checksum.slice(0, 16)}…</dd>
                </div>
              </dl>

              <p className="wi-pilot-limit">
                <span aria-hidden="true">⚠</span> Volume déclaré pour cet ouvrage.
                Ce n&apos;est ni le prélèvement de la commune, ni un total.
              </p>
            </article>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------ Comparaison */}
      {view === "compare" && (
        <div
          role="tabpanel"
          id="wi-pilot-panel-compare"
          aria-labelledby="wi-pilot-tab-compare"
          className="wi-card"
          style={{ marginTop: "1rem" }}
        >
          <h3 className="wi-h3">Comparaison directe des trois volumes</h3>
          <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem", maxWidth: "62ch" }}>
            La comparaison est légitime ici parce que les trois valeurs partagent la
            même unité, la même année, la même métrique et la même méthode. Les
            longueurs illustrent&nbsp;; <strong>chaque barre porte son nombre</strong>,
            et l&apos;échelle est la plus grande des trois valeurs — ni un maximum
            communal, ni un total.
          </p>

          {/*
            Rendu en `ul` et non en `figure` avec SVG : chaque barre est une
            ligne de liste portant son libellé et sa valeur en TEXTE. La
            visualisation est donc l'alternative textuelle d'elle-même — il n'y
            a rien à décrire séparément.
          */}
          <ul className="wi-bars" data-testid="wi-pilot-bars">
            {observations.map((observation) => {
              const value = typeof observation.value === "number" ? observation.value : 0;
              const pct = scale > 0 ? Math.max(2, Math.round((value / scale) * 100)) : 0;
              return (
                <li key={observation.ouvrageCode} className="wi-bar-row">
                  <span className="wi-bar-label wi-mono">{observation.ouvrageCode}</span>
                  <span className="wi-bar-track">
                    <span
                      className="wi-bar-fill"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="wi-bar-value wi-num">
                    {formatVolume(observation.value)}&nbsp;
                    <span className="wi-bar-unit">{observation.unit ?? ""}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="wi-muted" style={{ marginTop: "1rem", fontSize: "0.8125rem" }}>
            Aucun total n&apos;est affiché sous ces barres, et c&apos;est délibéré&nbsp;:
            additionner trois ouvrages déclarés donnerait un nombre que rien ne
            permet de lire comme le prélèvement d&apos;un territoire.
          </p>
        </div>
      )}

      {/* -------------------------------- Ce que ces données ne disent pas */}
      <div
        className="wi-card wi-accent-stress"
        style={{ marginTop: "1.5rem" }}
        data-testid="wi-pilot-limits"
      >
        <h3 className="wi-h3">Ce que ces données ne disent pas</h3>
        <ul className="wi-limit-list">
          {coverageWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          <li>
            Trois ouvrages ne décrivent pas une commune. Le périmètre est exhaustif
            <em> pour ce que la BNPE déclare</em>, ce qui n&apos;est pas la même chose
            qu&apos;exhaustif pour ce qui est prélevé.
          </li>
          <li>
            Un volume annuel ne dit rien de sa répartition dans l&apos;année&nbsp;: un
            prélèvement concentré sur l&apos;été et un prélèvement régulier produisent
            le même nombre et pas la même pression sur la ressource.
          </li>
          <li>
            Aucune conclusion de conformité n&apos;est tirée de ces valeurs. La
            conformité relève exclusivement du registre juridique, qui n&apos;instruit
            aujourd&apos;hui aucun texte.
          </li>
        </ul>

        {(attribution || sourceUrl) && (
          <p className="wi-muted wi-pilot-attribution">
            {attribution}
            {sourceUrl && (
              <>
                {" "}
                <a
                  href={sourceUrl}
                  className="wi-link"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Page officielle de la source
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
