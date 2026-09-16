/**
 * L'en-tête de section de la refonte : un surtitre numéroté en capitales, puis
 * un filet pleine largeur. Remplace les pastilles et encadrés colorés de la
 * version précédente — ici la hiérarchie est portée par le filet et le rythme
 * vertical, pas par une boîte.
 */
export function SectionKicker({ children, gap = 24 }: { children: React.ReactNode; gap?: number }) {
  return (
    <>
      <span
        style={{
          display: "block",
          fontSize: 13,
          lineHeight: "12px",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--color-accent-700)",
          marginBottom: 12,
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {children}
      </span>
      <hr style={{ height: 1, border: 0, margin: `0 0 ${gap}px`, background: "var(--color-divider)" }} />
    </>
  );
}

/** Titre de section — Barlow Condensed, capitales, 32px. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: "var(--font-heading)",
        fontWeight: 600,
        fontSize: 32,
        lineHeight: "36px",
        letterSpacing: ".02em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </h2>
  );
}

/** Chapô de section. */
export function SectionLead({ children, maxCh = 60 }: { children: React.ReactNode; maxCh?: number }) {
  return (
    <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: "24px", maxWidth: `${maxCh}ch`, color: "var(--ink-78)" }}>
      {children}
    </p>
  );
}
