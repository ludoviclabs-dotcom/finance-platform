"use client";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, isChinaConcentrated } from "@/lib/crm/dataLoader";

interface Props { materials: Material[] }

const NARRATIVES = {
  strategic: {
    title: "Matières Stratégiques",
    cardColor: "border-red-500/40 bg-red-500/5",
    badgeColor: "bg-red-500/20 text-red-400",
    scoreColor: "text-red-400", riskLevel: "Critique",
    description: "Sous-ensemble des matières critiques jugé indispensable à la défense, la transition énergétique et l'autonomie numérique. Substitution difficile à court terme ; une rupture d'approvisionnement constitue un risque systémique pour l'économie européenne.",
    examples: ["Terres rares lourdes (aimants, guidage militaire)", "Lithium (batteries véhicules électriques)", "Gallium & Germanium (semi-conducteurs 5G/6G)", "Titane (aérospatiale, défense)", "Cobalt (batteries, superalliages)"],
  },
  criticalOnly: {
    title: "Autres matières critiques",
    cardColor: "border-blue-500/40 bg-blue-500/5",
    badgeColor: "bg-blue-500/20 text-blue-400",
    scoreColor: "text-blue-400", riskLevel: "Élevé",
    description: "Matières critiques non classées stratégiques : risque d'approvisionnement significatif mais substitution partielle possible. Impactent des secteurs clés (chimie, sidérurgie, énergie), avec des alternatives à coûts et délais importants.",
    examples: ["Fluorine (acides industriels, réfrigérants)", "Phosphore (engrais, électronique)", "Vanadium (batteries redox flow)", "Hélium (IRM médicaux, cryogénie)", "Borate (céramiques, verre spécial)"],
  },
} as const;

function avgScore(arr: Material[]): string {
  if (arr.length === 0) return "—";
  const sum = arr.reduce((s, m) => s + (m.carbonco_supply_risk_score ?? 0), 0);
  return (sum / arr.length).toFixed(1);
}

export default function StrategicVsCriticalSection({ materials }: Props) {
  const strategic    = materials.filter(m => m.is_strategic_eu);
  const criticalOnly = materials.filter(m => m.is_critical_eu && !m.is_strategic_eu);

  return (
    <section id="analyse" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Stratégiques vs critiques</h2>
        <p className="text-zinc-400 mt-1 text-sm max-w-3xl">
          Le règlement CRMA (2024) distingue deux statuts <strong className="text-zinc-300">non exclusifs</strong> :
          toute matière stratégique est aussi critique. Les {strategic.length} matières stratégiques forment
          un sous-ensemble des {materials.length} matières critiques ; la carte ci-dessous oppose ce
          sous-ensemble aux {criticalOnly.length} matières critiques non stratégiques.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {([{ data: strategic, key: "strategic" }, { data: criticalOnly, key: "criticalOnly" }] as const).map(({ data, key }) => {
          const n = NARRATIVES[key];
          return (
            <div key={key} className={`rounded-2xl border p-6 space-y-5 ${n.cardColor}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{n.title}</h3>
                  <span className={`inline-block mt-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${n.badgeColor}`}>{data.length} matières</span>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-black ${n.scoreColor}`}>{avgScore(data)}</p>
                  <p className="text-xs text-zinc-500">score CarbonCo moyen /10</p>
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{n.description}</p>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Exemples clés</p>
                <ul className="space-y-1">
                  {n.examples.map(ex => (
                    <li key={ex} className="text-sm text-zinc-300 flex items-center gap-2">
                      <span className="text-zinc-600">›</span>{ex}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
                <div><p className="text-xl font-bold text-white">{data.length}</p><p className="text-xs text-zinc-500">matières</p></div>
                <div><p className="text-xl font-bold text-red-400">{data.filter(m => isChinaConcentrated(m)).length}</p><p className="text-xs text-zinc-500">concentrées Chine</p></div>
                <div><p className={`text-xl font-bold ${n.scoreColor}`}>{n.riskLevel}</p><p className="text-xs text-zinc-500">niveau risque</p></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tableau comparatif top 12 */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 border-b border-zinc-800">
            <tr>
              {["Matière","Catégorie","Statut UE","Score CarbonCo","Part Chine","Concentration"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {[...materials].sort((a,b) => (b.carbonco_supply_risk_score ?? 0) - (a.carbonco_supply_risk_score ?? 0)).slice(0,12).map(m => {
              const china = getChinaShare(m);
              return (
              <tr key={m.id} className="hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{m.name_fr}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{m.category}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.is_strategic_eu ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                    {m.is_strategic_eu ? "Stra." : "Crit."}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-amber-400 font-bold">{m.carbonco_supply_risk_score ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-red-500" style={{ width: `${china}%` }} /></div>
                    <span className="font-mono text-zinc-300 text-xs">{china}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {isChinaConcentrated(m) ? <span className="text-red-400 text-xs font-bold">⚠ Chine ≥ 50%</span> : <span className="text-emerald-400 text-xs">Diversifié</span>}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-zinc-900/50 text-xs text-zinc-500 border-t border-zinc-800">
          12 premières matières par score CarbonCo — valeurs estimées, part Chine au stade de production agrégé. Grille complète ci-dessous.
        </div>
      </div>
    </section>
  );
}
