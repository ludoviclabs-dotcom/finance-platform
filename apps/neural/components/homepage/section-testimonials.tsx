const quotes = [
  {
    logo: "LVMH", ind: "Luxe · Finance",    kpi: "−68% temps de clôture",
    q: "Ils n'ont pas vendu de l'IA. Ils ont livré un agent qui a remplacé 3 semaines de reporting manuel en 4 jours.",
    who: "Direction Financière, maison de luxe (CAC 40)",
  },
  {
    logo: "ADP",  ind: "Transport · Supply", kpi: "+42% prévisions",
    q: "La première fois qu'une présentation IA se termine par 'et voici la ligne de P&L concernée'.",
    who: "COO, transporteur européen",
  },
  {
    logo: "AXA",  ind: "Assurance · Compta", kpi: "IFRS 17 sans incident",
    q: "Leur agent a absorbé la bascule IFRS 17 pendant que mes équipes dormaient. Deux nuits de travail, zéro erreur.",
    who: "CFO, assureur mutualiste",
  },
];

export function SectionTestimonials() {
  return (
    <section className="nhp-testimonials section-cream">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">Extraits</div>
          <h2 className="h-display h-editorial">Ce qu&apos;ils en disent,<br/><em>quand nous n&apos;écoutons pas.</em></h2>
        </div>
        <div className="nhp-quotes-grid">
          {quotes.map((q, i) => (
            <figure key={i} className="nhp-quote-card">
              <div className="nhp-quote-top">
                <span className="nhp-quote-logo">{q.logo}</span>
                <span className="nhp-quote-ind">{q.ind}</span>
              </div>
              <blockquote>« {q.q} »</blockquote>
              <div className="nhp-quote-kpi">{q.kpi}</div>
              <figcaption>{q.who}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
