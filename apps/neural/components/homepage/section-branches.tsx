import Link from "next/link";

import { getProofCatalog } from "@/lib/proof-catalog";

const branches = [
  {
    id: "si",
    label: "Systèmes d'Information",
    agents: 0,
    status: "Backlog qualifié",
    next: "Prioriser une première surface runtime",
    href: "/solutions/si",
  },
  {
    id: "rh",
    label: "Ressources Humaines",
    agents: 4,
    status: "Runtime parsé",
    next: "Publier la fiche RH Luxe",
    href: "/solutions/rh",
  },
  {
    id: "mkt",
    label: "Marketing",
    agents: 0,
    status: "Backlog qualifié",
    next: "Finaliser Bank Marketing",
    href: "/solutions/marketing",
  },
  {
    id: "com",
    label: "Communication",
    agents: 5,
    status: "Démo publique",
    next: "Étendre les exports audit",
    href: "/solutions/communication",
  },
  {
    id: "cpt",
    label: "Comptabilité",
    agents: 8,
    status: "Live avec données",
    next: "Renforcer les model cards",
    href: "/solutions/comptabilite",
  },
  {
    id: "fin",
    label: "Finance",
    agents: 6,
    status: "Live avec données",
    next: "Brancher Banque Finance",
    href: "/solutions/finance",
  },
  {
    id: "sup",
    label: "Supply Chain",
    agents: 4,
    status: "Runtime parsé",
    next: "Stabiliser Assurance Supply",
    href: "/solutions/supply-chain",
  },
];

const matrixSectors = ["Transport", "Luxe", "Aéro", "SaaS", "Banque", "Assurance"];
const matrixBranches = ["SI", "RH", "Mkt", "Comms", "Compta", "Finance", "Supply"];

const coverageMap: Record<string, "live" | "demo" | "runtime" | "backlog" | "empty"> = {
  "Luxe-RH": "live",
  "Luxe-Comms": "live",
  "Luxe-Compta": "live",
  "Luxe-Finance": "live",
  "Luxe-Supply": "live",
  "Banque-Finance": "live",
  "Assurance-Compta": "live",
  "Banque-Comms": "demo",
  "Assurance-Supply": "demo",
  "Banque-Mkt": "runtime",
  "Transport-Finance": "backlog",
  "Transport-Compta": "backlog",
  "Aéro-RH": "backlog",
  "Aéro-Supply": "backlog",
};

const legend = [
  { status: "live", label: "Live avec données" },
  { status: "demo", label: "Démo publique" },
  { status: "runtime", label: "Runtime parsé" },
  { status: "backlog", label: "Backlog qualifié" },
  { status: "empty", label: "Non alimenté" },
];

export function SectionBranches() {
  const catalog = getProofCatalog();
  const buyerStats = [
    { value: catalog.counts.liveAgentsWithExcel, label: "agents avec données" },
    { value: catalog.counts.runtimeWorkbooks, label: "workbooks runtime" },
    { value: `${catalog.counts.liveCells}/${catalog.counts.frameworkCells}`, label: "cellules alimentées" },
    { value: catalog.counts.clientReady, label: "client-ready" },
  ];

  return (
    <section className="nhp-branches">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">07 branches</div>
          <h2 className="h-display h-tight">Une couverture cartographiée, pas sur-vendue.</h2>
          <p className="lead">
            Chaque branche affiche maintenant ses agents avec données, ses démos et ses limites.
          </p>
        </div>

        <div className="nhp-coverage-map">
          <div className="nhp-cpm-top">
            <div>
              <div className="nhp-cpm-kicker">Coverage Proof Map</div>
              <h3>La carte distingue ce qui existe, ce qui est démontrable et ce qui reste à industrialiser.</h3>
            </div>
            <p>
              168 = capacité cible framework. Le périmètre public actuel repose sur{" "}
              {catalog.counts.liveAgentsWithExcel} agents avec données Excel,{" "}
              {catalog.counts.runtimeWorkbooks} workbooks runtime et{" "}
              {catalog.counts.liveCells} cellules secteur x branche alimentées.
            </p>
          </div>

          <div className="nhp-cpm-body">
            <div className="nhp-cpm-branches" aria-label="Branches métier cartographiées">
              {branches.map((branch, index) => (
                <Link key={branch.id} href={branch.href} className="nhp-branch-row">
                  <div className="nhp-branch-num">0{index + 1}</div>
                  <div className="nhp-branch-main">
                    <div className="nhp-branch-label">{branch.label}</div>
                    <div className="nhp-branch-next">{branch.next}</div>
                  </div>
                  <div className="nhp-branch-proof">
                    <span>{branch.agents}</span>
                    <small>{branch.status}</small>
                  </div>
                </Link>
              ))}
            </div>

            <div className="nhp-cpm-matrix" aria-label="Matrice miniature secteur par branche">
              <div className="nhp-cpm-matrix-label">6 secteurs x 7 branches</div>
              <div className="nhp-cpm-cols">
                <span />
                {matrixBranches.map((branch) => (
                  <span key={branch}>{branch}</span>
                ))}
              </div>
              {matrixSectors.map((sector) => (
                <div key={sector} className="nhp-cpm-row">
                  <span className="nhp-cpm-sector">{sector}</span>
                  {matrixBranches.map((branch) => {
                    const status = coverageMap[`${sector}-${branch}`] ?? "empty";
                    return (
                      <span
                        key={`${sector}-${branch}`}
                        className={`nhp-cpm-cell is-${status}`}
                        title={`${sector} x ${branch} : ${legend.find((item) => item.status === status)?.label}`}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="nhp-cpm-legend">
                {legend.map((item) => (
                  <span key={item.status}>
                    <i className={`is-${item.status}`} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="nhp-cpm-buyer">
              <div className="nhp-cpm-buyer-title">Lecture acheteur</div>
              <p>
                La couverture n'est pas un inventaire marketing : elle sert à savoir quoi tester,
                quoi vendre en pilot et quoi laisser au backlog.
              </p>
              <div className="nhp-cpm-stats">
                {buyerStats.map((stat) => (
                  <div key={stat.label}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="nhp-cpm-actions">
            <Link href="/proof" className="nhp-btn nhp-btn-primary">Voir la preuve →</Link>
            <Link href="/simulation" className="nhp-btn nhp-btn-ghost">Simuler un parcours</Link>
            <Link href="/secteurs/luxe/finance" className="nhp-btn nhp-btn-link">Ouvrir Luxe Finance ▸</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
