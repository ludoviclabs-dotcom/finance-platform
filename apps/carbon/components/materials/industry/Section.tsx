/**
 * Une section de la page telle que la maquette la répète : 24px au-dessus,
 * 48px dessous (72px pour la dernière), ancre décalée sous la barre collante,
 * et une entrée en fondu jouée au chargement, retardée section par section.
 *
 * L'animation est une animation CSS, pas un révélateur au défilement : c'est
 * ce que fait la maquette, et le contenu reste visible sans JavaScript (un
 * révélateur piloté par IntersectionObserver le laisse à opacité nulle tant
 * que la page n'est pas hydratée).
 */
export function Section({
  id,
  revealDelay = 0,
  paddingBottom = 48,
  children,
}: {
  id: string;
  /** Retard de l'entrée, en secondes. */
  revealDelay?: number;
  paddingBottom?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="ind-reveal ind-anchor"
      style={{ padding: `24px 0 ${paddingBottom}px`, animationDelay: `${revealDelay}s` }}
    >
      {children}
    </section>
  );
}
