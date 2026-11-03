import type { Metadata } from "next";
import Link from "next/link";
import { getChinaShare, getMaterials, isSnapshotStale, snapshotAgeDays } from "@/lib/crm/dataLoader";
import {
  dueSignalKeys,
  getKeyFigure,
  getRoboticsDataset,
  layersInReadingOrder,
  renderDateIso,
  summarizeRobotics,
} from "@/lib/robotics/dataLoader";
import { MxThemeProvider } from "@/components/materials/MxThemeProvider";
import MxNav, { type MxNavSection } from "@/components/materials/MxNav";
import { Frame } from "@/components/materials/industry/Frame";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker, SectionLead, SectionTitle } from "@/components/materials/industry/SectionKicker";
import { industryFontVars } from "@/components/materials/industry/fonts";
import ActorMapSection from "@/components/robotics/ActorMapSection";
import ChokepointTimeline from "@/components/robotics/ChokepointTimeline";
import ControlSection from "@/components/robotics/ControlSection";
import CostAnatomy from "@/components/robotics/CostAnatomy";
import { KeyFigure } from "@/components/robotics/KeyFigure";
import MarketSection from "@/components/robotics/MarketSection";
import MethodPanel from "@/components/robotics/MethodPanel";
import ValueChainFlow from "@/components/robotics/ValueChainFlow";
import { formatIsoDate } from "@/components/robotics/labels";

export const metadata: Metadata = {
  title: "Robotique & IA physique | Carbon&Co Intelligence",
  description:
    "Chaîne de valeur mondiale des robots humanoïdes en 12 couches : qui contrôle chaque maillon, de la mine aux modèles d'IA, et quelles matières critiques elle consomme.",
  alternates: { canonical: "/robotics" },
  openGraph: {
    title: "Robotique & IA physique — Carbon&Co",
    description:
      "La chaîne de valeur des humanoïdes et ses dépendances, de la mine aux modèles d'IA — chaque chiffre relié à une source datée.",
    type: "website",
    url: "/robotics",
  },
};

// Rendu statique, régénéré chaque jour : les échéances de revérification des
// signaux et la péremption du snapshot se recalculent sans attendre un build.
export const revalidate = 86400;

const SECTIONS: readonly MxNavSection[] = [
  { id: "pourquoi", label: "Pourquoi" },
  { id: "controle", label: "Contrôle" },
  { id: "carte", label: "Cartographie" },
  { id: "cout", label: "Coût" },
  { id: "chaine", label: "Chaîne" },
  { id: "goulots", label: "Goulots" },
  { id: "marche", label: "Marché" },
  { id: "methode", label: "Méthode" },
];

const WHY_ITEMS = [
  {
    n: "01",
    body: (
      <>
        Robots, cobots et équipements automatisés entrent dans votre <Link href="/produit/scope-3">Scope 3</Link>,
        catégorie des biens immobilisés, et prolongent la dépendance aux matières critiques de vos achats.
      </>
    ),
  },
  {
    n: "02",
    body: (
      <>
        Concentration d’une couche, contrôles à l’export, rupture d’un fournisseur : ces dépendances nourrissent votre{" "}
        <strong style={{ fontWeight: 700, color: "var(--color-text)" }}>double matérialité</strong>, côté risques
        comme côté impacts.
      </>
    ),
  },
  {
    n: "03",
    body: (
      <>
        Chaque chiffre renvoie à une source datée. Ceux du dossier d’origine que la relecture n’a pas confirmés ont été
        corrigés ou retirés : la liste figure dans la <a href="#methode">méthode</a>.
      </>
    ),
  },
];

const h1Style: React.CSSProperties = {
  margin: "0 0 0 -0.052em",
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: "clamp(44px,6vw,80px)",
  lineHeight: 1.04,
  letterSpacing: ".01em",
  textTransform: "uppercase",
};

