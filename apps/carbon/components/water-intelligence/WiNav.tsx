/**
 * WiNav.tsx — navigation ancrée du module public Water Intelligence (P04).
 *
 * Server Component : de simples ancres `<a href="#...">`, aucun état, aucun
 * JavaScript. La navigation clavier fonctionne nativement, et le saut d'ancre
 * est compensé par `scroll-margin-top` en CSS (pas de calcul JS).
 */

export interface WiNavItem {
  id: string;
  label: string;
}

export function WiNav({ items }: { items: readonly WiNavItem[] }) {
  return (
    <nav className="wi-nav" aria-label="Sections de la page">
      <div className="wi-nav-inner">
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="wi-nav-link">
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
