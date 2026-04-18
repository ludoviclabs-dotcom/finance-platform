import Link from "next/link";

const tiers = [
  {
    name: "Starter",    sub: "AI Essentials",
    price: "290",  to: "1 290",   users: "1 – 50 users",      highlight: false,
    feats: ["1–2 branches", "Agents pré-configurés", "Dashboard basique", "Support email"],
  },
  {
    name: "Business",   sub: "AI Accelerator",
    price: "4 900", to: "16 500",  users: "50 – 500 users",    highlight: true,
    feats: ["3–4 branches", "Agents customisés", "Analytics avancés", "Support prioritaire"],
  },
  {
    name: "Enterprise", sub: "AI Transformation",
    price: "35 000", to: "110 000", users: "500 – 5 000 users", highlight: false,
    feats: ["5–7 branches", "Agents sur mesure", "CSM dédié", "SLA 99.9%"],
  },
];

export function SectionPricing() {
  return (
    <section className="nhp-pricing">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">Forfaits</div>
          <h2 className="h-display h-tight">Transparents. Contractualisés. Sans surprise.</h2>
        </div>
        <div className="nhp-pricing-grid">
          {tiers.map((t) => (
            <div key={t.name} className={`nhp-tier${t.highlight ? " nhp-tier-hl" : ""}`}>
              {t.highlight && <div className="nhp-tier-pop">Le plus déployé</div>}
              <div className="nhp-tier-name">{t.name}</div>
              <div className="nhp-tier-sub">{t.sub}</div>
              <div className="nhp-tier-price">
                <span className="nhp-tp-from">dès</span>
                <span className="nhp-tp-val">{t.price}</span>
                <span className="nhp-tp-u">€</span>
              </div>
              <div className="nhp-tier-price-to">jusqu&apos;à {t.to} €/mois · {t.users}</div>
              <ul className="nhp-tier-feats">
                {t.feats.map((f) => (
                  <li key={f}><span className="nhp-check">✓</span> {f}</li>
                ))}
              </ul>
              <Link
                href="/forfaits"
                className={`nhp-btn ${t.highlight ? "nhp-btn-primary" : "nhp-btn-ghost"} nhp-btn-block`}
              >
                {t.highlight ? "Démarrer" : "Explorer"}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
