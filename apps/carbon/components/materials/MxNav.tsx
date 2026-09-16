"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMxTheme } from "./MxThemeProvider";

const SECTIONS = [
  { id: "pourquoi", label: "Pourquoi" },
  { id: "chine", label: "Dépendance" },
  { id: "carte", label: "Cartographie" },
  { id: "risque", label: "Risque" },
  { id: "chaine", label: "Chaîne" },
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
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      {/* Le rembourrage aligne la barre sur la colonne de contenu (1200px max)
          tout en la gardant pleine largeur : même calcul que le conteneur,
          répété ici parce que la barre est collante et vit hors de lui.
          flex-wrap + row-gap : sous ~1000px les liens passent à la ligne au
          lieu de comprimer la marque et l'interrupteur de thème (le point
          laissé à vérifier par la session de design). */}
      <div
        className="flex items-center flex-wrap gap-x-4 gap-y-2"
        style={{
          padding: "12px max(clamp(20px,5vw,72px), calc((100% - 1200px) / 2 + clamp(20px,5vw,72px)))",
        }}
      >
        <Link
          href="/"
          className="flex items-baseline gap-2.5 whitespace-nowrap mr-auto"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 18,
            color: "var(--color-text)",
          }}
        >
          Carbon&amp;Co
          <span
            className="hidden sm:inline"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: 13,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink-70)",
            }}
          >
            Matières critiques
          </span>
        </Link>

        <nav className="mx-scrollbar-none flex gap-4 overflow-x-auto min-w-0">
          {SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={isActive ? "location" : undefined}
                className="shrink-0 whitespace-nowrap"
                style={{ fontSize: 14, color: isActive ? "var(--color-accent-700)" : "inherit" }}
              >
                {s.label}
              </a>
            );
          })}
        </nav>

        <span
          className="hidden md:inline whitespace-nowrap"
          style={{
            fontSize: 12,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--color-accent-700)",
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          Snapshot {snapshotDateLabel}
        </span>

        {/* Radios natives : choix unique, navigable au clavier sans script. */}
        <div className="ind-seg" role="group" aria-label="Thème">
          <label className="ind-seg-opt">
            <input
              type="radio"
              name="mx-theme"
              value="clair"
              checked={theme === "clair"}
              onChange={() => setTheme("clair")}
            />
            Clair
          </label>
          <label className="ind-seg-opt">
            <input
              type="radio"
              name="mx-theme"
              value="sombre"
              checked={theme === "sombre"}
              onChange={() => setTheme("sombre")}
            />
            Sombre
          </label>
        </div>
      </div>
    </div>
  );
}
