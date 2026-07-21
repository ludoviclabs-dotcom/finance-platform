"use client";

import type { CSSProperties } from "react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Reveal } from "@/components/ui/reveal";
import type { MaterialsSummary } from "@/lib/crm/dataLoader";
import MxScoreRing from "./MxScoreRing";

interface Props {
  summary: MaterialsSummary;
  snapshotYear: number;
}

function KpiGlowCard({ value, suffix, label, color, glow }: {
  value: number; suffix: string; label: string; color: string; glow: boolean;
}) {
  return (
    <div
      onMouseMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--gx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--gy", `${e.clientY - rect.top}px`);
      }}
      onMouseLeave={e => {
        e.currentTarget.style.setProperty("--gx", "-220px");
        e.currentTarget.style.setProperty("--gy", "-220px");
      }}
      style={{ "--gx": "-220px", "--gy": "-220px" } as CSSProperties}
      className={`relative overflow-hidden rounded-2xl border p-4 flex items-center gap-3.5 transition-transform hover:-translate-y-0.5 ${glow ? "mx-alert-glow" : ""}`}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(170px circle at var(--gx) var(--gy), color-mix(in srgb, ${color} 14%, transparent), transparent 72%)` }}
      />
      <MxScoreRing value={1} size={58} strokeWidth={6} color={color} />
      <div className="relative min-w-0">
        <p className="m-0 font-bold text-[27px] leading-none" style={{ fontFamily: "var(--mx-font-display)", color, fontVariantNumeric: "tabular-nums" }}>
          <AnimatedCounter value={value} suffix={suffix} />
        </p>
        <p className="m-0 mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--mx-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

export default function MaterialsHero({ summary, snapshotYear }: Props) {
  const { total, strategic, chinaConcentrated, chinaThreshold, alerts, alertsThreshold } = summary;

  // Tous les indicateurs sont DÉRIVÉS du dataset — aucun chiffre en dur.
  const kpis = [
    { value: total, suffix: "", label: "Matières critiques UE", color: "var(--mx-em)", glow: false },
    { value: strategic, suffix: "", label: "Dont stratégiques", color: "var(--mx-violet)", glow: false },
    {
      value: chinaConcentrated, suffix: "",
      label: `Concentrées en Chine ≥ ${chinaThreshold}%`,
      color: "var(--mx-tier-high)", glow: false,
    },
    {
      value: alerts, suffix: "",
      label: `Alertes volatilité ≥ ${alertsThreshold}%`,
      color: "var(--mx-amber)", glow: alerts > 0,
    },
  ];

  return (
    <div id="apercu" className="mx-anchor relative overflow-hidden border-b" style={{ borderColor: "var(--mx-border)" }}>
      <div
        className="mx-drift-bg absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--mx-fg) 9%, transparent) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          WebkitMaskImage: "radial-gradient(ellipse 75% 80% at 45% 35%, #000 25%, transparent 75%)",
          maskImage: "radial-gradient(ellipse 75% 80% at 45% 35%, #000 25%, transparent 75%)",
        }}
      />
      <div
        className="mx-aurora-1 absolute -top-[180px] -right-[120px] w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--mx-em) 14%, transparent), transparent 65%)", filter: "blur(20px)" }}
      />
      <div
        className="mx-aurora-2 absolute -bottom-[220px] -left-[100px] w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--mx-violet) 12%, transparent), transparent 65%)", filter: "blur(20px)" }}
      />

      <div className="relative max-w-[1280px] mx-auto px-5 md:px-7 pt-14 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="flex flex-col gap-5">
          <Reveal>
            <p
              className="m-0 flex items-center gap-2 font-semibold text-[10.5px] uppercase tracking-[0.16em]"
              style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-em)" }}
            >
              <span className="w-[22px] h-px" style={{ background: "var(--mx-em)" }} />
              Intelligence économique · Métaux critiques · Snapshot {snapshotYear}
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1
              className="m-0 font-bold leading-[1.1] tracking-tight"
              style={{ fontFamily: "var(--mx-font-display)", fontSize: "clamp(34px,3.7vw,48px)", color: "var(--mx-fg)" }}
            >
              Les métaux critiques au cœur de la{" "}
              <span style={{ background: "linear-gradient(100deg, var(--mx-em), var(--mx-cyan))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                géopolitique
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="m-0 text-[15.5px] leading-relaxed max-w-[520px]" style={{ color: "var(--mx-muted)" }}>
              {total} matières premières critiques identifiées par l&apos;Union Européenne, dont{" "}
              <strong className="font-semibold" style={{ color: "var(--mx-fg)" }}>{strategic} jugées stratégiques</strong>{" "}
              pour la défense, la transition énergétique et l&apos;autonomie numérique.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="flex flex-wrap gap-3 pt-0.5">
              <a
                href="#matieres"
                className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 font-semibold text-[13.5px] transition"
                style={{ background: "linear-gradient(120deg, var(--mx-em-dark), var(--mx-em))", color: "#06121E", boxShadow: "0 6px 24px color-mix(in srgb, var(--mx-em) 30%, transparent)" }}
              >
                Explorer les {total} matières →
              </a>
              <a
                href="#carte"
                className="inline-flex items-center rounded-[10px] border px-5 py-2.5 font-semibold text-[13.5px] transition"
                style={{ borderColor: "var(--mx-border-2)", color: "var(--mx-fg)" }}
              >
                Cartographie mondiale
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--mx-amber)" }} />
              <p className="m-0 text-[11.5px]" style={{ color: "var(--mx-subtle)" }}>
                Snapshot de démonstration — valeurs estimées, non normatives. Méthodologie en pied de page.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {kpis.map(k => <KpiGlowCard key={k.label} {...k} />)}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
