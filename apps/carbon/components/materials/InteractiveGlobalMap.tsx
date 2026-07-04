"use client";
// Choroplèthe Mapbox GL — chargée dynamiquement (ssr:false) UNIQUEMENT quand
// NEXT_PUBLIC_MAPBOX_TOKEN est présent. Ne jamais importer ce module statiquement :
// mapbox-gl pèse ~1,5 Mo et exige un token valide.
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Material } from "@/lib/crm/dataLoader";
import { computeCountryWeights } from "@/lib/crm/countryWeights";
import { MAPBOX_TOKEN } from "@/lib/mapbox";

interface Props { materials: Material[] }

export default function InteractiveGlobalMap({ materials }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    const weights = computeCountryWeights(materials).filter(c => c.iso2);
    const maxWeight = weights[0]?.total ?? 1;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [15, 25],
      zoom: 1.3,
      projection: "mercator",
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("countries", {
        type: "vector",
        url: "mapbox://mapbox.country-boundaries-v1",
      });

      // Ramp rouge : alpha proportionnel au poids d'approvisionnement cumulé.
      const matchPairs: (string | string[])[] = [];
      for (const c of weights) {
        const alpha = 0.15 + 0.75 * (c.total / maxWeight);
        matchPairs.push(c.iso2 as string, `rgba(239,68,68,${alpha.toFixed(2)})`);
      }

      map.addLayer({
        id: "country-supply-weight",
        type: "fill",
        source: "countries",
        "source-layer": "country_boundaries",
        // worldview "all"/US : évite les doublons de frontières disputées
        filter: ["any", ["==", ["get", "worldview"], "all"], ["in", "US", ["get", "worldview"]]],
        paint: {
          "fill-color": ["match", ["get", "iso_3166_1"], ...matchPairs, "rgba(63,63,70,0.15)"] as never,
          "fill-outline-color": "rgba(255,255,255,0.12)",
        },
      });

      const byIso = new Map(weights.map(c => [c.iso2 as string, c]));

      map.on("click", "country-supply-weight", e => {
        const feature = e.features?.[0] as { properties?: { iso_3166_1?: string } } | undefined;
        const iso = feature?.properties?.iso_3166_1;
        const entry = iso ? byIso.get(iso) : undefined;
        if (!entry) return;
        const top = entry.materials.slice(0, 5)
          .map(m => `<li style="display:flex;justify-content:space-between;gap:12px"><span>${m.name_fr}</span><span style="font-family:monospace;color:#a1a1aa">${m.share_pct}%</span></li>`)
          .join("");
        const more = entry.materials.length > 5 ? `<p style="color:#71717a;font-size:10px;margin-top:4px">+${entry.materials.length - 5} autres matières</p>` : "";
        new mapboxgl.Popup({ closeButton: true, maxWidth: "280px" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:inherit">
              <p style="font-weight:700;font-size:14px;margin-bottom:2px">${entry.country}</p>
              <p style="color:#a1a1aa;font-size:11px;margin-bottom:8px">${entry.materials.length} matière(s) — poids cumulé ${entry.total.toFixed(0)} pts</p>
              <ul style="font-size:12px;display:flex;flex-direction:column;gap:3px">${top}</ul>${more}
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "country-supply-weight", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "country-supply-weight", () => { map.getCanvas().style.cursor = ""; });
    });

    map.on("error", e => {
      // Token invalide/expiré : on log sans casser la page (la carte reste vide).
      console.warn("[materials] Mapbox error — vérifier NEXT_PUBLIC_MAPBOX_TOKEN :", e.error?.message);
    });

    return () => map.remove();
  }, [materials]);

  return (
    <section id="carte" className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Cartographie mondiale</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Poids cumulé des pays producteurs sur les 34 matières critiques UE. Cliquer sur un pays pour le détail.
          </p>
        </div>
        <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full shrink-0">
          Mapbox live
        </span>
      </div>
      <div ref={containerRef}
        className="rounded-2xl border border-zinc-800 overflow-hidden h-80 lg:h-[26rem] [&_.mapboxgl-popup-content]:!bg-zinc-900 [&_.mapboxgl-popup-content]:!text-white [&_.mapboxgl-popup-content]:!rounded-xl [&_.mapboxgl-popup-content]:!border [&_.mapboxgl-popup-content]:!border-zinc-700 [&_.mapboxgl-popup-tip]:!border-t-zinc-900" />
    </section>
  );
}
