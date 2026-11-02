"use client";

import { useEffect, useRef, useState } from "react";
import type { BomItem, Layer } from "@/lib/robotics/dataLoader";
import { squarify } from "@/lib/crm/squarify";
import { Frame } from "@/components/materials/industry/Frame";
import { BOM_WEIGHT_META, bomWeight } from "./labels";

const TREEMAP_H = 420;

/** Mesure du cadre : même discipline que le treemap de /materials (valeur de
 *  bureau servie avant la mesure, pour que le HTML prérendu ne déborde pas). */
function useMeasuredBox() {
  const ref = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 1052, h: TREEMAP_H - 4 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 2;
      const h = el.clientHeight - 2;
      if (w > 0 && h > 0) setBox(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, box };
}

export default function BomTreemap({ items, layers }: { items: BomItem[]; layers: Layer[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { ref, box } = useMeasuredBox();

  const sorted = [...items].sort((a, b) => b.max_pct - a.max_pct);
  const tiles = squarify(sorted.map(bom => ({ value: bom.max_pct, bom })), 0, 0, box.w, box.h);
  const selected = items.find(i => i.id === selectedId) ?? null;
  const layerName = (id: string) => layers.find(l => l.id === id)?.name ?? id;

  return (
    <>
      <Frame as="figure" ref={ref} className="m-0" style={{ height: TREEMAP_H }}>
        {tiles.map((t, i) => {
          const bom = t.item.bom;
          const weight = BOM_WEIGHT_META[bomWeight(bom.max_pct)];
          const isOn = selectedId === bom.id;
          const pct = bom.min_pct === bom.max_pct ? `${bom.max_pct} %` : `${bom.min_pct}–${bom.max_pct} %`;
          return (
            <button
              key={bom.id}
              type="button"
              onClick={() => setSelectedId(prev => (prev === bom.id ? null : bom.id))}
              aria-pressed={isOn}
              title={`${bom.label} — ${pct}`}
              className="ind-tile ind-tile-in"
              style={{
                position: "absolute",
                left: t.x, top: t.y, width: t.w, height: t.h,
                boxSizing: "border-box",
                border: "1px solid var(--color-bg)",
                background: weight.colorVar,
                color: weight.ink,
                cursor: "pointer",
                overflow: "hidden",
                padding: 0,
                textAlign: "left",
                font: "inherit",
                animationDelay: `${0.15 + i * 0.05}s`,
              }}
            >
              <span
                style={{
                  position: "absolute", left: 12, top: 10, right: 12,
                  fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: t.w > 160 ? 40 : 24, lineHeight: 1,
                  letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1", pointerEvents: "none",
                  display: t.w > 56 && t.h > 36 ? "block" : "none",
                }}
              >
                {pct}
              </span>
              <span
                style={{
                  position: "absolute", left: 12, right: 12, bottom: 10,
                  fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15, lineHeight: "18px",
                  letterSpacing: ".02em", textTransform: "uppercase", pointerEvents: "none",
                  display: t.w > 90 && t.h > 72 ? "block" : "none",
                }}
              >
                {bom.label}
              </span>
            </button>
          );
        })}
      </Frame>

      {selected && (
        <Frame className="flex flex-wrap items-start gap-x-12 gap-y-4" style={{ marginTop: 24, padding: 24 }}>
          <div className="min-w-0" style={{ flex: "1 1 280px" }}>
            <div className="flex items-center gap-3">
              <h3
                style={{
                  margin: 0, fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 28,
                  lineHeight: "32px", letterSpacing: ".02em", textTransform: "uppercase",
                }}
              >
                {selected.label}
              </h3>
              <button
                type="button"
                className="ind-btn ind-btn-ghost ml-auto"
                onClick={() => setSelectedId(null)}
                aria-label="Fermer le détail"
                style={{ padding: "0 6px" }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--ink-78)" }}>{selected.detail}</p>
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
              Couches de la chaîne
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selected.layer_ids.map(id => (
                <a key={id} href={`#couche-${id}`} className="ind-tag ind-tag-neutral">
                  {layerName(id)}
                </a>
              ))}
            </div>
          </div>
        </Frame>
      )}
    </>
  );
}
