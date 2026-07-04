// Sparkline SVG minimaliste — ne s'affiche qu'avec ≥ 2 points réels d'historique.
// Convention couleur du module : hausse de prix = tension (rouge), baisse = détente (émeraude).
import type { PricePoint } from "@/lib/crm/dataLoader";

interface Props {
  points: PricePoint[];
  width?: number;
  height?: number;
  className?: string;
}

export default function Sparkline({ points, width = 120, height = 32, className }: Props) {
  if (points.length < 2) return null;

  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - 6) / (points.length - 1);
  const coords = points.map((p, i) => [
    3 + i * stepX,
    height - 4 - ((p.value - min) / range) * (height - 8),
  ] as const);

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const color = up ? "#ef4444" : "#10b981";
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      className={className} role="img"
      aria-label={`Évolution du prix sur ${points.length} relevés, de ${values[0]} à ${values[values.length - 1]}`}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}
