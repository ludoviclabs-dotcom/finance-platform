import type { CSSProperties, ReactNode } from "react";
import { HERO } from "./content";
import { TrackedLink } from "./TrackedLink";

/**
 * Briques de la page d'accueil. Composants serveur : aucun état, les
 * animations sont posées après coup par HomeShell.
 */

export const INK_78 = "var(--ink-78)";
export const INK_70 = "var(--ink-70)";

/** Les quatre repères « + » d'un cadre filaire, pour les éléments que
 *  <Frame> ne sait pas rendre (liens, boutons). */
export function Corners() {
  return (
    <>
      <i className="ind-corner tl" />
      <i className="ind-corner tr" />
      <i className="ind-corner bl" />
      <i className="ind-corner br" />
    </>
  );
}

/** Une puce « + » accentuée devant un court libellé. */
export function Plus({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return (
    <span style={{ display: "flex", gap }}>
      <b aria-hidden style={{ color: "var(--color-accent)" }}>
        +
      </b>
      <span>{children}</span>
    </span>
  );
}

/**
 * Titre de section : surtitre numéroté puis filet. Rendu en <h2> — la
 * maquette le dessine comme un simple libellé, mais c'est lui qui structure
 * le plan de la page pour les lecteurs d'écran.
 */
export function Kicker({ children, after = 28, id }: { children: ReactNode; after?: number; id?: string }) {
  return (
    <>
      <h2
        id={id}
        style={{
          margin: 0,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--color-accent-700)",
        }}
      >
        {children}
      </h2>
      <div style={{ height: 1, margin: `12px 0 ${after}px`, background: "var(--color-divider)" }} />
    </>
  );
}

/** Petit surtitre interne aux cartes. */
export function Eyebrow({ children, as: Tag = "span" }: { children: ReactNode; as?: "span" | "h2" }) {
  return (
    <Tag
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: 12,
        lineHeight: 1.4,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--color-accent-700)",
      }}
    >
      {children}
    </Tag>
  );
}

export const H3: CSSProperties = {
  margin: 0,
  fontSize: 21,
  lineHeight: 1.1,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

export const BODY: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.55, color: INK_78 };

export const HEADING_NUM: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  lineHeight: 1,
};

/** Le titre du hero : « prouvé. » porte le glitch de HomeShell. */
export function HeroTitle() {
  return (
    <h1 className="acc-hero-title">
      <span style={{ display: "block" }}>Votre reporting</span>
      <span style={{ display: "block" }}>
        CSRD,{" "}
        <span data-glitch="1" style={{ display: "inline-block", color: "var(--color-accent)" }}>
          prouvé.
        </span>
      </span>
    </h1>
  );
}

export function HeroTag() {
  return (
    <span className="ind-tag ind-tag-accent" style={{ alignSelf: "flex-start", fontWeight: 600, letterSpacing: "0.06em" }}>
      {HERO.tag}
    </span>
  );
}

export function HeroCtas() {
  const size: CSSProperties = { padding: "13px 22px", fontSize: 16 };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <TrackedLink
        href={HERO.primary.href}
        event="trial_started"
        source="hero"
        className="ind-btn ind-btn-primary ind-frame acc-btn"
        style={size}
      >
        {HERO.primary.label}
        <Corners />
      </TrackedLink>
      <TrackedLink
        href={HERO.secondary.href}
        event="demo_requested"
        source="hero"
        className="ind-btn ind-btn-secondary acc-btn"
        style={size}
      >
        {HERO.secondary.label}
      </TrackedLink>
    </div>
  );
}

export function HeroReassurance() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px", fontSize: 13, color: INK_70 }}>
      {HERO.reassurance.map((r) => (
        <Plus key={r} gap={6}>
          {r}
        </Plus>
      ))}
    </div>
  );
}
