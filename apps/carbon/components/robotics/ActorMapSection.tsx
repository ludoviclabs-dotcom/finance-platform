"use client";

import { useMemo, useState } from "react";
import type { CountryWeight } from "@/lib/crm/countryWeights";
import { ISO3166_ALPHA2_TO_NUMERIC, countryLabelFr } from "@/lib/iso3166";
import type { Actor, Layer, SegmentId } from "@/lib/robotics/dataLoader";
import { useMxTheme } from "@/components/materials/MxThemeProvider";
import WorldMap from "@/components/materials/map/WorldMap";
import { PALETTES } from "@/components/materials/GlobalMapSection";
import { Frame } from "@/components/materials/industry/Frame";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker, SectionTitle, SectionLead } from "@/components/materials/industry/SectionKicker";
import { SEGMENT_LABEL, SEGMENT_ORDER } from "./labels";

type Filter = SegmentId | "tous";

const RANK_SIZE = 10;

interface CountryActors {
  weight: CountryWeight;
  actors: Actor[];
}

// Un acteur multi-pays (STMicroelectronics, 1X) compte dans chacun de ses pays :
// la carte montre où les acteurs sont implantés, pas une part de marché.
function groupByCountry(actors: Actor[]): CountryActors[] {
  const byCode = new Map<string, Actor[]>();
  for (const a of actors) {
    for (const code of a.countries) byCode.set(code, [...(byCode.get(code) ?? []), a]);
  }
  return [...byCode.entries()]
    .map(([code, list]) => ({
      weight: {
        country: countryLabelFr(code),
        iso2: code,
        isoNumeric: ISO3166_ALPHA2_TO_NUMERIC[code] ?? null,
        total: list.length,
        materials: [],
      },
      actors: list,
    }))
    .sort((a, b) => b.weight.total - a.weight.total || a.weight.country.localeCompare(b.weight.country, "fr"));
}

