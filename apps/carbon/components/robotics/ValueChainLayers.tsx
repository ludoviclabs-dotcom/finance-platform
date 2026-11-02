import Link from "next/link";
import type { Material } from "@/lib/crm/dataLoader";
import { countryLabelFr } from "@/lib/iso3166";
import {
  getActorsForLayer,
  getKeyFigure,
  resolveLayerMaterials,
  type BlocId,
  type Layer,
  type RoboticsDataset,
} from "@/lib/robotics/dataLoader";
import { Frame } from "@/components/materials/industry/Frame";
import { BLOC_LABEL, SEGMENT_DESC, SEGMENT_LABEL, SEGMENT_ORDER, formatIsoDate } from "./labels";

const ACTOR_PREVIEW = 5;

function LayerCard({ ds, layer, materials }: { ds: RoboticsDataset; layer: Layer; materials: Material[] }) {
  const actors = getActorsForLayer(ds, layer.id);
  const linked = resolveLayerMaterials(layer, materials);
  const rationale = new Map(layer.material_links.map(l => [l.material_id, l.rationale]));
  const figures = layer.key_figure_ids.map(id => getKeyFigure(ds, id));
  // Le bloc « Autres » se nomme par les pays de ses acteurs (Lynas : Australie)
  // plutôt que par un libellé générique.
  const blocName = (b: BlocId) =>
    b === "other"
      ? [...new Set(actors.filter(a => a.bloc === "other").flatMap(a => a.countries))].map(countryLabelFr).join(", ") ||
        BLOC_LABEL.other
      : BLOC_LABEL[b];

  return (
    <Frame as="section" className="ind-anchor flex flex-col gap-3" style={{ padding: 20 }} id={`couche-${layer.id}`}>
      <div className="flex items-baseline gap-3">
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
          {String(layer.order).padStart(2, "0")}
        </span>
        <h4
          style={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 20,
            lineHeight: "24px",
            letterSpacing: ".02em",
            textTransform: "uppercase",
          }}
        >
          {layer.name}
        </h4>
      </div>

      <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--ink-78)" }}>
        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {layer.dominant_blocs.map(blocName).join(", ")}
        </span>
        {layer.challenger_blocs.length > 0 && (
          <> · contesté par {layer.challenger_blocs.map(blocName).join(", ")}</>
        )}
      </p>

      <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
        {actors.slice(0, ACTOR_PREVIEW).map(a => a.name).join(", ")}
        {actors.length > ACTOR_PREVIEW ? ` +${actors.length - ACTOR_PREVIEW}` : ""}
      </p>

      {figures.length > 0 && (
        <ul className="flex flex-col gap-1" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {figures.map(f => (
            <li key={f.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 items-baseline" style={{ fontSize: 13, lineHeight: "18px" }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1", whiteSpace: "nowrap" }}>
                {f.value_label}
              </span>
              <span style={{ color: "var(--ink-78)" }}>
                {f.label} ({formatIsoDate(f.as_of)})
              </span>
            </li>
          ))}
        </ul>
      )}

      {linked.length > 0 && (
        <div className="flex flex-col gap-1.5" style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--color-divider)" }}>
          <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
            Matières critiques
          </span>
          <div className="flex flex-wrap gap-1.5">
            {linked.map(m => (
              <Link key={m.id} href={`/materials/${m.id}`} className="ind-tag ind-tag-accent" title={rationale.get(m.id)}>
                {m.name_fr} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </Frame>
  );
}

/** Les 12 couches en quatre segments, de la mine au robot. Chaque couche
 *  renvoie aux fiches /materials de ce qu'elle consomme : c'est le pont entre
 *  les deux modules. */
export default function ValueChainLayers({ ds, materials }: { ds: RoboticsDataset; materials: Material[] }) {
  return (
    <div className="flex flex-col gap-10">
      {SEGMENT_ORDER.map((segment, si) => {
        const layers = ds.layers.filter(l => l.segment === segment).sort((a, b) => a.order - b.order);
        return (
          <div key={segment} className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] gap-x-12 gap-y-4">
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                {String(si + 1).padStart(2, "0")} / {String(SEGMENT_ORDER.length).padStart(2, "0")}
              </span>
              <h3
                style={{
                  margin: "4px 0 0",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 28,
                  lineHeight: "32px",
                  letterSpacing: ".02em",
                  textTransform: "uppercase",
                }}
              >
                {SEGMENT_LABEL[segment]}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: "20px", color: "var(--ink-70)" }}>{SEGMENT_DESC[segment]}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {layers.map(l => (
                <LayerCard key={l.id} ds={ds} layer={l} materials={materials} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
