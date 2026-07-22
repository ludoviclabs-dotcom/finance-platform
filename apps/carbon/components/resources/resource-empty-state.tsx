"use client";

/**
 * États vides du cockpit Ressources — composant présentationnel générique +
 * décideur pur.
 *
 * Remplace l'ancien paragraphe unique (qui mélangeait « catalogue vide » et
 * « aucun résultat de filtre », et exposait le nom interne « Evidence Kernel »
 * comme s'il s'agissait d'une instruction utilisateur). Trois cas désormais
 * distincts, décidés par `resourcesEmptyStateKind` :
 *
 *  - `empty-real` : catalogue vide, session réelle → onboarding.
 *  - `empty-demo` : catalogue vide, session de démonstration → le scénario
 *                   Asterion doit être chargé via le workflow protégé (jamais
 *                   déclenché depuis le navigateur).
 *  - `no-results` : un filtre/recherche est actif et exclut tout, alors que le
 *                   catalogue existe → proposition de réinitialiser.
 *
 * Le composant n'expose JAMAIS d'interne d'administration (DATABASE_ADMIN_URL,
 * nom de moteur d'ingestion, bouton lançant un workflow admin).
 */

import type { ReactNode } from "react";
import Link from "next/link";

export type ResourcesEmptyKind = "grid" | "no-results" | "empty-real" | "empty-demo";

/**
 * Décide quel rendu afficher sous les filtres du catalogue. Pur — testé sans
 * monter la page.
 *
 * `no-results` n'est retenu que si un filtre (famille ≠ « all ») OU une
 * recherche est actif : sans filtre, un catalogue vide est un vrai vide
 * (onboarding), jamais un « aucun résultat ».
 */
export function resourcesEmptyStateKind(input: {
  itemsLength: number;
  filteredLength: number;
  family: string;
  query: string;
  isDemo: boolean;
}): ResourcesEmptyKind {
  const { itemsLength, filteredLength, family, query, isDemo } = input;
  if (filteredLength > 0) return "grid";
  const noFilters = family === "all" && query.trim() === "";
  if (noFilters && itemsLength === 0) return isDemo ? "empty-demo" : "empty-real";
  return "no-results";
}

export type ResourceEmptyAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  testId?: string;
  variant?: "primary" | "ghost";
};

const ACTION_CLASS: Record<"primary" | "ghost", string> = {
  primary:
    "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700",
  ghost:
    "inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-surface-raised)]",
};

export function ResourceEmptyState({
  icon,
  title,
  description,
  actions = [],
  testId,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  actions?: ResourceEmptyAction[];
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="mx-auto max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-6 py-10 text-center"
    >
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-foreground)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        {description}
      </p>
      {actions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions.map((a) => {
            const cls = ACTION_CLASS[a.variant ?? "primary"];
            return a.href ? (
              <Link key={a.label} href={a.href} data-testid={a.testId} className={cls}>
                {a.label}
              </Link>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                data-testid={a.testId}
                className={`${cls} cursor-pointer`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
