"use client";

import { useMemo, useState } from "react";
import type { Material } from "@/lib/crm/dataLoader";
import { computeCountryWeights } from "@/lib/crm/countryWeights";
import WorldMap from "./map/WorldMap";
import CountryRankingSidebar from "./map/CountryRankingSidebar";

export default function GlobalMapSection({ materials }: { materials: Material[] }) {
  const weights = useMemo(() => computeCountryWeights(materials), [materials]);
  const [showFlows, setShowFlows] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  return (
    <section id="carte" className="mx-anchor space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p
            className="m-0 mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-cyan)" }}
          >
            <span className="w-[22px] h-px" style={{ background: "var(--mx-cyan)" }} />
            Géographie de l&apos;approvisionnement
          </p>
          <h2 className="m-0 font-bold text-2xl tracking-tight" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
            Cartographie mondiale
          </h2>
          <p className="mt-1.5 mb-0 text-[13px]" style={{ color: "var(--mx-muted)" }}>
            Poids cumulé des pays producteurs sur les 34 matières critiques UE. Survoler ou cliquer un pays pour le détail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFlows(v => !v)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] border text-xs font-semibold cursor-pointer"
          style={{
            borderColor: showFlows ? "color-mix(in srgb, var(--mx-cyan) 55%, transparent)" : "var(--mx-border-2)",
            background: showFlows ? "color-mix(in srgb, var(--mx-cyan) 8%, var(--mx-card))" : "var(--mx-card)",
            color: showFlows ? "var(--mx-cyan)" : "var(--mx-muted)",
          }}
        >
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--mx-cyan)" }} />
          Flux vers l&apos;Europe
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-stretch">
        <WorldMap
          weights={weights}
          showFlows={showFlows}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
        />
        <CountryRankingSidebar
          weights={weights}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
        />
      </div>
    </section>
  );
}
