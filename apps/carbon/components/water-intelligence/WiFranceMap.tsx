"use client";

/**
 * WiFranceMap.tsx — carte du périmètre publié (Water Intelligence v2).
 *
 * ## Pourquoi pas un `<iframe>` vers un fichier CDN
 *
 * La maquette fournie charge D3, topojson-client et la topologie mondiale
 * depuis des CDN externes (unpkg, jsdelivr) à l'exécution, dans un document
 * HTML séparé. Ce module reprend le même rendu — silhouette du monde,
 * contour de la France animé, marqueur pulsé sur la commune publiée — avec
 * les dépendances déjà présentes du dépôt : `d3-geo`, `topojson-client`,
 * `world-atlas` (voir `WiMapCanvas.tsx`, qui a déjà résolu ce même problème).
 * La topologie est un IMPORT DE MODULE, jamais un `fetch` au rendu — c'est la
 * règle « aucun appel réseau client » de cette page, tenue aussi pour la
 * carte, pas seulement pour Hub'Eau.
 *
 * ## Ce que la carte affirme, et ce qu'elle refuse d'affirmer
 *
 * Seule la commune du périmètre signé est marquée. Le reste du monde est un
 * simple fond de contexte, jamais teinté comme s'il portait une donnée : les
 * couches géographiques complètes restent différées (`geo_layers: "deferred"`),
 * et une carte qui laisserait croire le contraire mentirait par la forme.
 */

import { geoConicConformal, geoPath } from "d3-geo";
import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";

export interface WiFranceMapProps {
  /** Coordonnées approximatives du chef-lieu de la commune publiée. */
  readonly markerLonLat: readonly [number, number];
  readonly geographyCode: string;
  readonly ouvrageCount: number;
  readonly periodLabel: string;
  readonly reducedMotion?: boolean;
}

const VIEWBOX_W = 720;
const VIEWBOX_H = 520;
/** Code ISO numérique du pays France dans `world-atlas` (id `250`). */
const FRANCE_ID = "250";

export function WiFranceMap({
  markerLonLat,
  geographyCode,
  ouvrageCount,
  periodLabel,
  reducedMotion = false,
}: WiFranceMapProps) {
  const [markerShown, setMarkerShown] = useState(reducedMotion);

  const { worldPath, francePath, projected } = useMemo(() => {
    /* Même convention de typage que `WiMapCanvas.tsx` : le JSON importé ne
       correspond pas exactement aux types `topojson-specification`, et un
       cast local est plus honnête qu'une déclaration `any` implicite. */
    const collection = feature(
      worldAtlas as never,
      (worldAtlas as never as { objects: { countries: never } }).objects.countries,
    ) as unknown as {
      features: Array<{ id?: string | number; type: string } & Record<string, unknown>>;
    };
    const france = collection.features.find((f) => String(f.id) === FRANCE_ID);
    const others = collection.features.filter((f) => String(f.id) !== FRANCE_ID);

    const projection = geoConicConformal()
      .rotate([-3, -46.2])
      .fitExtent(
        [
          [30, 24],
          [VIEWBOX_W - 30, VIEWBOX_H - 24],
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (france as any) ?? { type: "FeatureCollection", features: [] },
      );
    const path = geoPath(projection);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      worldPath: others.map((f) => path(f as any) ?? "").filter(Boolean),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      francePath: france ? (path(france as any) ?? "") : "",
      projected: projection(markerLonLat as [number, number]),
    };
  }, [markerLonLat]);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => setMarkerShown(true), 1800);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const [mx, my] = projected ?? [VIEWBOX_W / 2, VIEWBOX_H / 2];

  return (
    <div className="wi-map-frame" data-testid="wi-france-map">
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        role="img"
        aria-label={`Carte de France, commune ${geographyCode} mise en évidence — périmètre publié, ${ouvrageCount} ouvrages, ${periodLabel}.`}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          <pattern
            id="wi-map-hatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="1.3" height="7" fill="rgba(147,165,184,.18)" />
          </pattern>
        </defs>

        {worldPath.map((d, i) => (
          <path key={i} d={d} fill="var(--wi-map-land)" stroke="var(--wi-map-stroke)" />
        ))}

        {francePath && (
          <>
            <path d={francePath} fill="rgba(45,212,191,.05)" stroke="none" />
            <path d={francePath} fill="url(#wi-map-hatch)" stroke="none" />
            <path
              d={francePath}
              fill="none"
              stroke="var(--wi-water)"
              strokeWidth={1.6}
              strokeLinejoin="round"
              className={reducedMotion ? undefined : "wi-map-outline-draw"}
            />
          </>
        )}

        {markerShown && (
          <g transform={`translate(${mx},${my})`} className="wi-map-marker">
            <circle
              r={20}
              fill="none"
              stroke="rgba(147,165,184,.55)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <circle
              r={10}
              fill="none"
              stroke="var(--wi-water)"
              strokeWidth={2}
              className={reducedMotion ? undefined : "wi-map-pulse"}
            />
            <circle r={4.5} fill="var(--wi-water)" stroke="var(--wi-bg)" strokeWidth={1.5} />
            <line
              x1={8}
              y1={-8}
              x2={26}
              y2={-26}
              stroke="rgba(165,243,252,.5)"
              strokeWidth={1}
            />
            <g transform="translate(30,-30)">
              <rect
                x={-6}
                y={-30}
                width={190}
                height={40}
                rx={8}
                fill="var(--wi-surface)"
                stroke="rgba(165,243,252,.25)"
              />
              <text y={-14} fill="var(--wi-fg)" fontSize={12} fontWeight={700}>
                {geographyCode} · commune publiée
              </text>
              <text y={2} fill="var(--wi-muted)" fontSize={10}>
                {ouvrageCount} ouvrages · {periodLabel}
              </text>
            </g>
          </g>
        )}

        <g transform={`translate(18,${VIEWBOX_H - 62})`}>
          <rect
            x={-8}
            y={-16}
            width={236}
            height={56}
            rx={10}
            fill="var(--wi-surface)"
            fillOpacity={0.92}
            stroke="rgba(165,243,252,.18)"
          />
          <rect x={2} y={-6} width={14} height={10} fill="url(#wi-map-hatch)" stroke="rgba(147,165,184,.5)" strokeWidth={0.7} />
          <text x={24} y={3} fill="var(--wi-muted)" fontSize={10}>
            Périmètre non autorisé à publier
          </text>
          <circle cx={9} cy={20} r={4} fill="var(--wi-water)" />
          <text x={24} y={24} fill="var(--wi-fg)" fontSize={10}>
            Périmètre publié — {geographyCode}, {periodLabel}
          </text>
        </g>
      </svg>
    </div>
  );
}
