/**
 * ResourceNav — barre d'onglets du cockpit Ressources (Module 2, PR-M2C).
 *
 * Pure (l'onglet actif est passé en prop, pas lu via un hook) → testable au
 * rendu serveur et réutilisable sur les cinq pages.
 */

import Link from "next/link";

export type ResourceTab = "catalog" | "exposures" | "assessments" | "methodology";

const TABS: { key: ResourceTab; href: string; label: string }[] = [
  { key: "catalog", href: "/resources", label: "Catalogue" },
  { key: "exposures", href: "/resources/exposures", label: "Expositions" },
  { key: "assessments", href: "/resources/assessments", label: "Assessments" },
  { key: "methodology", href: "/resources/methodology", label: "Méthodologie" },
];

export function ResourceNav({ active }: { active: ResourceTab }) {
  return (
    <nav aria-label="Sections du module Ressources" className="mb-6 border-b border-[var(--color-border)]">
      <ul className="flex flex-wrap gap-1">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                data-testid={`resource-tab-${t.key}`}
                className={`inline-block border-b-2 px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-emerald-500 text-[var(--color-foreground)]"
                    : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default ResourceNav;
