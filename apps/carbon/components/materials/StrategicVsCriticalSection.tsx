"use client";
interface Producer { country: string; share_pct: number }
interface Material { id: string; name_fr: string; category: string; criticality_eu: string; criticality_score: number; china_dominant: boolean; main_uses: string[]; top_producers: Producer[] }
interface Props { materials: Material[] }

function getChinaShare(m: Material): number {
  return m.top_producers.find(p => p.country === "Chine")?.share_pct ?? 0;
}

const NARRATIVES = {
  strategic: {
    title: "Matières Stratégiques", badge: "17 matières",
    cardColor: "border-red-500/40 bg-red-500/5",
    badgeColor: "bg-red-500/20 text-red-400",
    scoreColor: "text-red-400", riskLevel: "Critique",
    description: "Indispensables à la défense nationale, la transition énergétique et l'autonomie numérique. Aucune substitution viable à court terme. Une rupture d'approvisionnement constitue un risque systémique pour l'économie européenne.",
    examples: ["Terres rares lourdes (aimants, guidage militaire)", "Lithium (batteries véhicules électriques)", "Gallium & Germanium (semi-conducteurs 5G/6G)", "Titane (aérospatiale, défense)", "Cobalt (batteries, superalliages)"],
  },
  critical: {
    title: "Matières Critiques", badge: "17 matières",
    cardColor: "border-blue-500/40 bg-blue-500/5",
    badgeColor: "bg-blue-500/20 text-blue-400",
    scoreColor: "text-blue-400", riskLevel: "Élevé",
    description: "Risque d'approvisionnement significatif mais substitution partielle possible. Impactent des secteurs industriels clés (chimie, sidérurgie, énergie). Des alternatives existent mais impliquent des coûts et délais importants.",
    examples: ["Fluorine (acides industriels, réfrigérants)", "Phosphore (engrais, électronique)", "Vanadium (batteries redox flow)", "Hélium (IRM médicaux, cryogénie)", "Borate (céramiques, verre spécial)"],
  },
} as const;

export default function StrategicVsCriticalSection({ materials }: Props) {
  const strategic = materials.filter(m => m.criticality_eu === "Stratégique");
  const critical  = materials.filter(m => m.criticality_eu === "Critique");
  const avgScore  = (arr: Material[]) => (arr.reduce((s,m) => s + m.criticality_score, 0) / arr.length).toFixed(1);

  return (
    <section id="analyse" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Analyse comparative</h2>
        <p className="text-zinc-400 mt-1 text-sm max-w-2xl">
          La Commission Européenne distingue deux niveaux de criticité selon l&apos;irremplaçabilité
          et la concentration géographique des sources d&apos;approvisionnement (CRMA 2024).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {([{ data: strategic, key: "strategic" }, { data: critical, key: "critical" }] as const).map(({ data, key }) => {
          const n = NARRATIVES[key];
          return (
            <div key={key} className={`rounded-2xl border p-6 space-y-5 ${n.cardColor}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{n.title}</h3>
                  <span className={`inline-block mt-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${n.badgeColor}`}>{n.badge}</span>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-black ${n.scoreColor}`}>{avgScore(data)}</p>
                  <p className="text-xs text-zinc-500">score moyen /10</p>
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
                <div><p className="text-xl font-bold text-red-400">{data.filter(m => m.china_dominant).length}</p><p className="text-xs text-zinc-500">dominées Chine</p></div>
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
              {["Matière","Catégorie","Criticité","Score","Part Chine","Statut"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {[...strategic, ...critical].sort((a,b) => b.criticality_score - a.criticality_score).slice(0,12).map(m => (
              <tr key={m.id} className="hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{m.name_fr}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{m.category}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.criticality_eu === "Stratégique" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                    {m.criticality_eu.slice(0,4)}.
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-amber-400 font-bold">{m.criticality_score}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-red-500" style={{ width: `${getChinaShare(m)}%` }} /></div>
                    <span className="font-mono text-zinc-300 text-xs">{getChinaShare(m)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {m.china_dominant ? <span className="text-red-400 text-xs font-bold">⚠ Chine</span> : <span className="text-emerald-400 text-xs">Diversifié</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-zinc-900/50 text-xs text-zinc-500 border-t border-zinc-800">
          12 premières matières par score de criticité — grille complète ci-dessous
        </div>
      </div>
    </section>
  );
}
