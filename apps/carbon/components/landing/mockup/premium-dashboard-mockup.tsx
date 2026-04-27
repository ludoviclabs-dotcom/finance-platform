"use client";

import { useEffect, useRef } from "react";
import styles from "./premium-dashboard-mockup.module.css";

interface Hotspot {
  id: string;
  targetId: string;
  label: string;
  description: string;
  number: string;
  side: "left" | "right" | "top";
  color: string;
  posClass: keyof typeof styles;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: "scopes",
    targetId: "card-scopes",
    label: "Scopes 1, 2, 3",
    description: "Visualisation en temps reel de vos emissions par scope selon le GHG Protocol. Ventilation automatique par poste et site.",
    number: "01",
    side: "left",
    color: "#16a34a",
    posClass: "hScopes",
  },
  {
    id: "kpis",
    targetId: "card-kpis",
    label: "KPIs Carbone",
    description: "Indicateurs cles : total tCO2e, evolution Year-over-Year, trajectoire SBTi, benchmark sectoriel.",
    number: "02",
    side: "top",
    color: "#0891b2",
    posClass: "hKpis",
  },
  {
    id: "postes",
    targetId: "card-postes",
    label: "Postes d'emission",
    description: "Detail par poste (energie, transport, achats, numerique...) avec ventilation automatique et facteurs ADEME/IEA.",
    number: "03",
    side: "right",
    color: "#7c3aed",
    posClass: "hPostes",
  },
  {
    id: "actions",
    targetId: "card-actions",
    label: "Plan d'action IA",
    description: "Recommandations generees par le copilote NEURAL pour reduire vos emissions prioritaires, chiffrees et priorisees.",
    number: "04",
    side: "right",
    color: "#ea580c",
    posClass: "hActions",
  },
  {
    id: "rapports",
    targetId: "card-rapports",
    label: "Rapports CSRD",
    description: "Generation automatique de rapports conformes CSRD, CDP, Bilan Carbone. Format auditeur pret pour signature.",
    number: "05",
    side: "left",
    color: "#16a34a",
    posClass: "hRapports",
  },
];

