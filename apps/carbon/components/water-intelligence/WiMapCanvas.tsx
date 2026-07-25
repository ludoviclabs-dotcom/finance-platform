"use client";

/**
 * WiMapCanvas.tsx — rendu cartographique D3 (Wave C, C05).
 *
 * Îlot client justifié : D3 a besoin du DOM.
 *
 * Squelette technique repris de `WorldMap.tsx` (`components/materials/map/`) :
 * D3 possède le sous-arbre, `ResizeObserver` déclenche le rendu, la projection
 * est `geoNaturalEarth1().fitExtent`, et l'infobulle vit en React HORS du
 * sous-arbre D3. Ce qui n'est PAS repris : le provider de thème `--mx-*`, le
 * domaine « matières », les flèches de flux et l'anneau pulsé — ce dernier est
 * explicitement proscrit par le blueprint §11.7.
 *
 * Dépendances : `d3-geo`, `d3-selection`, `topojson-client`, `world-atlas`,
 * toutes déjà installées. Aucun ajout, aucune tuile, aucun appel réseau : la
 * topologie est un import de module.
 */

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { useCallback, useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";

import type { WaterGeographyScope } from "@/lib/water-intelligence/contracts";

/** Une entité cartographiable : un code officiel, une valeur, un état. */
export interface WiMapFeatureValue {
  /** Clé de jointure — le CODE, jamais un libellé. */
  readonly code: string;
  readonly label: string;
  /** `null` = absence : rendue en gris hachuré, jamais en teinte basse. */
  readonly value: number | null;
  readonly unit: string | null;
  /** `true` si la valeur est retenue pour licence. */
  readonly withheld?: boolean;
}

export interface WiMapCanvasProps {
  readonly scope: WaterGeographyScope;
  readonly values: readonly WiMapFeatureValue[];
  readonly selectedCode: string | null;
  readonly onSelect: (code: string) => void;
  readonly dimensionLabel: string;
  readonly periodLabel: string;
  /** Neutralise les transitions — une teinte qui change est un mouvement. */
  readonly reducedMotion?: boolean;
}

interface TopoGeometry {
  readonly type: string;
  readonly properties?: Record<string, unknown>;
  readonly id?: string | number;
}

export function WiMapCanvas({
  scope,
  values,
  selectedCode,
  onSelect,
  dimensionLabel,
  periodLabel,
  reducedMotion = false,
}: WiMapCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<WiMapFeatureValue | null>(null);

  const byCode = useCallback(() => {
    const index = new Map<string, WiMapFeatureValue>();
    for (const entry of values) index.set(entry.code, entry);
    return index;
  }, [values]);

  const render = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth || 640;
    const height = Math.max(280, Math.round(width * 0.52));
    const index = byCode();

    // Domaine des valeurs présentes uniquement : une absence ne participe
    // jamais à l'échelle, elle serait comptée comme une valeur basse.
    const present = values
      .map((entry) => entry.value)
      .filter((value): value is number => value !== null);
    const min = present.length ? Math.min(...present) : 0;
    const max = present.length ? Math.max(...present) : 1;

    const collection = feature(
      worldAtlas as never,
      (worldAtlas as never as { objects: { countries: never } }).objects.countries,
    ) as unknown as { features: TopoGeometry[] };

    const projection = geoNaturalEarth1().fitExtent(
      [
        [8, 8],
        [width - 8, height - 8],
      ],
      collection as never,
    );
    const path = geoPath(projection);

    const svg = select(host).selectAll("svg").data([null]);
    const svgEnter = svg
      .enter()
      .append("svg")
      .attr("role", "img")
      .attr("tabindex", 0);
    const merged = svgEnter.merge(svg as never);

    merged
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr(
        "aria-label",
        `Carte — dimension ${dimensionLabel}, échelle ${scope}, période ${periodLabel}. ` +
          "Les mêmes données sont disponibles dans le tableau équivalent ci-dessous.",
      );

    const shapes = merged
      .selectAll("path.wi-map-shape")
      .data(collection.features as never[]);

    shapes
      .enter()
      .append("path")
      .attr("class", "wi-map-shape")
      .merge(shapes as never)
      .attr("d", path as never)
      .attr("fill", (datum: never) => {
        const code = featureCode(datum as TopoGeometry);
        const entry = code ? index.get(code) : undefined;
        if (!entry || entry.value === null) return "var(--wi-map-land)";
        const ratio = max === min ? 1 : (entry.value - min) / (max - min);
        return `color-mix(in srgb, var(--wi-ramp-to) ${Math.round(
          20 + ratio * 80,
        )}%, var(--wi-ramp-from))`;
      })
      .attr("stroke", (datum: never) => {
        const code = featureCode(datum as TopoGeometry);
        return code && code === selectedCode ? "var(--wi-map-select)" : "var(--wi-map-stroke)";
      })
      .attr("stroke-width", (datum: never) => {
        const code = featureCode(datum as TopoGeometry);
        return code && code === selectedCode ? 2.5 : 0.5;
      })
      .style("transition", reducedMotion ? "none" : "fill 250ms ease-out")
      .style("cursor", (datum: never) => {
        const code = featureCode(datum as TopoGeometry);
        return code && index.has(code) ? "pointer" : "default";
      })
      .on("click", (_event: unknown, datum: never) => {
        const code = featureCode(datum as TopoGeometry);
        if (code && index.has(code)) onSelect(code);
      })
      .on("mouseenter", (_event: unknown, datum: never) => {
        const code = featureCode(datum as TopoGeometry);
        setHovered(code ? index.get(code) ?? null : null);
      })
      .on("mouseleave", () => setHovered(null));

    shapes.exit().remove();
  }, [byCode, dimensionLabel, onSelect, periodLabel, reducedMotion, scope, selectedCode, values]);

  useEffect(() => {
    render();
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => render());
    observer.observe(host);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div>
      <div
        ref={hostRef}
        className="wi-card"
        style={{ padding: "0.5rem", borderRadius: "0.75rem" }}
      />
      {/* Infobulle React, HORS du sous-arbre D3. */}
      <div aria-live="polite" className="wi-muted" style={{ marginTop: "0.5rem", minHeight: "1.5rem", fontSize: "0.875rem" }}>
        {hovered ? (
          <span>
            <strong>{hovered.label}</strong>{" "}
            {hovered.withheld ? (
              <span>— valeur non publiable (licence)</span>
            ) : hovered.value === null ? (
              <span>— donnée absente</span>
            ) : (
              <span>
                — {hovered.value}
                {hovered.unit ? ` ${hovered.unit}` : ""}
              </span>
            )}
          </span>
        ) : (
          <span>Survolez ou sélectionnez un territoire pour en afficher le détail.</span>
        )}
      </div>
    </div>
  );
}

/** Code de jointure d'une entité. Jamais le nom : aucune jointure par libellé. */
function featureCode(geometry: TopoGeometry): string | null {
  if (geometry.id === undefined || geometry.id === null) return null;
  return String(geometry.id).padStart(3, "0");
}
