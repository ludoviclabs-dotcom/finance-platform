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

/**
 * Grille 1a — colonne centrale de 728px (8 cellules) : lecture linéaire,
 * modules en carrés 2 × 2, passage mobile direct.
 */
export function LayoutA({ prefix, motion }: { prefix: string; motion: boolean }) {
  const id = (s: string) => `${prefix}-${s}`;
  const section = { paddingBottom: 56 };
  return (
    <>
      <div style={{ maxWidth: 728, margin: "0 auto", paddingBottom: 16 }}>
        <header data-reveal="0" style={{ display: "flex", flexDirection: "column", gap: 24, padding: "72px 0 40px" }}>
          <HeroTag />
          <HeroTitle size={84} split="two-lines" />
          <p style={{ ...BODY, maxWidth: "60ch", fontSize: 17 }}>{HERO.lead}</p>
          <HeroCtas />
          <HeroReassurance />
        </header>
        <div data-reveal="1" style={{ paddingBottom: 40 }}>
          <AvatarBlueprint size={130} motion={motion} />
        </div>

        <section data-reveal="0" style={section}>
          <Frame style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--color-divider)" }}>
            {KPIS.map((k) => (
              <div
                key={k.value}
                style={{ display: "flex", flexDirection: "column", gap: 8, padding: "22px 24px", background: "var(--color-bg)" }}
              >
                <span style={{ ...HEADING_NUM, fontSize: 44 }}>{k.value}</span>
                <span style={{ fontSize: 13, color: INK_70 }}>{k.label}</span>
              </div>
            ))}
          </Frame>
        </section>

        <section id={id("pourquoi")} data-reveal="0" className="acc-anchor" style={section}>
          <Kicker>01 · Pourquoi Carbon&amp;Co</Kicker>
          <div style={{ display: "grid", gap: 24 }}>
            {WHY.map((w) => (
              <div key={w.n} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: "6px 16px" }}>
                <span style={{ ...HEADING_NUM, gridRow: "span 2", fontSize: 32, color: "var(--color-accent)" }}>{w.n}</span>
                <h3 style={H3}>{w.title}</h3>
                <p style={BODY}>{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id={id("comment")} data-reveal="0" className="acc-anchor" style={section}>
          <Kicker>02 · Comment ça marche</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Eyebrow>Étape {s.n}</Eyebrow>
                <h3 style={H3}>{s.title}</h3>
                <p style={BODY}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id={id("modules")} data-reveal="0" className="acc-anchor" style={section}>
          <Kicker>03 · Modules</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {MODULES.slice(0, 4).map((m) => (
              <Link
                key={m.code}
                href={m.href}
                className="ind-frame acc-tile"
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: 24,
                }}
              >
                <Corners />
                <span style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 600, color: "var(--color-accent-700)" }}>
                  {m.code}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ ...HEADING_NUM, fontSize: 32, textTransform: "uppercase" }}>{m.title}</span>
                  <span style={{ fontSize: 15, color: INK_78 }}>{m.body}</span>
                  <span style={{ fontSize: 14, color: "var(--color-accent-700)" }}>Ouvrir →</span>
                </span>
              </Link>
            ))}
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 14, color: INK_70 }}>
            Aussi :{" "}
            {MODULES.slice(4).map((m, i) => (
              <span key={m.code}>
                {i > 0 && " · "}
                <Link href={m.href}>{m.title}</Link>
              </span>
            ))}
          </p>
        </section>

        <section id={id("secteurs")} data-reveal="0" className="acc-anchor" style={section}>
          <Kicker after={24}>04 · Secteurs</Kicker>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SECTORS.map((s) => (
              <span key={s} className="ind-tag ind-tag-outline" style={{ fontSize: 13, padding: "6px 12px" }}>
                {s}
              </span>
            ))}
          </div>
        </section>

        <section id={id("pilote")} data-reveal="0" className="acc-anchor" style={section}>
          <Kicker>05 · Programme pilote</Kicker>
          <Frame style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h3 style={{ ...H3, fontSize: 24 }}>{PILOT.title}</h3>
              <p style={BODY}>{PILOT.body}</p>
            </div>
            <PilotButton style={{ flexShrink: 0 }} />
          </Frame>
        </section>

        <section id={id("securite")} data-reveal="0" className="acc-anchor" style={section}>
          <Kicker after={20}>06 · Sécurité</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24, fontSize: 15 }}>
            {SECURITY.map((s) => (
              <Plus key={s}>{s}</Plus>
            ))}
          </div>
        </section>

        <section id={id("calcul")} data-reveal="0" className="acc-anchor" style={{ paddingBottom: 48 }}>
          <Kicker>07 · Calcul</Kicker>
          <Frame style={{ display: "flex", flexDirection: "column", gap: 18, padding: 28 }}>
            <h3 style={{ ...H3, fontSize: 28 }}>{CALC.title}</h3>
            <p style={BODY}>{CALC.body}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
              <CalcField label="Effectif" placeholder="ex. 120" />
              <CalcField label="Chiffre d'affaires (M€)" placeholder="ex. 35" />
              <CalcButton />
            </div>
          </Frame>
        </section>
      </div>
      <PlancheFooter />
    </>
  );
}
