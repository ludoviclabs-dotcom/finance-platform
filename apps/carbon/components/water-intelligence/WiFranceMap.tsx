"use client";

/**
 * WiFranceMap.tsx — Basin Atlas : la carte du périmètre publié
 * (Water Intelligence v3, WI-V3-04).
 *
 * ## Pourquoi cette carte-ci, et pas l'explorateur multi-couches
 *
 * Le dépôt porte DEUX chemins cartographiques, et ce n'est pas une
 * duplication : `WiMapCanvas` / `WiMapFrame` / `WiFilterBar` composent un
 * explorateur choroplèthe qui exige `coverage.layer_count > 0`. Ce compteur
 * vaut zéro, et `WiMapFrame` refuse alors de monter la moindre carte — à
 * raison : un fond teinté sans données se lit comme une couverture nulle.
 * Ces trois composants restent donc dormants, et c'est le comportement juste.
 *
 * Cette carte-ci affirme autre chose : un UNIQUE point vérifié, celui de la
 * commune signée. Ce n'est pas une carte de couverture, et c'est pourquoi
 * elle peut être rendue quand l'autre ne le peut pas.
 *
 * ## Trois types de couches, et une hiérarchie qui s'arrête où la preuve s'arrête
 *
 * La hiérarchie visée est ouvrage → commune → bassin. Les deux premiers
 * niveaux sont publiés ; le troisième ne l'est pas, et `basinJoin()` le
 * démontre à partir du document plutôt que de l'affirmer. La couche bassin est
 * donc rendue désactivée, hachurée, explicitement différée — jamais comme une
 * relation vérifiée.
 *
 * La légende est PERSISTANTE et en HTML, pas en `<text>` SVG : elle porte des
 * interrupteurs réels, se lit par un lecteur d'écran comme une liste de
 * contrôles, et se relit à n'importe quelle largeur.
 *
 * ## Aucun appel réseau
 *
 * `d3-geo`, `topojson-client` et `world-atlas` sont déjà des dépendances du
 * dépôt ; la topologie est un IMPORT DE MODULE, jamais un `fetch`. Aucune
 * bibliothèque de tuiles n'est ajoutée : Mapbox, MapLibre ou Leaflet
 * apporteraient un fond de tuiles distant pour une carte qui montre un point.
 */

import { geoConicConformal, geoPath } from "d3-geo";
import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";

import {
  LAYER_KIND_LABELS,
  atlasLayers,
  defaultVisibleLayers,
  type WiAtlasLayer,
  type WiBasinJoin,
} from "@/lib/water-intelligence/basin-atlas";

import { WiInspectionDrawer } from "./WiInspectionDrawer";

export interface WiFranceMapProps {
  /** Coordonnées approximatives du chef-lieu de la commune publiée. */
  readonly markerLonLat: readonly [number, number];
  readonly geographyCode: string;
  readonly ouvrageCount: number;
  readonly periodLabel: string;
  readonly reducedMotion?: boolean;
  /** État de jointure bassin, DÉRIVÉ du document canonique. */
  readonly join: WiBasinJoin;
  /** Code de la source du périmètre publié. */
  readonly sourceCode: string;
  /** Date de la revue humaine qui a autorisé la publication. */
  readonly reviewedOn: string;
}

const VIEWBOX_W = 720;
const VIEWBOX_H = 520;
/** Code ISO numérique du pays France dans `world-atlas` (id `250`). */
const FRANCE_ID = "250";

/**
 * Fenêtre du domaine métropolitain, en degrés.
 *
 * Dans `world-atlas`, « France » est UNE feature qui porte aussi les
 * territoires ultramarins — la Guyane s'étend jusqu'à ~54° ouest. Cadrer
 * `fitExtent` sur la feature entière étire la projection de la Guyane à la
 * Corse : la métropole tombe à 83 × 79 px dans un cadre de 720 × 520 — 2 % de
 * la surface — et le marqueur de la commune publiée se colle au bord droit,
 * son étiquette débordant du cadre.
 *
 * Le cadrage retient donc les anneaux métropolitains, seul périmètre que
 * cette carte prétend montrer. Ce n'est pas un jugement sur les territoires
 * ultramarins : la carte ne les cartographie pas, exactement comme elle ne
 * cartographie aucune couche géographique différée.
 */
const METROPOLITAN_BOUNDS = { west: -6, east: 10, south: 41, north: 52 } as const;

/**
 * Ne conserve, d'une géométrie France, que les anneaux métropolitains.
 *
 * Retourne la géométrie inchangée si le filtre ne retient rien : un fond de
 * carte dégradé vaut mieux qu'une carte vide, et la règle du module est que
 * l'absence ne se fabrique jamais silencieusement.
 */
