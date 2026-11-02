import type { Chokepoint, Layer, RoboticsDataset } from "@/lib/robotics/dataLoader";
import { Frame } from "@/components/materials/industry/Frame";
import { QualityTag } from "./KeyFigure";
import { formatIsoDate } from "./labels";

/**
 * Les goulots d'étranglement, chacun avec sa frise de signaux datés.
 *
 * `dueKeys` (« idGoulot:indexSignal ») est calculé par la page au rendu
 * serveur : un signal dont l'échéance est atteinte est marqué « à revérifier »
 * plutôt que présenté comme un état actuel.
 */
export default function ChokepointsList({ ds, dueKeys }: { ds: RoboticsDataset; dueKeys: ReadonlySet<string> }) {
  const layerById = new Map<string, Layer>(ds.layers.map(l => [l.id, l]));
  const actorName = new Map(ds.actors.map(a => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-8">
      {ds.chokepoints.map((c: Chokepoint, ci) => (
        <Frame key={c.id} className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="border-b lg:border-b-0 lg:border-r" style={{ padding: 24, borderColor: "var(--color-divider)" }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
              {String(ci + 1).padStart(2, "0")}
            </span>
            <h3
              style={{
                margin: "4px 0 12px",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 24,
                lineHeight: "28px",
                letterSpacing: ".02em",
                textTransform: "uppercase",
              }}
            >
              {c.title}
            </h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", color: "var(--ink-78)" }}>{c.issue}</p>
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 16 }}>
              {c.layer_ids.map(id => (
                <a key={id} href={`#couche-${id}`} className="ind-tag ind-tag-neutral">
                  {layerById.get(id)?.name ?? id}
                </a>
              ))}
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
              {c.actor_ids.map(id => actorName.get(id) ?? id).join(", ")}
            </p>
          </div>

          <div style={{ padding: 24 }}>
            <p style={{ margin: "0 0 12px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
              Signaux datés
            </p>
            {c.signals.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--ink-70)" }}>
                Aucun signal daté et sourcé retenu à ce jour.
              </p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {c.signals.map((s, i) => {
                  const due = dueKeys.has(`${c.id}:${i}`);
                  return (
                    <li
                      key={`${s.date}-${i}`}
                      className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-4"
                      style={{ padding: "10px 0", borderTop: i === 0 ? 0 : "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                        {formatIsoDate(s.date)}
                      </span>
                      <span className="flex flex-col gap-1.5">
                        <span style={{ fontSize: 14, lineHeight: "20px" }}>{s.text}</span>
                        <span className="flex items-center gap-2 flex-wrap">
                          <QualityTag quality={s.provenance.data_quality} />
                          {s.review_by && (
                            due ? (
                              <span className="ind-tag ind-tag-outline" style={{ fontWeight: 600 }}>
                                À revérifier depuis le {formatIsoDate(s.review_by)}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
                                Échéance : {formatIsoDate(s.review_by)}
                              </span>
                            )
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Frame>
      ))}
    </div>
  );
}
