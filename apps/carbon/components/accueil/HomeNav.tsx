"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MxTheme } from "@/components/materials/MxThemeProvider";
import { MODULES, NAV_ANCHORS, NAV_ANCHORS_AFTER } from "./content";
import { Corners } from "./parts";

/**
 * Barre de l'accueil Industry : marque et rubrique, ancres de la page, menu
 * « Modules » déroulant, bascule Clair / Sombre, connexion et essai.
 *
 * `anchor` préfixe les ancres : la page de revue pose trois planches côte à
 * côte, chacune avec ses propres sections — sans préfixe, les identifiants
 * se dupliqueraient et chaque barre enverrait vers la première planche.
 */
export function HomeNav({
  section = "Accueil",
  theme,
  onTheme,
  motion = true,
  anchor = (id: string) => id,
}: {
  section?: string;
  theme: MxTheme;
  onTheme: (t: MxTheme) => void;
  motion?: boolean;
  anchor?: (id: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const dd = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (dd.current && !dd.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !motion || !panel.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    panel.current.animate(
      [
        { opacity: 0, transform: "translateY(-6px)", clipPath: "inset(0 0 100% 0)" },
        { opacity: 1, transform: "none", clipPath: "inset(-12px -12px -12px -12px)" },
      ],
      { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
  }, [open, motion]);

  const seg = (active: boolean): CSSProperties => ({
    font: "500 13px/1 var(--font-body)",
    padding: "8px 12px",
    border: 0,
    cursor: "pointer",
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-bg)" : "var(--color-text)",
  });

  return (
    <nav
      className="acc-nav"
      style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "14px 48px",
        borderBottom: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginRight: "auto" }}>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "0.01em",
            color: "inherit",
          }}
        >
          Carbon&amp;Co
        </Link>
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--ink-70)",
          }}
        >
          {section}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {NAV_ANCHORS.map((a) => (
          <a key={a.id} href={`#${anchor(a.id)}`}>
            {a.label}
          </a>
        ))}
        <div ref={dd} style={{ position: "relative" }}>
          <button
            type="button"
            className="acc-nav-toggle"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="true"
          >
            Modules{" "}
            <span
              aria-hidden
              style={{ display: "inline-block", transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}
            >
              ▾
            </span>
          </button>
          {open && (
            <div
              ref={panel}
              className="ind-frame"
              style={{
                position: "absolute",
                top: "calc(100% + 18px)",
                left: -18,
                width: 340,
                padding: "6px 0",
                background: "var(--color-bg)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <Corners />
              {MODULES.map((m) => (
                <Link key={m.code} href={m.href} className="acc-menu-item" onClick={() => setOpen(false)}>
                  <span
                    style={{
                      gridRow: "span 2",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      color: "var(--color-accent-700)",
                    }}
                  >
                    {m.code}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      fontSize: 17,
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {m.title}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-70)" }}>{m.body}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        {NAV_ANCHORS_AFTER.map((a) => (
          <a key={a.id} href={`#${anchor(a.id)}`}>
            {a.label}
          </a>
        ))}
      </div>
      <div role="group" aria-label="Thème" style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
        <button type="button" onClick={() => onTheme("clair")} aria-pressed={theme === "clair"} style={seg(theme === "clair")}>
          Clair
        </button>
        <button type="button" onClick={() => onTheme("sombre")} aria-pressed={theme === "sombre"} style={seg(theme === "sombre")}>
          Sombre
        </button>
      </div>
      <Link href="/login" className="ind-btn ind-btn-ghost acc-btn" style={{ fontSize: 14 }}>
        Se connecter
      </Link>
      <Link href="/login" className="ind-btn ind-btn-primary ind-frame acc-btn" style={{ fontSize: 14 }}>
        Essai gratuit — 14j
        <Corners />
      </Link>
    </nav>
  );
}
