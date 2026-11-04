/**
 * WiNeural.tsx — le copilote NEURAL de l'accueil, dessiné en épure, en guide
 * du module Eau.
 *
 * Mêmes formes que la planche « Assistant ESG » de l'accueil
 * (`components/accueil/AvatarBlueprint.tsx`), sans son animation perpétuelle :
 * le tracé se dessine UNE fois à l'apparition (CSS, nombre d'itérations fini),
 * et rien ne joue si le visiteur demande moins d'animations.
 */

const SHAPES = [
  { kind: "line", attrs: { x1: 120, y1: 40, x2: 120, y2: 62 } },
  { kind: "circle", attrs: { cx: 120, cy: 34, r: 6 } },
  { kind: "rect", attrs: { x: 58, y: 62, width: 124, height: 84, rx: 34 } },
  { kind: "rect", attrs: { x: 72, y: 78, width: 96, height: 52, rx: 22 } },
  { kind: "rect", attrs: { x: 42, y: 88, width: 12, height: 34, rx: 5 } },
  { kind: "rect", attrs: { x: 186, y: 88, width: 12, height: 34, rx: 5 } },
  { kind: "rect", attrs: { x: 108, y: 146, width: 24, height: 10 } },
  { kind: "rect", attrs: { x: 72, y: 156, width: 96, height: 62, rx: 18 } },
  { kind: "circle", attrs: { cx: 120, cy: 187, r: 13 } },
  { kind: "rect", attrs: { x: 54, y: 162, width: 12, height: 46, rx: 6 } },
  { kind: "rect", attrs: { x: 174, y: 162, width: 12, height: 46, rx: 6 } },
] as const;

export function WiNeural({ size = 120, plate }: { size?: number; plate?: string }) {
  return (
    <figure className="wi-neural">
      <div className="wi-neural-head" aria-hidden="true">
        <span>Guide NEURAL</span>
        {plate ? <span className="wi-neural-plate">{plate}</span> : null}
      </div>
      <div className="wi-neural-stage">
        <svg
          viewBox="0 0 240 260"
          width={size}
          height={Math.round((size * 260) / 240)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
          className="wi-neural-svg"
        >
          <g strokeWidth={1} strokeDasharray="2 5" opacity={0.5}>
            <line x1={120} y1={12} x2={120} y2={252} />
            <line x1={30} y1={104} x2={210} y2={104} />
          </g>
          {SHAPES.map((shape, i) => {
            const style = { animationDelay: `${200 + i * 70}ms` };
            if (shape.kind === "line") return <line key={i} className="wi-neural-draw" style={style} {...shape.attrs} />;
            if (shape.kind === "circle") return <circle key={i} className="wi-neural-draw" style={style} {...shape.attrs} />;
            return <rect key={i} className="wi-neural-draw" style={style} {...shape.attrs} />;
          })}
          <circle cx={100} cy={104} r={7} />
          <circle cx={140} cy={104} r={7} />
          <circle cx={100} cy={104} r={2.5} fill="currentColor" stroke="none" />
          <circle cx={140} cy={104} r={2.5} fill="currentColor" stroke="none" />
          <path d="M112 187 q8 -12 16 0 q-8 10 -16 0z" fill="currentColor" stroke="none" opacity={0.45} />
          <ellipse cx={120} cy={240} rx={54} ry={6} strokeDasharray="3 4" opacity={0.6} />
        </svg>
        <figcaption className="wi-neural-cap">Fig. — copilote, mode eau</figcaption>
      </div>
    </figure>
  );
}
