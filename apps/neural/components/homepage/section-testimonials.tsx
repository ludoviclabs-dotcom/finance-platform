const quotes = [
  {
    logo: "Cadrage",
    ind: "Banque · DORA",
    kpi: "retour non signe",
    q: "Le cadrage outcome avant code clarifie enfin ce qui doit être prouve avant de parler de deploiement.",
    who: "Direction risques, prospect anonymise",
  },
  {
    logo: "Trust",
    ind: "Luxe · CSRD",
    kpi: "retour de due diligence",
    q: "La separation live, demo et planned evite les promesses trop larges et rend la discussion plus utile.",
    who: "DPO groupe, prospect anonymise",
  },
  {
    logo: "Proof",
    ind: "Assurance · Supply",
    kpi: "retour de cadrage",
    q: "Voir le workbook, le gate et la limite connue vaut mieux qu'une promesse generale sur les agents.",
    who: "RSSI, prospect anonymise",
  },
];

export function SectionTestimonials() {
  return (
    <section className="nhp-testimonials section-cream">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">Retours anonymises</div>
          <h2 className="h-display h-editorial">Ce que les cadrages nous apprennent.</h2>
        </div>
        <div className="nhp-quotes-grid">
          {quotes.map((quote) => (
            <figure key={quote.logo} className="nhp-quote-card">
              <div className="nhp-quote-top">
                <span className="nhp-quote-logo">{quote.logo}</span>
                <span className="nhp-quote-ind">{quote.ind}</span>
              </div>
              <blockquote>« {quote.q} »</blockquote>
              <div className="nhp-quote-kpi">{quote.kpi}</div>
              <figcaption>{quote.who}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
