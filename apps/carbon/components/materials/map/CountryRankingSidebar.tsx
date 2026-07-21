"use client";

/**
 * Classement des pays producteurs + animation "reveal loop" en boucle
 * infinie (3 phases : révélation séquentielle → pause avec glow sur #1 →
 * dissolution inversée) qui se met en pause au survol. Entièrement figée
 * (liste complète affichée statiquement) sous prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { CountryWeight } from "@/lib/crm/countryWeights";

interface Props {
  weights: CountryWeight[];
  selectedCountry: string | null;
  onSelectCountry: (country: string | null) => void;
}

const RANK_SIZE = 10;
const REVEAL_STAGGER_MS = 130;
const HOLD_MS = 3800;
const DISSOLVE_STAGGER_MS = 70;
const FLICKER_TICK_MS = 700;

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export default function CountryRankingSidebar({ weights, selectedCountry, onSelectCountry }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const top = weights.slice(0, RANK_SIZE);
  const maxTotal = top[0]?.total || 1;

  const [visibleCount, setVisibleCount] = useState(prefersReducedMotion ? RANK_SIZE : 0);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [flicker, setFlicker] = useState<Record<number, 1 | -1>>({});
  const hoveredRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleCount(RANK_SIZE);
      return;
    }
    let cancelled = false;
    const waitUnhover = async () => {
      while (!cancelled && hoveredRef.current) await delay(150);
    };

    async function loop() {
      while (!cancelled) {
        await waitUnhover();
        if (cancelled) return;
        setPhase("in");
        setVisibleCount(0);
        setFlicker({});
        await delay(350);
        for (let i = 1; i <= RANK_SIZE; i++) {
          await waitUnhover();
          if (cancelled) return;
          setVisibleCount(i);
          await delay(REVEAL_STAGGER_MS);
        }

        setPhase("hold");
        const holdUntil = Date.now() + HOLD_MS;
        while (!cancelled && (Date.now() < holdUntil || hoveredRef.current)) {
          await delay(FLICKER_TICK_MS);
          if (cancelled) return;
          if (hoveredRef.current) continue;
          const a = 1 + Math.floor(Math.random() * (RANK_SIZE - 1));
          const b = 1 + Math.floor(Math.random() * (RANK_SIZE - 1));
          setFlicker({ [a]: Math.random() > 0.5 ? 1 : -1, [b]: Math.random() > 0.5 ? 1 : -1 });
        }

        await waitUnhover();
        if (cancelled) return;
        setPhase("out");
        setFlicker({});
        for (let i = RANK_SIZE - 1; i >= 0; i--) {
          await waitUnhover();
          if (cancelled) return;
          setVisibleCount(i);
          await delay(DISSOLVE_STAGGER_MS);
        }
        await delay(500);
      }
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion]);

  const selected = weights.find(c => c.country === selectedCountry);

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}
    >
      {selected && (
        <div
          className="rounded-xl border p-3.5 flex flex-col gap-2"
          style={{ borderColor: "color-mix(in srgb, var(--mx-cyan) 35%, var(--mx-border))", background: "var(--mx-card-2)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 font-semibold text-[15px]" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
              {selected.country}
            </p>
            <button
              type="button"
              onClick={() => onSelectCountry(null)}
              aria-label="Fermer le détail pays"
              className="border-none bg-transparent cursor-pointer text-sm p-0.5"
              style={{ color: "var(--mx-subtle)" }}
            >
              ✕
            </button>
          </div>
          <p className="m-0" style={{ fontFamily: "var(--mx-font-mono)", fontSize: 11.5, color: "var(--mx-cyan)" }}>
            {selected.materials.length} matière(s) · poids cumulé {Math.round(selected.total)} pts
          </p>
          <div className="flex flex-col gap-1.5">
            {selected.materials.slice(0, 6).map(m => (
              <div key={m.id} className="flex items-center gap-2.5 text-[12.5px]">
                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--mx-fg)" }}>
                  {m.name_fr}
                </span>
                <div className="w-[70px] h-1 rounded-full overflow-hidden shrink-0" style={{ background: "var(--mx-chip)" }}>
                  <div className="h-full rounded-full" style={{ width: `${m.share_pct}%`, background: "var(--mx-cyan)" }} />
                </div>
                <span className="w-9 text-right font-semibold" style={{ fontFamily: "var(--mx-font-mono)", fontSize: 11.5, color: "var(--mx-muted)" }}>
                  {m.share_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h3 className="m-0 flex items-center gap-2 font-semibold text-[14.5px]" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
          Classement des pays
          <span className="mx-pulse-dot w-1.5 h-1.5 rounded-full" style={{ background: "var(--mx-cyan)" }} />
        </h3>
        <span style={{ fontSize: 11, color: "var(--mx-subtle)" }}>poids cumulé, pts</span>
      </div>

      <div
        onMouseEnter={() => { hoveredRef.current = true; }}
        onMouseLeave={() => { hoveredRef.current = false; }}
        className="flex flex-col gap-1 overflow-y-auto"
      >
        {top.map((c, i) => {
          const visible = i < visibleCount;
          const delta = phase === "hold" ? (flicker[i] ?? 0) : 0;
          const isTop = i === 0;
          return (
            <button
              key={c.country}
              type="button"
              onClick={() => onSelectCountry(selectedCountry === c.country ? null : c.country)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] border-none text-left cursor-pointer"
              style={{
                background: selectedCountry === c.country ? "var(--mx-card-2)" : "transparent",
                outline: selectedCountry === c.country ? "1px solid color-mix(in srgb, var(--mx-cyan) 45%, transparent)" : "none",
                opacity: visible ? 1 : 0,
                transform: visible ? "none" : `translateX(${phase === "out" ? "22px" : "-22px"})`,
                transition: "opacity .4s ease, transform .45s cubic-bezier(.16,1,.3,1), background .15s ease",
                color: "var(--mx-fg)",
              }}
            >
              <span className="w-4 font-semibold" style={{ fontFamily: "var(--mx-font-mono)", fontSize: 10.5, color: "var(--mx-subtle)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${isTop && phase === "hold" ? "mx-pulse-dot" : ""}`}
                style={{ background: isTop ? "var(--mx-tier-high)" : "var(--mx-cyan)" }}
              />
              <span
                className="text-[12.5px] font-medium shrink-0 w-20 overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {c.country}
              </span>
              <div className="flex-1 h-[5px] rounded-full overflow-visible" style={{ background: "var(--mx-chip)" }}>
                <div
                  className={isTop && phase === "hold" ? "mx-row-glow" : ""}
                  style={{
                    height: "100%",
                    width: visible ? `${Math.max(3, (c.total / maxTotal) * 100)}%` : "0%",
                    background: isTop ? "var(--mx-tier-high)" : "var(--mx-cyan)",
                    borderRadius: 5,
                    transition: "width .55s cubic-bezier(.16,1,.3,1)",
                  }}
                />
              </div>
              <span className="w-[34px] text-right font-semibold" style={{ fontFamily: "var(--mx-font-mono)", fontSize: 11.5, color: "var(--mx-muted)" }}>
                {visible ? Math.round(c.total) + delta : ""}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="mt-auto pt-2.5 border-t"
        style={{ fontSize: 10.5, color: "var(--mx-subtle)", borderColor: "var(--mx-border)" }}
      >
        Stade de production agrégé — extraction, raffinage et transformation non distingués.
      </p>
    </div>
  );
}