export default async function RoboticsPage() {
  const ds = await getRoboticsDataset();
  const { materials } = await getMaterials();
  const summary = summarizeRobotics(ds);
  const layers = layersInReadingOrder(ds);
  const fig = (id: string) => getKeyFigure(ds, id);

  // Calculés au rendu serveur et jamais côté client (même discipline que
  // /materials) ; `revalidate` les tient à jour d'un jour sur l'autre.
  const isStale = isSnapshotStale(ds.snapshot_date);
  const ageDays = snapshotAgeDays(ds.snapshot_date);
  const dueKeys = [...dueSignalKeys(ds)];
  const today = renderDateIso();
  const snapshotDateLabel = formatIsoDate(ds.snapshot_date);

  // Pont vers /materials : les matières consommées par la chaîne, avec la part
  // chinoise que /materials affiche (null quand la Chine n'est pas parmi les
  // premiers producteurs suivis).
  const linkedIds = new Set(ds.layers.flatMap(l => l.material_links.map(m => m.material_id)));
  const flowMaterials = materials
    .filter(m => linkedIds.has(m.id))
    .map(m => ({ id: m.id, name: m.name_fr, chinaShare: m.top_producers.some(p => p.country === "Chine") ? getChinaShare(m) : null }));
  const materialNames = Object.fromEntries(materials.map(m => [m.id, m.name_fr]));

  return (
    <MxThemeProvider skin="industry" style={industryFontVars}>
      <main id="main-content" className="min-h-screen">
        <MxNav snapshotDateLabel={snapshotDateLabel} sections={SECTIONS} moduleLabel="Robotique & IA physique" />

        <div className="mx-auto" style={{ maxWidth: 1200, padding: "0 clamp(20px,5vw,72px)" }}>
          <header
            className="ind-reveal grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-12 gap-y-6 items-end"
            style={{ padding: "72px 0 40px" }}
          >
            <h1 style={h1Style}>
              <span className="block">{summary.layers} couches.</span>
              <span className="block" style={{ color: "var(--color-accent-700)" }}>Une chaîne sous tension.</span>
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", maxWidth: "44ch", color: "var(--ink-78)" }}>
              La chaîne de valeur mondiale des robots humanoïdes : qui contrôle chaque couche, de la mine aux modèles
              d’IA, et quelles matières critiques elle consomme. {summary.values} valeurs chiffrées, dont{" "}
              {summary.verifiedPct} % lues telles quelles dans une source datée.
            </p>
          </header>

          <Frame className="ind-reveal grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8" style={{ padding: "28px 24px", marginBottom: 48, animationDelay: "0.05s" }}>
            <KeyFigure figure={fig("chine-aimants-frittes")} />
            <KeyFigure figure={fig("part-chine-livraisons-2025")} />
            <KeyFigure figure={fig("bofa-actionneurs-mains-2030")} />
            <KeyFigure figure={fig("ndfeb-par-humanoide")} />
          </Frame>

          <Section id="pourquoi" revealDelay={0.1}>
            <SectionKicker>01 · Pourquoi cette chaîne compte</SectionKicker>
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

          <ControlSection
            revealDelay={0.2}
            layers={layers}
            actors={ds.actors}
            keyFigures={ds.key_figures}
            materialNames={materialNames}
            china={{
              extraction: fig("chine-extraction-terres-rares"),
              raffinage: fig("chine-raffinage-terres-rares"),
              aimants: fig("chine-aimants-frittes"),
              livraisons: fig("part-chine-livraisons-2025"),
              extractionAimants: fig("chine-extraction-terres-rares-aimants"),
            }}
          />

          <ActorMapSection actors={ds.actors} layers={ds.layers} revealDelay={0.3} />

          <CostAnatomy
            revealDelay={0.4}
            bom={ds.bom}
            layers={ds.layers}
            chokepoints={ds.chokepoints}
            figures={{
              actuatorsHands: fig("bofa-actionneurs-mains-2030"),
              bom2025: fig("bofa-bom-chine-2025"),
              bom2030: fig("bofa-bom-chine-2030"),
              offChina: fig("ms-bom-hors-chine"),
              avgPrice: fig("yole-prix-moyen"),
              digitCost: fig("agility-cout-production"),
              digitHourly: fig("digit-cout-horaire"),
              wageUs: fig("salaire-production-usa"),
              wageEu: fig("salaire-moyen-ue"),
              roi: fig("agility-retour-investissement"),
            }}
          />

          <ValueChainFlow
            revealDelay={0.5}
            layers={layers}
            actors={ds.actors}
            keyFigures={ds.key_figures}
            materials={flowMaterials}
            trackedMaterials={materials.length}
          />

          <ChokepointTimeline
            revealDelay={0.6}
            chokepoints={ds.chokepoints}
            layers={layers}
            actors={ds.actors}
            today={today}
            dueKeys={dueKeys}
          />

          <MarketSection
            revealDelay={0.7}
            projections={ds.projections}
            oems={ds.oems}
            actors={ds.actors}
            steps={[
              { figure: fig("livraisons-mondiales-2025"), kind: "livraisons", caption: "livrés" },
              { figure: fig("bofa-livraisons-2030"), kind: "livraisons", caption: "par an · BofA" },
              { figure: fig("bofa-livraisons-2035"), kind: "livraisons", caption: "par an · BofA" },
              { figure: fig("ms-parc-2050"), kind: "parc", caption: "en service · MS" },
            ]}
            deliveries={fig("livraisons-mondiales-2025")}
            chinaShare={fig("part-chine-livraisons-2025")}
            fleet={{ total: fig("ms-parc-2050"), china: fig("ms-parc-chine-2050"), usa: fig("ms-parc-usa-2050") }}
            proUse={fig("ms-usage-professionnel-2050")}
          />

          <Section id="methode" revealDelay={0.8} paddingBottom={72}>
            <SectionKicker>08 · Méthode</SectionKicker>
            <div className="mb-8">
              <SectionTitle>D’où viennent ces chiffres</SectionTitle>
              <SectionLead maxCh={72}>{ds.scope_note}</SectionLead>
            </div>
            <MethodPanel ds={ds} />
          </Section>

          <footer
            className="flex items-center justify-between gap-6 flex-wrap"
            style={{ borderTop: "1px solid var(--color-divider)", padding: "36px 0 48px" }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Ce module fait partie de la plateforme CarbonCo.</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "20px", maxWidth: "70ch", color: "var(--ink-70)" }}>
                Snapshot du {snapshotDateLabel} — données de contexte, non normatives. Ni cours, ni valorisations, ni
                conseil en investissement.
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
              <Link href="/materials" className="ind-btn ind-btn-secondary">Matières critiques</Link>
              <Link href="/" className="ind-btn ind-btn-primary">Retour à l’accueil →</Link>
            </div>
          </footer>
        </div>
      </main>
    </MxThemeProvider>
  );
}
