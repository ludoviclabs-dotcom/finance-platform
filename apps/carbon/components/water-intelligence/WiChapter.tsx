/**
 * WiChapter.tsx — un chapitre de la surface publique Water Intelligence.
 *
 * La refonte Industry découpe la page en chapitres qui tiennent chacun dans un
 * écran : on avance par le rail du bas (Précédent / Suivant) ou par la
 * navigation, pas par un défilement sans fin. Le chapitre reste un simple
 * `<section>` ancré — aucun état, aucun JavaScript : les ancres historiques et
 * la navigation clavier fonctionnent nativement.
 */

import type { ReactNode } from "react";

export interface WiChapterLink {
  readonly id: string;
  readonly label: string;
}

export function WiChapter({
  id,
  index,
  total,
  kicker,
  title,
  lead,
  prev,
  next,
  bare = false,
  children,
}: {
  id: string;
  index: number;
  total: number;
  kicker?: string;
  title?: string;
  lead?: ReactNode;
  prev?: WiChapterLink | null;
  next?: WiChapterLink | null;
  /** Sans en-tête : le premier chapitre porte le h1 du hero. */
  bare?: boolean;
  children: ReactNode;
}) {
  const headingId = `${id}-chapitre`;
  const number = String(index).padStart(2, "0");
  const totalLabel = String(total).padStart(2, "0");
  const segments = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <section
      id={id}
      className="wi-chapter"
      aria-labelledby={bare ? undefined : headingId}
      aria-label={bare ? `Chapitre ${number}` : undefined}
    >
      {!bare && title ? (
        <header className="wi-chapter-head">
          <div className="wi-chapter-head-main">
            <p className="wi-kicker">
              {number} · {kicker}
            </p>
            <h2 id={headingId} className="wi-h2">
              {title}
            </h2>
          </div>
          {lead ? <div className="wi-chapter-lead">{lead}</div> : null}
        </header>
      ) : null}

      <div className="wi-chapter-body">{children}</div>

      <nav className="wi-chapter-rail" aria-label={`Progression — chapitre ${number} sur ${totalLabel}`}>
        <span className="wi-chapter-count">
          Chapitre {number} / {totalLabel}
        </span>
        <span className="wi-chapter-segments" aria-hidden="true">
          {segments.map((n) => (
            <span
              key={n}
              className="wi-chapter-segment"
              data-state={n < index ? "done" : n === index ? "current" : "todo"}
            />
          ))}
        </span>
        {prev ? (
          <a href={`#${prev.id}`} className="wi-btn">
            ← {prev.label}
          </a>
        ) : null}
        {next ? (
          <a href={`#${next.id}`} className="wi-btn wi-btn-primary">
            Suivant : {next.label} →
          </a>
        ) : null}
      </nav>
    </section>
  );
}

/** Le cadre filaire Industry : un filet 1px et quatre repères « + » aux coins. */
export function WiFrame({
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: {
  as?: "div" | "figure" | "section" | "aside" | "article";
  className?: string;
  children?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={`wi-frame ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
