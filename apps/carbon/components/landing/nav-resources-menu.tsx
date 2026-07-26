"use client";

/**
 * components/landing/nav-resources-menu.tsx — menu « Ressources » de la barre
 * publique (feat/water-intelligence-discoverability).
 *
 * ## Pourquoi un menu plutôt qu'un neuvième lien
 *
 * Le commentaire de `landing-page.tsx` le disait déjà : « 9 liens text-sm + logo
 * + 2 CTA ≈ 1520px > conteneur 1440px », et « Accueil » avait dû sortir du
 * desktop pour que la barre cesse de déborder. Ajouter naïvement
 * « Eau & risques hydriques » aurait remis le débordement, en pire — c'est le
 * libellé le plus long des dix.
 *
 * Deux entrées thématiques (Métaux, Eau) sont regroupées sous « Ressources ».
 * La barre perd un lien au lieu d'en gagner un.
 *
 * ## Accessibilité — ce qui est tenu, et comment
 *
 * - **Ouverture par bouton**, jamais par survol seul : un menu qui ne s'ouvre
 *   qu'au hover est inatteignable au clavier et instable au toucher. Le survol
 *   n'ouvre rien ici.
 * - `aria-expanded` et `aria-controls` sur le déclencheur, `aria-haspopup`.
 * - **Échap** ferme et **rend le focus au déclencheur** — sans ce retour, le
 *   focus resterait sur un élément détaché et la tabulation repartirait du
 *   document.
 * - **Clic extérieur** ferme (`pointerdown` sur le document, capturé avant que
 *   le clic n'atteigne sa cible).
 * - **Flèches haut/bas** parcourent les entrées ; `Home`/`End` vont aux
 *   extrémités.
 * - **Tabulation hors du menu** ferme aussi : `focusout` vérifie si le nouveau
 *   focus est encore dans le menu.
 * - Chaque entrée porte un libellé ET une description : la couleur ne porte
 *   aucune information.
 *
 * Aucun paquet n'est ajouté : ni Radix, ni Headless UI. L'animation se limite à
 * une transition d'opacité, neutralisée sous `prefers-reduced-motion`, et le
 * menu est parfaitement utilisable sans elle.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

export interface ResourceMenuEntry {
  readonly href: string;
  readonly label: string;
  readonly description: string;
}

/**
 * Les deux surfaces publiques thématiques.
 *
 * Exportées pour que les tests vérifient les cibles sans monter le composant,
 * et pour que la version mobile rende exactement les mêmes entrées — une
 * seconde liste finirait par diverger.
 */
export const RESOURCE_MENU_ENTRIES: readonly ResourceMenuEntry[] = [
  {
    href: "/materials",
    label: "Métaux critiques",
    description: "Dépendances, criticité et chaînes d’approvisionnement",
  },
  {
    href: "/water",
    label: "Eau & risques hydriques",
    description: "Stress, prélèvements, qualité, réglementation et résilience",
  },
] as const;

export const RESOURCE_MENU_LABEL = "Ressources";

/** Menu déroulant accessible de la barre desktop. */
export function NavResourcesMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  /* Clic hors du menu. `pointerdown` plutôt que `click` : la fermeture doit
     précéder l'activation de ce que l'utilisateur vise. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /* Échap depuis n'importe où dans le menu, focus rendu au déclencheur. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
      return;
    }
    if (!open) return;

    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[current < 0 ? 0 : (current + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[current <= 0 ? items.length - 1 : current - 1]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  /* Tabuler hors du menu le ferme, sans voler le focus au passage. */
  const onFocusOut = (event: React.FocusEvent) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={onFocusOut}
      data-testid="nav-resources-menu"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => {
          const next = !open;
          setOpen(next);
          // Ouverture au clavier comme à la souris : la première entrée reçoit
          // le focus, sinon un utilisateur clavier ouvrirait un menu vide de
          // point d'entrée.
          if (next) requestAnimationFrame(() => itemRefs.current[0]?.focus());
        }}
        className="flex items-center gap-1 whitespace-nowrap text-xs 2xl:text-sm font-semibold text-neutral-500 hover:text-black transition-colors motion-reduce:transition-none tracking-wide cursor-pointer"
        data-testid="nav-resources-trigger"
      >
        {RESOURCE_MENU_LABEL}
        <svg
          className="w-3 h-3"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/*
        Rendu conditionnel plutôt que masquage CSS : un menu fermé mais présent
        dans le DOM reste tabulable, et l'utilisateur clavier traverse des liens
        qu'il ne voit pas.
      */}
      {open && (
        <div
          id={menuId}
          role="group"
          aria-label={RESOURCE_MENU_LABEL}
          className="absolute left-0 top-full mt-3 w-[22rem] rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl"
          data-testid="nav-resources-panel"
        >
          {RESOURCE_MENU_ENTRIES.map((entry, index) => (
            <Link
              key={entry.href}
              href={entry.href}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 hover:bg-neutral-50 focus-visible:bg-neutral-50 transition-colors motion-reduce:transition-none"
              data-testid={`nav-resources-item-${index}`}
            >
              <span className="block text-sm font-bold text-black">{entry.label}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{entry.description}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Version mobile — mêmes entrées, sans dépliage.
 *
 * Le tiroir mobile est déjà une liste verticale : y imbriquer un second niveau
 * repliable ajouterait un état à gérer sans rien rendre plus lisible. Les deux
 * entrées sont donc listées à plat sous un intertitre, ce qui les rend
 * atteignables en un geste au lieu de deux.
 */
export function NavResourcesMobileGroup({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div data-testid="nav-resources-mobile">
      <p className="pt-3 pb-1 text-[0.7rem] uppercase tracking-widest font-bold text-neutral-400">
        {RESOURCE_MENU_LABEL}
      </p>
      {RESOURCE_MENU_ENTRIES.map((entry, index) => (
        <Link
          key={entry.href}
          href={entry.href}
          onClick={onNavigate}
          className="block py-3 border-b border-neutral-100 hover:text-black transition-colors motion-reduce:transition-none"
          data-testid={`nav-resources-mobile-item-${index}`}
        >
          <span className="block text-sm font-semibold text-neutral-600">{entry.label}</span>
          <span className="block text-xs text-neutral-400">{entry.description}</span>
        </Link>
      ))}
    </div>
  );
}