export default function ActorMapSection({
  actors,
  layers,
  revealDelay,
}: {
  actors: Actor[];
  layers: Layer[];
  revealDelay?: number;
}) {
  const { theme } = useMxTheme();
  const [filter, setFilter] = useState<Filter>("tous");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const layerById = useMemo(() => new Map(layers.map(l => [l.id, l])), [layers]);
  const visibleActors = useMemo(
    () => (filter === "tous" ? actors : actors.filter(a => a.layer_ids.some(id => layerById.get(id)?.segment === filter))),
    [actors, filter, layerById],
  );
  const groups = useMemo(() => groupByCountry(visibleActors), [visibleActors]);
  const weights = useMemo(() => groups.map(g => g.weight), [groups]);
  const actorsByCountry = useMemo(() => new Map(groups.map(g => [g.weight.country, g.actors])), [groups]);

  const selected = groups.find(g => g.weight.country === selectedCountry) ?? null;
  const top = groups.slice(0, RANK_SIZE);
  const maxTotal = top[0]?.weight.total || 1;
  const palette = PALETTES[theme];

  const legend = (
    <div
      className="absolute z-[4] flex items-center gap-2.5 flex-wrap"
      style={{ left: 16, bottom: 12, fontSize: 12, color: "var(--ink-70)" }}
    >
      <span>Peu d’acteurs</span>
      <div
        style={{
          width: 110,
          height: 6,
          background: `linear-gradient(90deg, ${palette.low}, ${palette.high})`,
          border: "1px solid var(--color-divider)",
        }}
      />
      <span>beaucoup</span>
    </div>
  );

  const renderTooltip = (w: CountryWeight) => {
    const list = actorsByCountry.get(w.country) ?? [];
    return (
      <>
        <p className="m-0 font-bold">{w.country}</p>
        <p className="m-0 mt-[3px] mb-1.5" style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
          {list.length} acteur{list.length > 1 ? "s" : ""}
        </p>
        <p className="m-0" style={{ fontSize: 11.5 }}>
          {list.slice(0, 4).map(a => a.name).join(", ")}
          {list.length > 4 ? ` +${list.length - 4}` : ""}
        </p>
        <p className="m-0 mt-1.5" style={{ fontSize: "10.5px", color: "var(--ink-55)" }}>Cliquer pour le détail →</p>
      </>
    );
  };

  return (
    <Section id="carte" revealDelay={revealDelay}>
      <SectionKicker>03 · Géographie des acteurs</SectionKicker>

      <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
        <div>
          <SectionTitle>Cartographie mondiale</SectionTitle>
          <SectionLead>
            Implantation des {actors.length} acteurs suivis, de la mine au constructeur. Filtrer par segment de la
            chaîne ; survoler ou cliquer un pays pour le détail.
          </SectionLead>
        </div>
        <div className="ind-seg flex-wrap" role="group" aria-label="Segment de la chaîne">
          {(["tous", ...SEGMENT_ORDER] as Filter[]).map(f => (
            <label key={f} className="ind-seg-opt">
              <input
                type="radio"
                name="rb-segment"
                checked={filter === f}
                onChange={() => {
                  setFilter(f);
                  setSelectedCountry(null);
                }}
              />
              {f === "tous" ? "Tous" : SEGMENT_LABEL[f]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] gap-12 items-start">
        <Frame as="figure" className="m-0">
          <WorldMap
            weights={weights}
            showFlows={false}
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
            palette={palette}
            legend={legend}
            renderTooltip={renderTooltip}
          />
        </Frame>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 22,
                lineHeight: "24px",
                letterSpacing: ".02em",
                textTransform: "uppercase",
              }}
            >
              Classement des pays
            </h3>
            <span style={{ fontSize: 12, color: "var(--ink-70)" }}>acteurs suivis</span>
          </div>

          <table className="ind-table" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 36 }}>№</th>
                <th scope="col">Pays</th>
                <th scope="col">Poids</th>
                <th scope="col" style={{ textAlign: "right", width: 44 }}>n</th>
              </tr>
            </thead>
            <tbody>
              {top.map((g, i) => {
                const isOn = selectedCountry === g.weight.country;
                return (
                  <tr
                    key={g.weight.country}
                    onClick={() => setSelectedCountry(isOn ? null : g.weight.country)}
                    style={{
                      cursor: "pointer",
                      background: isOn ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent",
                    }}
                  >
                    <td style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={isOn}
                        onClick={event => {
                          event.stopPropagation();
                          setSelectedCountry(isOn ? null : g.weight.country);
                        }}
                        className="whitespace-nowrap overflow-hidden text-ellipsis w-full text-left"
                        style={{ border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 500, padding: 0, cursor: "pointer" }}
                      >
                        {g.weight.country}
                      </button>
                    </td>
                    <td>
                      <div style={{ height: 4, background: "var(--color-divider)" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(2, (g.weight.total / maxTotal) * 100)}%`,
                            background: i === 0 ? "var(--color-text)" : "var(--color-accent)",
                            transition: "width .9s cubic-bezier(.16,1,.3,1)",
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1" }}>
                      {g.weight.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {selected && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--color-divider)" }}>
              <div className="flex items-baseline justify-between gap-3">
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 22,
                    lineHeight: "24px",
                    letterSpacing: ".02em",
                    textTransform: "uppercase",
                  }}
                >
                  {selected.weight.country}
                </p>
                <button
                  type="button"
                  className="ind-btn ind-btn-ghost"
                  onClick={() => setSelectedCountry(null)}
                  style={{ padding: "0 6px" }}
                >
                  Fermer
                </button>
              </div>
              <ul className="flex flex-col gap-2.5" style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                {selected.actors.map(a => (
                  <li key={a.id} style={{ fontSize: 14, lineHeight: "20px" }}>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                    <span style={{ display: "block", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
                      {a.layer_ids.map(id => layerById.get(id)?.name).filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ margin: "24px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
            Sélection d’acteurs du dossier d’origine, non exhaustive : la carte compte des implantations, pas des parts
            de marché.
          </p>
        </div>
      </div>
    </Section>
  );
}
