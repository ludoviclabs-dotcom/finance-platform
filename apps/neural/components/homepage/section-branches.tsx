import Link from "next/link";

const branches = [
  { id: "si",  label: "Systèmes d'Information", desc: "Monitoring, migrations, sécurité",   n: 24, href: "/solutions/si" },
  { id: "rh",  label: "Ressources Humaines",    desc: "Recrutement, onboarding, paie",      n: 24, href: "/solutions/rh" },
  { id: "mkt", label: "Marketing",              desc: "PLG, content, attribution",          n: 24, href: "/solutions/marketing" },
  { id: "com", label: "Communication",          desc: "RP, social, interne",                n: 24, href: "/solutions/communication" },
  { id: "cpt", label: "Comptabilité",           desc: "IFRS, clôture, consolidation",       n: 24, href: "/solutions/comptabilite" },
  { id: "fin", label: "Finance",                desc: "Trésorerie, risque, reporting",      n: 24, href: "/solutions/finance" },
  { id: "sup", label: "Supply Chain",           desc: "Sourcing, logistique, traçabilité",  n: 24, href: "/solutions/supply-chain" },
];

export function SectionBranches() {
  return (
    <section className="nhp-branches">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">07 branches</div>
          <h2 className="h-display h-tight">Une couverture métier totale.</h2>
          <p className="lead">Des agents Claude spécialisés pour chaque fonction, orchestrés entre eux.</p>
        </div>
        <div className="nhp-branches-grid">
          {branches.map((b, i) => (
            <Link key={b.id} href={b.href} className="nhp-branch-card">
              <div className="nhp-branch-num">0{i + 1}</div>
              <div className="nhp-branch-label">{b.label}</div>
              <div className="nhp-branch-desc">{b.desc}</div>
              <div className="nhp-branch-foot">
                <span className="nhp-dot nhp-dot-green"/> {b.n} agents actifs
                <span className="nhp-branch-arrow">→</span>
              </div>
            </Link>
          ))}
          <Link href="/marketplace" className="nhp-branch-card nhp-branch-matrix">
            <div className="nhp-branch-matrix-head">
              <div className="nhp-branch-label">Matrice 7 × 6</div>
              <div className="nhp-branch-desc">168 agents spécialisés, une orchestration unique.</div>
            </div>
            <div className="nhp-mini-matrix">
              {Array.from({ length: 42 }).map((_, i) => (
                <span key={i} className="nhp-mm-cell" style={{ animationDelay: `${i * 30}ms` }}/>
              ))}
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
