/**
 * ModuleLinks — ponts vers les modules qui portent l'empreinte réelle
 * (Module 2, PR-M2C).
 *
 * Décision D-4 : le module Ressources n'est PAS un moteur carbone. L'exposition
 * environnementale (intensité carbone, eau, énergie, achats) se LIT depuis les
 * modules existants — jamais recalculée ici. Ce composant matérialise ce
 * principe : il oriente vers CRMA, Eau, Énergie (Scope 2) et Achats (Scope 3)
 * plutôt que d'afficher un chiffre carbone inventé.
 *
 * Purement présentationnel → testable au rendu serveur.
 */

import Link from "next/link";

interface ModuleLink {
  href: string;
  label: string;
  description: string;
  testId: string;
}

const LINKS: ModuleLink[] = [
  {
    href: "/crma",
    label: "CRMA — matières critiques",
    description: "Exposition matière, aimants permanents, Article 24.",
    testId: "module-link-crma",
  },
  {
    href: "/water",
    label: "Eau — stress hydrique",
    description: "Prélèvements, permis et screening de stress hydrique par site.",
    testId: "module-link-water",
  },
  {
    href: "/scopes",
    label: "Énergie — Scope 2",
    description: "Électricité, chaleur, vapeur ; location-based et market-based.",
    testId: "module-link-energy",
  },
  {
    href: "/fournisseurs/scope3",
    label: "Achats — Scope 3",
    description: "Lignes d'achat et empreinte amont de la chaîne de valeur.",
    testId: "module-link-procurement",
  },
];

export function ModuleLinks() {
  return (
    <div data-testid="module-links">
      <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">
        L&apos;exposition environnementale d&apos;une ressource se lit dans les modules qui
        détiennent la donnée — le module Ressources oriente, il ne recalcule aucun facteur carbone
        (décision D-4).
      </p>
      <nav aria-label="Modules liés à l'exposition environnementale">
        <ul className="grid gap-3 sm:grid-cols-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                data-testid={l.testId}
                className="block rounded-xl border border-[var(--color-border)] p-3 transition hover:border-emerald-500/50"
              >
                <span className="text-sm font-semibold text-[var(--color-foreground)]">
                  {l.label}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                  {l.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default ModuleLinks;
