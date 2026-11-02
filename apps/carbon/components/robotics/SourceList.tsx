import { resolveSources, type Provenance, type RoboticsDataset } from "@/lib/robotics/dataLoader";
import { QualityTag } from "./KeyFigure";
import { SOURCE_KIND_LABEL, formatIsoDate } from "./labels";

/** Provenance d'une valeur, en clair : sa qualité, sa réserve éventuelle et
 *  chacune de ses sources (éditeur, titre cliquable, date, nature). C'est ici
 *  que la règle « chaque chiffre renvoie à sa source » devient lisible. */
export default function SourceList({ ds, provenance }: { ds: RoboticsDataset; provenance: Provenance }) {
  const sources = resolveSources(ds, provenance);
  return (
    <div className="flex flex-col gap-1.5" style={{ fontSize: 12, lineHeight: "18px" }}>
      <span className="flex items-center gap-2 flex-wrap">
        <QualityTag quality={provenance.data_quality} />
        {provenance.note && <span style={{ color: "var(--ink-70)" }}>{provenance.note}</span>}
      </span>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }} className="flex flex-col gap-1">
        {sources.map(s => (
          <li key={s.id} style={{ color: "var(--ink-70)" }}>
            <span style={{ fontWeight: 600, color: "var(--ink-78)" }}>{s.publisher}</span>
            {" · "}
            <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: "anywhere" }}>
              {s.title}
            </a>
            {" · "}
            <span style={{ fontFeatureSettings: "'tnum' 1" }}>{s.published ? formatIsoDate(s.published) : "non datée"}</span>
            {s.kind !== "primary" && <> · {SOURCE_KIND_LABEL[s.kind].toLowerCase()}</>}
          </li>
        ))}
      </ul>
    </div>
  );
}
