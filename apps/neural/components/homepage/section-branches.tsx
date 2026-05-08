import Link from "next/link";

const branches = [
  { id: "si", label: "Systemes d'Information", desc: "Positionnement, pas encore surface live", n: 0, href: "/solutions/si" },
  { id: "rh", label: "Ressources Humaines", desc: "RH Luxe, workbooks et parcours démo", n: 4, href: "/solutions/rh" },
  { id: "mkt", label: "Marketing", desc: "Bank Marketing embarqué, fiches à finaliser", n: 0, href: "/solutions/marketing" },
  { id: "com", label: "Communication", desc: "Luxe Comms live, Banque en démo", n: 5, href: "/solutions/communication" },
  { id: "cpt", label: "Comptabilité", desc: "Luxe et Assurance avec données Excel", n: 8, href: "/solutions/comptabilite" },
  { id: "fin", label: "Finance", desc: "Luxe Finance + Banque Finance", n: 6, href: "/solutions/finance" },
  { id: "sup", label: "Supply Chain", desc: "Luxe Supply en données, Assurance en démo", n: 4, href: "/solutions/supply-chain" },
];

export function SectionBranches() {
  return (
    <section className="nhp-branches">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">07 branches</div>
          <h2 className="h-display h-tight">Une couverture cartographiee, pas sur-vendue.</h2>
          <p className="lead">
            Chaque branche affiche maintenant ses agents avec données, ses démos et ses limites.
          </p>
        </div>
        <div className="nhp-branches-grid">
          {branches.map((branche, index) => (
            <Link key={branche.id} href={branche.href} className="nhp-branche-card">
              <div className="nhp-branche-num">0{index + 1}</div>
              <div className="nhp-branche-label">{branche.label}</div>
              <div className="nhp-branche-desc">{branche.desc}</div>
              <div className="nhp-branche-foot">
                <span className="nhp-dot nhp-dot-green"/> {branche.n} avec données
                <span className="nhp-branche-arrow">→</span>
              </div>
            </Link>
          ))}
          <Link href="/proof" className="nhp-branche-card nhp-branche-matrix">
            <div className="nhp-branche-matrix-head">
              <div className="nhp-branche-label">Proof Console</div>
              <div className="nhp-branche-desc">4 niveaux de maturité pour transformer les workbooks en produit.</div>
            </div>
            <div className="nhp-mini-matrix">
              {Array.from({ length: 42 }).map((_, index) => (
                <span key={index} className="nhp-mm-cell" style={{ animationDelay: `${index * 30}ms` }}/>
              ))}
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
