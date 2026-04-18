"use client";
import { Fragment, useState } from "react";

const branches = ["SI", "RH", "Marketing", "Comms", "Compta", "Finance", "Supply"];
const sectors  = ["Transport", "Luxe", "Aéronautique", "SaaS", "Banque", "Assurance"];

export function SectionMatrix() {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section className="nhp-matrix">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow">Matrice 7 × 6</div>
          <h2 className="h-display h-tight">42 déploiements possibles.<br/><span className="muted">Un seul opérateur.</span></h2>
        </div>
        <div className="nhp-matrix-wrap">
          <div className="nhp-matrix-table">
            <div className="nhp-matrix-corner">Secteur × Branche</div>
            {branches.map((b) => <div key={b} className="nhp-matrix-col-head">{b}</div>)}
            {sectors.map((s, si) => (
              <Fragment key={s}>
                <div className="nhp-matrix-row-head">{s}</div>
                {branches.map((b, bi) => {
                  const key = `${si}-${bi}`;
                  return (
                    <div
                      key={b}
                      className={`nhp-matrix-cell${hover === key ? " is-hover" : ""}`}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <div className="nhp-matrix-cell-inner">
                        <span className="nhp-matrix-n">24</span>
                        <span className="nhp-matrix-cell-label">{s.slice(0, 3)}·{b.slice(0, 3)}</span>
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
