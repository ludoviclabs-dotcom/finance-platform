"use client";

import { useMemo, useState } from "react";
import type { Material } from "@/lib/crm/dataLoader";
import { computeCountryWeights } from "@/lib/crm/countryWeights";
import { useMxTheme } from "./MxThemeProvider";
import WorldMap, { type MapPalette } from "./map/WorldMap";
import CountryRankingSidebar from "./map/CountryRankingSidebar";
import { Frame } from "./industry/Frame";
import { Section } from "./industry/Section";
import { SectionKicker, SectionTitle, SectionLead } from "./industry/SectionKicker";

// Une seule teinte acier, déclinée par thème : la rampe de poids va du pâle au
// profond en clair, et s'inverse en sombre pour rester lisible sur le fond.
const PALETTES: Record<"clair" | "sombre", MapPalette> = {
  clair: {
    base: "#e7e7ea", stroke: "#f2f2f3", high: "#2c455d", low: "#d6ebff",
    flow: "#5980a6", hub: "#1d1f20", hubStroke: "#f2f2f3", selected: "#1d1f20",
  },
  sombre: {
    base: "#2c455d", stroke: "#1d2d3d", high: "#d6ebff", low: "#416180",
    flow: "#94bce3", hub: "#f2f2f3", hubStroke: "#1d2d3d", selected: "#f2f2f3",
  },
};

export default function GlobalMapSection({ materials, revealDelay }: { materials: Material[]; revealDelay?: number }) {
  const { theme } = useMxTheme();
  const weights = useMemo(() => computeCountryWeights(materials), [materials]);
  const [showFlows, setShowFlows] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const palette = PALETTES[theme];

  const legend = (
    <div
      className="absolute z-[4] flex items-center gap-2.5 flex-wrap"
      style={{ left: 16, bottom: 12, fontSize: 12, color: "var(--ink-70)" }}
    >
      <span>Poids faible</span>
      <div
        style={{
          width: 110,
          height: 6,
          background: `linear-gradient(90deg, ${palette.low}, ${palette.high})`,
          border: "1px solid var(--color-divider)",
        }}
      />
      <span>élevé</span>
      {showFlows && (
        <span className="ml-3 flex items-center gap-1.5">
          <span style={{ width: 16, height: 0, borderTop: `1.5px dashed ${palette.flow}` }} />
          flux vers l’Europe
        </span>
      )}
    </div>
  );

  return (
    <Section id="carte" revealDelay={revealDelay}>
      <SectionKicker>03 · Géographie de l’approvisionnement</SectionKicker>

      <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
        <div>
          <SectionTitle>Cartographie mondiale</SectionTitle>
          <SectionLead>
            Poids cumulé des pays producteurs sur les {materials.length} matières critiques UE. Survoler ou cliquer un
            pays pour le détail.
          </SectionLead>
        </div>
        <div className="ind-seg" role="group" aria-label="Flux">
          <label className="ind-seg-opt">
            <input type="radio" name="mx-flows" checked={showFlows} onChange={() => setShowFlows(true)} />
            Flux vers l’Europe
          </label>
          <label className="ind-seg-opt">
            <input type="radio" name="mx-flows" checked={!showFlows} onChange={() => setShowFlows(false)} />
            Poids seuls
          </label>
        </div>
      </div>

      {/* minmax(0, …) comme dans la maquette : avec de simples `8fr 4fr`, la
          largeur minimale de la carte (460px de haut × 16/9 = 818px) gonflait
          sa colonne et écrasait le classement à 190px. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] gap-12 items-start">
        <Frame as="figure" className="m-0">
          <WorldMap
            weights={weights}
            showFlows={showFlows}
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
            palette={palette}
            legend={legend}
          />
        </Frame>
        <CountryRankingSidebar
          weights={weights}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
        />
      </div>
    </Section>
  );
}