export function PremiumDashboardMockup() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;

    const buildLines = () => {
      const r = wrap.getBoundingClientRect();
      svg.setAttribute("width", String(r.width));
      svg.setAttribute("height", String(r.height));
      svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
      svg.innerHTML = "";

      const SVG_NS = "http://www.w3.org/2000/svg";
      const defs = document.createElementNS(SVG_NS, "defs");
      svg.appendChild(defs);

      const hots = wrap.querySelectorAll<HTMLDivElement>("[data-target]");
      hots.forEach((hot, i) => {
        const targetId = hot.dataset.target;
        const side = hot.dataset.side as "left" | "right" | "top" | undefined;
        const color = hot.dataset.color || "#16a34a";
        if (!targetId || !side) return;
        const target = wrap.querySelector<HTMLElement>(`#${targetId}`);
        if (!target) return;

        const hotR = hot.getBoundingClientRect();
        const tR = target.getBoundingClientRect();

        let x1: number, y1: number;
        if (side === "left") {
          x1 = hotR.right - r.left;
          y1 = hotR.top + hotR.height / 2 - r.top;
        } else if (side === "right") {
          x1 = hotR.left - r.left;
          y1 = hotR.top + hotR.height / 2 - r.top;
        } else {
          x1 = hotR.left + hotR.width / 2 - r.left;
          y1 = hotR.bottom - r.top;
        }

        let x2: number, y2: number;
        if (side === "left") {
          x2 = tR.left - r.left;
          y2 = tR.top + tR.height / 2 - r.top;
        } else if (side === "right") {
          x2 = tR.right - r.left;
          y2 = tR.top + tR.height / 2 - r.top;
        } else {
          x2 = tR.left + tR.width / 2 - r.left;
          y2 = tR.top - r.top;
        }

        const gid = `lg-${i}`;
        const lg = document.createElementNS(SVG_NS, "linearGradient");
        lg.setAttribute("id", gid);
        lg.setAttribute("gradientUnits", "userSpaceOnUse");
        lg.setAttribute("x1", String(x1));
        lg.setAttribute("y1", String(y1));
        lg.setAttribute("x2", String(x2));
        lg.setAttribute("y2", String(y2));
        lg.innerHTML = `
          <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.05"/>
        `;
        defs.appendChild(lg);

        const dx = x2 - x1;
        const dy = y2 - y1;
        let cx1: number, cy1: number, cx2: number, cy2: number;
        if (side === "left" || side === "right") {
          cx1 = x1 + dx * 0.6;
          cy1 = y1;
          cx2 = x1 + dx * 0.4;
          cy2 = y2;
        } else {
          cx1 = x1;
          cy1 = y1 + dy * 0.4;
          cx2 = x2;
          cy2 = y1 + dy * 0.6;
        }

        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
        path.setAttribute("stroke", `url(#${gid})`);
        path.setAttribute("stroke-width", "1");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        svg.appendChild(path);

        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", String(x2));
        c.setAttribute("cy", String(y2));
        c.setAttribute("r", "3.5");
        c.setAttribute("fill", color);
        c.setAttribute("stroke", "#0b1220");
        c.setAttribute("stroke-width", "1.5");
        svg.appendChild(c);
      });
    };

    buildLines();
    const onResize = () => buildLines();
    window.addEventListener("resize", onResize);

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(buildLines);
      ro.observe(wrap);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(buildLines).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={styles.mockupWrap}>
      <span className={`${styles.deco} ${styles.deco1}`} />
      <span className={`${styles.deco} ${styles.deco2}`} />
      <span className={`${styles.deco} ${styles.deco3}`} />

      <div className={styles.browser}>
        <div className={styles.titlebar}>
          <div className={styles.traffic}>
            <span className={styles.trafficR} />
            <span className={styles.trafficY} />
            <span className={styles.trafficG} />
          </div>
          <div className={styles.navArrows}>
            <span>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M4 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <div className={styles.urlBar}>
            <div>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              app.carbonco.fr/dashboard
            </div>
          </div>
          <div className={styles.titlebarRight}>
            <span>
              <svg width="11" height="11" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="1" fill="currentColor" />
                <circle cx="6" cy="2" r="1" fill="currentColor" />
                <circle cx="6" cy="10" r="1" fill="currentColor" />
              </svg>
            </span>
          </div>
        </div>

        <div className={styles.dash}>
          <aside className={styles.sidenav}>
            <div className={styles.brand}>
              <div className={styles.brandMark}>C</div>
            </div>
            <div className={`${styles.navi} ${styles.naviActive}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              Dashboard
            </div>
            <div className={styles.navi}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 21V10M9 21V4M15 21v-9M21 21V7" />
              </svg>
              KPIs
            </div>
            <div className={styles.navi}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 12a9 9 0 11-9-9v9h9z" />
              </svg>
              Scopes
            </div>
            <div className={styles.navi}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 3l9 5-9 5-9-5 9-5zm0 9l9 5-9 5-9-5 9-5z" />
              </svg>
              Postes
            </div>
            <div className={styles.navi}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2l2.4 5 5.6.4-4.2 3.7 1.3 5.4L12 13.8 6.9 16.5l1.3-5.4L4 7.4 9.6 7 12 2z" />
              </svg>
              Actions
            </div>
            <div className={styles.navi}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" />
                <path d="M14 3v6h6" />
              </svg>
              Rapports
            </div>
          </aside>

          <main className={styles.screen}>
            <div className={styles.dashHead}>
              <div>
                <div className={styles.hTitle}>Bilan Carbone — Vue globale</div>
                <div className={styles.hSub}>Annee 2025 · GHG Protocol · Mise a jour il y a 4 min</div>
              </div>
              <div className={styles.seg}>
                <span>Mois</span>
                <span>Trim.</span>
                <span className={styles.segOn}>Annee</span>
              </div>
            </div>

            <div className={styles.kpiRow}>
              <div className={styles.kpi} id="card-kpis">
                <div className={styles.kpiLabel}>Total tCO2e</div>
                <div className={styles.kpiValue}>12 847</div>
                <div className={styles.kpiFoot}>
                  <span className={`${styles.delta} ${styles.deltaGreen}`}>▼ 12% YoY</span>
                  <svg width="44" height="14" viewBox="0 0 44 14">
                    <polyline fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,4 8,5 16,7 24,8 32,10 44,12" />
                  </svg>
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Scope 1</div>
                <div className={styles.kpiValue}>3 210</div>
                <div className={styles.kpiFoot}>
                  <span className={`${styles.delta} ${styles.deltaTeal}`}>▼ 8% YoY</span>
                  <svg width="44" height="14" viewBox="0 0 44 14">
                    <polyline fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,5 8,5.5 16,6 24,7 32,8 44,9" />
                  </svg>
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Scope 2</div>
                <div className={styles.kpiValue}>2 415</div>
                <div className={styles.kpiFoot}>
                  <span className={`${styles.delta} ${styles.deltaViolet}`}>▼ 18% YoY</span>
                  <svg width="44" height="14" viewBox="0 0 44 14">
                    <polyline fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,3 8,4 16,6 24,8 32,10 44,11" />
                  </svg>
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Scope 3</div>
                <div className={styles.kpiValue}>7 222</div>
                <div className={styles.kpiFoot}>
                  <span className={`${styles.delta} ${styles.deltaOrange}`}>▼ 9% YoY</span>
                  <svg width="44" height="14" viewBox="0 0 44 14">
                    <polyline fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,4 8,5 16,5.5 24,6.5 32,7.5 44,8.5" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={styles.body}>
              <div className={styles.panel} id="card-scopes">
                <div className={styles.panelTitle}>
                  Repartition Scopes <span className={styles.chip}>2025</span>
                </div>
                <div className={styles.bars}>
                  <div className={`${styles.bar} ${styles.barB1}`}>
                    <span className={styles.barVal}>25%</span>
                  </div>
                  <div className={`${styles.bar} ${styles.barB2}`}>
                    <span className={styles.barVal}>19%</span>
                  </div>
                  <div className={`${styles.bar} ${styles.barB3}`}>
                    <span className={styles.barVal}>56%</span>
                  </div>
                </div>
                <div className={styles.barAxis}>
                  <span>S1</span>
                  <span>S2</span>
                  <span>S3</span>
                </div>
              </div>

              <div className={styles.panel} id="card-postes">
                <div className={styles.panelTitle}>Postes d&apos;emission</div>
                <div className={styles.postes}>
                  <div className={styles.poste}>
                    <div className={styles.posteRow}>
                      <span className={styles.posteName}>Energie</span>
                      <span className={styles.postePct}>28%</span>
                    </div>
                    <div className={styles.track}>
                      <i style={{ width: "28%", background: "#16a34a" }} />
                    </div>
                  </div>
                  <div className={styles.poste}>
                    <div className={styles.posteRow}>
                      <span className={styles.posteName}>Transport</span>
                      <span className={styles.postePct}>34%</span>
                    </div>
                    <div className={styles.track}>
                      <i style={{ width: "34%", background: "#0891b2" }} />
                    </div>
                  </div>
                  <div className={styles.poste}>
                    <div className={styles.posteRow}>
                      <span className={styles.posteName}>Achats</span>
                      <span className={styles.postePct}>22%</span>
                    </div>
                    <div className={styles.track}>
                      <i style={{ width: "22%", background: "#7c3aed" }} />
                    </div>
                  </div>
                  <div className={styles.poste}>
                    <div className={styles.posteRow}>
                      <span className={styles.posteName}>Numerique</span>
                      <span className={styles.postePct}>16%</span>
                    </div>
                    <div className={styles.track}>
                      <i style={{ width: "16%", background: "#ea580c" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.panel} id="card-actions">
                <div className={styles.panelTitle}>
                  Actions IA <span className={`${styles.chip} ${styles.chipNeural}`}>NEURAL</span>
                </div>
                <div className={styles.actions}>
                  <div className={styles.action}>
                    <div className={styles.aText}>Migrer vers electricite verte</div>
                    <div className={styles.aMeta}>
                      <span className={styles.pill}>−840 tCO2e</span>
                      <span className={`${styles.pill} ${styles.pillDim}`}>Haute</span>
                    </div>
                  </div>
                  <div className={styles.action}>
                    <div className={styles.aText}>Optimiser flotte vehicules</div>
                    <div className={styles.aMeta}>
                      <span className={`${styles.pill} ${styles.pillTeal}`}>−520 tCO2e</span>
                      <span className={`${styles.pill} ${styles.pillDim}`}>Moyenne</span>
                    </div>
                  </div>
                  <div className={styles.action}>
                    <div className={styles.aText}>Reduire deplacements pro</div>
                    <div className={styles.aMeta}>
                      <span className={`${styles.pill} ${styles.pillViolet}`}>−310 tCO2e</span>
                      <span className={`${styles.pill} ${styles.pillDim}`}>Haute</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.footerRep} id="card-rapports">
              <div className={styles.ftxt}>
                <div className={styles.fL1}>Rapports CSRD</div>
                <div className={styles.fL2}>3 rapports prets · E1, S1, G1</div>
              </div>
              <div className={styles.actionsFoot}>
                <span className={`${styles.btn} ${styles.btnPrimary}`}>Telecharger PDF</span>
                <span className={`${styles.btn} ${styles.btnGhost}`}>Excel</span>
              </div>
            </div>
          </main>
        </div>
      </div>

      <svg ref={svgRef} className={styles.links} preserveAspectRatio="none" />

      {HOTSPOTS.map((h) => (
        <div
          key={h.id}
          className={`${styles.hot} ${styles[h.posClass as string]}`}
          data-target={h.targetId}
          data-side={h.side}
          data-color={h.color}
        >
          <span className={styles.dot} style={{ color: h.color, background: h.color }} />
          {h.label}
          <span className={styles.num}>{h.number}</span>
        </div>
      ))}
    </div>
  );
}

export const PREMIUM_DASHBOARD_HOTSPOTS = HOTSPOTS;
