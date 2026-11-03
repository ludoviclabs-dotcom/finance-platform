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

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  columnGap: 24,
  padding: "0 48px",
};

/**
 * Grille 1b — asymétrique 4 / 8 : un rail gauche collant (indicateurs,
 * secteurs, sécurité) et une colonne droite pour le récit, les modules et
 * les CTA.
 */
export function LayoutB({ prefix, motion }: { prefix: string; motion: boolean }) {
  const id = (s: string) => `${prefix}-${s}`;
  const h3 = { ...H3, fontSize: 21 };
  return (
    <>
      <header style={{ ...GRID, alignItems: "center", padding: "64px 48px 56px" }}>
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

      <div style={{ ...GRID, alignItems: "start", padding: "16px 48px 56px", borderTop: "1px solid var(--color-divider)" }}>
        <aside
          style={{
            gridColumn: "span 4",
            position: "sticky",
            top: 24,
            display: "flex",
            flexDirection: "column",
            gap: 40,
            padding: "32px 24px 0 0",
            borderRight: "1px solid var(--color-divider)",
          }}
        >
          <div data-reveal="0">
            <Kicker after={8}>A · Indicateurs</Kicker>
            {KPIS.map((k, i) => (
              <div
                key={k.value}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i < KPIS.length - 1 ? "1px solid var(--color-divider)" : undefined,
                }}
              >
                <span style={{ fontSize: 13, color: INK_70 }}>{k.short}</span>
                <span style={{ ...HEADING_NUM, fontSize: 30 }}>{k.value}</span>
              </div>
            ))}
          </div>
          <div id={id("secteurs")} data-reveal="1" className="acc-anchor">
            <Kicker after={8}>B · Secteurs</Kicker>
            {SECTORS.map((s) => (
              <a key={s} href={`#${id("secteurs")}`} className="acc-rail-link">
                <span>{s}</span>
                <span style={{ color: "var(--color-accent)" }}>→</span>
              </a>
            ))}
          </div>
          <div id={id("securite")} data-reveal="2" className="acc-anchor" style={{ paddingBottom: 16 }}>
            <Kicker after={16}>C · Sécurité</Kicker>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              {SECURITY.map((s) => (
                <Plus key={s}>{s}</Plus>
              ))}
            </div>
          </div>
        </aside>

        <main style={{ gridColumn: "span 8", display: "flex", flexDirection: "column", gap: 56, padding: "32px 0 0 24px" }}>
          <section id={id("pourquoi")} data-reveal="0" className="acc-anchor">
            <Kicker>01 · Pourquoi Carbon&amp;Co</Kicker>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 }}>
              {WHY.map((w) => (
                <div key={w.n} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={{ ...HEADING_NUM, fontSize: 32, color: "var(--color-accent)" }}>{w.n}</span>
                  <h3 style={h3}>{w.title}</h3>
                  <p style={BODY}>{w.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id={id("modules")} data-reveal="0" className="acc-anchor">
            <Kicker>02 · Modules</Kicker>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              {MODULES.map((m) => (
                <Link
                  key={m.code}
                  href={m.href}
                  className="ind-frame acc-tile"
                  style={{ display: "flex", flexDirection: "column", gap: 8, padding: 20 }}
                >
                  <Corners />
                  <span style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 600, color: "var(--color-accent-700)" }}>
                    {m.code}
                  </span>
                  <span style={{ ...HEADING_NUM, fontSize: 22, lineHeight: 1.05, textTransform: "uppercase" }}>{m.title}</span>
                  <span style={{ fontSize: 14, color: INK_78 }}>{m.body}</span>
                </Link>
              ))}
            </div>
          </section>

          <section id={id("comment")} data-reveal="0" className="acc-anchor">
            <Kicker>03 · Comment ça marche</Kicker>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                border: "1px solid var(--color-divider)",
              }}
            >
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 20,
                    borderLeft: i > 0 ? "1px solid var(--color-divider)" : undefined,
                  }}
                >
                  <Eyebrow>
                    Étape {s.n}
                    {i < STEPS.length - 1 && " →"}
                  </Eyebrow>
                  <h3 style={h3}>{s.title}</h3>
                  <p style={{ ...BODY, fontSize: 14 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            id={id("pilote")}
            data-reveal="0"
            className="acc-anchor"
            style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 24 }}
          >
            <Frame style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
              <Eyebrow>04 · Programme pilote</Eyebrow>
              <h3 style={{ ...H3, fontSize: 24 }}>{PILOT.title}</h3>
              <p style={BODY}>{PILOT.body}</p>
              <PilotButton style={{ alignSelf: "flex-start", marginTop: 4 }} />
            </Frame>
            <Frame id={id("calcul")} className="acc-anchor" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
              <Eyebrow>05 · Calcul</Eyebrow>
              <h3 style={{ ...H3, fontSize: 24 }}>{CALC.title}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <CalcField label="Effectif" placeholder="ex. 120" />
                <CalcField label="CA (M€)" placeholder="ex. 35" />
              </div>
              <div style={{ alignSelf: "flex-start", marginTop: 4 }}>
                <CalcButton />
              </div>
            </Frame>
          </section>
        </main>
      </div>
      <PlancheFooter />
    </>
  );
}
