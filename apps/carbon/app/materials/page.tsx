import type { Metadata } from "next";
import Link from "next/link";
import { getMaterials, summarize, isSnapshotStale, snapshotAgeDays } from "@/lib/crm/dataLoader";
import { DataStatusBadge } from "@/components/ui/data-status-badge";
import { Reveal } from "@/components/ui/reveal";
import { MxThemeProvider } from "@/components/materials/MxThemeProvider";
import MxNav from "@/components/materials/MxNav";
import ChinaDependencyWidget from "@/components/materials/ChinaDependencyWidget";
import SupplyChainExplainer from "@/components/materials/SupplyChainExplainer";
import GlobalMapSection from "@/components/materials/GlobalMapSection";
import CriticalityTreemap from "@/components/materials/CriticalityTreemap";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";

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
        financiers d&apos;un côté, impacts de l&apos;autre.
      </>
    ),
  },
  {
    n: "03",
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
    <MxThemeProvider skin="industry">
      <main className="min-h-screen">
        <MxNav snapshotDateLabel={snapshotDateLabel} />

        <div className="mx-auto" style={{ maxWidth: 1200, padding: "0 clamp(20px,5vw,72px)" }}>
          <Reveal>
            <header className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-x-12 gap-y-6 items-end" style={{ padding: "72px 0 48px" }}>
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
                Cartographie des {materials.length} matières premières critiques de l&apos;UE : concentration
                géographique, part chinoise, score de risque d&apos;approvisionnement. Le contexte qui éclaire vos
                analyses Scope 3 et votre double matérialité.
              </p>
            </header>
          </Reveal>

          <div className="flex flex-col" style={{ gap: 24 }}>
            <Reveal delay={0.1}>
              <section id="pourquoi" className="mx-anchor" style={{ padding: "24px 0 48px" }}>
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
              </section>
            </Reveal>

            <Reveal delay={0.2}>
              <section id="chine" className="mx-anchor" style={{ padding: "24px 0 48px" }}>
                <SectionKicker gap={32}>02 · Dépendance Chine</SectionKicker>
                <ChinaDependencyWidget materials={materials} />
              </section>
            </Reveal>

            <Reveal delay={0.3}>
              <div style={{ padding: "24px 0 48px" }}>
                <GlobalMapSection materials={materials} />
              </div>
            </Reveal>

            <Reveal delay={0.4}>
              <div style={{ padding: "24px 0 48px" }}>
                <CriticalityTreemap materials={materials} />
              </div>
            </Reveal>

            <Reveal delay={0.5}>
              <div style={{ padding: "24px 0 72px" }}>
                <SupplyChainExplainer />
              </div>
            </Reveal>
          </div>

          {/* Provenance — la refonte a retiré le bandeau qui la portait en tête
              de page ; elle reste due (sources, méthodologie, part estimée,
              péremption) et se donne ici, dans la voix typographique du reste
              de la page plutôt qu'en encadré d'alerte. */}
          <section
            aria-label="Provenance des données"
            className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-x-12 gap-y-4"
            style={{ borderTop: "1px solid var(--color-divider)", padding: "32px 0" }}
          >
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
                Provenance
              </p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", maxWidth: "80ch", color: "var(--ink-70)" }}>
                Valeurs estimées à partir de repères publics (USGS, Commission européenne CRMA/RMIS, LME, Trading
                Economics). Non destinées à un usage normatif. L&apos;historique local n&apos;est enrichi que
                lorsqu&apos;un nouveau snapshot daté est publié.
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: "20px", maxWidth: "80ch", color: "var(--ink-70)" }}>
                <span style={{ fontWeight: 600, color: "var(--color-text)" }}>Méthodologie —</span> {methodology_note}
              </p>
            </div>
            <div className="flex md:flex-col md:items-end gap-3 flex-wrap">
              <DataStatusBadge status={isStale ? "STALE" : "ESTIMATED"} />
              <span style={{ fontSize: 13, color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
                {summary.estimatedPct} % des valeurs estimées
              </span>
              <span style={{ fontSize: 13, color: isStale ? "var(--color-accent-700)" : "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
                Snapshot vieux de {ageDays} j{isStale ? " — potentiellement périmé" : ""}
              </span>
            </div>
          </section>

          <footer
            className="flex items-center justify-between gap-6 flex-wrap"
            style={{ borderTop: "1px solid var(--color-divider)", padding: "36px 0 48px" }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                Ce module fait partie de la plateforme CarbonCo.
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "20px", maxWidth: "70ch", color: "var(--ink-70)" }}>
                Snapshot de démonstration daté du {snapshot_date} — valeurs estimées, non normatives.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/etat-du-produit" className="ind-btn ind-btn-secondary">État du produit</Link>
              <Link href="/" className="ind-btn ind-btn-primary">Retour à l&apos;accueil →</Link>
            </div>
          </footer>
        </div>
      </main>
    </MxThemeProvider>
  );
}
