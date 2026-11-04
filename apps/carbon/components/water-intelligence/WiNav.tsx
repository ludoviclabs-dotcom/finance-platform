/**
 * WiNav.tsx — navigation ancrée du module public Water Intelligence (P04),
 * en-tête Industry depuis la refonte : marque, chapitres, date du snapshot et
 * bascule de thème, comme /materials et /robotics.
 *
 * Server Component : de simples ancres `<a href="#...">`, aucun état, aucun
 * JavaScript. La navigation clavier fonctionne nativement, et le saut d'ancre
 * est compensé par `scroll-margin-top` en CSS (pas de calcul JS). Les éléments
 * interactifs (bascule de thème) arrivent par `aside`, rendus par leur propre
 * composant client.
 */

import type { ReactNode } from "react";

export interface WiNavItem {
  id: string;
  label: string;
}

export function WiNav({
  items,
  brand,
  aside,
}: {
  items: readonly WiNavItem[];
  brand?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <nav className="wi-nav" aria-label="Sections de la page">
      <div className="wi-nav-inner">
        {brand ? <div className="wi-nav-brand">{brand}</div> : null}
        <div className="wi-nav-links">
          {items.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="wi-nav-link">
              {item.label}
            </a>
          ))}
        </div>
        {aside ? <div className="wi-nav-aside">{aside}</div> : null}
      </div>
    </nav>
  );
}
