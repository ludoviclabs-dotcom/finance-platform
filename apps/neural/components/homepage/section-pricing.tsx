import Link from "next/link";

const tiers = [
  {
    name: "Proof Audit",
    sub: "Cartographie agentique",
    price: "1 500",
    to: "3 500",
    unit: "mission",
    highlight: false,
    badge: "Diagnostic",
    feats: [
      "Inventaire workbooks + process",
      "Score de maturité par agent",
      "Backlog 30 jours priorisé",
      "Synthèse risques / preuves",
    ],
  },
  {
    name: "Agent Pack 30 jours",
    sub: "1 agent prouvable",
    price: "8 000",
    to: "20 000",
    unit: "sprint",
    highlight: true,
    badge: "Priorité",
    feats: [
      "1 agent branché et testable",
      "Sourcebook + model card",
      "Exemple input/output",
      "Export ou trace d'exécution",
    ],
  },
  {
    name: "Governed Runtime Sprint",
    sub: "Operator Gateway MVP",
    price: "Sur devis",
    to: "après design partner",
    unit: "90 jours",
    highlight: false,
    badge: "Enterprise",
    feats: [
      "2-3 agents sous gouvernance",
      "Audit trail et cost tracking",
      "RBAC, owners et kill switch",
      "DPA / security pack préparatoire",
    ],
  },
];

export function SectionPricing() {
  return (
    <section className="nhp-pricing">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">Offres prouvables</div>
          <h2 className="h-display h-tight">Vendre un agent vérifiable avant une plateforme.</h2>
        </div>
        <div className="nhp-pricing-grid">
          {tiers.map((tier) => (
            <div key={tier.name} className={`nhp-tier${tier.highlight ? " nhp-tier-hl" : ""}`}>
              <div className="nhp-tier-pop">{tier.badge}</div>
              <div className="nhp-tier-name">{tier.name}</div>
              <div className="nhp-tier-sub">{tier.sub}</div>
              <div className="nhp-tier-price">
                {tier.price === "Sur devis" ? (
                  <span className="nhp-tp-val nhp-tp-val-text">{tier.price}</span>
                ) : (
                  <>
                    <span className="nhp-tp-from">de</span>
                    <span className="nhp-tp-val">{tier.price}</span>
                    <span className="nhp-tp-u">EUR</span>
                  </>
                )}
              </div>
              <div className="nhp-tier-price-to">
                {tier.price === "Sur devis"
                  ? `${tier.to} · ${tier.unit}`
                  : `jusqu'à ${tier.to} EUR · ${tier.unit}`}
              </div>
              <ul className="nhp-tier-feats">
                {tier.feats.map((feature) => (
                  <li key={feature}><span className="nhp-check">✓</span> {feature}</li>
                ))}
              </ul>
              <Link
                href="/contact"
                className={`nhp-btn ${tier.highlight ? "nhp-btn-primary" : "nhp-btn-ghost"} nhp-btn-block`}
              >
                Demander un cadrage
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
