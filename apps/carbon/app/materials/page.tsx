import type { Metadata } from "next";
import Link from "next/link";
import { getMaterials } from "@/lib/crm/dataLoader";
import { Reveal } from "@/components/ui/reveal";
import MaterialsHero from "@/components/materials/MaterialsHero";
import SnapshotBanner from "@/components/materials/SnapshotBanner";
import ChinaDependencyWidget from "@/components/materials/ChinaDependencyWidget";
import PriceAlertModule from "@/components/materials/PriceAlertModule";
import StrategicVsCriticalSection from "@/components/materials/StrategicVsCriticalSection";
import MaterialsGrid from "@/components/materials/MaterialsGrid";
import SupplyChainExplainer from "@/components/materials/SupplyChainExplainer";
import GlobalMapSection from "@/components/materials/GlobalMapSection";
import CriticalityTreemap from "@/components/materials/CriticalityTreemap";

export const metadata: Metadata = {
  title: "Métaux Critiques & Terres Rares | Carbon&Co Intelligence",
  description: "Cartographie mondiale des 34 matières premières critiques de l'UE. Dépendances, prix, acteurs clés.",
  alternates: { canonical: "/materials" },
  openGraph: {
    title: "Métaux Critiques & Terres Rares — Carbon&Co",
    description:
      "Cartographie des 34 matières premières critiques de l'UE : dépendances, prix, producteurs. Le contexte qui éclaire vos analyses Scope 3.",
    type: "website",
    url: "/materials",
  },
};

export default async function MaterialsPage() {
  const dataset = await getMaterials();
  const { materials, snapshot_date } = dataset;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Barre de navigation contextuelle — même pattern que /produit, en sombre */}
      <div className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm">
            <Link href="/" className="font-extrabold tracking-tighter text-white">
              Carbon<span className="text-green-500">&amp;</span>Co
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">Métaux critiques</span>
          </nav>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition">
            ← Accueil
          </Link>
        </div>
      </div>

      <MaterialsHero total={materials.length} strategic={dataset.strategic_count} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <SnapshotBanner date={snapshot_date} />
      </div>

      {/* Pont vers le cœur du produit : pourquoi ce module existe dans CarbonCo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Reveal>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 md:p-8">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">
            Pourquoi ces matières comptent
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-sm leading-relaxed text-zinc-300">
            <p>
              Ces matières alimentent vos catégories{" "}
              <Link href="/produit/scope-3" className="text-emerald-400 hover:underline font-semibold">
                Scope 3
              </Link>{" "}
              — achats de biens, transport amont, utilisation des produits vendus.
            </p>
            <p>
              Leur criticité (dépendance, volatilité des prix, concentration géographique)
              nourrit votre <strong className="text-white">double matérialité</strong> : risques
              financiers d&apos;un côté, impacts de l&apos;autre.
            </p>
            <p>
              Les donneurs d&apos;ordre soumis à la CSRD demandent ces données à leurs
              fournisseurs. Cette page vous aide à identifier où votre chaîne de valeur
              est la plus exposée.
            </p>
          </div>
        </div>
        </Reveal>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

        {/* ROW 1 : Alertes volatilité + Dépendance chinoise */}
        <Reveal>
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <PriceAlertModule materials={materials} threshold={15} />
            </div>
            <div className="lg:col-span-2">
              <ChinaDependencyWidget materials={materials} />
            </div>
          </section>
        </Reveal>

        {/* ROW 2 : Carte mondiale (Mapbox si token, sinon SVG statique) */}
        <Reveal>
          <GlobalMapSection materials={materials} />
        </Reveal>

        {/* ROW 3 : Treemap de criticité */}
        <Reveal>
          <CriticalityTreemap materials={materials} />
        </Reveal>

        {/* ROW 4 : Stratégiques vs Critiques */}
        <Reveal>
          <StrategicVsCriticalSection materials={materials} />
        </Reveal>

        {/* ROW 5 : Frise supply chain */}
        <Reveal>
          <SupplyChainExplainer />
        </Reveal>

        {/* ROW 6 : Grille complète filtrable */}
        <Reveal>
          <MaterialsGrid materials={materials} />
        </Reveal>

        {/* Pied de module — retour vers le produit et l'état de la plateforme */}
        <footer className="border-t border-zinc-800 pt-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-white mb-1">
              Ce module fait partie de la plateforme CarbonCo.
            </p>
            <p className="text-sm text-zinc-500">
              Données mises à jour chaque semaine — aucune donnée inventée, chaque point est daté.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/etat-du-produit"
              className="rounded-xl border border-zinc-700 text-zinc-300 px-5 py-2.5 font-semibold text-sm hover:border-zinc-500 transition"
            >
              État du produit
            </Link>
            <Link
              href="/"
              className="rounded-xl bg-white text-zinc-900 px-5 py-2.5 font-semibold text-sm hover:bg-zinc-100 transition"
            >
              Retour à l&apos;accueil →
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
