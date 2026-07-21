"use client";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, getChinaTier } from "@/lib/crm/dataLoader";
import { CHINA_TIER_META } from "@/lib/crm/chinaTier";
import MxScoreRing from "./MxScoreRing";

interface Props { materials: Material[] }

const NARRATIVES = {
  strategic: {
    title: "Matières stratégiques",
    accent: "var(--mx-amber)",
    riskLevel: "Critique",
    description: "Sous-ensemble jugé indispensable à la défense, la transition énergétique et l'autonomie numérique. Substitution difficile à court terme ; une rupture d'approvisionnement constitue un risque systémique pour l'économie européenne.",
    examples: ["Terres rares lourdes — aimants, guidage militaire", "Lithium — batteries de véhicules électriques", "Gallium et germanium — semi-conducteurs 5G/6G", "Titane — aérospatiale, défense"],
  },
  criticalOnly: {
    title: "Autres matières critiques",
    accent: "var(--mx-blue)",
    riskLevel: "Élevé",
    description: "Matières critiques non classées stratégiques : risque d'approvisionnement significatif mais substitution partielle possible. Elles impactent des secteurs clés — chimie, sidérurgie, énergie — avec des alternatives à coûts et délais importants.",
    examples: ["Fluorine — acides industriels, réfrigérants", "Phosphore — engrais, électronique", "Vanadium — batteries redox flow", "Hélium — IRM médicaux, cryogénie"],
  },
} as const;

function avgScore(arr: Material[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, m) => s + (m.carbonco_supply_risk_score ?? 0), 0) / arr.length;
}

