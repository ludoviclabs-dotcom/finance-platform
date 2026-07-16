"use client";
import { useRouter } from "next/navigation";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare } from "@/lib/crm/dataLoader";

interface Props { materials: Material[] }

type Node = {
  id: string;
  name: string;
  size: number;
  china: number;
  category: string;
  strategic: boolean;
  fill: string;
};

function fillFor(china: number): string {
  if (china >= 50) return "#ef4444";   // red-500
  if (china >= 20) return "#f59e0b";   // amber-500
  return "#10b981";                     // emerald-500
}

/* Cellule custom : rect + label si la tuile est assez grande */
function TreemapCell(props: {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; size?: number; fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, size, fill } = props;
  const showName = width > 68 && height > 34;
  const showScore = width > 68 && height > 52;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={fill} fillOpacity={0.82} stroke="#09090b" strokeWidth={2} />
      {showName && (
        <text x={x + 8} y={y + 20} fill="#fff" fontSize={12} fontWeight={700}
          style={{ pointerEvents: "none" }}>
          {name && name.length > width / 8 ? `${name.slice(0, Math.floor(width / 8))}…` : name}
        </text>
      )}
      {showScore && (
        <text x={x + 8} y={y + 38} fill="rgba(255,255,255,0.75)" fontSize={11}
          fontFamily="ui-monospace, monospace" style={{ pointerEvents: "none" }}>
          {size}
        </text>
      )}
    </g>
  );
}

function TreemapTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: Node }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 backdrop-blur px-4 py-3 shadow-xl">
      <p className="font-bold text-white text-sm">{d.name}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{d.category}</p>
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-zinc-300">Score CarbonCo : <span className="font-mono text-amber-400 font-bold">{d.size}</span></p>
        <p className="text-zinc-300">Part Chine : <span className="font-mono font-bold" style={{ color: fillFor(d.china) }}>{d.china}%</span></p>
        <p className="text-zinc-300">Statut UE : <span className="font-semibold">{d.strategic ? "Stratégique (⊂ critique)" : "Critique"}</span></p>
      </div>
      <p className="text-[10px] text-zinc-500 mt-2">Cliquer pour ouvrir la fiche →</p>
    </div>
  );
}

export default function CriticalityTreemap({ materials }: Props) {
  const router = useRouter();

  const data: Node[] = materials.map(m => {
    const china = getChinaShare(m);
    return {
      id: m.id,
      name: m.name_fr,
      size: m.carbonco_supply_risk_score ?? 0,
      china,
      category: m.category,
      strategic: m.is_strategic_eu,
      fill: fillFor(china),
    };
  }).sort((a, b) => b.size - a.size);

  return (
    <section id="treemap" className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Treemap de risque d&apos;approvisionnement</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Surface proportionnelle au <strong className="text-zinc-300">score CarbonCo</strong>{" "}
            (risque d&apos;approvisionnement, estimé — pas un score officiel UE). Couleur selon la part chinoise de production.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Chine ≥ 50%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> 20–49%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> &lt; 20%</span>
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-2 h-[420px] lg:h-[480px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" nameKey="name" aspectRatio={4 / 3}
            isAnimationActive={false}
            content={<TreemapCell />}
            onClick={(node: unknown) => {
              const id = (node as { id?: string })?.id;
              if (id) router.push(`/materials/${id}`);
            }}>
            <Tooltip content={<TreemapTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
