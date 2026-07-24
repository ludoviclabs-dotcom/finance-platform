/**
 * WiPrimitives.tsx — primitives du shell public Water Intelligence (P04).
 *
 * Tous ces composants sont des Server Components (aucun `"use client"`,
 * aucun hook, aucun gestionnaire d'événement) : la page publique est rendue
 * intégralement côté serveur, sans îlot client ni bailout CSR.
 *
 * Règle d'accessibilité tenue ici : la couleur n'est JAMAIS le seul vecteur
 * d'information. Chaque badge et chaque zone « donnée absente » porte un
 * libellé texte explicite en plus de sa teinte et, le cas échéant, de sa
 * texture (hachures).
 */

import type { ReactNode } from "react";

/* -------------------------------------------------------------- Section */

export function WiSection({
  id,
  title,
  kicker,
  children,
}: {
  id: string;
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-titre`;
  return (
    <section id={id} className="wi-section" aria-labelledby={headingId}>
      {kicker ? (
        <p className="wi-mono" style={{ color: "var(--wi-data)", marginBottom: "0.375rem" }}>
          {kicker}
        </p>
      ) : null}
      <h2 id={headingId} className="wi-h2">
        {title}
      </h2>
      <div style={{ marginTop: "1rem" }}>{children}</div>
    </section>
  );
}

/* --------------------------------------------------------------- Badges */

type BadgeTone = "demo" | "absent" | "pending" | "alert";

const BADGE_CLASS: Record<BadgeTone, string> = {
  demo: "wi-badge wi-badge-demo",
  absent: "wi-badge wi-badge-absent",
  pending: "wi-badge wi-badge-pending",
  alert: "wi-badge wi-badge-alert",
};

/**
 * Pastille d'état. `label` est toujours rendu en texte : un lecteur d'écran
 * comme un lecteur daltonien reçoit la même information que la couleur.
 */
export function WiBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <span className={BADGE_CLASS[tone]}>{label}</span>;
}

/* ------------------------------------------------- Placeholder honnête */

/**
 * Bloc d'une section dont la donnée n'est PAS encore branchée.
 *
 * N'invente rien : annonce explicitement ce qui manque, quelle mission le
 * livrera, et ne montre aucun chiffre. La texture hachurée double le libellé
 * « Non branché » — elle ne le remplace pas.
 */
export function WiPlaceholder({
  what,
  plannedIn,
  children,
}: {
  what: string;
  plannedIn: string;
  children?: ReactNode;
}) {
  return (
    <div className="wi-absent-fill" style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <WiBadge tone="pending" label="Non branché" />
        <span className="wi-mono" style={{ color: "var(--wi-muted)" }}>
          Prévu&nbsp;: {plannedIn}
        </span>
      </div>
      <p className="wi-muted" style={{ marginTop: "0.75rem" }}>
        {what}
      </p>
      {children ? <div style={{ marginTop: "0.75rem" }}>{children}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------- Donnée absente */

/**
 * Marqueur d'une valeur absente. Rend littéralement « Donnée absente », jamais
 * `0`, jamais un tiret muet : donnée manquante ≠ zéro (invariant du dépôt).
 */
export function WiAbsentValue({ reason }: { reason: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
      <WiBadge tone="absent" label="Donnée absente" />
      <span className="wi-muted" style={{ fontSize: "0.8125rem" }}>
        {reason}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ Carte info */

export function WiCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: "water" | "data" | "stress" | "compliance" | "adapt" | "absent";
  children: ReactNode;
}) {
  const accentClass = accent ? ` wi-accent-${accent}` : "";
  return (
    <div className={`wi-card${accentClass}`}>
      <h3 className="wi-h3">{title}</h3>
      <div className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
        {children}
      </div>
    </div>
  );
}
