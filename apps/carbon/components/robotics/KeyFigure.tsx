import type { DataQuality } from "@/lib/crm/dataLoader";
import type { KeyFigure as KeyFigureData } from "@/lib/robotics/dataLoader";
import { QUALITY_META, formatIsoDate } from "./labels";

/** Étiquette de qualité d'une valeur — le libellé porte l'information, la
 *  teinte ne fait que la redoubler. */
export function QualityTag({ quality }: { quality: DataQuality }) {
  const meta = QUALITY_META[quality];
  return (
    <span className={meta.className} title={meta.help}>
      {meta.label}
    </span>
  );
}

/** Grand chiffre de la peau Industry, avec son libellé, sa date de mesure et
 *  sa qualité. La provenance détaillée (sources) vit dans la section Méthode. */
export function KeyFigure({ figure, size = 40 }: { figure: KeyFigureData; size?: number }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: ".02em",
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {figure.value_label}
      </span>
      <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-78)" }}>{figure.label}</span>
      <span className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: "var(--ink-70)" }}>
        <span style={{ fontFeatureSettings: "'tnum' 1" }}>{formatIsoDate(figure.as_of)}</span>
        <QualityTag quality={figure.provenance.data_quality} />
      </span>
    </div>
  );
}
