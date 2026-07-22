"use client";

/**
 * ConcentrationChoropleth — carte du monde OFFLINE (topologie `world-atlas`
 * embarquée, aucune tuile chargée au runtime → respecte « pas d'internet au
 * runtime »). Colorie les pays selon la part d'approvisionnement RÉELLE du tenant
 * (rampe séquentielle ambre, une seule teinte) ; les pays sans donnée reçoivent
 * un neutre distinct.
 *
 * Accessibilité : chaque pays colorié porte un `<title>` (part), et une « vue
 * tableau » textuelle liste les parts sous la carte (jamais couleur seule).
 */

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";

import { ISO_A2_TO_NUM, shareToAmber } from "@/lib/resources-viz";

type CountryProps = { name?: string };

// Décodé UNE fois au chargement du module (pur). Le cast passe par `unknown` car
// le JSON world-atlas n'est pas typé Topology côté package.
const WORLD = feature(
  worldTopo as unknown as Parameters<typeof feature>[0],
  (worldTopo as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects
    .countries,
) as unknown as FeatureCollection<Geometry, CountryProps>;

const NEUTRAL = "var(--color-surface-raised)";

export function ConcentrationChoropleth({
  shares,
  width = 460,
  height = 232,
  testId,
}: {
  shares: { country_code: string; share_pct: number }[];
  width?: number;
  height?: number;
  testId?: string;
}) {
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);

  const { paths, shareByNum, maxShare, ranked } = useMemo(() => {
    const byNum = new Map<string, number>();
    const byCode: { code: string; share: number }[] = [];
    for (const s of shares) {
      const num = ISO_A2_TO_NUM[s.country_code.toUpperCase()];
      if (num) byNum.set(num, (byNum.get(num) ?? 0) + s.share_pct);
      byCode.push({ code: s.country_code.toUpperCase(), share: s.share_pct });
    }
    const max = Math.max(1, ...byNum.values());
    const projection = geoNaturalEarth1().fitSize([width, height], WORLD);
    const draw = geoPath(projection);
    const p = WORLD.features.map((f) => ({
      id: String(f.id),
      name: f.properties?.name ?? "",
      d: draw(f) ?? "",
    }));
    const rankedShares = [...byCode].sort((a, b) => b.share - a.share);
    return { paths: p, shareByNum: byNum, maxShare: max, ranked: rankedShares };
  }, [shares, width, height]);

  if (shares.length === 0) return null;

  return (
    <div className="relative" data-testid={testId}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Carte des parts d'approvisionnement par pays"
        onMouseLeave={() => setHover(null)}
      >
        {paths.map((p) => {
          const share = shareByNum.get(p.id);
          const fill = share !== undefined ? shareToAmber(share, maxShare) : NEUTRAL;
          return (
            <path
              key={p.id}
              d={p.d}
              fill={fill}
              stroke="var(--color-border)"
              strokeWidth={0.4}
              onMouseMove={
                share !== undefined
                  ? (e) => {
                      const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      setHover({
                        label: `${p.name} · ${Math.round(share)} %`,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }
                  : undefined
              }
            >
              {share !== undefined && <title>{`${p.name} : ${Math.round(share)} %`}</title>}
            </path>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-foreground)] shadow-lg"
          style={{ left: hover.x + 8, top: hover.y + 8 }}
        >
          {hover.label}
        </div>
      )}

      {/* Vue tableau (accessibilité + jamais couleur seule) */}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--color-muted-foreground)]">
        {ranked.map((r) => (
          <li key={r.code} className="tabular-nums">
            <span className="font-mono">{r.code}</span> {Math.round(r.share)} %
          </li>
        ))}
      </ul>
    </div>
  );
}
