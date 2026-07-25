"use client";

/**
 * WiFilterBar.tsx — barre de filtres de l'explorateur (Wave C, C06).
 *
 * Îlot client justifié : contrôles interactifs.
 *
 * Règles du blueprint §10.4 tenues ici :
 * - un filtre SANS option n'est pas rendu — il n'est pas rendu désactivé. Un
 *   contrôle grisé suggère qu'une donnée existe ailleurs ;
 * - aucune option n'est écrite en dur : toutes dérivent du read model ;
 * - la hiérarchie échelle → dimension → période → scénario est respectée ;
 * - tout changement est annoncé (`aria-live="polite"`).
 *
 * Aucun vocabulaire inventé : les libellés d'échelle sont ceux du contrat
 * (`world`/`europe`/`france`), les dimensions sont des `layer_id` réels.
 */

import { useId } from "react";

import type { WaterGeographyScope } from "@/lib/water-intelligence/contracts";

export interface WiFilterOption {
  readonly value: string;
  readonly label: string;
}

export interface WiFilterState {
  readonly scope: WaterGeographyScope;
  readonly dimension: string | null;
  readonly period: string | null;
  readonly scenario: string | null;
}

export interface WiFilterBarProps {
  readonly state: WiFilterState;
  readonly scopes: readonly WiFilterOption[];
  readonly dimensions: readonly WiFilterOption[];
  readonly periods: readonly WiFilterOption[];
  readonly scenarios: readonly WiFilterOption[];
  readonly onChange: (next: WiFilterState) => void;
  /** Dimensions prévues mais NON couvertes — listées hors du sélecteur. */
  readonly uncoveredDimensions?: readonly string[];
}

export function WiFilterBar({
  state,
  scopes,
  dimensions,
  periods,
  scenarios,
  onChange,
  uncoveredDimensions = [],
}: WiFilterBarProps) {
  const baseId = useId();

  const announcement =
    dimensions.length === 0
      ? "Aucune dimension publiée : aucun filtre de dimension n’est proposé."
      : `Échelle ${state.scope}, dimension ${state.dimension ?? "non sélectionnée"}.`;

  return (
    <div className="wi-card" role="group" aria-label="Filtres de la carte">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {scopes.length > 0 ? (
          <WiSelect
            id={`${baseId}-scope`}
            label="Échelle"
            value={state.scope}
            options={scopes}
            onChange={(value) =>
              // Changer un filtre de niveau n réinitialise les niveaux > n.
              onChange({
                scope: value as WaterGeographyScope,
                dimension: null,
                period: null,
                scenario: null,
              })
            }
          />
        ) : null}

        {dimensions.length > 0 ? (
          <WiSelect
            id={`${baseId}-dim`}
            label="Dimension"
            value={state.dimension ?? ""}
            options={dimensions}
            onChange={(value) =>
              onChange({ ...state, dimension: value, period: null, scenario: null })
            }
          />
        ) : null}

        {periods.length > 0 ? (
          <WiSelect
            id={`${baseId}-period`}
            label="Période"
            value={state.period ?? ""}
            options={periods}
            onChange={(value) => onChange({ ...state, period: value, scenario: null })}
          />
        ) : null}

        {/* Scénario : NON rendu si la liste est vide (blueprint §10.4). */}
        {scenarios.length > 0 ? (
          <WiSelect
            id={`${baseId}-scenario`}
            label="Scénario"
            value={state.scenario ?? ""}
            options={scenarios}
            onChange={(value) => onChange({ ...state, scenario: value })}
          />
        ) : null}
      </div>

      <p aria-live="polite" className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.8125rem" }}>
        {announcement}
      </p>

      {uncoveredDimensions.length > 0 ? (
        <section style={{ marginTop: "0.75rem" }}>
          <h4 className="wi-h4">Dimensions non encore couvertes</h4>
          <p className="wi-muted" style={{ fontSize: "0.8125rem" }}>
            Elles ne sont pas proposées comme options — une option grisée laisserait croire
            qu’une donnée existe ailleurs.
          </p>
          <ul className="wi-muted" style={{ paddingLeft: "1.1rem", fontSize: "0.8125rem" }}>
            {uncoveredDimensions.map((dimension) => (
              <li key={dimension}>{dimension}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function WiSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly WiFilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "10rem" }}>
      <label htmlFor={id} className="wi-muted" style={{ fontSize: "0.8125rem" }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          padding: "0.375rem 0.5rem",
          borderRadius: "0.375rem",
          border: "1px solid var(--wi-border-2)",
          background: "var(--wi-card-2)",
          color: "var(--wi-fg)",
          font: "inherit",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
