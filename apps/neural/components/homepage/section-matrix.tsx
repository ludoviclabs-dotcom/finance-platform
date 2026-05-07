"use client";

import { Fragment, useState } from "react";

const branches = ["SI", "RH", "Marketing", "Comms", "Compta", "Finance", "Supply"];
const sectors  = ["Transport", "Luxe", "Aeronautique", "SaaS", "Banque", "Assurance"];

const liveCells = new Set([
  "Luxe|RH",
  "Luxe|Supply",
  "Luxe|Compta",
  "Luxe|Finance",
  "Luxe|Comms",
  "Banque|Finance",
  "Assurance|Compta",
]);

const demoCells = new Set([
  "Transport|Compta",
  "Transport|Finance",
  "Aeronautique|Marketing",
  "Banque|Comms",
  "Banque|Marketing",
  "Assurance|Supply",
  "Assurance|Marketing",
]);

function cellStatus(sector: string, branch: string) {
  const key = `${sector}|${branch}`;
  if (liveCells.has(key)) return { marker: "live", label: "data" };
  if (demoCells.has(key)) return { marker: "demo", label: "demo" };
  return { marker: "planned", label: "plan" };
}

export function SectionMatrix() {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section className="nhp-matrix">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">Matrice 7 x 6</div>
          <h2 className="h-display h-tight">42 combinaisons possibles.<br/><span className="muted">7 deja alimentees.</span></h2>
        </div>
        <div className="nhp-matrix-wrap">
          <div className="nhp-matrix-table">
            <div className="nhp-matrix-corner">Secteur x Branche</div>
            {branches.map((branch) => <div key={branch} className="nhp-matrix-col-head">{branch}</div>)}
            {sectors.map((sector, sectorIndex) => (
              <Fragment key={sector}>
                <div className="nhp-matrix-row-head">{sector}</div>
                {branches.map((branch, branchIndex) => {
                  const key = `${sectorIndex}-${branchIndex}`;
                  const status = cellStatus(sector, branch);
                  return (
                    <div
                      key={branch}
                      className={`nhp-matrix-cell is-${status.marker}${hover === key ? " is-hover" : ""}`}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <div className="nhp-matrix-cell-inner">
                        <span className="nhp-matrix-n">{status.label}</span>
                        <span className="nhp-matrix-cell-label">{sector.slice(0, 3)}·{branch.slice(0, 3)}</span>
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
