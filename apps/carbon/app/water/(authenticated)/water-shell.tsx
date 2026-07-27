"use client";

/**
 * WaterShell — chrome des surfaces hydriques authentifiées.
 *
 * ## Ce que ce shell remplace
 *
 * `/water/cockpit` et `/water/decision` étaient rendus dans le dashboard
 * général : barre latérale de trente entrées, en-tête de produit, tour
 * d'accueil. Les deux cockpits hydriques y étaient deux lignes parmi les
 * autres, et le lien entre eux n'existait que dans le corps des pages.
 *
 * Le shell ne montre que le domaine hydrique : ses deux surfaces
 * authentifiées, la vitrine publique dont elles sont la contrepartie, et la
 * sortie vers le dashboard. Rien d'autre — ce n'est pas une refonte
 * graphique, c'est le retrait du chrome qui n'appartenait pas à ce domaine.
 *
 * ## Le titre est rendu ICI, et une seule fois
 *
 * Le shell rend le `h1` de la page, comme le faisait l'en-tête du groupe
 * `(app)`. Les deux pages hydriques ouvrent donc leur corps en `h2` — elles
 * le documentent chacune, et l'invariant qu'elles décrivent (un seul titre de
 * premier niveau par document) reste vrai après le déménagement.
 *
 * ## Aucune donnée tenant dans la navigation
 *
 * Les deux liens de section sont des chemins NUS. Aucun identifiant
 * d'entreprise, de site ou de tenant n'entre dans une URL de ce shell — même
 * discipline que les ponts de `module_bridges.py`, pour la même raison : une
 * URL finit dans un historique, une capture d'écran ou un rapport de bug.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplets, LogOut, Waves, ArrowLeft, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { AuthenticatedSession } from "@/components/layout/authenticated-boundary";

/**
 * Titres repris VERBATIM de la table `pageConfig` du dashboard général, d'où
 * ils sortent dans le même changement : le déménagement d'une route ne doit
 * pas être l'occasion de réécrire ce qu'elle annonce.
 */
const SECTIONS = [
  {
    href: "/water/cockpit",
    label: "Cockpit opérationnel",
    icon: Droplets,
    title: "Eau & stress hydrique",
    subtitle:
      "Prélèvements, permis, zones de stress · screening géographique auditable",
    testId: "water-shell-link-cockpit",
  },
  {
    href: "/water/decision",
    label: "Décision",
    icon: Waves,
    title: "Cockpit décisionnel hydrique",
    subtitle:
      "Six facettes séparées · scénarios financiers sans valeur par défaut",
    testId: "water-shell-link-decision",
  },
] as const;

export function WaterShell({
  auth,
  logout,
  children,
}: AuthenticatedSession & { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const current = SECTIONS.find((section) => pathname === section.href);

  return (
    <div
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
      data-testid="water-shell"
    >
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* --------------------------------------------------- Barre de service */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-foreground-muted)] underline-offset-2 hover:underline"
            data-testid="water-shell-link-dashboard"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Tableau de bord
          </Link>

          {/*
            La surface publique est nommée par SON nom, pas par sa nature.
            « Vitrine publique » décrivait une catégorie de page ; depuis que
            `/water` porte une publication réelle et une identité produit, le
            lien doit dire OÙ il mène — au même titre que « Tableau de bord »
            ci-dessus. L'icône de lien externe continue de signaler qu'on
            quitte les surfaces authentifiées.
          */}
          <Link
            href="/water"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-foreground-muted)] underline-offset-2 hover:underline"
            data-testid="water-shell-link-public"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Retour à Water Intelligence
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {/*
              L'adresse de connexion, pas l'identifiant d'entreprise : le
              second n'a rien à faire dans un DOM qui finit en capture d'écran.
            */}
            <span
              className="hidden text-sm text-[var(--color-foreground-muted)] sm:inline"
              data-testid="water-shell-user"
            >
              {auth.email}
            </span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)]"
              data-testid="water-shell-logout"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------ Titre + sections */}
        <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
          <h1
            className="text-xl font-bold text-[var(--color-foreground)]"
            data-testid="water-shell-title"
          >
            {current?.title ?? "Eau & stress hydrique"}
          </h1>
          {current?.subtitle ? (
            <p className="mt-1 max-w-[76ch] text-sm text-[var(--color-foreground-muted)]">
              {current.subtitle}
            </p>
          ) : null}

          <nav aria-label="Surfaces hydriques" className="mt-4" data-testid="water-shell-nav">
            <ul className="flex flex-wrap gap-2">
              {SECTIONS.map((section) => {
                const active = pathname === section.href;
                const Icon = section.icon;
                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      data-testid={section.testId}
                      /*
                        L'état courant est porté par `aria-current` ET par un
                        contraste de fond : la couleur seule ne dit jamais
                        quelle section est ouverte.
                      */
                      className={
                        active
                          ? "inline-flex items-center gap-2 rounded-md bg-[var(--color-foreground)] px-3 py-1.5 text-sm font-semibold text-[var(--color-background)]"
                          : "inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)]"
                      }
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
