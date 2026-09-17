import type { Metadata } from "next";
import Link from "next/link";
import { getMaterials, isSnapshotStale, snapshotAgeDays } from "@/lib/crm/dataLoader";
import { MxThemeProvider } from "@/components/materials/MxThemeProvider";
import MxNav from "@/components/materials/MxNav";
import ChinaDependencyWidget from "@/components/materials/ChinaDependencyWidget";
import SupplyChainExplainer from "@/components/materials/SupplyChainExplainer";
import GlobalMapSection from "@/components/materials/GlobalMapSection";
import CriticalityTreemap from "@/components/materials/CriticalityTreemap";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";
import { industryFontVars } from "@/components/materials/industry/fonts";

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
    n: "01",
    body: (
      <>
        Ces matières alimentent vos catégories{" "}
        <Link href="/produit/scope-3">Scope 3</Link> — achats de biens, transport amont, utilisation des produits
        vendus.
      </>
    ),
  },
  {
    n: "02",
    body: (
      <>
        Leur criticité (dépendance, volatilité des prix, concentration géographique) nourrit votre{" "}
        <strong style={{ fontWeight: 700, color: "var(--color-text)" }}>double matérialité</strong> : risques
        financiers d’un côté, impacts de l’autre.
      </>
    ),
  },
  {
    n: "03",
    body: (
      <>
        Les donneurs d’ordre soumis à la CSRD demandent ces données à leurs fournisseurs. Cette page vous aide
        à identifier où votre chaîne de valeur est la plus exposée.
      </>
    ),
  },
];

export default async function MaterialsPage() {
  const dataset = await getMaterials();
  const { materials, snapshot_date } = dataset;
  // Périmé / âge : calculés côté serveur (page prérendue) et jamais recalculés
  // côté client, pour ne pas faire diverger le HTML figé au build et le rendu
  // du navigateur.
  const isStale = isSnapshotStale(snapshot_date);
  const ageDays = snapshotAgeDays(snapshot_date);
  // Formatage déterministe DD.MM.YYYY par découpe de chaîne (pas de Date() /
  // fuseau horaire côté client), pour éviter tout écart d'hydratation entre le
  // HTML prérendu et le navigateur.
  const [snapYear, snapMonth, snapDay] = snapshot_date.split("-");
  const snapshotDateLabel = `${snapDay}.${snapMonth}.${snapYear}`;

  return (
    <MxThemeProvider skin="industry" style={industryFontVars}>
      <main id="main-content" className="min-h-screen">
        <MxNav snapshotDateLabel={snapshotDateLabel} />

        <div className="mx-auto" style={{ maxWidth: 1200, padding: "0 clamp(20px,5vw,72px)" }}>
          <header
            className="ind-reveal grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-12 gap-y-6 items-end"
            style={{ padding: "72px 0 48px" }}
          >
            <h1
              style={{
                margin: "0 0 0 -0.052em",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "clamp(44px,6vw,80px)",
                lineHeight: 1.04,
                letterSpacing: ".01em",
                textTransform: "uppercase",
              }}
            >
              <span className="block">{materials.length} matières critiques.</span>
              <span className="block" style={{ color: "var(--color-accent-700)" }}>Une carte des dépendances.</span>
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", maxWidth: "44ch", color: "var(--ink-78)" }}>
              Cartographie des {materials.length} matières premières critiques de l’UE : concentration géographique,
              part chinoise, score de risque d’approvisionnement. Le contexte qui éclaire vos analyses Scope 3 et
              votre double matérialité.
            </p>
          </header>

          <Section id="pourquoi" revealDelay={0.1}>
            <SectionKicker>01 · Pourquoi ces matières comptent</SectionKicker>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-6">
              {WHY_ITEMS.map(item => (
                <div key={item.n} className="grid grid-cols-[auto_1fr] gap-4 items-start">
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      fontSize: 32,
                      lineHeight: "24px",
                      letterSpacing: ".02em",
                      color: "var(--color-accent-700)",
                      fontFeatureSettings: "'tnum' 1",
                    }}
                  >
                    {item.n}
                  </span>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: "24px", color: "var(--ink-78)" }}>{item.body}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="chine" revealDelay={0.2}>
            <SectionKicker gap={32}>02 · Dépendance Chine</SectionKicker>
            <ChinaDependencyWidget materials={materials} />
          </Section>

          <GlobalMapSection materials={materials} revealDelay={0.3} />

          <CriticalityTreemap materials={materials} revealDelay={0.4} />

          <SupplyChainExplainer revealDelay={0.5} />

          {/* Pied de page de la maquette, au mot près. La provenance détaillée
              (sources, statut de qualité par valeur) vit sur chaque fiche
              /materials/[id] ; ici, la date, le caractère estimé et la règle
              d'historique suffisent. La mention de péremption s'ajoute quand
              le snapshot dépasse STALE_AFTER_DAYS (calculé au build). */}
          <footer
            className="flex items-center justify-between gap-6 flex-wrap"
            style={{ borderTop: "1px solid var(--color-divider)", padding: "36px 0 48px" }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                Ce module fait partie de la plateforme CarbonCo.
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "20px", maxWidth: "70ch", color: "var(--ink-70)" }}>
                Snapshot de démonstration daté du {snapshot_date} — valeurs estimées, non normatives. L’historique
                n’est enrichi que lorsqu’un nouveau snapshot daté est publié.
                {isStale && (
                  <>
                    {" "}
                    <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>
                      Snapshot vieux de {ageDays} jours — potentiellement périmé.
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/etat-du-produit" className="ind-btn ind-btn-secondary">État du produit</Link>
              <Link href="/" className="ind-btn ind-btn-primary">Retour à l’accueil →</Link>
            </div>
          </footer>
        </div>
      </main>
    </MxThemeProvider>
  );
}
