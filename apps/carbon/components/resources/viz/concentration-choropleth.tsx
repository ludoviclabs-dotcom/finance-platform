"use client";

/**
 * ConcentrationChoropleth — carte du monde OFFLINE (topologie `world-atlas`
 * embarquée, aucune tuile chargée au runtime → respecte « pas d'internet au
 * runtime »). Colorie les pays selon la part d'approvisionnement RÉELLE du tenant
 * (rampe séquentielle ambre, une seule teinte) ; les pays sans donnée reçoivent
 * un neutre distinct.
 *
 * COUVERTURE PAYS (P2) : la jointure passe par le référentiel ISO 3166-1 complet
 * (`lib/iso3166.ts`), et les DEUX côtés sont zero-paddés — les `id` de world-atlas
 * ne sont pas tous sur 3 chiffres (ex. `76` pour le Brésil). Un code non assigné
 * n'est JAMAIS colorié comme une part nulle : il est signalé explicitement, sa part
 * reste dans la vue tableau, et si AUCUNE observation n'est cartographiable la carte
 * n'est pas rendue du tout (plutôt qu'une carte trompeuse).
 *
 * Accessibilité : chaque pays colorié porte un `<title>`, et la vue tableau liste
 * TOUTES les observations (jamais couleur seule, jamais d'omission silencieuse).
 */

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";

import { iso3166Alpha2ToNumeric, normalizeIsoNumeric } from "@/lib/iso3166";
import { shareToAmber } from "@/lib/resources-viz";

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

  const { paths, shareByNum, maxShare, ranked, unmapped } = useMemo(() => {
    // Vue tableau : TOUTES les observations, normalisées, triées — jamais filtrées.
    const rankedShares = shares
      .map((s) => ({
        code: String(s.country_code ?? "").trim().toUpperCase(),
        share: s.share_pct,
      }))
      .sort((a, b) => b.share - a.share);

    const byNum = new Map<string, number>();
    const unmappedCodes: string[] = [];
    for (const s of rankedShares) {
      const numeric = iso3166Alpha2ToNumeric(s.code);
      if (numeric === null) {
        // Code non assigné ISO : signalé, jamais confondu avec « part nulle ».
        if (!unmappedCodes.includes(s.code)) unmappedCodes.push(s.code);
        continue;
      }
      byNum.set(numeric, (byNum.get(numeric) ?? 0) + s.share);
    }

    const max = Math.max(1, ...byNum.values());
    const projection = geoNaturalEarth1().fitSize([width, height], WORLD);
    const draw = geoPath(projection);
    const p = WORLD.features.map((f) => ({
      id: normalizeIsoNumeric(f.id as string | number),
      name: f.properties?.name ?? "",
      d: draw(f) ?? "",
    }));

    return {
      paths: p,
      shareByNum: byNum,
      maxShare: max,
      ranked: rankedShares,
      unmapped: unmappedCodes,
    };
  }, [shares, width, height]);

  if (shares.length === 0) return null;

  const mappable = shareByNum.size > 0;

  return (
    <div className="relative" data-testid={testId}>
      {mappable ? (
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
                        const rect = (
                          e.currentTarget.ownerSVGElement as SVGSVGElement
                        ).getBoundingClientRect();
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
      ) : (
        <p
          data-testid="choropleth-unavailable"
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
        >
          Carte indisponible : code pays non reconnu. Les parts restent lisibles ci-dessous.
        </p>
      )}

      {hover && mappable && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-foreground)] shadow-lg"
          style={{ left: hover.x + 8, top: hover.y + 8 }}
        >
          {hover.label}
        </div>
      )}

      {unmapped.length > 0 && mappable && (
        <p
          data-testid="choropleth-unmapped-warning"
          role="status"
          className="mt-2 text-[11px] text-amber-700 dark:text-amber-400"
        >
          {unmapped.length} code(s) pays non cartographiable(s) : {unmapped.join(", ")} — part(s)
          conservée(s) dans le tableau ci-dessous.
        </p>
      )}

      {/* Vue tableau — TOUJOURS complète (mappée ou non), jamais couleur seule */}
      <ul
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--color-muted-foreground)]"
        data-testid="choropleth-table"
      >
        {ranked.map((r) => (
          <li key={r.code} className="tabular-nums">
            <span className="font-mono">{r.code}</span> {Math.round(r.share)} %
          </li>
        ))}
      </ul>
    </div>
  );
}
