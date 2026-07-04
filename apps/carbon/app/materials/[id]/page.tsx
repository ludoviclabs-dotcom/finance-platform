import Link from "next/link";
import { notFound } from "next/navigation";
import { getMaterials, getMaterialById, getChinaShare } from "@/lib/crm/dataLoader";
import Sparkline from "@/components/materials/Sparkline";

interface PageProps { params: Promise<{ id: string }> }

export async function generateStaticParams() {
  const { materials } = await getMaterials();
  return materials.map(m => ({ id: m.id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const material = await getMaterialById(id);
  if (!material) return { title: "Matière introuvable | Carbon&Co Intelligence" };
  return {
    title: `${material.name_fr} — Criticité, producteurs & prix | Carbon&Co Intelligence`,
    description: `${material.name_fr} (${material.category}) : score de criticité UE ${material.criticality_score}, part chinoise ${getChinaShare(material)}%, usages et producteurs clés.`,
  };
}

function chinaTone(share: number) {
  if (share >= 50) return { bar: "bg-red-500", text: "text-red-400", label: "Dominance critique" };
  if (share >= 20) return { bar: "bg-amber-400", text: "text-amber-400", label: "Présence significative" };
  return { bar: "bg-emerald-500", text: "text-emerald-400", label: "Approvisionnement diversifié" };
}

export default async function MaterialPage({ params }: PageProps) {
  const { id } = await params;
  const material = await getMaterialById(id);
  if (!material) notFound();

  const { materials, snapshot_date } = await getMaterials();
  const china = getChinaShare(material);
  const tone = chinaTone(china);
  const price = material.price_snapshot;
  const history = material.price_history;
  const related = materials.filter(m => m.category === material.category && m.id !== material.id).slice(0, 4);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Fil d'ariane + badges */}
        <div className="space-y-5">
          <Link href="/materials" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition">
            ← Métaux critiques
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              material.criticality_eu === "Stratégique" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
            }`}>{material.criticality_eu} UE</span>
            <span className="text-xs px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
              {material.category}
            </span>
            {material.data_quality === "estimated" && (
              <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                Données estimées — snapshot statique
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight">{material.name_fr}</h1>
            <div className="text-right">
              <p className="font-mono text-4xl font-black text-amber-400">{material.criticality_score}</p>
              <p className="text-xs text-zinc-500">Score criticité UE / 10</p>
            </div>
          </div>
        </div>

        {/* Prix + dépendance Chine */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="font-bold text-white">Prix</h2>
            {price ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-black text-white">{price.value}</span>
                  <span className="text-sm text-zinc-500">{price.unit}</span>
                  <span className={`ml-auto text-sm font-bold ${price.trend_3m_pct > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {price.trend_3m_pct > 0 ? "+" : ""}{price.trend_3m_pct}% / 3 mois
                  </span>
                </div>
                {history.length >= 2 ? (
                  <div className="space-y-1">
                    <Sparkline points={history} width={320} height={64} className="w-full" />
                    <p className="text-xs text-zinc-500">
                      {history.length} relevés — du {history[0].date} au {history[history.length - 1].date}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
                    Historique en construction — un relevé hebdomadaire automatique (GitHub Actions, chaque lundi)
                    accumule les prix du snapshot. La courbe apparaîtra dès 2 relevés réels.
                  </p>
                )}
                <p className="text-[10px] text-zinc-600">Relevé du {price.date}</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Pas de cotation publique de référence dans le snapshot.</p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="font-bold text-white">Dépendance Chine</h2>
            <div className="flex items-baseline justify-between">
              <span className={`font-mono text-3xl font-black ${tone.text}`}>{china}%</span>
              <span className={`text-xs font-semibold ${tone.text}`}>{tone.label}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800">
              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${china}%` }} />
            </div>
            <p className="text-xs text-zinc-500">
              Part de la Chine dans la production mondiale{material.china_dominant ? " — matière classée sous dominance chinoise." : "."}
            </p>
          </div>
        </section>

        {/* Producteurs + usages */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="font-bold text-white">Producteurs principaux</h2>
            <div className="space-y-3">
              {material.top_producers.map(p => (
                <div key={p.country} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-200">{p.country}</span>
                    <span className="font-mono text-zinc-400">{p.share_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800">
                    <div className={`h-full rounded-full ${p.country === "Chine" ? "bg-red-500" : "bg-blue-500/70"}`}
                      style={{ width: `${p.share_pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="font-bold text-white">Usages clés</h2>
            <ul className="space-y-2.5">
              {material.main_uses.map(u => (
                <li key={u} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-zinc-600">›</span>{u}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Matières liées */}
        {related.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-bold text-white">Même catégorie</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {related.map(m => (
                <Link key={m.id} href={`/materials/${m.id}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition">
                  <p className="font-bold text-sm text-white">{m.name_fr}</p>
                  <p className="font-mono text-xs text-amber-400 mt-1">{m.criticality_score}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-zinc-600 border-t border-zinc-800 pt-4">
          Snapshot du {snapshot_date} — sources : USGS, Commission Européenne CRMA/RMIS, LME, Trading Economics.
          Données illustratives (data_quality : {material.data_quality}), à remplacer par un flux vérifié avant tout usage normatif.
        </p>
      </div>
    </main>
  );
}
