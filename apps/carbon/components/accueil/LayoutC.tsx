import Link from "next/link";
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

const THIRDS = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 } as const;

/**
 * Grille 1c — trois colonnes : hero et bande d'indicateurs pleine largeur,
 * puis tout en cellules de 4. La plus courte des trois pages.
 */
export function LayoutC({ prefix, motion }: { prefix: string; motion: boolean }) {
  const id = (s: string) => `${prefix}-${s}`;
  const h3 = { ...H3, fontSize: 21 };
  return (
    <>
      <header style={{ padding: "64px 48px 56px" }}>
        <div data-reveal="0" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <HeroTag />
          <HeroTitle size={112} split="wide" />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            columnGap: 24,
            alignItems: "start",
            marginTop: 40,
          }}
        >
          <div data-reveal="1" style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: 22 }}>
            <p style={{ ...BODY, fontSize: 16 }}>{HERO.lead}</p>
            <HeroCtas block />
            <HeroReassurance stacked />
          </div>
          <div data-reveal="2" style={{ gridColumn: "span 8" }}>
            <AvatarBlueprint size={130} motion={motion} />
          </div>
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
        {KPIS.map((k, i) => (
          <div
            key={k.value}
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
        <section id={id("pourquoi")} data-reveal="0" className="acc-anchor">
          <Kicker>01 · Pourquoi Carbon&amp;Co</Kicker>
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
          <Kicker>02 · Modules</Kicker>
          <div style={{ ...THIRDS, gap: "20px 24px" }}>
            {MODULES.map((m) => (
              <Link
                key={m.code}
                href={m.href}
                className="ind-frame acc-tile"
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  alignItems: "baseline",
                  gap: "4px 10px",
                  padding: "18px 20px",
                }}
              >
                <Corners />
                <span style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 600, color: "var(--color-accent-700)" }}>
                  {m.code}
                </span>
                <span style={{ ...HEADING_NUM, fontSize: 21, lineHeight: 1.05, textTransform: "uppercase" }}>{m.title}</span>
                <span style={{ color: "var(--color-accent)" }}>→</span>
                <span style={{ gridColumn: "2 / -1", fontSize: 14, color: INK_78 }}>{m.body}</span>
              </Link>
            ))}
          </div>
        </section>

        <div data-reveal="0" style={THIRDS}>
          <section id={id("comment")} className="acc-anchor">
            <Kicker after={20}>03 · Comment ça marche</Kicker>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {STEPS.map((s) => (
                <div key={s.n} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: "2px 10px" }}>
                  <span style={{ ...HEADING_NUM, gridRow: "span 2", fontSize: 22, color: "var(--color-accent)" }}>{s.n}</span>
                  <span style={{ ...HEADING_NUM, fontSize: 19, textTransform: "uppercase" }}>{s.title}</span>
                  <span style={{ fontSize: 14, color: INK_78 }}>{s.short}</span>
                </div>
              ))}
            </div>
          </section>
          <section id={id("secteurs")} className="acc-anchor">
            <Kicker after={20}>04 · Secteurs</Kicker>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 15 }}>
              {SECTORS.map((s) => (
                // La cellule est trop étroite pour « Transport & logistique ».
                <Plus key={s}>{s.replace(" & logistique", "")}</Plus>
              ))}
            </div>
          </section>
          <section id={id("securite")} className="acc-anchor">
            <Kicker after={20}>05 · Sécurité</Kicker>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 15 }}>
              {SECURITY.map((s) => (
                <Plus key={s}>{s}</Plus>
              ))}
            </div>
          </section>
        </div>

        <div data-reveal="0" style={THIRDS}>
          <Frame as="section" id={id("pilote")} className="acc-anchor" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
            <Eyebrow>06 · Programme pilote</Eyebrow>
            <h3 style={{ ...H3, fontSize: 24 }}>{PILOT.title}</h3>
            <p style={BODY}>{PILOT.body}</p>
            <PilotButton style={{ alignSelf: "flex-start", marginTop: "auto" }} />
          </Frame>
          <Frame
            as="section"
            id={id("calcul")}
            className="acc-anchor"
            style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 12, padding: 24 }}
          >
            <Eyebrow>07 · Calcul</Eyebrow>
            <h3 style={{ ...H3, fontSize: 24 }}>{CALC.title}</h3>
            <p style={BODY}>{CALC.body}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end", marginTop: "auto" }}>
              <CalcField label="Effectif" placeholder="ex. 120" />
              <CalcField label="Chiffre d'affaires (M€)" placeholder="ex. 35" />
              <CalcButton />
            </div>
          </Frame>
        </div>
      </div>
      <PlancheFooter />
    </>
  );
}
