import type { MarketProjection, RoboticsDataset } from "@/lib/robotics/dataLoader";
import { countryLabelFr } from "@/lib/iso3166";
import { Frame } from "@/components/materials/industry/Frame";
import { QualityTag } from "./KeyFigure";
import { formatBnUsd, formatIsoDate } from "./labels";

// Échelle logarithmique : les projections vont de 3 Md$ (2026) à 7 500 Md$
// (2050). En échelle linéaire, tout ce qui précède 2050 tiendrait dans un pixel.
const LOG_MIN = 0; // 1 Md$
const LOG_MAX = 4; // 10 000 Md$
const TICKS = [1, 10, 100, 1000, 10000];

function pos(value: number): number {
  const v = Math.min(LOG_MAX, Math.max(LOG_MIN, Math.log10(Math.max(1, value))));
  return ((v - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
}

function ProjectionRow({ p }: { p: MarketProjection }) {
  const left = pos(p.min_bn_usd);
  const right = pos(p.max_bn_usd);
  const range = p.max_bn_usd > p.min_bn_usd;
  const value = range ? `${formatBnUsd(p.min_bn_usd)} – ${formatBnUsd(p.max_bn_usd)}` : formatBnUsd(p.max_bn_usd);

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,2fr)] gap-x-6 gap-y-2 items-center"
      style={{ padding: "12px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}
    >
      <div className="min-w-0">
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.institution}</p>
        <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>{p.detail}</p>
      </div>
      <div className="relative" style={{ height: 14 }} aria-hidden="true">
        <div className="absolute inset-x-0" style={{ top: 6, height: 1, background: "var(--color-divider)" }} />
        {range ? (
          <div
            className="absolute"
            style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%`, top: 2, height: 10, background: "var(--color-accent)" }}
          />
        ) : (
          <div
            className="absolute"
            style={{ left: `calc(${left}% - 5px)`, top: 2, width: 10, height: 10, background: "var(--mx-tier-high)" }}
          />
        )}
      </div>
      <div className="flex md:flex-col md:items-end items-center gap-2">
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1", whiteSpace: "nowrap" }}>
          {value}
        </span>
        <QualityTag quality={p.provenance.data_quality} />
      </div>
    </div>
  );
}

/** Projections de marché (échelle log) et volumes des constructeurs. */
export default function MarketOverview({ ds }: { ds: RoboticsDataset }) {
  const horizons = [...new Set(ds.projections.map(p => p.horizon))].sort((a, b) => a - b);
  const actorById = new Map(ds.actors.map(a => [a.id, a]));

  return (
    <div className="flex flex-col gap-12">
      <Frame style={{ padding: "8px 24px 20px" }}>
        {/* Graduations alignées sur la colonne des barres (même grille). */}
        <div className="hidden md:grid grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,2fr)] gap-x-6" style={{ padding: "12px 0 4px" }}>
          <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
            Institution
          </span>
          <div className="relative" style={{ height: 16 }}>
            {TICKS.map(t => (
              <span
                key={t}
                className="absolute"
                style={{
                  left: `${pos(t)}%`,
                  transform: t === TICKS[0] ? "none" : t === TICKS[TICKS.length - 1] ? "translateX(-100%)" : "translateX(-50%)",
                  fontSize: 11,
                  color: "var(--ink-70)",
                  fontFeatureSettings: "'tnum' 1",
                  whiteSpace: "nowrap",
                }}
              >
                {t.toLocaleString("fr-FR")}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)", textAlign: "right" }}>
            Md$
          </span>
        </div>

        {horizons.map(h => (
          <div key={h} style={{ marginTop: 16 }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 22,
                lineHeight: "24px",
                letterSpacing: ".02em",
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              Horizon {h}
            </p>
            {ds.projections
              .filter(p => p.horizon === h)
              .sort((a, b) => a.max_bn_usd - b.max_bn_usd)
              .map(p => (
                <ProjectionRow key={p.id} p={p} />
              ))}
          </div>
        ))}
        <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)", maxWidth: "80ch" }}>
          Échelle logarithmique, en milliards de dollars. Les périmètres diffèrent d’une institution à l’autre (robots
          seuls, services compris, marché adressable) : ces projections se comparent en ordre de grandeur, pas au
          dollar près.
        </p>
      </Frame>

      <div>
        <h3
          style={{
            margin: "0 0 12px",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 22,
            lineHeight: "24px",
            letterSpacing: ".02em",
            textTransform: "uppercase",
          }}
        >
          Volumes des constructeurs
        </h3>
        <div className="overflow-x-auto">
          <table className="ind-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col">Constructeur</th>
                <th scope="col">Volume publié</th>
                <th scope="col">Capacité visée</th>
              </tr>
            </thead>
            <tbody>
              {ds.oems.map(o => {
                const actor = actorById.get(o.actor_id);
                return (
                  <tr key={o.actor_id} style={{ verticalAlign: "top" }}>
                    <td style={{ paddingTop: 12, paddingBottom: 12, width: "34%" }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{actor?.name ?? o.actor_id}</span>
                      <span style={{ display: "block", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
                        {o.model} · {(actor?.countries ?? []).map(countryLabelFr).join(" / ")}
                      </span>
                      <span style={{ display: "block", marginTop: 4, fontSize: 12, lineHeight: "18px", color: "var(--ink-78)" }}>{o.facts}</span>
                    </td>
                    <td style={{ paddingTop: 12, paddingBottom: 12 }}>
                      {o.volume ? (
                        <span className="flex flex-col gap-1.5">
                          <span>{o.volume.label}</span>
                          <span className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: "var(--ink-70)" }}>
                            <span style={{ fontFeatureSettings: "'tnum' 1" }}>{formatIsoDate(o.volume.as_of)}</span>
                            <QualityTag quality={o.volume.provenance.data_quality} />
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-70)" }}>Non publié</span>
                      )}
                    </td>
                    <td style={{ paddingTop: 12, paddingBottom: 12 }}>
                      {o.capacity ? (
                        <span className="flex flex-col gap-1.5">
                          <span>{o.capacity.label}</span>
                          <QualityTag quality={o.capacity.provenance.data_quality} />
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-70)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)", maxWidth: "80ch" }}>
          Produit, livré, vendu ou réservé : chaque constructeur publie une grandeur différente, reprise telle quelle.
          Les capacités sont des objectifs annoncés, pas des productions constatées.
        </p>
      </div>
    </div>
  );
}
