/**
 * Le cadre filaire du système « Industry » : un rectangle à filet 1px portant
 * quatre repères de calage « + » débordant aux coins.
 *
 * Le système l'exige sur toute carte, figure ou table encadrée et interdit d'en
 * retirer les repères — d'où ce composant plutôt que la recopie des quatre
 * <i> à chaque appel. Les repères débordent de 6px : un parent qui coupe son
 * débordement les ferait disparaître.
 *
 * `ref` est un prop ordinaire (React 19) et pointe l'élément encadré : le
 * treemap mesure ce cadre pour y poser ses tuiles en absolu.
 */
export function Frame({
  as: Tag = "div",
  className = "",
  style,
  children,
  ref,
  ...rest
}: {
  as?: "div" | "figure" | "section" | "aside";
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
} & Omit<React.HTMLAttributes<HTMLElement>, "style" | "className" | "children">) {
  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`ind-frame relative ${className}`.trim()}
      style={style}
      {...rest}
    >
      <i className="ind-corner tl" />
      <i className="ind-corner tr" />
      <i className="ind-corner bl" />
      <i className="ind-corner br" />
      {children}
    </Tag>
  );
}
