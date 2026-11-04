"use client";

/**
 * WiTabs.tsx — onglets accessibles pour tenir un chapitre dans un écran.
 *
 * Tous les panneaux sont rendus côté serveur : un panneau inactif porte
 * `hidden`, il n'est pas absent. Le contenu reste donc dans le document (et
 * dans les contrôles de vérité qui lisent le rendu statique), seule sa
 * visibilité change.
 *
 * Une ancre qui vise un élément d'un panneau caché ouvre ce panneau : un lien
 * `#evenements` historique continue d'atterrir sur ce qu'il promet.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface WiTab {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

export function WiTabs({
  label,
  tabs,
  initial,
}: {
  label: string;
  tabs: readonly WiTab[];
  initial?: string;
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const base = useId();
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || !root.current) return;
      const target = root.current.querySelector(`[id="${CSS.escape(hash)}"]`);
      const panel = target?.closest<HTMLElement>("[data-wi-tab]");
      if (panel?.dataset.wiTab) {
        setActive(panel.dataset.wiTab);
        requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <div className="wi-tabs" ref={root}>
      <div role="tablist" aria-label={label} className="wi-tablist">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className="wi-tabbtn"
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="wi-tabbtn-n" aria-hidden="true">
                {String.fromCharCode(65 + index)}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          data-wi-tab={tab.id}
          hidden={tab.id !== active}
          className="wi-tabpanel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
