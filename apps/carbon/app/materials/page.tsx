import type { Metadata } from "next";
import Link from "next/link";
import { getMaterials, summarize, isSnapshotStale, snapshotAgeDays } from "@/lib/crm/dataLoader";
import { Reveal } from "@/components/ui/reveal";
import { MxThemeProvider } from "@/components/materials/MxThemeProvider";
import MxNav from "@/components/materials/MxNav";
import MxTicker from "@/components/materials/MxTicker";
import MaterialsHero from "@/components/materials/MaterialsHero";
import SnapshotBanner from "@/components/materials/SnapshotBanner";
import MaterialsProvenance from "@/components/materials/MaterialsProvenance";
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

const WHY_ITEMS = [
  {
    n: "01", color: "var(--mx-em)",
    body: (
      <>
        Ces matières alimentent vos catégories{" "}
        <Link href="/produit/scope-3" className="font-semibold hover:underline" style={{ color: "var(--mx-em)" }}>
          Scope 3
        </Link>{" "}
        — achats de biens, transport amont, utilisation des produits vendus.
      </>
    ),
  },
  {
    n: "02", color: "var(--mx-cyan)",
    body: (
      <>
        Leur criticité (dépendance, volatilité des prix, concentration géographique) nourrit votre{" "}
        <strong className="font-semibold" style={{ color: "var(--mx-fg)" }}>double matérialité</strong> : risques
        financiers d&apos;un côté, impacts de l&apos;autre.
      </>
    ),
  },
  {
    n: "03", color: "var(--mx-violet)",
    body: (
      <>
        Les donneurs d&apos;ordre soumis à la CSRD demandent ces données à leurs fournisseurs. Cette page vous aide
        à identifier où votre chaîne de valeur est la plus exposée.
      </>
    ),
  },
];

export default async function MaterialsPage() {
  const dataset = await getMaterials();
  const { materials, snapshot_date, methodology_note } = dataset;
  const summary = summarize(materials);
  const snapshotYear = Number(snapshot_date.slice(0, 4));
  const isStale = isSnapshotStale(snapshot_date);
  // Âge calculé côté serveur (page prérendue), passé en prop — jamais recalculé
  // côté client, comme isStale, pour éviter un écart d'hydratation.
  const ageDays = snapshotAgeDays(snapshot_date);
  // Formatage déterministe DD.MM.YYYY par découpe de chaîne (pas de Date() /
  // fuseau horaire côté client) — même discipline que snapshotYear ci-dessus.
  const [snapYear, snapMonth, snapDay] = snapshot_date.split("-");
  const snapshotDateLabel = `${snapDay}.${snapMonth}.${snapYear}`;

  return (
    <MxThemeProvider>
      <main className="min-h-screen">
        <MxNav snapshotDateLabel={snapshotDateLabel} />
        <MxTicker materials={materials} />

        <MaterialsHero summary={summary} snapshotYear={snapshotYear} />

        <div className="max-w-[1280px] mx-auto px-5 md:px-7 mt-4 space-y-3">
          <SnapshotBanner date={snapshot_date} methodologyNote={methodology_note} estimatedPct={summary.estimatedPct} isStale={isStale} />
          <MaterialsProvenance snapshotDate={snapshot_date} isStale={isStale} ageDays={ageDays} />
        </div>

        <div className="max-w-[1280px] mx-auto px-5 md:px-7">
          <Reveal>
            <section
              className="mt-10 rounded-2xl border p-6 md:p-7"
              style={{
                background: "linear-gradient(120deg, color-mix(in srgb, var(--mx-em) 6%, transparent), transparent 55%), var(--mx-card)",
                borderColor: "color-mix(in srgb, var(--mx-em) 25%, var(--mx-border))",
                boxShadow: "var(--mx-shadow)",
              }}
            >
              <p className="m-0 mb-4 font-semibold text-[10.5px] uppercase tracking-[0.16em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-em)" }}>
                Pourquoi ces matières comptent
              </p>
              <div className="grid md:grid-cols-3 gap-7">
                {WHY_ITEMS.map(item => (
                  <div key={item.n} className="flex gap-3.5">
                    <span className="font-bold text-xs pt-0.5" style={{ fontFamily: "var(--mx-font-mono)", color: item.color }}>{item.n}</span>
                    <p className="m-0 text-[13px] leading-relaxed" style={{ color: "var(--mx-muted)" }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        </div>

        <div className="max-w-[1280px] mx-auto px-5 md:px-7 py-10 flex flex-col gap-14">
          <Reveal>
            <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
              <div className="lg:col-span-3">
                <PriceAlertModule materials={materials} threshold={15} />
              </div>
              <div className="lg:col-span-2">
                <ChinaDependencyWidget materials={materials} />
              </div>
            </section>
          </Reveal>

          <Reveal>
            <GlobalMapSection materials={materials} />
          </Reveal>

          <Reveal>
            <CriticalityTreemap materials={materials} />
          </Reveal>

          <Reveal>
            <StrategicVsCriticalSection materials={materials} />
          </Reveal>

          <Reveal>
            <SupplyChainExplainer />
          </Reveal>

          <Reveal>
            <MaterialsGrid materials={materials} />
          </Reveal>

          <footer className="border-t pt-9 flex flex-col md:flex-row items-start md:items-center justify-between gap-5" style={{ borderColor: "var(--mx-border)" }}>
            <div>
              <p className="m-0 mb-1 text-sm font-semibold" style={{ color: "var(--mx-fg)" }}>
                Ce module fait partie de la plateforme CarbonCo.
              </p>
              <p className="m-0 text-sm" style={{ color: "var(--mx-subtle)" }}>
                Snapshot de démonstration daté du {snapshot_date} — valeurs estimées, non normatives. L&apos;historique
                n&apos;est enrichi que lorsqu&apos;un nouveau snapshot daté est publié.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/etat-du-produit"
                className="rounded-[10px] border px-5 py-2.5 font-semibold text-sm transition-colors"
                style={{ borderColor: "var(--mx-border-2)", color: "var(--mx-fg)" }}
              >
                État du produit
              </Link>
              <Link
                href="/"
                className="rounded-[10px] px-5 py-2.5 font-semibold text-sm transition"
                style={{ background: "linear-gradient(120deg, var(--mx-em-dark), var(--mx-em))", color: "#06121E" }}
              >
                Retour à l&apos;accueil →
              </Link>
            </div>
          </footer>
        </div>
      </main>
    </MxThemeProvider>
  );
}
