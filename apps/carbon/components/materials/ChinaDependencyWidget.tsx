"use client";

import { useEffect, useState } from "react";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, getChinaTier, type ChinaTier } from "@/lib/crm/dataLoader";
import { CHINA_TIER_META } from "@/lib/crm/chinaTier";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { Frame } from "./industry/Frame";

interface Props { materials: Material[] }

const TIER_ORDER: ChinaTier[] = ["high", "mid", "low"];
const RING_R = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
const COUNTER_MS = 1400;

/**
 * Compteur du centre de l'anneau. L'ancienne version déléguait à
 * <AnimatedCounter>, qui n'existe plus ici : l'anneau et le nombre doivent
 * partir ensemble et tenir la même durée (1,4 s), donc une seule rampe pilote
 * les deux plutôt que deux animations indépendantes qui dérivent.
 */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNTER_MS);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return value;
}

export default function ChinaDependencyWidget({ materials }: Props) {
  // Faux pendant l'hydratation, comme au serveur : le compteur part de 0 des
  // deux côtés. La vraie préférence arrive au rendu suivant.
  const animate = !usePrefersReducedMotion();

  const tiers = TIER_ORDER.map(tier => ({
    tier,
    ...CHINA_TIER_META[tier],
    items: materials.filter(m => getChinaTier(getChinaShare(m)) === tier),
  }));

  const dominated = tiers[0].items.length;
  const fraction = materials.length === 0 ? 0 : dominated / materials.length;
  const pct = Math.round(fraction * 100);
  const counter = useCountUp(pct, animate);

  // L'anneau se remplit depuis zéro peu après le montage : la transition CSS
  // n'a lieu que si la valeur initiale rendue est bien 0 (un dasharray posé
  // directement à sa valeur finale ne transite pas). Sans animation, il est
  // plein d'emblée — `filled` ne suffit pas : son état initial est fixé
  // pendant l'hydratation, avant que la préférence ne soit connue.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!animate) return;
    const id = setTimeout(() => setFilled(true), 300);
    return () => clearTimeout(id);
  }, [animate]);
  const ringFilled = filled || !animate;

  const headerCell: React.CSSProperties = {
    padding: "12px 24px",
    fontSize: 13,
    lineHeight: "24px",
    letterSpacing: ".08em",
    textTransform: "uppercase",
    fontWeight: 600,
  };

  return (
    <Frame>
      <header className="flex flex-wrap" style={{ borderBottom: "1px solid var(--color-divider)" }}>
        <span style={{ ...headerCell, flex: 1, minWidth: "16ch" }}>
          Part chinoise de production — stade agrégé
        </span>
        <span
          className="whitespace-nowrap"
          style={{ ...headerCell, borderLeft: "1px solid var(--color-divider)", color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}
        >
          {materials.length} matières
        </span>
        <span
          className="hidden sm:inline whitespace-nowrap"
          style={{ ...headerCell, borderLeft: "1px solid var(--color-divider)", color: "var(--ink-70)" }}
        >
          Valeurs estimées
        </span>
      </header>

      {/* 4fr/8fr au-delà de lg ; empilé en dessous, où le filet vertical entre
          l'anneau et les paliers devient un filet horizontal. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] items-stretch">
        <div
          className="flex flex-col items-center justify-center gap-3 border-b lg:border-b-0 lg:border-r"
          style={{ padding: "36px 24px", borderColor: "var(--color-divider)" }}
        >
          <div className="relative" style={{ width: 196, height: 196 }}>
            <svg viewBox="0 0 196 196" width={196} height={196} style={{ display: "block" }} aria-hidden="true">
              <circle cx="98" cy="98" r={RING_R} fill="none" stroke="var(--color-divider)" strokeWidth={1} />
              <circle
                cx="98"
                cy="98"
                r={RING_R}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={6}
                strokeDasharray={`${((ringFilled ? fraction : 0) * RING_CIRCUMFERENCE).toFixed(1)} ${RING_CIRCUMFERENCE.toFixed(1)}`}
                transform="rotate(-90 98 98)"
                style={{ transition: animate ? "stroke-dasharray 1.4s cubic-bezier(.16,1,.3,1)" : "none" }}
              />
              <circle cx="98" cy="98" r={74} fill="none" stroke="var(--color-divider)" strokeWidth={1} strokeDasharray="2 6" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 56,
                  lineHeight: 1,
                  letterSpacing: ".01em",
                  fontFeatureSettings: "'tnum' 1",
                }}
              >
                {counter}
                <span style={{ fontSize: 28, color: "var(--ink-55)" }}> %</span>
              </span>
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  color: "var(--ink-70)",
                  marginTop: 6,
                }}
              >
                dominance chinoise
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", textAlign: "center", color: "var(--ink-70)", maxWidth: "26ch" }}>
            {dominated} matières sur {materials.length} dont la Chine assure au moins la moitié de la production.
          </p>
        </div>

        <div className="flex flex-col">
          {tiers.map(t => (
            <div
              key={t.tier}
              className="grid grid-cols-[52px_minmax(0,1fr)_72px] sm:grid-cols-[72px_minmax(0,1fr)_96px] gap-x-4 sm:gap-x-6 items-center"
              style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-divider)" }}
            >
              <span
                className="flex items-center gap-2.5"
                style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}
              >
                <i
                  className="inline-block shrink-0"
                  style={{ width: 10, height: 10, background: t.colorVar, border: "1px solid var(--color-divider)" }}
                />
                {String(TIER_ORDER.indexOf(t.tier) + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 22,
                    lineHeight: "24px",
                    letterSpacing: ".02em",
                    textTransform: "uppercase",
                  }}
                >
                  {t.label}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
                  {t.desc}
                  {t.items.length > 0 && (
                    <> · {t.items.slice(0, 5).map(m => m.name_fr).join(", ")}
                      {t.items.length > 5 ? ` +${t.items.length - 5}` : ""}</>
                  )}
                </p>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 40,
                  lineHeight: "40px",
                  letterSpacing: ".02em",
                  textAlign: "right",
                  fontFeatureSettings: "'tnum' 1",
                }}
              >
                {t.items.length}
              </span>
            </div>
          ))}
          <p style={{ margin: "auto 0 0", padding: "12px 24px", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
            Part chinoise dérivée des producteurs du snapshot, au stade de production agrégé — extraction, raffinage
            et transformation non distingués. Valeurs estimées.
          </p>
        </div>
      </div>
    </Frame>
  );
}
