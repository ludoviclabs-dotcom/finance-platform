const problems = [
  { k: "80%",   t: "des POC IA n'atteignent jamais la production.", src: "RAND Corp." },
  { k: "< 20%", t: "des projets produisent un ROI mesurable.",      src: "McKinsey" },
  { k: "2 × ∞", t: "de budget engagé sans cadre méthodologique.",   src: "BCG 2024" },
];

export function SectionProblem() {
  return (
    <section className="nhp-problem section-dark">
      <div className="nhp-container">
        <div className="eyebrow eyebrow-violet">Le constat</div>
        <h2 className="h-display">
          La plupart des projets IA<br/>s&apos;arrêtent avant la production.
        </h2>
        <p className="lead lead-dark">
          L&apos;écart se joue rarement sur le modèle. Il se joue sur le cadrage, les données,
          la gouvernance et la mise en flux. NEURAL structure ces quatre points avant d&apos;écrire
          la première ligne de code.
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
