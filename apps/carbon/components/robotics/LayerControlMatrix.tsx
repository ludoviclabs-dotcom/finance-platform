import type { BlocId, KeyFigure as KeyFigureData, Layer } from "@/lib/robotics/dataLoader";
import { Frame } from "@/components/materials/industry/Frame";
import { KeyFigure } from "./KeyFigure";
import { BLOC_LABEL, BLOC_ORDER, BLOC_SHORT, SEGMENT_LABEL } from "./labels";

type Role = "dominant" | "challenger" | null;

function roleOf(layer: Layer, bloc: BlocId): Role {
  if (layer.dominant_blocs.includes(bloc)) return "dominant";
  if (layer.challenger_blocs.includes(bloc)) return "challenger";
  return null;
}

/** Carré plein (domine) ou filaire (conteste) : la forme porte le rôle, la
 *  teinte ne fait que le redoubler — lisible en niveaux de gris. */
function Square({ role }: { role: "dominant" | "challenger" }) {
  return (
    <i
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        background: role === "dominant" ? "var(--mx-tier-high)" : "transparent",
        border: `1.5px solid ${role === "dominant" ? "var(--mx-tier-high)" : "var(--color-accent)"}`,
      }}
    />
  );
}

function RoleMark({ role, bloc }: { role: Role; bloc: BlocId }) {
  if (!role) return <span aria-hidden="true" style={{ color: "var(--ink-55)" }}>·</span>;
  const label = role === "dominant" ? "domine" : "conteste";
  return (
    <span className="inline-flex items-center justify-center" title={`${BLOC_LABEL[bloc]} : ${label}`}>
      <Square role={role} />
      <span className="sr-only">{BLOC_LABEL[bloc]} : {label}</span>
    </span>
  );
}

const headerCell: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: 13,
  lineHeight: "24px",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 600,
};

export default function LayerControlMatrix({ layers, chinaFigures }: { layers: Layer[]; chinaFigures: KeyFigureData[] }) {
  // La colonne « Autres » n'apparaît que si une couche y renvoie (Australie).
  const blocs = BLOC_ORDER.filter(
    b => b !== "other" || layers.some(l => roleOf(l, "other") !== null),
  );

  return (
    <Frame>
      <header className="flex flex-wrap" style={{ borderBottom: "1px solid var(--color-divider)" }}>
        <span style={{ ...headerCell, flex: 1, minWidth: "16ch" }}>Qui contrôle chaque couche</span>
        <span
          className="whitespace-nowrap flex items-center gap-4"
          style={{ ...headerCell, borderLeft: "1px solid var(--color-divider)", color: "var(--ink-70)", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}
        >
          <span className="flex items-center gap-1.5"><Square role="dominant" /> domine</span>
          <span className="flex items-center gap-1.5"><Square role="challenger" /> conteste</span>
        </span>
      </header>

      <div className="overflow-x-auto">
        {/* Sous sm, la note de dominance disparaît et les colonnes de blocs se
            resserrent : le nom de couche garde sa largeur, le tableau défile
            dans son cadre plutôt que la page. */}
        <table className="ind-table" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th scope="col" style={{ paddingLeft: 24 }}>Couche</th>
              {blocs.map(b => (
                <th key={b} scope="col" className="w-14 sm:w-[76px]" style={{ textAlign: "center" }} title={BLOC_LABEL[b]}>
                  {BLOC_SHORT[b]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {layers.map(l => (
              <tr key={l.id}>
                <td style={{ paddingLeft: 24, paddingTop: 12, paddingBottom: 12 }}>
                  <span className="flex items-baseline gap-3">
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                      {String(l.order).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <a href={`#couche-${l.id}`} style={{ fontWeight: 500, color: "var(--color-text)" }}>{l.name}</a>
                      <span style={{ display: "block", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
                        {SEGMENT_LABEL[l.segment]}
                        <span className="hidden sm:inline"> · {l.dominance_note}</span>
                      </span>
                    </span>
                  </span>
                </td>
                {blocs.map(b => (
                  <td key={b} style={{ textAlign: "center" }}>
                    <RoleMark role={roleOf(l, b)} bloc={b} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8"
        style={{ padding: "28px 24px", borderTop: "1px solid var(--color-divider)" }}
      >
        {chinaFigures.map(f => (
          <KeyFigure key={f.id} figure={f} size={36} />
        ))}
      </div>
      <p style={{ margin: 0, padding: "0 24px 16px", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
        Rôles des blocs : qualification éditoriale du dossier d’origine. Parts chiffrées : sources datées, détaillées
        dans la section Méthode.
      </p>
    </Frame>
  );
}
