"use client";

/**
 * Choroplèthe D3 (projection Natural Earth + topojson-client + world-atlas
 * bundlé) — remplace l'ancienne intégration Mapbox : aucun token, aucune
 * requête réseau au runtime, tout est du JS bundlé + une donnée topojson
 * statique importée en module (apps/carbon/lib/mapbox.ts est supprimé).
 * D3 possède entièrement le sous-arbre du conteneur ref — React ne touche
 * jamais son intérieur, seuls l'infobulle et les contrôles autour sont React.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { zoom as d3zoom, type ZoomBehavior } from "d3-zoom";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldTopology from "world-atlas/countries-110m.json";

import { useMxTheme } from "../MxThemeProvider";
import type { CountryWeight } from "@/lib/crm/countryWeights";

interface Props {
  weights: CountryWeight[];
  showFlows: boolean;
  selectedCountry: string | null;
  onSelectCountry: (country: string | null) => void;
}

interface TooltipState {
  x: number;
  y: number;
  country: string;
  materialsCount: number;
  totalPts: number;
  top: { name: string; share: number }[];
}

// Point d'ancrage des flèches de flux ("vers l'Europe"), et pays déjà
// européens/périphériques exclus des flèches (n'auraient pas de sens visuel).
const EUROPE_TARGET: [number, number] = [8.5, 50.2];
const FLOW_EXCLUDE_ISO_NUMERIC = new Set(["250", "056", "724", "380", "578"]);
const MAX_FLOW_ARROWS = 9;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Interpolation linéaire RGB — équivalent de d3.interpolateRgb(from, to)(t)
// sans dépendre du package d3-interpolate pour une seule fonction.
function lerpColor(fromHex: string, toHex: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hexToRgb(fromHex);
  const [r2, g2, b2] = hexToRgb(toHex);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function isoOf(feature: Feature<Geometry>): string | null {
  return feature.id != null ? String(feature.id).padStart(3, "0") : null;
}

export default function WorldMap({ weights, showFlows, selectedCountry, onSelectCountry }: Props) {
  const { theme } = useMxTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgNodeRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const features = useMemo(() => {
    const topology = worldTopology as unknown as Topology;
    const countries = topology.objects.countries as GeometryCollection;
    const collection = feature(topology, countries) as FeatureCollection<Geometry>;
    // Antarctique (010) exclue — aucune production minière à représenter.
    return collection.features.filter(f => f.id !== "010");
  }, []);

  const byIsoNumeric = useMemo(() => {
    const map = new Map<string, CountryWeight>();
    for (const w of weights) if (w.isoNumeric) map.set(w.isoNumeric, w);
    return map;
  }, [weights]);

  const maxWeight = Math.sqrt(weights[0]?.total ?? 1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Fonction nommée (plutôt qu'inline) et paramétrée par `el` (plutôt que de
    // fermer sur la variable externe) pour que le ResizeObserver plus bas
    // puisse la rappeler directement : un changement de largeur/hauteur du
    // conteneur (breakpoint lg, rotation, sidebar qui grandit après sélection
    // d'un pays) doit recalculer la projection, pas seulement effacer l'infobulle.
    function render(el: HTMLDivElement) {
      const width = el.clientWidth || 860;
      const height = el.clientHeight || 460;
      const dark = theme !== "clair";

      select(el).selectAll("*").remove();

      const svg = select(el)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "block");

      const g = svg.append("g");

      const projection = geoNaturalEarth1().fitExtent(
        [[8, 8], [width - 8, height - 8]],
        { type: "FeatureCollection", features } as FeatureCollection<Geometry>
      );
      const path = geoPath(projection);

      const baseColor = dark ? "#152136" : "#E4EAF2";
      const strokeColor = dark ? "rgba(255,255,255,.09)" : "#FFFFFF";
      const highColor = dark ? "#E0655A" : "#C94F43";
      const lowColor = dark ? "#33405A" : "#F2DCD2";
      const cyanColor = dark ? "#22D3EE" : "#0891B2";

      const featByIso = new Map(features.map(f => [isoOf(f), f]));

      g.selectAll("path.mx-country")
        .data(features)
        .join("path")
        .attr("class", "mx-country")
        .attr("d", (f: GeoPermissibleObjects) => path(f))
        .attr("fill", f => {
          const c = byIsoNumeric.get(isoOf(f as Feature<Geometry>) ?? "");
          return c ? lerpColor(lowColor, highColor, Math.sqrt(c.total) / maxWeight) : baseColor;
        })
        .attr("stroke", f => {
          const c = byIsoNumeric.get(isoOf(f as Feature<Geometry>) ?? "");
          return c && c.country === selectedCountry ? "var(--mx-fg)" : strokeColor;
        })
        .attr("stroke-width", f => {
          const c = byIsoNumeric.get(isoOf(f as Feature<Geometry>) ?? "");
          return c && c.country === selectedCountry ? 2 : 0.6;
        })
        .style("cursor", f => (byIsoNumeric.has(isoOf(f as Feature<Geometry>) ?? "") ? "pointer" : "default"))
        .on("mousemove", (event: MouseEvent, f) => {
          const c = byIsoNumeric.get(isoOf(f as Feature<Geometry>) ?? "");
          if (!c) {
            setTooltip(null);
            return;
          }
          const rect = el.getBoundingClientRect();
          let x = event.clientX - rect.left + 14;
          let y = event.clientY - rect.top + 14;
          if (x > rect.width - 220) x = event.clientX - rect.left - 220;
          if (y > rect.height - 130) y = event.clientY - rect.top - 130;
          setTooltip({
            x, y, country: c.country,
            materialsCount: c.materials.length,
            totalPts: c.total,
            top: c.materials.slice(0, 3).map(m => ({ name: m.name_fr, share: m.share_pct })),
          });
        })
        .on("mouseleave", () => setTooltip(null))
        .on("click", (_event: MouseEvent, f) => {
          const c = byIsoNumeric.get(isoOf(f as Feature<Geometry>) ?? "");
          if (c) onSelectCountry(selectedCountry === c.country ? null : c.country);
        });

      if (showFlows) {
        const target = projection(EUROPE_TARGET);
        if (target) {
          const flowG = g.append("g");
          const candidates = weights
            .filter(w => w.isoNumeric && !FLOW_EXCLUDE_ISO_NUMERIC.has(w.isoNumeric))
            .slice(0, MAX_FLOW_ARROWS);
          const topTotal = weights[0]?.total || 1;

          candidates.forEach((c, i) => {
            const f = featByIso.get(c.isoNumeric);
            if (!f) return;
            const origin = path.centroid(f);
            if (!Number.isFinite(origin[0]) || !Number.isFinite(origin[1])) return;
            const midX = (origin[0] + target[0]) / 2;
            const midY = (origin[1] + target[1]) / 2;
            const dx = target[0] - origin[0];
            const dy = target[1] - origin[1];
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const curveX = midX - (dy / dist) * Math.min(90, dist * 0.25);
            const curveY = midY + (dx / dist) * Math.min(90, dist * 0.25);
            const strokeW = 1 + 2.2 * (c.total / topTotal);

            flowG.append("path")
              .attr("d", `M${origin[0]},${origin[1]} Q${curveX},${curveY} ${target[0]},${target[1]}`)
              .attr("fill", "none")
              .attr("stroke", cyanColor)
              .attr("stroke-width", strokeW)
              .attr("stroke-dasharray", "7 9")
              .attr("opacity", 0.55)
              .attr("class", "mx-flow");
            flowG.append("circle").attr("cx", origin[0]).attr("cy", origin[1]).attr("r", 3).attr("fill", cyanColor);
            flowG.append("circle")
              .attr("cx", origin[0]).attr("cy", origin[1]).attr("r", 3)
              .attr("fill", "none").attr("stroke", cyanColor).attr("stroke-width", 1)
              .attr("class", "mx-ping-ring")
              .style("animation-delay", `${i * 0.25}s`);
          });

          const hubColor = dark ? "#34D399" : "#059669";
          flowG.append("circle")
            .attr("cx", target[0]).attr("cy", target[1]).attr("r", 4.5)
            .attr("fill", hubColor).attr("stroke", dark ? "#06121E" : "#fff").attr("stroke-width", 1.5);
          flowG.append("circle")
            .attr("cx", target[0]).attr("cy", target[1]).attr("r", 4)
            .attr("fill", "none").attr("stroke", hubColor).attr("stroke-width", 1.2)
            .attr("class", "mx-ping-ring");
        }
      }

      const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 7])
        .on("zoom", event => g.attr("transform", event.transform.toString()));
      svg.call(zoomBehavior);
      svgNodeRef.current = svg.node();
      zoomBehaviorRef.current = zoomBehavior;
    }

    render(el);

    // Le conteneur peut changer de taille sans que les dépendances de l'effet
    // ne changent (breakpoint lg, rotation, sidebar qui grandit après sélection
    // d'un pays) : on rappelle render() directement pour recalculer width/height
    // et reconstruire la projection — un simple setState ne suffit pas, la carte
    // ne dépend d'aucun état React lié à la taille.
    const resizeObserver = new ResizeObserver(() => {
      setTooltip(null);
      render(el);
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      select(el).selectAll("*").remove();
    };
  }, [features, byIsoNumeric, maxWeight, theme, showFlows, selectedCountry, weights, onSelectCountry]);

  const zoomBy = (factor: number) => {
    const svgNode = svgNodeRef.current;
    const zb = zoomBehaviorRef.current;
    if (!svgNode || !zb) return;
    select(svgNode).transition().duration(250).call(zb.scaleBy, factor);
  };

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)", minHeight: 440 }}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none rounded-[10px] border px-3.5 py-2.5 text-xs max-w-[240px]"
          style={{
            left: tooltip.x, top: tooltip.y,
            background: "var(--mx-surface)", borderColor: "var(--mx-border-2)",
            boxShadow: "0 10px 30px rgba(0,0,0,.35)", color: "var(--mx-fg)",
          }}
        >
          <p className="m-0 font-bold">{tooltip.country}</p>
          <p className="m-0 mt-[3px] mb-1.5" style={{ fontFamily: "var(--mx-font-mono)", fontSize: 11, color: "var(--mx-cyan)" }}>
            {tooltip.materialsCount} matière(s) · {Math.round(tooltip.totalPts)} pts
          </p>
          <div className="flex flex-col gap-[3px]" style={{ fontSize: 11.5 }}>
            {tooltip.top.map(m => (
              <span key={m.name} className="flex justify-between gap-3.5">
                <span>{m.name}</span>
                <span style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-muted)" }}>{m.share}%</span>
              </span>
            ))}
          </div>
          <p className="m-0 mt-1.5" style={{ fontSize: "10.5px", color: "var(--mx-subtle)" }}>Cliquer pour le détail →</p>
        </div>
      )}

      <div className="absolute top-3.5 right-3.5 flex flex-col gap-1.5 z-[4]">
        <button
          type="button"
          onClick={() => zoomBy(1.5)}
          aria-label="Zoomer"
          className="w-[30px] h-[30px] rounded-lg border flex items-center justify-center text-[15px] cursor-pointer leading-none"
          style={{ borderColor: "var(--mx-border-2)", background: "var(--mx-surface)", color: "var(--mx-fg)" }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.5)}
          aria-label="Dézoomer"
          className="w-[30px] h-[30px] rounded-lg border flex items-center justify-center text-[15px] cursor-pointer leading-none"
          style={{ borderColor: "var(--mx-border-2)", background: "var(--mx-surface)", color: "var(--mx-fg)" }}
        >
          −
        </button>
      </div>

      <div className="absolute left-3.5 bottom-3 flex items-center gap-2 z-[4]" style={{ fontSize: "10.5px", color: "var(--mx-subtle)" }}>
        <span>Poids faible</span>
        <div className="w-[110px] h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, var(--mx-card-2), var(--mx-tier-high))" }} />
        <span>élevé</span>
        {showFlows && (
          <span className="ml-2.5 flex items-center gap-1.5">
            <span className="w-3.5 h-0.5" style={{ background: "var(--mx-cyan)" }} />
            flux d&apos;approvisionnement
          </span>
        )}
      </div>
    </div>
  );
}
