import Link from "next/link";
import { Frame } from "@/components/materials/industry/Frame";
import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { EnvironmentalIntelligence } from "@/components/landing/environmental-intelligence";
import { CONTACT_EMAIL } from "@/lib/site-url";
import { AvatarBlueprint } from "./AvatarBlueprint";
import { FOOTER_COLUMNS, HERO, KPIS, MODULES, PILOT, SECURITY, STEPS, WHY } from "./content";
import {
  BODY,
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
  Plus,
} from "./parts";
import { TrackedLink } from "./TrackedLink";

/**
 * Page d'accueil — grille 1d de la maquette « Accueil Layouts » : hero en
 * 7 / 5, bande d'indicateurs pleine largeur, puis sections en tiers.
 *
 * Tout chiffre affiché est réel : le nombre de points de donnée ESRS vient du
 * référentiel, celui des matières du snapshot /materials. Le score « 67/100 »
 * de la figure du hero est un exemple, annoncé comme tel dans la figure.
 *
 * Les grilles sont posées en classes (globals.css, « Accueil Industry ») et
 * non en styles en ligne : c'est ce qui leur permet de se replier en une
 * colonne sur téléphone.
 */
export function HomePage({
  esrsDatapointCount,
  materialsTotal,
}: {
  esrsDatapointCount: number;
  materialsTotal: number;
}) {
  const kpis = [{ value: String(esrsDatapointCount), label: "Points de donnée ESRS référencés" }, ...KPIS];
  const modules = MODULES.map((m) =>
    m.code === "M05" ? { ...m, body: `${materialsTotal} matières critiques · Scope 3` } : m,
  );
  const pilotHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(PILOT.subject)}`;

  return (
    <>
      <main>
        <header className="acc-hero acc-pad">
          <div data-reveal="0" className="acc-hero-copy">
            <HeroTag />
            <HeroTitle />
            <p style={{ ...BODY, maxWidth: "56ch", fontSize: 17 }}>{HERO.lead}</p>
            <HeroCtas />
            <HeroReassurance />
          </div>
          <div data-reveal="2" className="acc-hero-figure">
            <AvatarBlueprint size={140} />
          </div>
        </header>

        <section data-reveal="0" aria-label="Indicateurs" className="acc-kpis acc-pad">
          {kpis.map((k) => (
            <div key={k.label} className="acc-kpi">
              <span style={{ ...HEADING_NUM, fontSize: "clamp(40px, 5vw, 56px)" }}>{k.value}</span>
              <span style={{ fontSize: 13, color: INK_70 }}>{k.label}</span>
            </div>
          ))}
        </section>

        <div className="acc-sections acc-pad">
          <section id="pourquoi" data-reveal="0" className="acc-anchor">
            <Kicker>01 · Pourquoi Carbon&amp;Co</Kicker>
            <div className="acc-thirds">
              {WHY.map((w) => (
                <div key={w.n} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "6px 12px" }}>
                  <span style={{ ...HEADING_NUM, gridRow: "span 2", fontSize: 32, color: "var(--color-accent)" }}>{w.n}</span>
                  <h3 style={H3}>{w.title}</h3>
                  <p style={BODY}>{w.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="modules" data-reveal="0" className="acc-anchor">
            <Kicker>02 · Modules</Kicker>
            <div className="acc-modules">
              {modules.map((m) => (
                <Link key={m.code} href={m.href} className="ind-frame acc-tile">
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

          <section id="comment" data-reveal="0" className="acc-anchor">
            <Kicker>03 · Comment ça marche</Kicker>
            <ol className="acc-steps">
              {STEPS.map((s, i) => (
                <li key={s.n} className="acc-step">
                  <Eyebrow>
                    Étape {s.n}
                    {i < STEPS.length - 1 && " →"}
                  </Eyebrow>
                  <h3 style={H3}>{s.title}</h3>
                  <p style={BODY}>{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <EnvironmentalIntelligence />

          <div data-reveal="0" className="acc-thirds">
            <section id="securite" className="acc-anchor" aria-labelledby="securite-titre">
              <Kicker id="securite-titre" after={20}>
                05 · Sécurité
              </Kicker>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 15 }}>
                {SECURITY.map((s) => (
                  <Plus key={s}>{s}</Plus>
                ))}
              </div>
              <p style={{ margin: "16px 0 0", fontSize: 14 }}>
                <Link href="/trust">Trust Center</Link> · <Link href="/trust/sub-processors">Sous-traitants</Link>
              </p>
            </section>
            <section id="transparence" className="acc-anchor" aria-labelledby="transparence-titre">
              <Kicker id="transparence-titre" after={20}>
                06 · Transparence
              </Kicker>
              <p style={BODY}>
                Chaque fonctionnalité affiche son statut réel : disponible, en vérification, bêta ou planifiée. Ce qui
                n&apos;est pas prêt est dit comme tel.
              </p>
              <p style={{ margin: "16px 0 0", fontSize: 14 }}>
                <Link href="/etat-du-produit">État du produit</Link> · <Link href="/couverture">Couverture ESRS</Link>
              </p>
            </section>
            <Frame
              as="section"
              id="pilote"
              className="acc-anchor"
              aria-labelledby="pilote-titre"
              style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}
            >
              <Eyebrow as="h2">
                <span id="pilote-titre">07 · Programme pilote</span>
              </Eyebrow>
              <span className="ind-tag ind-tag-accent" style={{ alignSelf: "flex-start", fontWeight: 600 }}>
                {PILOT.badge}
              </span>
              <p style={BODY}>{PILOT.body}</p>
              <TrackedLink
                href={pilotHref}
                event="contact_clicked"
                source="pilot"
                className="ind-btn ind-btn-secondary acc-btn"
                style={{ alignSelf: "flex-start", marginTop: "auto", padding: "11px 18px" }}
              >
                {PILOT.cta}
              </TrackedLink>
            </Frame>
          </div>
        </div>
      </main>

      <footer className="acc-footer acc-pad">
        <div className="acc-footer-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 22 }}>Carbon&amp;Co</span>
            <p style={{ ...BODY, fontSize: 14 }}>Le reporting ESG &amp; CSRD, prouvé jusqu&apos;à la cellule source.</p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="acc-footer-title">{col.title}</h2>
              <ul className="acc-footer-list">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
                {col.title === "Ressources & légal" && (
                  <>
                    <li>
                      <CookiePreferencesButton className="acc-link-button" />
                    </li>
                    <li>
                      <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
                    </li>
                  </>
                )}
              </ul>
            </div>
          ))}
        </div>
        <p className="acc-footer-legal">
          © 2026 CarbonCo — projet en développement, non commercialisé · contact :{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · RGPD · Données métier en zone UE ·{" "}
          <Link href="/etat-du-produit">État réel du produit</Link>
        </p>
      </footer>
    </>
  );
}
