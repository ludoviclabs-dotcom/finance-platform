"use client";

/**
 * Habillage de l'Atlas 3D : pastilles de famille, fiche « digitalisée » et
 * légende. La scène three.js elle-même est chargée à la demande — three,
 * d3-geo et la topologie world-atlas ne sont téléchargés que si l'utilisateur
 * ouvre cette vue, jamais au chargement de /materials.
 */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare } from "@/lib/crm/dataLoader";
import { useMxTheme } from "../MxThemeProvider";
import { FAMILIES, type FamilyId } from "./families";

const Atlas3DScene = dynamic(() => import("./Atlas3DScene"), {
  ssr: false,
  loading: () => (
    <div
      className="absolute inset-0 grid place-items-center"
      style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-70)" }}
    >
      Chargement de l’atlas…
    </div>
  ),
});

/**
 * Frappe le texte caractère par caractère. Sous prefers-reduced-motion, le
 * texte est posé d'un coup — la fiche reste lisible, sans curseur clignotant.
 */
function useTypewriter(text: string, speed: number, enabled: boolean): { shown: string; typing: boolean } {
  const [shown, setShown] = useState(enabled ? "" : text);

  useEffect(() => {
    if (!enabled) { setShown(text); return; }
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, enabled]);

  return { shown, typing: enabled && shown.length < text.length };
}

function Caret() {
  return <span style={{ color: "var(--color-accent)", marginLeft: 1 }}>▌</span>;
}

