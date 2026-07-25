/**
 * WiMapFrame.tsx — cadre de l'explorateur cartographique (Wave C, C04/C05).
 *
 * Server Component : le cadre, la légende, la table alternative et les états
 * vides sont rendus au SERVEUR et présents dans le DOM initial. C'est ce qui
 * rend la table un équivalent réel de la carte (blueprint §12.6) plutôt qu'une
 * promesse — l'information reste accessible sans le JS de la carte.
 *
 * Décision structurante reprise du dépôt (`ConcentrationChoropleth`) :
 * **si aucune couche n'est publiée, la carte n'est pas rendue du tout.** Un
 * fond de carte sans données serait une décoration, et surtout laisserait
 * croire à une couverture nulle plutôt qu'à une absence de publication.
 */

import type { ReactNode } from "react";

import type { WaterPublicSnapshot } from "@/lib/water-intelligence/public-snapshot";

import { WiAccessibleDataTable, type WiTableColumn, type WiTableRow } from "./WiFoundations";
import { WiBadge } from "./WiPrimitives";

export interface WiMapFrameProps {
  readonly snapshot: WaterPublicSnapshot;
  /** Rendu de la carte, monté UNIQUEMENT si des couches sont publiées. */
  readonly map?: ReactNode;
  readonly legend?: ReactNode;
  readonly filters?: ReactNode;
  readonly tableColumns: readonly WiTableColumn[];
  readonly tableRows: readonly WiTableRow[];
}

export function WiMapFrame({
  snapshot,
  map,
  legend,
  filters,
  tableColumns,
  tableRows,
}: WiMapFrameProps) {
  const hasLayers = snapshot.coverage.layer_count > 0 && !snapshot.is_empty;

  if (!hasLayers) {
    return <WiMapUnavailable snapshot={snapshot} />;
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {filters}
      <div className="wi-map-grid">
        <div>{map}</div>
        <div>{legend}</div>
      </div>
      <section aria-label="Tableau équivalent à la carte">
        <h3 className="wi-h3">Tableau équivalent</h3>
        <p className="wi-muted" style={{ marginTop: "0.375rem", fontSize: "0.875rem" }}>
          Les mêmes données que la carte, sans exception : toute entité de la couche figure
          ici, y compris celles sans valeur.
        </p>
        <div style={{ marginTop: "0.75rem" }}>
          <WiAccessibleDataTable
            caption="Territoires de la couche affichée"
            columns={tableColumns}
            rows={tableRows}
            emptyLabel="Aucune entité dans la couche affichée."
          />
        </div>
      </section>
    </div>
  );
}

/**
 * État « aucune carte » — honnête et informatif.
 *
 * Ne rend ni fond de carte, ni silhouette, ni squelette animé : rien qui
 * puisse être pris pour une donnée. Explique ce qui manque et pourquoi.
 */
function WiMapUnavailable({ snapshot }: { snapshot: WaterPublicSnapshot }) {
  return (
    <div className="wi-absent-fill" style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <WiBadge tone="absent" label="Aucune couche publiée" />
        <span className="wi-mono wi-muted" style={{ fontSize: "0.75rem" }}>
          {snapshot.coverage.excluded_source_count} source
          {snapshot.coverage.excluded_source_count > 1 ? "s" : ""} écartée
          {snapshot.coverage.excluded_source_count > 1 ? "s" : ""}
        </span>
      </div>
      <p className="wi-muted" style={{ marginTop: "0.75rem" }}>
        La carte n’est pas affichée : aucune couche géographique n’est publiée. Un fond de
        carte sans données laisserait croire à une couverture nulle, alors qu’il s’agit
        d’une absence de publication.
      </p>
      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
        Les sources écartées et leurs motifs sont détaillés dans la section «&nbsp;Sources et
        preuves&nbsp;».
      </p>
    </div>
  );
}
