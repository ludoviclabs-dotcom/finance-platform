"use client";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, getChinaTier, type ChinaTier } from "@/lib/crm/dataLoader";
import { CHINA_TIER_META } from "@/lib/crm/chinaTier";
import MxScoreRing from "./MxScoreRing";

interface Props { materials: Material[] }

const TIER_ORDER: ChinaTier[] = ["high", "mid", "low"];

export default function ChinaDependencyWidget({ materials }: Props) {
  const tiers = TIER_ORDER.map(tier => ({
    tier,
    ...CHINA_TIER_META[tier],
    items: materials.filter(m => getChinaTier(getChinaShare(m)) === tier),
  }));

  const dominated = tiers[0].items.length;
  const pct = materials.length === 0 ? 0 : Math.round((dominated / materials.length) * 100);
  const chinaChips = tiers[0].items;

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3.5 h-full" style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}>
      <div>
        <h3 className="m-0 font-semibold text-base" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>Dépendance Chine</h3>
        <p className="m-0 mt-[3px] text-[11.5px]" style={{ color: "var(--mx-subtle)" }}>Sur les {materials.length} matières critiques UE — stade agrégé</p>
      </div>

      <div className="flex items-center gap-5">
        <MxScoreRing value={materials.length === 0 ? 0 : dominated / materials.length} size={118} strokeWidth={11} color="var(--mx-tier-high)">
          <span className="font-bold text-2xl" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-tier-high)", fontVariantNumeric: "tabular-nums" }}>
            <AnimatedCounter value={pct} suffix="%" />
          </span>
          <span className="text-[9.5px]" style={{ color: "var(--mx-subtle)" }}>dominance</span>
        </MxScoreRing>

        <div className="flex-1 flex flex-col gap-2.5">
          {tiers.map(t => (
            <div key={t.tier} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: t.colorVar }} />
                <span className="text-xs font-semibold" style={{ color: "var(--mx-fg)" }}>{t.label}</span>
                <span className="ml-auto font-bold text-xs" style={{ fontFamily: "var(--mx-font-mono)", color: t.colorVar }}>{t.items.length}</span>
              </div>
              <p className="m-0 ml-4 text-[10.5px]" style={{ color: "var(--mx-subtle)" }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: "var(--mx-border)" }}>
        {chinaChips.slice(0, 7).map(m => (
          <span
            key={m.id}
            className="text-[10.5px] rounded-full px-2.5 py-0.5"
            style={{ background: "color-mix(in srgb, var(--mx-tier-high) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--mx-tier-high) 30%, transparent)", color: "var(--mx-tier-high)" }}
          >
            {m.name_fr}
          </span>
        ))}
        {chinaChips.length > 7 && (
          <span className="text-[10.5px] px-1" style={{ color: "var(--mx-subtle)" }}>+{chinaChips.length - 7} autres</span>
        )}
      </div>

      <p className="text-[10px] leading-relaxed border-t pt-2.5 mt-auto" style={{ color: "var(--mx-subtle)", borderColor: "var(--mx-border)" }}>
        Part chinoise dérivée des producteurs du snapshot, au stade de production agrégé — extraction, raffinage et transformation non distingués. Valeurs estimées.
      </p>
    </div>
  );
}
