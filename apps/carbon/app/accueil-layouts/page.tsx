import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Frame } from "@/components/materials/industry/Frame";
import { industryFontVars } from "@/components/materials/industry/fonts";
import type { MxTheme } from "@/components/materials/MxThemeProvider";
import { LayoutA } from "@/components/accueil/LayoutA";
import { LayoutB } from "@/components/accueil/LayoutB";
import { LayoutC } from "@/components/accueil/LayoutC";
import { LayoutD } from "@/components/accueil/LayoutD";
import { Planche } from "@/components/accueil/Planche";
import { ESRS_SET2 } from "@/lib/esrs/schema";

/**
 * Planche de revue « Accueil Layouts » (maquette Claude Design, tour 1) :
 * trois organisations de la future homepage sous la charte Industry, même
 * contenu, chacune avec sa bascule Clair / Sombre et son menu Modules — plus
 * 1d, l'hybride qui assemble les meilleures parties des trois.
 *
 * Page de travail, hors index et hors sitemap. La grille retenue sera
 * promue sur `/` ; les composants sont déjà écrits pour cela.
 *
 * Réglages de la maquette, en paramètres d'URL :
 *  - ?theme=sombre  thème de départ des trois planches ;
 *  - ?motion=0      coupe les animations ;
 *  - ?grid=1        superpose la grille de 12 colonnes.
 */
export const metadata: Metadata = {
  title: "Accueil — trois grilles | Carbon&Co",
  robots: { index: false, follow: false },
};

type Params = { theme?: string; motion?: string; grid?: string };

type BodyProps = { prefix: string; motion: boolean; esrsDatapointCount: number };

const LAYOUTS: readonly { key: string; title: string; blurb: string; Body: (p: BodyProps) => ReactNode }[] = [
  {
    key: "1d",
    title: "Hybride retenu",
    blurb:
      "Squelette de 1c, hero, modules et étapes de 1b. Bande d'indicateurs sur le compte ESRS réel, test d'éligibilité remonté sous la bande.",
    Body: LayoutD,
  },
  {
    key: "1a",
    title: "Colonne centrale",
    blurb: "Une colonne de 8 cellules, modules en carrés 2×2. Lecture linéaire, passage mobile direct.",
    Body: LayoutA,
  },
  {
    key: "1b",
    title: "Asymétrique 4 / 8",
    blurb: "Rail gauche fixe (indicateurs, secteurs, sécurité), colonne droite pour le récit, les modules et les CTA.",
    Body: LayoutB,
  },
  {
    key: "1c",
    title: "Grille 3 colonnes",
    blurb: "Hero et bande KPI pleine largeur, puis tout en cellules de 4. La page la plus courte des trois.",
    Body: LayoutC,
  },
];

const MUTED = "var(--ink-78)";

function PlancheLabel({ code, title, children }: { code: string; title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
      <Frame
        style={{
          padding: "4px 10px",
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 22,
          lineHeight: 1.1,
          color: "var(--color-accent-700)",
        }}
      >
        {code}
      </Frame>
      <h2 style={{ margin: 0, fontSize: 28, letterSpacing: "0.02em", textTransform: "uppercase" }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 15, color: MUTED }}>{children}</p>
    </div>
  );
}

export default async function AccueilLayoutsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const defaultTheme: MxTheme = params.theme === "sombre" ? "sombre" : "clair";
  const motion = params.motion !== "0";
  const showGrid = params.grid === "1";

  return (
    <div
      data-mx
      data-mx-skin="industry"
      data-mx-theme="clair"
      className="acc-root"
      style={{ ...industryFontVars, minHeight: "100vh", background: "var(--color-surface)" }}
    >
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 96,
          padding: "80px 96px 120px",
        }}
      >
        <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <span
            style={{
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--color-accent-700)",
            }}
          >
            Tour 1 · Layouts de l&apos;accueil
          </span>
          <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase" }}>
            Carbon&amp;Co — trois grilles pour la home
          </h1>
          <p style={{ margin: 0, maxWidth: "72ch", fontSize: 16, lineHeight: 1.55, color: MUTED }}>
            Même contenu, même charte Industry, trois organisations. Chaque planche a sa bascule Clair / Sombre et le
            menu Modules ouvrable. Les textes de section hors hero sont provisoires. En tête, 1d assemble les
            meilleures parties des trois.
          </p>
        </div>

        {LAYOUTS.map(({ key, title, blurb, Body }) => (
          <div key={key} id={key} style={{ display: "flex", flexDirection: "column", gap: 20, width: 1200, flexShrink: 0 }}>
            <PlancheLabel code={key} title={title}>
              {blurb}
            </PlancheLabel>
            <Planche prefix={key} defaultTheme={defaultTheme} motion={motion} showGrid={showGrid}>
              <Body prefix={key} motion={motion} esrsDatapointCount={ESRS_SET2.datapoints.length} />
            </Planche>
          </div>
        ))}
      </section>
    </div>
  );
}
