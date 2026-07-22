/**
 * Primitives de mise en page du cockpit Ressources (Module 2, PR-M2C).
 *
 * Purement présentationnels (aucun hook) → testables au rendu serveur
 * (`renderToStaticMarkup`), thème via variables CSS (`--color-*`) pour vivre
 * dans le shell `(app)` en clair comme en sombre. Centralisés ici pour ne pas
 * dupliquer `Section` dans les cinq pages.
 */

import type { ReactNode } from "react";

export function ResourceSection({
  title,
  subtitle,
  children,
  testId,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testId: string;
  actions?: ReactNode;
}) {
  return (
    <section className="mb-8" data-testid={testId}>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h2>
        {actions}
      </div>
      {subtitle && (
        <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>
      )}
      {children}
    </section>
  );
}

export function ResourceCard({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] p-4 ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Ligne clé/valeur discrète (fiche ressource). */
export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value}</dd>
    </div>
  );
}

/** Message d'état neutre (vide) — distingue « pas de donnée » de « pas de risque ». */
export function EmptyNote({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="text-sm text-[var(--color-muted-foreground)]" data-testid={testId}>
      {children}
    </p>
  );
}
