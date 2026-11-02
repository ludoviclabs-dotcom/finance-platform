import { collectProvenances, type RoboticsDataset, type SourceKind } from "@/lib/robotics/dataLoader";
import type { DataQuality } from "@/lib/crm/dataLoader";
import { Frame } from "@/components/materials/industry/Frame";
import { QualityTag } from "./KeyFigure";
import { QUALITY_META, SOURCE_KIND_LABEL, formatIsoDate } from "./labels";

const QUALITIES: DataQuality[] = ["verified", "estimated", "manual"];
const KINDS: SourceKind[] = ["primary", "secondary", "editorial"];

const smallCaps: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 12,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--ink-70)",
};

const bigNumber: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: 40,
  lineHeight: "40px",
  letterSpacing: ".02em",
  fontFeatureSettings: "'tnum' 1",
};

/** Méthode, corrections apportées au dossier d'origine et registre des sources.
 *  Tout est dérivé du snapshot : aucun décompte en dur. */
export default function MethodPanel({ ds }: { ds: RoboticsDataset }) {
  const provenances = collectProvenances(ds);
  const byQuality = QUALITIES.map(q => ({ q, n: provenances.filter(p => p.provenance.data_quality === q).length }));
  const byKind = KINDS.map(k => ({ k, n: ds.sources.filter(s => s.kind === k).length }));
  const corrected = ds.corrections.filter(c => c.outcome === "corrected");
  const removed = ds.corrections.filter(c => c.outcome === "removed");
  const sources = [...ds.sources].sort((a, b) => a.publisher.localeCompare(b.publisher, "fr"));

  return (
    <div className="flex flex-col gap-10">
      <Frame className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-b md:border-b-0 md:border-r" style={{ padding: 24, borderColor: "var(--color-divider)" }}>
          <p style={smallCaps}>Qualité des {provenances.length} valeurs</p>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {byQuality.map(({ q, n }) => (
              <div key={q} className="flex flex-col gap-1.5">
                <span style={bigNumber}>{n}</span>
                <QualityTag quality={q} />
              </div>
            ))}
          </div>
          <ul style={{ margin: "20px 0 0", padding: 0, listStyle: "none" }} className="flex flex-col gap-1.5">
            {QUALITIES.map(q => (
              <li key={q} style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-78)" }}>
                <span style={{ fontWeight: 600 }}>{QUALITY_META[q].label}</span> — {QUALITY_META[q].help}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ padding: 24 }}>
          <p style={smallCaps}>{ds.sources.length} sources datées</p>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {byKind.map(({ k, n }) => (
              <div key={k} className="flex flex-col gap-1.5">
                <span style={bigNumber}>{n}</span>
                <span style={{ fontSize: 12, color: "var(--ink-70)" }}>{SOURCE_KIND_LABEL[k]}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "20px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-78)" }}>{ds.methodology_note}</p>
        </div>
      </Frame>

      <div>
        <h3
          style={{
            margin: "0 0 4px",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 22,
            lineHeight: "24px",
            letterSpacing: ".02em",
            textTransform: "uppercase",
          }}
        >
          Ce que la vérification a changé
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: "20px", color: "var(--ink-70)" }}>
          {corrected.length} chiffres corrigés et {removed.length} retirés faute de source, par rapport au dossier
          d’origine.
        </p>
        <div className="overflow-x-auto">
          <table className="ind-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">Chiffre</th>
                <th scope="col">Dossier d’origine</th>
                <th scope="col">Après vérification</th>
              </tr>
            </thead>
            <tbody>
              {[...corrected, ...removed].map(c => (
                <tr key={c.id} style={{ verticalAlign: "top" }}>
                  <td style={{ fontWeight: 500 }}>{c.claim}</td>
                  <td style={{ color: "var(--ink-70)", textDecoration: "line-through", textDecorationColor: "var(--ink-55)" }}>
                    {c.dossier_value}
                  </td>
                  <td>
                    {c.corrected_value ?? <span style={{ color: "var(--ink-70)" }}>Retiré : aucune source trouvée</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details>
        <summary className="ind-btn ind-btn-secondary" style={{ listStyle: "none", width: "fit-content" }}>
          Registre des {ds.sources.length} sources
        </summary>
        <ol style={{ margin: "16px 0 0", padding: 0, listStyle: "none" }}>
          {sources.map(s => (
            <li
              key={s.id}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,7fr)_minmax(0,2fr)] gap-x-6 gap-y-1"
              style={{ padding: "10px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)", fontSize: 13, lineHeight: "20px" }}
            >
              <span style={{ fontWeight: 600 }}>{s.publisher}</span>
              <span className="min-w-0">
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: "anywhere" }}>
                  {s.title}
                </a>
                {s.note && <span style={{ display: "block", fontSize: 12, color: "var(--ink-70)" }}>{s.note}</span>}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
                {s.published ? formatIsoDate(s.published) : "Non datée"} · {SOURCE_KIND_LABEL[s.kind]}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
