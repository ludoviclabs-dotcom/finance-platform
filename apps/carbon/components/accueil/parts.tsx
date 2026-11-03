import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FOOTER_LINKS, HERO } from "./content";

/**
 * Briques répétées par les trois grilles de l'accueil. Composants serveur :
 * aucun état, les animations sont posées après coup par AccueilMotion.
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
      <b style={{ color: "var(--color-accent)" }}>+</b>
      {children}
    </span>
  );
}

/** Surtitre de section numéroté puis filet ; `after` = marge sous le filet. */
export function Kicker({ children, after = 28 }: { children: ReactNode; after?: number }) {
  return (
    <>
      <span
        style={{
          display: "block",
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--color-accent-700)",
        }}
      >
        {children}
      </span>
      <div style={{ height: 1, margin: `12px 0 ${after}px`, background: "var(--color-divider)" }} />
    </>
  );
}

/** Petit surtitre interne aux cartes (pilote, calcul, étapes). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--color-accent-700)",
      }}
    >
      {children}
    </span>
  );
}

export const H3: CSSProperties = {
  margin: 0,
  fontSize: 22,
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

/** Le titre du hero : « prouvé. » porte le glitch d'AccueilMotion. */
export function HeroTitle({ size, split }: { size: number; split: "two-lines" | "wide" }) {
  const proved = (
    <span data-glitch="1" style={{ display: "inline-block", color: "var(--color-accent)" }}>
      prouvé.
    </span>
  );
  return (
    <h1
      style={{
        margin: "0 0 0 -0.052em",
        fontSize: size,
        lineHeight: split === "wide" ? 0.96 : 0.98,
        letterSpacing: "0.01em",
        textTransform: "uppercase",
      }}
    >
      {split === "wide" ? (
        <>
          <span style={{ display: "block" }}>Votre reporting CSRD,</span>
          {proved}
        </>
      ) : (
        <>
          <span style={{ display: "block" }}>Votre reporting</span>
          <span style={{ display: "block" }}>CSRD, {proved}</span>
        </>
      )}
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

/** Les deux CTA du hero ; `block` les empile pleine largeur (grille 1c). */
export function HeroCtas({ block = false }: { block?: boolean }) {
  const size: CSSProperties = { padding: "13px 22px", fontSize: 16 };
  const blockCls = block ? " acc-btn-block" : "";
  return (
    <div style={block ? { display: "flex", flexDirection: "column", gap: 10 } : { display: "flex", flexWrap: "wrap", gap: 12 }}>
      <Link href={HERO.primary.href} className={`ind-btn ind-btn-primary ind-frame acc-btn${blockCls}`} style={size}>
        {HERO.primary.label}
        <Corners />
      </Link>
      <Link href={HERO.secondary.href} className={`ind-btn ind-btn-secondary acc-btn${blockCls}`} style={size}>
        {HERO.secondary.label}
      </Link>
    </div>
  );
}

export function HeroReassurance({ stacked = false }: { stacked?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        flexWrap: stacked ? "nowrap" : "wrap",
        gap: stacked ? 6 : "8px 22px",
        fontSize: 13,
        color: INK_70,
      }}
    >
      {HERO.reassurance.map((r) => (
        <Plus key={r} gap={6}>
          {r}
        </Plus>
      ))}
    </div>
  );
}

/** Champs du test d'éligibilité. Maquette statique : rien n'est soumis. */
export function CalcField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="acc-field">
      <span>{label}</span>
      <input className="acc-input" type="text" inputMode="numeric" placeholder={placeholder} />
    </label>
  );
}

export function CalcButton() {
  return (
    <button type="button" className="ind-btn ind-btn-primary ind-frame acc-btn" style={{ padding: "10px 20px" }}>
      Calculer
      <Corners />
    </button>
  );
}

export function PilotButton({ style }: { style?: CSSProperties }) {
  return (
    <button type="button" className="ind-btn ind-btn-secondary acc-btn" style={{ padding: "11px 18px", ...style }}>
      Candidater →
    </button>
  );
}

export function PlancheFooter() {
  return (
    <footer
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 24,
        padding: "20px 48px",
        borderTop: "1px solid var(--color-divider)",
        fontSize: 13,
        color: INK_70,
      }}
    >
      <span>Carbon&amp;Co · Traitement et stockage en UE (Francfort)</span>
      <span style={{ display: "flex", gap: 18 }}>
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </span>
    </footer>
  );
}