function metropolitanOnly<T>(geometry: T): T {
  const geom = geometry as { type?: string; coordinates?: number[][][][] };
  if (geom?.type !== "MultiPolygon" || !Array.isArray(geom.coordinates)) return geometry;
  const kept = geom.coordinates.filter((polygon) =>
    polygon[0]?.some(
      ([lon, lat]) =>
        lon >= METROPOLITAN_BOUNDS.west &&
        lon <= METROPOLITAN_BOUNDS.east &&
        lat >= METROPOLITAN_BOUNDS.south &&
        lat <= METROPOLITAN_BOUNDS.north,
    ),
  );
  return kept.length ? ({ ...geom, coordinates: kept } as T) : geometry;
}

export function WiFranceMap({
  markerLonLat,
  geographyCode,
  ouvrageCount,
  periodLabel,
  reducedMotion = false,
  join,
  sourceCode,
  reviewedOn,
}: WiFranceMapProps) {
  const [markerShown, setMarkerShown] = useState(reducedMotion);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const layers = useMemo(
    () => atlasLayers({ geographyCode, periodLabel, ouvrageCount, join }),
    [geographyCode, periodLabel, ouvrageCount, join],
  );
  const [visible, setVisible] = useState<readonly string[]>(() => defaultVisibleLayers(layers));

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
    const found = collection.features.find((f) => String(f.id) === FRANCE_ID);
    const france = found ? { ...found, geometry: metropolitanOnly(found.geometry) } : undefined;
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

  /*
   * Le marqueur apparaît APRÈS le tracé du contour, pas 1,8 s plus tard comme
   * en v2 : le tracé dure désormais 480 ms, et faire attendre le point trois
   * fois plus longtemps que le trait qui le porte n'informait de rien.
   */
  useEffect(() => {
    if (reducedMotion) return undefined;
    const timer = window.setTimeout(() => setMarkerShown(true), 500);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const [mx, my] = projected ?? [VIEWBOX_W / 2, VIEWBOX_H / 2];
  const showMonde = visible.includes("monde");
  const showMetropole = visible.includes("metropole");

  const toggleLayer = (id: string) =>
    setVisible((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  return (
    <div className="wi-atlas" data-testid="wi-basin-atlas">
      <div className="wi-map-frame">
        {/*
          Boîte de rendu du SVG, isolée de `.wi-map-frame`.
          `.wi-map-frame` porte un `min-height` de confort pour la mise en
          page ; le SVG, avec `height: 100%`, ne le REMPLIT pas forcément —
          un pourcentage de hauteur qui se résout contre un ancêtre à hauteur
          `auto` retombe sur le ratio intrinsèque du SVG (720:520), presque
          toujours plus bas que le `min-height`. La sonde d'inspection est
          positionnée en pourcentage des coordonnées du viewBox : si elle
          reste sœur du SVG dans `.wi-map-frame`, ses pourcentages se
          résolvent contre le cadre entier, pas contre la boîte réelle du
          SVG — sur un mobile de 375 px, l'écart mesuré atteignait 211 px, la
          sonde tombant dans l'espace vide sous la carte plutôt que sur le
          marqueur. `.wi-map-canvas` porte le même ratio via `aspect-ratio` :
          sonde et SVG partagent alors exactement la même boîte, quelle que
          soit la largeur.
        */}
        <div className="wi-map-canvas">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          role="img"
          aria-label={`Carte de France, commune ${geographyCode} mise en évidence — périmètre publié, ${ouvrageCount} ouvrages, ${periodLabel}. Les contours de bassins ne sont pas cartographiés : ${join.label.toLowerCase()}.`}
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

          {/* ------------------------------------------- Couche de repérage */}
          <g className="wi-layer" data-visible={showMonde ? "true" : "false"}>
            {worldPath.map((d, i) => (
              <path key={i} d={d} fill="var(--wi-map-land)" stroke="var(--wi-map-stroke)" />
            ))}
          </g>

          {francePath && (
            <g className="wi-layer" data-visible={showMetropole ? "true" : "false"}>
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
            </g>
          )}

          {/* --------------------------------------------- Couche publiée */}
          {markerShown && (
            <g transform={`translate(${mx},${my})`} className="wi-map-marker">
              <circle
                r={20}
                fill="none"
                stroke="rgba(147,165,184,.55)"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              <circle r={4.5} fill="var(--wi-water)" stroke="var(--wi-bg)" strokeWidth={1.5} />
              <line x1={8} y1={-8} x2={26} y2={-26} stroke="rgba(165,243,252,.5)" strokeWidth={1} />
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
        </svg>

        {/*
          Le déclencheur d'inspection est un BOUTON HTML posé au-dessus du
          SVG, pas un `<circle>` cliquable : il reçoit le focus clavier
          nativement, porte un libellé lisible, et atteint la taille de cible
          tactile recommandée sans grossir le point dessiné.
        */}
        <button
          type="button"
          className="wi-map-probe"
          style={{ left: `${(mx / VIEWBOX_W) * 100}%`, top: `${(my / VIEWBOX_H) * 100}%` }}
          onClick={() => setDrawerOpen(true)}
          data-testid="wi-atlas-probe"
        >
          <span className="wi-visually-hidden">
            Inspecter le périmètre publié — commune {geographyCode}, {periodLabel}
          </span>
        </button>
        </div>
      </div>

      {/* ------------------------------------------------ Légende persistante */}
      <div className="wi-atlas-legend" data-testid="wi-atlas-legend">
        <p className="wi-kicker" style={{ margin: 0 }}>
          Couches
        </p>
        <ul className="wi-atlas-layers">
          {layers.map((layer) => (
            <AtlasLegendEntry
              key={layer.id}
              layer={layer}
              active={visible.includes(layer.id)}
              onToggle={() => toggleLayer(layer.id)}
            />
          ))}
        </ul>
      </div>

      <WiInspectionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kicker="Périmètre publié"
        title={`Commune ${geographyCode}`}
        testId="wi-atlas-drawer"
        rows={[
          { label: "Territoire", value: `Commune ${geographyCode}` },
          { label: "Code INSEE", value: geographyCode, mono: true },
          { label: "Période", value: periodLabel },
          { label: "Observations disponibles", value: `${ouvrageCount} ouvrages déclarés` },
          { label: "Source", value: sourceCode, mono: true },
          { label: "Statut de publication", value: "Publié — périmètre signé, portée limitée" },
          {
            label: "Niveau de preuve",
            value: "Valeur sourcée — volumes déclarés, repris sans conversion",
          },
          { label: "Jointure bassin", value: join.label },
        ]}
        sections={[
          {
            title: "Pourquoi certaines couches sont absentes",
            body: (
              <>
                <p style={{ margin: 0 }}>{join.reason}</p>
                <p style={{ marginTop: "0.5rem" }}>
                  Les autres communes ne sont pas grisées mais absentes&nbsp;: une teinte
                  neutre sur un territoire sans donnée se lit comme une mesure à zéro.
                </p>
              </>
            ),
          },
          {
            title: "Prochaine étape",
            body: <p style={{ margin: 0 }}>{join.nextStep}</p>,
          },
        ]}
        footer={
          <p className="wi-muted" style={{ margin: 0, fontSize: "0.75rem" }}>
            Décision de publication approuvée le {reviewedOn}. Aucun usage dérivé
            n&apos;est autorisé&nbsp;: ni total, ni moyenne, ni classement.
          </p>
        }
      />
    </div>
  );
}

/**
 * Une entrée de légende.
 *
 * Une couche différée n'est pas un interrupteur éteint : c'est un `<li>` sans
 * contrôle, hachuré et marqué « Différé ». Rendre un interrupteur qui
 * n'allume rien laisserait croire que la donnée existe et qu'on a choisi de
 * la masquer.
 */
function AtlasLegendEntry({
  layer,
  active,
  onToggle,
}: {
  layer: WiAtlasLayer;
  active: boolean;
  onToggle: () => void;
}) {
  const body = (
    <>
      <span className={`wi-atlas-swatch wi-atlas-swatch-${layer.kind}`} aria-hidden="true" />
      <span className="wi-atlas-layer-body">
        <span className="wi-atlas-layer-label">{layer.label}</span>
        <span className="wi-atlas-layer-detail">{layer.detail}</span>
      </span>
      <span className={`wi-atlas-kind wi-atlas-kind-${layer.kind}`}>
        {LAYER_KIND_LABELS[layer.kind]}
      </span>
    </>
  );

  if (!layer.toggleable) {
    return (
      <li
        className="wi-atlas-layer"
        data-kind={layer.kind}
        data-testid={`wi-atlas-layer-${layer.id}`}
      >
        {/* Même enveloppe interne que la variante à bouton : la disposition
            est portée par cet élément dans les deux cas, jamais par le `li`,
            qui resterait sinon un conteneur flex imbriquant un autre. */}
        <div className="wi-atlas-layer-static">{body}</div>
      </li>
    );
  }

  return (
    <li className="wi-atlas-layer" data-kind={layer.kind} data-testid={`wi-atlas-layer-${layer.id}`}>
      <button
        type="button"
        className="wi-atlas-layer-toggle"
        aria-pressed={active}
        onClick={onToggle}
        data-testid={`wi-atlas-toggle-${layer.id}`}
      >
        {body}
      </button>
    </li>
  );
}
