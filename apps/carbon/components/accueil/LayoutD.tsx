import Link from "next/link";
import type { CSSProperties } from "react";
import { Frame } from "@/components/materials/industry/Frame";
import { AvatarBlueprint } from "./AvatarBlueprint";
import { CALC, HERO, KPIS, MODULES, PILOT, SECTORS, SECURITY, STEPS, WHY } from "./content";
import {
  BODY,
  CalcButton,
  CalcField,
  Corners,
  Eyebrow,
  H3,
  HEADING_NUM,
  HeroCtas,
  HeroReassurance,
  HeroTag,
  HeroTitle,
  INK_70,
  INK_78,
  Kicker,
  PilotButton,
  PlancheFooter,
  Plus,
} from "./parts";

const THIRDS: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 };

/**
 * Grille 1d — l'hybride retenu après revue des trois premières :
 *  - squelette de 1c (bandes pleine largeur, puis sections en tiers) ;
 *  - hero de 1b (titre et CTA à gauche, figure à droite, tout au-dessus de
 *    la ligne de flottaison) ;
 *  - modules en cartes 3 × 2 et étapes encadrées de 1b.
 *
 * Trois corrections de contenu par rapport aux maquettes :
 *  - la bande d'indicateurs ouvre sur le nombre réel de points de donnée
 *    ESRS référencés, et non plus sur le score fictif « 67/100 », qui reste
 *    dans la figure marquée « données fictives » ;
 *  - le test d'éligibilité remonte juste après la bande et pose bien les
 *    trois questions qu'il annonce ;
 *  - les secteurs sont une simple liste : il n'existe pas de page secteur
 *    vers laquelle les flécher.
 */
export function LayoutD({
  prefix,
  motion,
  esrsDatapointCount,
}: {
  prefix: string;
  motion: boolean;
  esrsDatapointCount: number;
}) {
  const id = (s: string) => `${prefix}-${s}`;
  const h3 = { ...H3, fontSize: 21 };
  const kpis = [{ value: String(esrsDatapointCount), label: "Points de donnée ESRS référencés" }, ...KPIS.slice(1)];

  return (
    <>
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          columnGap: 24,
          alignItems: "center",
          padding: "64px 48px 56px",
        }}
      >
        <div data-reveal="0" style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: 24 }}>
          <HeroTag />
          <HeroTitle size={84} split="two-lines" />
          <p style={{ ...BODY, maxWidth: "56ch", fontSize: 17 }}>{HERO.lead}</p>
          <HeroCtas />
          <HeroReassurance />
        </div>
        <div data-reveal="2" style={{ gridColumn: "span 5" }}>
          <AvatarBlueprint size={140} motion={motion} />
        </div>
      </header>

      <section
        data-reveal="0"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          borderTop: "1px solid var(--color-divider)",
          borderBottom: "1px solid var(--color-divider)",
          padding: "0 48px",
        }}
      >
        {kpis.map((k, i) => (
          <div
            key={k.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: i === 0 ? "28px 24px 28px 0" : "28px 24px",
              borderLeft: i > 0 ? "1px solid var(--color-divider)" : undefined,
            }}
          >
            <span style={{ ...HEADING_NUM, fontSize: 56 }}>{k.value}</span>
            <span style={{ fontSize: 13, color: INK_70 }}>{k.label}</span>
          </div>
        ))}
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 56, padding: "56px 48px" }}>
        <Frame
          as="section"
          id={id("calcul")}
          data-reveal="0"
          className="acc-anchor"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            columnGap: 24,
            alignItems: "end",
            padding: 28,
          }}
        >
          <div style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: 12 }}>
            <Eyebrow>01 · Calcul</Eyebrow>
            <h3 style={{ ...H3, fontSize: 28 }}>{CALC.title}</h3>
            <p style={BODY}>{CALC.body}</p>
          </div>
          <div
            style={{
              gridColumn: "span 8",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <CalcField label="Effectif" placeholder="ex. 120" />
            <CalcField label="Chiffre d'affaires (M€)" placeholder="ex. 35" />
            <CalcField label="Total de bilan (M€)" placeholder="ex. 20" />
            <CalcButton />
          </div>
        </Frame>

        <section id={id("pourquoi")} data-reveal="0" className="acc-anchor">
          <Kicker>02 · Pourquoi Carbon&amp;Co</Kicker>
          <div style={THIRDS}>
            {WHY.map((w) => (
              <div key={w.n} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "6px 12px" }}>
                <span style={{ ...HEADING_NUM, gridRow: "span 2", fontSize: 32, color: "var(--color-accent)" }}>{w.n}</span>
                <h3 style={h3}>{w.title}</h3>
                <p style={BODY}>{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id={id("modules")} data-reveal="0" className="acc-anchor">
          <Kicker>03 · Modules</Kicker>
          <div style={{ ...THIRDS, gap: 16 }}>
            {MODULES.map((m) => (
              <Link
                key={m.code}
                href={m.href}
                className="ind-frame acc-tile"
                style={{ display: "flex", flexDirection: "column", gap: 8, padding: 24 }}
              >
                <Corners />
                <span style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 600, color: "var(--color-accent-700)" }}>
                  {m.code}
                </span>
                <span style={{ ...HEADING_NUM, fontSize: 24, lineHeight: 1.05, textTransform: "uppercase" }}>{m.title}</span>
                <span style={{ fontSize: 14, color: INK_78 }}>{m.body}</span>
                <span style={{ marginTop: 4, fontSize: 14, color: "var(--color-accent-700)" }}>Ouvrir →</span>
              </Link>
            ))}
          </div>
        </section>

        <section id={id("comment")} data-reveal="0" className="acc-anchor">
          <Kicker>04 · Comment ça marche</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", border: "1px solid var(--color-divider)" }}>
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 24,
                  borderLeft: i > 0 ? "1px solid var(--color-divider)" : undefined,
                }}
              >
                <Eyebrow>
                  Étape {s.n}
                  {i < STEPS.length - 1 && " →"}
                </Eyebrow>
                <h3 style={h3}>{s.title}</h3>
                <p style={BODY}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div data-reveal="0" style={THIRDS}>
          <section id={id("secteurs")} className="acc-anchor">
            <Kicker after={20}>05 · Secteurs</Kicker>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 15 }}>
              {SECTORS.map((s) => (
                <Plus key={s}>{s}</Plus>
              ))}
            </div>
          </section>
          <section id={id("securite")} className="acc-anchor">
            <Kicker after={20}>06 · Sécurité</Kicker>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 15 }}>
              {SECURITY.map((s) => (
                <Plus key={s}>{s}</Plus>
              ))}
            </div>
          </section>
          <Frame as="section" id={id("pilote")} className="acc-anchor" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
            <Eyebrow>07 · Programme pilote</Eyebrow>
            <h3 style={{ ...H3, fontSize: 24 }}>{PILOT.title}</h3>
            <p style={BODY}>{PILOT.body}</p>
            <PilotButton style={{ alignSelf: "flex-start", marginTop: "auto" }} />
          </Frame>
        </div>
      </div>
      <PlancheFooter />
    </>
  );
}
