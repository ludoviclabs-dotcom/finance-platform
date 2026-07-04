import { getMaterials } from "@/lib/crm/dataLoader";
import MaterialsHero from "@/components/materials/MaterialsHero";
import SnapshotBanner from "@/components/materials/SnapshotBanner";
import ChinaDependencyWidget from "@/components/materials/ChinaDependencyWidget";
import PriceAlertModule from "@/components/materials/PriceAlertModule";
import StrategicVsCriticalSection from "@/components/materials/StrategicVsCriticalSection";
import MaterialsGrid from "@/components/materials/MaterialsGrid";
import SupplyChainExplainer from "@/components/materials/SupplyChainExplainer";
import GlobalMap from "@/components/materials/GlobalMap";

export const metadata = {
  title: "Métaux Critiques & Terres Rares | Carbon&Co Intelligence",
  description: "Cartographie mondiale des 34 matières premières critiques de l'UE. Dépendances, prix, acteurs clés.",
};

export default async function MaterialsPage() {
  const dataset = await getMaterials();
  const { materials, snapshot_date } = dataset;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <MaterialsHero total={materials.length} strategic={dataset.strategic_count} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <SnapshotBanner date={snapshot_date} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

        {/* ROW 1 : Alertes volatilité + Dépendance chinoise */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <PriceAlertModule materials={materials} threshold={15} />
          </div>
          <div className="lg:col-span-2">
            <ChinaDependencyWidget materials={materials} />
          </div>
        </section>

        {/* ROW 2 : Carte mondiale */}
        <GlobalMap materials={materials} />

        {/* ROW 3 : Stratégiques vs Critiques */}
        <StrategicVsCriticalSection materials={materials} />

        {/* ROW 4 : Frise supply chain */}
        <SupplyChainExplainer />

        {/* ROW 5 : Grille complète filtrable */}
        <MaterialsGrid materials={materials} />
      </div>
    </main>
  );
}