export default function Atlas3D({ materials }: { materials: Material[] }) {
  const { theme } = useMxTheme();
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  const [family, setFamily] = useState<FamilyId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? materials.find(m => m.id === selectedId) ?? null : null;

  // Le nom et la catégorie se frappent ; les chiffres n'apparaissent qu'une
  // fois le nom posé, pour que la fiche se lise dans l'ordre.
  const name = useTypewriter(selected?.name_fr ?? "", 28, animate);
  const category = useTypewriter(selected?.category ?? "", 10, animate && !name.typing);
  const bodyVisible = !category.typing;

  // Les barres des producteurs partent de zéro à chaque nouvelle fiche.
  const [barsOn, setBarsOn] = useState(false);
  const barsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setBarsOn(false);
    if (!selected) return;
    barsTimer.current = setTimeout(() => setBarsOn(true), animate ? 120 : 0);
    return () => { if (barsTimer.current) clearTimeout(barsTimer.current); };
  }, [selectedId, selected, animate]);

  const rowLabel: React.CSSProperties = { color: "var(--ink-70)", alignSelf: "center" };
  const rowValue: React.CSSProperties = {
    fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 20, lineHeight: 1,
    letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1", textAlign: "right",
  };
  const listLabel: React.CSSProperties = {
    fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
    fontWeight: 600, color: "var(--ink-70)", marginBottom: 4,
  };

  return (
    <>
      <Atlas3DScene
        materials={materials}
        theme={theme}
        selectedId={selectedId}
        onSelect={setSelectedId}
        family={family}
      />

      {/* Pastilles de famille — boutons à bascule, pas des onglets : ils
          filtrent la scène sans changer de panneau. */}
      <div className="absolute flex flex-wrap gap-1.5" style={{ top: 20, left: 20, maxWidth: "60%", zIndex: 3 }}>
        {FAMILIES.map(f => {
          const on = family === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFamily(f.id)}
              style={{
                font: "inherit", fontSize: 12, letterSpacing: ".02em", padding: "5px 10px",
                border: `1px solid ${on ? "var(--color-accent)" : "var(--color-divider)"}`,
                background: on ? "var(--color-accent)" : "transparent",
                color: on ? "var(--color-bg)" : "var(--color-text)",
                cursor: "pointer", borderRadius: 0,
                transition: "background .15s, color .15s, border-color .15s",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {selected && (
        <aside
          aria-live="polite"
          className="ind-frame absolute"
          style={{
            top: 20, right: 20, width: "min(320px, 38vw)", zIndex: 3,
            background: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
            backdropFilter: "blur(8px)",
            padding: "16px 18px 14px",
          }}
        >
          <i className="ind-corner tl" /><i className="ind-corner tr" />
          <i className="ind-corner bl" /><i className="ind-corner br" />

          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Fermer la fiche"
            className="absolute"
            style={{ top: 8, right: 10, border: 0, background: "none", color: "var(--ink-70)", font: "inherit", fontSize: 16, cursor: "pointer" }}
          >
            ✕
          </button>

          <div style={{ fontSize: 12, lineHeight: "12px", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)" }}>
            {selected.is_strategic_eu ? "Matière stratégique UE" : "Matière critique UE"} · CRMA 2024
          </div>

          <h3
            style={{
              margin: "6px 0 0", fontFamily: "var(--font-heading)", fontWeight: 600,
              fontSize: 28, lineHeight: 1.05, letterSpacing: ".01em", textTransform: "uppercase",
            }}
          >
            {name.shown}{name.typing && <Caret />}
          </h3>
          <p style={{ margin: "2px 0 10px", fontSize: 12, color: "var(--ink-70)", minHeight: 14 }}>
            {category.shown}{category.typing && <Caret />}
          </p>

          {bodyVisible && (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-x-3" style={{ padding: "7px 0", borderTop: "1px solid var(--color-divider)", fontSize: 13 }}>
                <span style={rowLabel}>Score de risque CarbonCo</span>
                <span style={rowValue}>{(selected.carbonco_supply_risk_score ?? 0).toFixed(1)} / 10</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3" style={{ padding: "7px 0", borderTop: "1px solid var(--color-divider)", fontSize: 13 }}>
                <span style={rowLabel}>Part chinoise (stade agrégé)</span>
                <span style={rowValue}>{getChinaShare(selected)} %</span>
              </div>
              {selected.price_snapshot && (
                <div className="grid grid-cols-[1fr_auto] gap-x-3" style={{ padding: "7px 0", borderTop: "1px solid var(--color-divider)", fontSize: 13 }}>
                  <span style={rowLabel}>Prix snapshot</span>
                  <span style={rowValue}>
                    {selected.price_snapshot.value.toLocaleString("fr-FR")} {selected.price_snapshot.unit}
                  </span>
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--color-divider)", padding: "8px 0 0", marginTop: 8, fontSize: 13 }}>
                <div style={listLabel}>Composants &amp; usages</div>
                {selected.main_uses.map(u => (
                  <div key={u} style={{ lineHeight: "20px" }}>› {u}</div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--color-divider)", padding: "8px 0 0", marginTop: 8, fontSize: 13 }}>
                <div style={listLabel}>Top producteurs</div>
                {selected.top_producers.slice(0, 3).map(p => (
                  <div key={p.country} style={{ lineHeight: "20px" }}>
                    <span
                      className="inline-block align-middle"
                      style={{
                        height: 3, marginRight: 8, background: "var(--color-accent)",
                        width: barsOn ? Math.max(4, p.share_pct * 0.9) : 0,
                        transition: "width .6s cubic-bezier(.16,1,.3,1)",
                      }}
                    />
                    {p.country}{" "}
                    <span style={{ color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>{p.share_pct} %</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      )}

      <div
        className="absolute flex items-center gap-3.5 flex-wrap pointer-events-none"
        style={{ left: 20, bottom: 18, fontSize: 12, color: "var(--ink-70)", zIndex: 2 }}
      >
        <span><i className="inline-block align-[-1px] mr-1.5" style={{ width: 10, height: 10, background: "var(--mx-tier-high)", border: "1px solid var(--color-divider)" }} />Chine ≥ 50 %</span>
        <span><i className="inline-block align-[-1px] mr-1.5" style={{ width: 10, height: 10, background: "var(--mx-tier-mid)", border: "1px solid var(--color-divider)" }} />20–49 %</span>
        <span><i className="inline-block align-[-1px] mr-1.5" style={{ width: 10, height: 10, background: "var(--mx-tier-low)", border: "1px solid var(--color-divider)" }} />&lt; 20 %</span>
        <span>Hauteur = score de risque /10</span>
      </div>

      <div
        className="absolute text-right pointer-events-none hidden md:block"
        style={{ right: 20, bottom: 18, fontSize: 12, color: "var(--ink-70)", zIndex: 2 }}
      >
        Glisser pour tourner · survoler ou cliquer une matière
        <br />
        Points : pays producteurs · arcs : flux vers l’Europe
      </div>
    </>
  );
}
