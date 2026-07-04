"use client";
// Aiguillage carte : Mapbox interactive si NEXT_PUBLIC_MAPBOX_TOKEN est posé,
// sinon fallback SVG statique (GlobalMap) — comportement actuel inchangé.
// Le chunk mapbox-gl (~1,5 Mo) n'est téléchargé que si la carte interactive est rendue.
import dynamic from "next/dynamic";
import type { Material } from "@/lib/crm/dataLoader";
import { isMapboxEnabled } from "@/lib/mapbox";
import GlobalMap from "./GlobalMap";

const InteractiveGlobalMap = dynamic(() => import("./InteractiveGlobalMap"), {
  ssr: false,
  loading: () => (
    <section id="carte" className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Cartographie mondiale</h2>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 h-80 lg:h-[26rem] animate-pulse" />
    </section>
  ),
});

export default function GlobalMapSection({ materials }: { materials: Material[] }) {
  if (!isMapboxEnabled()) return <GlobalMap materials={materials} />;
  return <InteractiveGlobalMap materials={materials} />;
}
