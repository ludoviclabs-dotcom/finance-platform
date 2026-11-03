/**
 * components/landing/environmental-intelligence.tsx — section publique
 * « Intelligence environnementale » de la page d'accueil
 * (feat/water-intelligence-discoverability, reprise sous la charte Industry).
 *
 * Trois modules publics sur les dépendances physiques de l'activité :
 * Métaux critiques, Eau, Robotique & IA physique — les trois entrées du menu
 * « Dépendances » de la barre.
 *
 * ## Ce que cette section ne dit pas, et pourquoi
 *
 * Une carte d'accueil est exactement l'endroit où la nuance se perd —
 * « 7 sources officielles » se lit comme « 7 sources affichées » si rien ne
 * l'en empêche. La carte Eau annonce donc l'état de l'INFRASTRUCTURE et la
 * DÉCISION de publication, jamais l'état de l'eau. Aucun chiffre hydrique n'y
 * figure.
 *
 * Formulations bannies, et vérifiées par un test : données en temps réel, carte
 * actuellement alimentée, surveillance active, conformité automatique,
 * couverture mondiale complète.
 *
 * ## Trois surfaces Eau distinctes, dites comme telles
 *
 * `/water` est publique. `/water/cockpit` est le cockpit d'entreprise et
 * `/water/decision` le cockpit décisionnel : les deux exigent une session, et
 * la section le mentionne au lieu de laisser un visiteur buter sur une
 * redirection de connexion.
 *
 * Chaque carte porte son titre, sa description et ses puces en texte : aucune
 * information n'est portée par la seule couleur.
 */

import Link from "next/link";

const INK_70 = "var(--ink-70)";
const INK_78 = "var(--ink-78)";

function ModuleCard({
  kicker,
  title,
  status,
  intro,
  bullets,
  cta,
  href,
  testId,
  children,
}: {
  kicker: string;
  title: string;
  status: string;
  intro: string;
  bullets: readonly string[];
  cta: string;
  href: string;
  testId: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="ind-frame acc-env-card" data-testid={testId}>
      <i className="ind-corner tl" />
      <i className="ind-corner tr" />
      <i className="ind-corner bl" />
      <i className="ind-corner br" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--color-accent-700)",
          }}
        >
          {kicker}
        </span>
        {/* Le statut est du TEXTE dans une étiquette : c'est l'information la
            plus facile à mal lire de la carte. */}
        <span className="ind-tag ind-tag-accent" style={{ fontWeight: 600 }} data-testid={`${testId}-status`}>
          {status}
        </span>
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: 24,
          lineHeight: 1.1,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: INK_78 }}>{intro}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {bullets.map((bullet) => (
          <li key={bullet} style={{ display: "flex", gap: 8, fontSize: 14 }}>
            <b aria-hidden="true" style={{ color: "var(--color-accent)" }}>
              +
            </b>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <Link
          href={href}
          className="ind-btn ind-btn-secondary acc-btn"
          style={{ padding: "11px 18px" }}
          data-testid={`${testId}-cta`}
        >
          {cta}
          <span aria-hidden="true">→</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

export function EnvironmentalIntelligence() {
  return (
    <section
      id="intelligence-environnementale"
      className="acc-anchor"
      data-reveal="0"
      aria-labelledby="intelligence-environnementale-titre"
      data-testid="environmental-intelligence"
    >
      <h2
        id="intelligence-environnementale-titre"
        style={{
          margin: 0,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--color-accent-700)",
        }}
      >
        04 · Dépendances — intelligence environnementale
      </h2>
      <div style={{ height: 1, margin: "12px 0 20px", background: "var(--color-divider)" }} />
      <p style={{ margin: "0 0 28px", maxWidth: "72ch", fontSize: 15, lineHeight: 1.55, color: INK_78 }}>
        Trois modules publics sur les dépendances physiques de votre activité. Chaque valeur y porte sa source&nbsp;;
        ce qui n’est pas encore publié est affiché comme tel.
      </p>

      <div className="acc-thirds acc-env-grid">
        <ModuleCard
          kicker="Minéral"
          title="Métaux critiques"
          status="Catalogue public consultable"
          intro="Dépendances, criticité et chaînes d’approvisionnement des matières premières stratégiques, avec leur concentration géographique."
          bullets={[
            "Dépendances, criticité et chaînes d’approvisionnement",
            "Concentration géographique par matière",
            "Cadre CRMA et matières stratégiques",
          ]}
          cta="Explorer les métaux critiques"
          href="/materials"
          testId="env-card-materials"
        />

        <ModuleCard
          kicker="Hydrique"
          title="Eau et ressources hydriques"
          /*
            La carte décrit la DÉCISION, pas l'état du document. La première
            est un fait durable — un humain a signé le 2026-07-28 ; le second
            change au premier run du workflow de génération.
          */
          status="Pilote public approuvé — périmètre limité"
          intro="Le contexte hydrique à partir de sources officielles traçables. Une première publication pilote est approuvée sur un périmètre communal et annuel explicitement limité ; les six autres sources restent non publiées, chacune pour un motif nommé."
          bullets={[
            "7 sources officielles instrumentées, licences vérifiées",
            "1 source approuvée à la publication, sur 1 commune et 1 année",
            "Chaque valeur porte sa source, sa période et son checksum",
            "Stress, sécheresse, nappes, prélèvements, qualité et réglementation",
          ]}
          cta="Explorer Water Intelligence"
          href="/water"
          testId="env-card-water"
        >
          {/* Les deux surfaces authentifiées sont nommées avec leur condition
              d'accès : un visiteur sans session serait sinon renvoyé vers
              /login sans avoir compris pourquoi. */}
          <div
            style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-divider)", fontSize: 14 }}
            data-testid="env-water-private"
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: INK_70,
              }}
            >
              Pour les entreprises clientes
            </p>
            <p style={{ margin: "8px 0 0" }}>
              <Link href="/water/cockpit" data-testid="env-water-cockpit-link">
                Accéder au cockpit entreprise
              </Link>{" "}
              <span style={{ color: INK_70 }}>
                — sites, prélèvements, permis et screening. <strong>Connexion requise.</strong>
              </span>
            </p>
            <p style={{ margin: "8px 0 0", color: INK_70 }}>
              Le{" "}
              <Link href="/water/decision" data-testid="env-water-decision-link">
                cockpit décisionnel
              </Link>{" "}
              y rassemble six facettes séparées et un calculateur de scénarios financiers.{" "}
              <strong>Connexion requise.</strong>
            </p>
          </div>
        </ModuleCard>

        <ModuleCard
          kicker="Industriel"
          title="Robotique & IA physique"
          status="Catalogue public consultable"
          intro="La chaîne de valeur mondiale des robots humanoïdes en 12 couches : qui contrôle chaque maillon, de la mine aux modèles d’IA, et quelles matières critiques elle consomme."
          bullets={[
            "Chaîne de valeur des humanoïdes, de la mine aux modèles d’IA",
            "Contrôle de chaque couche et goulots d’étranglement",
            "Chaque chiffre relié à une source datée",
          ]}
          cta="Explorer la robotique"
          href="/robotics"
          testId="env-card-robotics"
        />
      </div>

      <p style={{ margin: "24px 0 0", maxWidth: "80ch", fontSize: 12, lineHeight: 1.6, color: INK_70 }}>
        Water Intelligence ne publie aucune observation tant qu’une décision humaine de publication n’a pas été signée
        pour la source concernée. Les libellés ci-dessus décrivent l’état de l’infrastructure, pas l’état de la
        ressource en eau.
      </p>
    </section>
  );
}
