"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMxTheme } from "./MxThemeProvider";

const SECTIONS = [
  { id: "apercu", label: "Vue d'ensemble" },
  { id: "carte", label: "Cartographie" },
  { id: "treemap", label: "Risque" },
  { id: "analyse", label: "Analyse" },
  { id: "chaine", label: "Chaîne" },
  { id: "matieres", label: "Matières" },
] as const;

// Scroll-spy réel via IntersectionObserver (le prototype Claude Design ne
// peut pas s'appuyer dessus dans son bac à sable de prévisualisation et
// utilise un polling manuel — ce n'est pas une contrainte du navigateur réel).
function useScrollSpy(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const elements = ids
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        );
        setActive(topMost.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export default function MxNav({ snapshotDateLabel }: { snapshotDateLabel: string }) {
  const { theme, setTheme } = useMxTheme();
  const activeSection = useScrollSpy(SECTIONS.map(s => s.id));

  return (
    <div
      className="sticky top-0 z-40 backdrop-blur-xl border-b"
      style={{
        background: "color-mix(in srgb, var(--mx-bg) 80%, transparent)",
        borderColor: "var(--mx-border)",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-5 md:px-7 h-14 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight shrink-0"
          style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}
        >
          Carbon<span style={{ color: "var(--mx-em)" }}>&amp;</span>Co
          <span
            className="text-[8.5px] font-semibold uppercase tracking-[0.12em] rounded-[5px] border px-1.5 py-px opacity-85"
            style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-em)", borderColor: "var(--mx-em)" }}
          >
            Intelligence
          </span>
        </Link>

        <nav className="mx-scrollbar-none flex gap-1.5 overflow-x-auto flex-1 min-w-0">
          {SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                style={{
                  color: isActive ? "var(--mx-em)" : "var(--mx-muted)",
                  background: isActive ? "color-mix(in srgb, var(--mx-em) 14%, transparent)" : "transparent",
                  borderColor: isActive ? "color-mix(in srgb, var(--mx-em) 35%, transparent)" : "transparent",
                }}
              >
                {s.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className="hidden sm:flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.1em]"
            style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-em)" }}
          >
            <span className="mx-pulse-dot w-1.5 h-1.5 rounded-full" style={{ background: "var(--mx-em)" }} />
            SNAPSHOT {snapshotDateLabel}
          </span>
          <div
            className="flex p-[3px] rounded-[9px] border"
            style={{ borderColor: "var(--mx-border)", background: "var(--mx-card-2)" }}
          >
            <button
              type="button"
              onClick={() => setTheme("sombre")}
              aria-pressed={theme === "sombre"}
              className="px-2.5 py-1 rounded-[7px] text-[11.5px] font-semibold cursor-pointer transition-colors"
              style={{
                color: theme === "sombre" ? "var(--mx-em)" : "var(--mx-muted)",
                background: theme === "sombre" ? "color-mix(in srgb, var(--mx-em) 16%, transparent)" : "transparent",
              }}
            >
              Sombre
            </button>
            <button
              type="button"
              onClick={() => setTheme("clair")}
              aria-pressed={theme === "clair"}
              className="px-2.5 py-1 rounded-[7px] text-[11.5px] font-semibold cursor-pointer transition-colors"
              style={{
                color: theme === "clair" ? "var(--mx-em)" : "var(--mx-muted)",
                background: theme === "clair" ? "color-mix(in srgb, var(--mx-em) 16%, transparent)" : "transparent",
              }}
            >
              Clair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
