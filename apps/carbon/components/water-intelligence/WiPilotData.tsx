"use client";

/**
 * WiPilotData — la première publication pilote BNPE (Water Intelligence v2).
 *
 * ## Ce qui a changé par rapport à la V1
 *
 * La V1 offrait trois vues (table, cartes, comparaison) sélectionnées par
 * onglets. La v2 simplifie en un seul panneau — décision signée à gauche,
 * volumes en barres à droite — parce que trois valeurs ne justifient pas un
 * sélecteur : les trois se lisent d'un coup d'œil dans la même vue. Chaque
 * ligne de la liste porte son code d'ouvrage ET sa valeur en texte : la barre
 * illustre, elle ne remplace jamais le nombre.
 *
 * ## Ce que cette section NE produit toujours pas
 *
 * Ni total, ni moyenne, ni classement, ni score, ni extrapolation.
 * `derived_use_allowed = false` au registre des décisions, et la raison est
 * concrète : la couverture BNPE est partielle par construction — les volumes
 * exonérés de redevance sont inconnus et les petits volumes ne sont pas
 * déclarés. Un total sur trois ouvrages présenterait une somme partielle
 * comme le prélèvement de la commune.
 *
 * ## Les avertissements ne sont PAS résumés
 *
 * La maquette n'illustre qu'un seul avertissement dans la carte de décision,
 * par manque de place à l'écran. Les `coverageWarnings` restent TOUS affichés
 * ici, dans l'ordre où le document les porte : ce sont des avertissements
 * obligatoires du backend, pas une liste éditoriale qu'on pourrait raccourcir
 * pour la mise en page.
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { formatVolume, type PilotObservationRow } from "@/lib/water-intelligence/pilot-snapshot";

export interface WiPilotDataProps {
  observations: readonly PilotObservationRow[];
  coverageWarnings: readonly string[];
  scopeLabel: string;
  attribution: string | null;
  sourceUrl: string | null;
  isPublished: boolean;
  reviewedOn: string;
  sourceCode: string;
  licenseLabel: string;
  methodLabel: string;
  yearLabel: string;
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
  reviewedOn,
  sourceCode,
  licenseLabel,
  methodLabel,
  yearLabel,
  notGeneratedExplanation,
}: WiPilotDataProps) {
  const reduce = useReducedMotion();

  /* La plus grande valeur sert d'ÉCHELLE au graphique, pas de référence
     éditoriale : elle n'est ni un maximum communal, ni un total. */
  const numericValues = observations
    .map((o) => (typeof o.value === "number" ? o.value : 0))
    .filter((v) => v > 0);
  const scale = numericValues.length ? Math.max(...numericValues) : 1;

  const bars = useMemo(
    () =>
      observations.map((observation) => {
        const value = typeof observation.value === "number" ? observation.value : 0;
        const pct = scale > 0 ? Math.max(2, Math.round((value / scale) * 100)) : 0;
        return { observation, pct };
      }),
    [observations, scale],
  );

  if (!isPublished || observations.length === 0) {
    return (
      <div className="wi-card wi-accent-absent wi-absent-fill" data-testid="wi-pilot-not-generated">
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

  return (
    <div data-testid="wi-pilot-data">
      <div className="wi-grid wi-grid-2" style={{ alignItems: "stretch" }}>
        {/* -------------------------------------------------- Décision signée */}
        <div className="wi-card wi-accent-water" data-testid="wi-pilot-decision">
          <p className="wi-kicker">Décision signée</p>
          <p style={{ marginTop: "0.75rem", fontSize: "0.9375rem" }}>
            Une décision humaine signée le <strong>{reviewedOn}</strong> autorise la
            publication de <strong>{observations.length} observations</strong> de
            prélèvements déclarés, sur la {scopeLabel}. Rien d&apos;autre.
          </p>
          <dl style={{ marginTop: "1.125rem", display: "grid", gap: "0.75rem" }}>
            <div>
              <dt
                style={{
                  fontSize: "0.6875rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--wi-subtle)",
                  fontWeight: 650,
                }}
              >
                Source
              </dt>
              <dd className="wi-mono" style={{ margin: "0.125rem 0 0", fontSize: "0.8125rem" }}>
                {sourceCode}
              </dd>
            </div>
            <div>
              <dt
                style={{
                  fontSize: "0.6875rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--wi-subtle)",
                  fontWeight: 650,
                }}
              >
                Licence
              </dt>
              <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem" }}>{licenseLabel}</dd>
            </div>
            <div>
              <dt
                style={{
                  fontSize: "0.6875rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--wi-subtle)",
                  fontWeight: 650,
                }}
              >
                Méthode
              </dt>
              <dd style={{ margin: "0.125rem 0 0", fontSize: "0.875rem" }}>{methodLabel}</dd>
            </div>
          </dl>

          {/* Tous les avertissements obligatoires — voir docstring : la
              maquette n'en illustre qu'un, cette page les porte tous. */}
          <ul
            className="wi-limit-list"
            style={{
              marginTop: "1.125rem",
              paddingTop: "0.875rem",
              borderTop: "1px solid var(--wi-border)",
              color: "var(--wi-stress)",
            }}
            data-testid="wi-pilot-warnings"
          >
            {coverageWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>

        {/* --------------------------------------------------- Volumes annuels */}
        <div className="wi-card" style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <h3 className="wi-h3">Volumes annuels par ouvrage — {yearLabel}</h3>
            <span className="wi-mono" style={{ fontSize: "0.6875rem", color: "var(--wi-subtle)" }}>
              unité&nbsp;: {observations[0]?.unit ?? "n.c."}
            </span>
          </div>

          <ul className="wi-bars" style={{ marginTop: "1.375rem", flex: 1 }} data-testid="wi-pilot-bars">
            {bars.map(({ observation, pct }) => (
              <li key={observation.ouvrageCode} className="wi-bar-row">
                <span className="wi-bar-label wi-mono">{observation.ouvrageCode}</span>
                <span className="wi-bar-track">
                  <motion.span
                    className="wi-bar-fill"
                    aria-hidden="true"
                    initial={reduce ? false : { width: "0%" }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    style={reduce ? { width: `${pct}%` } : undefined}
                  />
                </span>
                <span className="wi-bar-value wi-num">
                  {formatVolume(observation.value)}&nbsp;
                  <span className="wi-bar-unit">{observation.unit ?? ""}</span>
                </span>
              </li>
            ))}
          </ul>

          <p
            className="wi-muted"
            style={{
              marginTop: "1.375rem",
              paddingTop: "0.875rem",
              borderTop: "1px solid var(--wi-border)",
              fontSize: "0.78125rem",
            }}
          >
            Aucun total, aucune moyenne, aucun classement&nbsp;: la décision de
            publication interdit tout usage dérivé. Trois volumes, rien de plus.
          </p>
        </div>
      </div>

      {/* -------------------------------- Ce que ces données ne disent pas */}
      <div className="wi-card wi-accent-stress" style={{ marginTop: "1.5rem" }} data-testid="wi-pilot-limits">
        <h3 className="wi-h3">Ce que ces données ne disent pas</h3>
        <ul className="wi-limit-list">
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
                <a href={sourceUrl} className="wi-link" target="_blank" rel="noreferrer noopener">
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