export default function StrategicVsCriticalSection({ materials }: Props) {
  const strategic    = materials.filter(m => m.is_strategic_eu);
  const criticalOnly = materials.filter(m => m.is_critical_eu && !m.is_strategic_eu);
  const groups = [{ data: strategic, key: "strategic" as const }, { data: criticalOnly, key: "criticalOnly" as const }];

  const tableRows = [...materials]
    .sort((a, b) => (b.carbonco_supply_risk_score ?? 0) - (a.carbonco_supply_risk_score ?? 0))
    .slice(0, 12);

  return (
    <section id="analyse" className="mx-anchor space-y-5">
      <div>
        <p className="m-0 mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-violet)" }}>
          <span className="w-[22px] h-px" style={{ background: "var(--mx-violet)" }} />
          Règlement CRMA 2024
        </p>
        <h2 className="m-0 font-bold text-2xl tracking-tight" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
          Stratégiques vs critiques
        </h2>
        <p className="mt-1.5 mb-0 text-[13px] max-w-2xl" style={{ color: "var(--mx-muted)" }}>
          Deux statuts non exclusifs : toute matière stratégique est aussi critique. Les {strategic.length} matières
          stratégiques forment un sous-ensemble des {materials.length} matières critiques.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groups.map(({ data, key }) => {
          const n = NARRATIVES[key];
          const avg = avgScore(data);
          return (
            <div
              key={key}
              className="rounded-2xl border p-6 flex flex-col gap-4"
              style={{ borderColor: `color-mix(in srgb, ${n.accent} 28%, var(--mx-border))`, background: `linear-gradient(140deg, color-mix(in srgb, ${n.accent} 6%, transparent), transparent 55%), var(--mx-card)`, boxShadow: "var(--mx-shadow)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="m-0 font-semibold text-[17px]" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>{n.title}</h3>
                  <span className="inline-block mt-1.5 font-semibold text-[11px] px-2.5 py-0.5 rounded-full" style={{ color: n.accent, background: `color-mix(in srgb, ${n.accent} 14%, transparent)` }}>
                    {data.length} matières
                  </span>
                </div>
                <MxScoreRing value={avg / 10} size={86} strokeWidth={8} color={n.accent}>
                  <span className="font-bold text-[19px]" style={{ fontFamily: "var(--mx-font-display)", color: n.accent }}>{avg.toFixed(1)}</span>
                  <span className="text-[8.5px]" style={{ color: "var(--mx-subtle)" }}>score /10</span>
                </MxScoreRing>
              </div>
              <p className="m-0 text-[13px] leading-relaxed" style={{ color: "var(--mx-muted)" }}>{n.description}</p>
              <div className="flex flex-col gap-1.5">
                <p className="m-0 font-semibold text-[10.5px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>Exemples clés</p>
                {n.examples.map(ex => (
                  <p key={ex} className="m-0 flex gap-2 text-[12.5px]" style={{ color: "var(--mx-muted)" }}><span style={{ color: n.accent }}>›</span>{ex}</p>
                ))}
              </div>
              <div className="flex gap-8 border-t pt-3.5 mt-auto" style={{ borderColor: "var(--mx-border)" }}>
                <div><p className="m-0 font-bold text-lg" style={{ color: "var(--mx-fg)" }}>{data.length}</p><p className="m-0 mt-px text-[11px]" style={{ color: "var(--mx-subtle)" }}>matières</p></div>
                <div><p className="m-0 font-bold text-lg" style={{ color: "var(--mx-tier-high)" }}>{data.filter(m => getChinaTier(getChinaShare(m)) === "high").length}</p><p className="m-0 mt-px text-[11px]" style={{ color: "var(--mx-subtle)" }}>concentrées Chine</p></div>
                <div><p className="m-0 font-bold text-lg" style={{ color: n.accent }}>{n.riskLevel}</p><p className="m-0 mt-px text-[11px]" style={{ color: "var(--mx-subtle)" }}>niveau de risque</p></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}>
        <div className="grid gap-3 px-5 py-3 border-b" style={{ gridTemplateColumns: "1.4fr 1.3fr .7fr .8fr 1.2fr .9fr", background: "var(--mx-card-2)", borderColor: "var(--mx-border)" }}>
          {["Matière", "Catégorie", "Statut UE", "Score", "Part Chine", "Concentration"].map(h => (
            <span key={h} className="font-semibold text-[10.5px] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>{h}</span>
          ))}
        </div>
        {tableRows.map(m => {
          const china = getChinaShare(m);
          const tier = getChinaTier(china);
          const tierMeta = CHINA_TIER_META[tier];
          const stColor = m.is_strategic_eu ? "var(--mx-amber)" : "var(--mx-blue)";
          return (
            <div
              key={m.id}
              className="grid gap-3 px-5 py-2.5 items-center border-b last:border-b-0 transition-colors hover:bg-[var(--mx-card-2)]"
              style={{ gridTemplateColumns: "1.4fr 1.3fr .7fr .8fr 1.2fr .9fr", borderColor: "var(--mx-border)" }}
            >
              <span className="font-semibold text-[13px]" style={{ color: "var(--mx-fg)" }}>{m.name_fr}</span>
              <span className="text-[11.5px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--mx-subtle)" }}>{m.category}</span>
              <span>
                <span className="font-semibold text-[10px] px-2 py-0.5 rounded-full" style={{ color: stColor, background: `color-mix(in srgb, ${stColor} 13%, transparent)` }}>
                  {m.is_strategic_eu ? "Stratégique" : "Critique"}
                </span>
              </span>
              <span className="font-bold text-[12.5px]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-amber)" }}>{(m.carbonco_supply_risk_score ?? 0).toFixed(1)}</span>
              <span className="flex items-center gap-2">
                <span className="w-16 h-1 rounded-full overflow-hidden inline-block" style={{ background: "var(--mx-chip)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${china}%`, background: tierMeta.colorVar }} />
                </span>
                <span className="font-semibold text-[11.5px]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-muted)" }}>{china}%</span>
              </span>
              <span className="font-semibold text-[11.5px]" style={{ color: tierMeta.colorVar }}>
                {tier === "high" ? "Chine ≥ 50%" : tier === "mid" ? "Présence Chine" : "Diversifié"}
              </span>
            </div>
          );
        })}
        <p className="px-5 py-3 text-[11px]" style={{ background: "var(--mx-card-2)", color: "var(--mx-subtle)" }}>
          12 premières matières par score CarbonCo — valeurs estimées, part Chine au stade agrégé. Grille complète ci-dessous.
        </p>
      </div>
    </section>
  );
}
