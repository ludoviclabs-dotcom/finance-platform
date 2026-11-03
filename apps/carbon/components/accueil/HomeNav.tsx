"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MxTheme } from "@/components/materials/MxThemeProvider";
import { NavResourcesMenu, NavResourcesMobileGroup } from "@/components/landing/nav-resources-menu";
import { NAV_LINKS, NAV_LINKS_AFTER } from "./content";
import { Corners } from "./parts";
import { TrackedLink } from "./TrackedLink";

/**
 * Barre de la page d'accueil : marque, deux ancres de la page, le menu
 * « Dépendances » (métaux, eau, robotique — composant partagé et testé pour
 * sa découvrabilité), tarifs, démo, bascule Clair / Sombre, connexion, essai.
 *
 * Sous 1100px, les liens passent dans un panneau ouvert par un bouton ; le
 * menu Dépendances y est rendu à plat (NavResourcesMobileGroup).
 */
export function HomeNav({ theme, onTheme }: { theme: MxTheme; onTheme: (t: MxTheme) => void }) {
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const seg = (active: boolean): CSSProperties => ({
    font: "500 13px/1 var(--font-body)",
    padding: "8px 12px",
    border: 0,
    cursor: "pointer",
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-bg)" : "var(--color-text)",
  });
  const themeSwitch = (
    <div role="group" aria-label="Thème" style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
      <button type="button" onClick={() => onTheme("clair")} aria-pressed={theme === "clair"} style={seg(theme === "clair")}>
        Clair
      </button>
      <button type="button" onClick={() => onTheme("sombre")} aria-pressed={theme === "sombre"} style={seg(theme === "sombre")}>
        Sombre
      </button>
    </div>
  );
  const close = () => setOpen(false);

  return (
    <nav aria-label="Navigation principale" className="acc-nav">
      <div className="acc-nav-bar">
        <Link href="/" aria-label="CarbonCo — Accueil" className="acc-brand">
          Carbon&amp;Co
        </Link>
        <div className="acc-nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <NavResourcesMenu />
          {NAV_LINKS_AFTER.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="acc-nav-desktop">{themeSwitch}</div>
        <Link href="/login" className="ind-btn ind-btn-ghost acc-btn acc-nav-desktop" style={{ fontSize: 14 }}>
          Se connecter
        </Link>
        <TrackedLink
          href="/login"
          event="trial_started"
          source="header"
          className="ind-btn ind-btn-primary ind-frame acc-btn"
          style={{ fontSize: 14 }}
        >
          Essai gratuit — 14j
          <Corners />
        </TrackedLink>
        <button
          ref={burger}
          type="button"
          className="acc-burger"
          aria-expanded={open}
          aria-controls="acc-mobile-menu"
          aria-label="Menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden>{open ? "✕" : "☰"}</span>
        </button>
      </div>
      {open && (
        <div id="acc-mobile-menu" className="acc-mobile-menu">
          {[...NAV_LINKS, ...NAV_LINKS_AFTER].map((l) => (
            <Link key={l.href} href={l.href} className="acc-mobile-item" onClick={close}>
              <span className="acc-dd-label">{l.label}</span>
            </Link>
          ))}
          <NavResourcesMobileGroup onNavigate={close} />
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, paddingTop: 16 }}>
            {themeSwitch}
            <Link href="/login" className="ind-btn ind-btn-secondary acc-btn" onClick={close}>
              Se connecter
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
