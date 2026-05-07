import Link from "next/link";

import { getProofCatalog, PROOF_STATUS_LABELS } from "@/lib/proof-catalog";

export function SectionProofConsole() {
  const catalog = getProofCatalog();
  const cards = [
    {
      value: catalog.counts.liveAgentsWithExcel,
      label: "agents avec donnees",
      detail: "source registry Excel",
    },
    {
      value: catalog.counts.runtimeWorkbooks,
      label: "workbooks runtime",
      detail: "embarques dans apps/neural/data",
    },
    {
      value: catalog.counts.desktopNeuralWorkbooks,
      label: "workbooks audites",
      detail: "hors Carbon and Co",
    },
    {
      value: `${catalog.counts.liveCells}/${catalog.counts.frameworkCells}`,
      label: "cellules alimentees",
      detail: "secteur x branche",
    },
  ];

  return (
    <section className="nhp-proof">
      <div className="nhp-container">
        <div className="nhp-proof-head">
          <div>
            <div className="eyebrow">Proof Console</div>
            <h2 className="h-display h-tight">Le catalogue reel, pas la promesse.</h2>
            <p className="lead">
              NEURAL distingue maintenant les workbooks crees, les donnees parsees, les demos
              publiques et les briques vraiment vendables.
            </p>
          </div>
          <Link href="/proof" className="nhp-btn nhp-btn-ghost">
            Ouvrir la console
          </Link>
        </div>

        <div className="nhp-proof-grid">
          {cards.map((card) => (
            <div key={card.label} className="nhp-proof-card">
              <p className="nhp-proof-value">{card.value}</p>
              <p className="nhp-proof-label">{card.label}</p>
              <p className="nhp-proof-detail">{card.detail}</p>
            </div>
          ))}
        </div>

        <div className="nhp-proof-levels">
          {catalog.maturityLevels.map((level) => (
            <div key={`${level.score}-${level.label}`} className="nhp-proof-level">
              <span className="nhp-proof-level-score">{level.score}</span>
              <div>
                <p>{level.label}</p>
                <span>{PROOF_STATUS_LABELS[level.status]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
