import type { Material } from "@/lib/crm/dataLoader";

// Bandeau de cotation défilant — pur CSS (.mx-ticker-track), aucun hook :
// reste un Server Component, pas de "use client" nécessaire.
export default function MxTicker({ materials }: { materials: Material[] }) {
  const priced = materials.filter(m => m.price_snapshot);
  if (priced.length === 0) return null;

  const items = priced.map(m => {
    const p = m.price_snapshot!;
    const t = p.trend_3m_pct;
    return {
      key: m.id,
      name: m.name_fr,
      price: p.value.toLocaleString("fr-FR"),
      unit: p.unit,
      trend: (t > 0 ? "▲ +" : t < 0 ? "▼ " : "") + t + " %",
      trendColor: t > 0 ? "var(--mx-red)" : t < 0 ? "var(--mx-em)" : "var(--mx-muted)",
    };
  });
  // Dupliqué pour une boucle CSS sans coupure (translateX -50% = une copie pleine).
  const looped = [...items, ...items];

  return (
    <div className="border-b overflow-hidden" style={{ borderColor: "var(--mx-border)", background: "color-mix(in srgb, var(--mx-surface) 70%, transparent)" }}>
      <div className="mx-ticker-track flex w-max gap-9 py-2.5">
        {looped.map((it, i) => (
          <span key={`${it.key}-${i}`} className="flex items-baseline gap-2.5 shrink-0 text-xs whitespace-nowrap">
            <span className="font-semibold whitespace-nowrap" style={{ color: "var(--mx-muted)" }}>{it.name}</span>
            <span className="font-semibold" style={{ fontFamily: "var(--mx-font-mono)" }}>{it.price}</span>
            <span style={{ fontFamily: "var(--mx-font-mono)", fontSize: 10, color: "var(--mx-subtle)" }}>{it.unit}</span>
            <span className="font-bold" style={{ fontFamily: "var(--mx-font-mono)", fontSize: 11, color: it.trendColor }}>{it.trend}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
