const problems = [
  { k: "80%",   t: "des POC IA n'atteignent jamais la production.", src: "RAND Corp." },
  { k: "< 20%", t: "des projets produisent un ROI mesurable.",      src: "McKinsey" },
  { k: "2 × ∞", t: "de budget brûlé sans méthode.",                src: "BCG 2024" },
];

export function SectionProblem() {
  return (
    <section className="nhp-problem section-dark">
      <div className="nhp-container">
        <div className="eyebrow eyebrow-violet">Le constat</div>
        <h2 className="h-display">
          L&apos;IA en entreprise est<br/>un cimetière de POCs.
        </h2>
        <p className="lead lead-dark">
          Nous sommes l&apos;antidote. Méthode, KPIs contractualisés, agents qui vivent dans vos flux — pas à côté.
        </p>
        <div className="nhp-problem-row">
          {problems.map((p, i) => (
            <div key={i} className="nhp-problem-cell">
              <div className="nhp-problem-k">{p.k}</div>
              <div className="nhp-problem-t">{p.t}</div>
              <div className="nhp-problem-src">{p.src}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
