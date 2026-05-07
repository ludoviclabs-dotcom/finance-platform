import Link from "next/link";

const branches = [
  { id: "si", label: "Systemes d'Information", desc: "Positionnement, pas encore surface live", n: 0, href: "/solutions/si" },
  { id: "rh", label: "Ressources Humaines", desc: "RH Luxe, workbooks et parcours demo", n: 4, href: "/solutions/rh" },
  { id: "mkt", label: "Marketing", desc: "Bank Marketing embarque, fiches a finaliser", n: 0, href: "/solutions/marketing" },
  { id: "com", label: "Communication", desc: "Luxe Comms live, Banque en demo", n: 5, href: "/solutions/communication" },
  { id: "cpt", label: "Comptabilite", desc: "Luxe et Assurance avec donnees Excel", n: 8, href: "/solutions/comptabilite" },
  { id: "fin", label: "Finance", desc: "Luxe Finance + Banque Finance", n: 6, href: "/solutions/finance" },
  { id: "sup", label: "Supply Chain", desc: "Luxe Supply en donnees, Assurance en demo", n: 4, href: "/solutions/supply-chain" },
];

export function SectionBranches() {
  return (
    <section className="nhp-branches">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">07 branches</div>
          <h2 className="h-display h-tight">Une couverture cartographiee, pas sur-vendue.</h2>
          <p className="lead">
            Chaque branche affiche maintenant ses agents avec donnees, ses demos et ses limites.
          </p>
        </div>
        <div className="nhp-branches-grid">
          {branches.map((branch, index) => (
            <Link key={branch.id} href={branch.href} className="nhp-branch-card">
              <div className="nhp-branch-num">0{index + 1}</div>
              <div className="nhp-branch-label">{branch.label}</div>
              <div className="nhp-branch-desc">{branch.desc}</div>
              <div className="nhp-branch-foot">
                <span className="nhp-dot nhp-dot-green"/> {branch.n} avec donnees
                <span className="nhp-branch-arrow">→</span>
              </div>
            </Link>
          ))}
          <Link href="/proof" className="nhp-branch-card nhp-branch-matrix">
            <div className="nhp-branch-matrix-head">
              <div className="nhp-branch-label">Proof Console</div>
              <div className="nhp-branch-desc">4 niveaux de maturite pour transformer les workbooks en produit.</div>
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
