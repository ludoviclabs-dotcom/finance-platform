"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
    description:
      "Visualisation en temps reel de vos emissions par scope selon le GHG Protocol. Ventilation automatique par poste et site.",
    number: "01",
    side: "left",
    color: "#16a34a",
    posClass: "hScopes",
  },
  {
    id: "kpis",
    targetId: "card-kpis",
    label: "KPIs Carbone",
    description:
      "Indicateurs cles : total tCO2e, evolution Year-over-Year, trajectoire SBTi, benchmark sectoriel.",
    number: "02",
    side: "top",
    color: "#0891b2",
    posClass: "hKpis",
  },
  {
    id: "postes",
    targetId: "card-postes",
    label: "Postes d'emission",
    description:
      "Detail par poste (energie, transport, achats, numerique...) avec ventilation automatique et facteurs ADEME/IEA.",
    number: "03",
    side: "right",
    color: "#7c3aed",
    posClass: "hPostes",
  },
  {
    id: "actions",
    targetId: "card-actions",
    label: "Plan d'action IA",
    description:
      "Recommandations generees par le copilote NEURAL pour reduire vos emissions prioritaires, chiffrees et priorisees.",
    number: "04",
    side: "right",
    color: "#ea580c",
    posClass: "hActions",
  },
  {
    id: "rapports",
    targetId: "card-rapports",
    label: "Rapports CSRD",
    description:
      "Generation automatique de rapports conformes CSRD, CDP, Bilan Carbone. Format auditeur pret pour signature.",
    number: "05",
    side: "left",
    color: "#16a34a",
    posClass: "hRapports",
  },
];

const SIDENAV_ITEMS = [
  {
    id: "kpis",
    label: "KPIs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 21V10M9 21V4M15 21v-9M21 21V7" />
      </svg>
    ),
  },
  {
    id: "scopes",
    label: "Scopes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 12a9 9 0 11-9-9v9h9z" />
      </svg>
    ),
  },
  {
    id: "postes",
    label: "Postes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 3l9 5-9 5-9-5 9-5zm0 9l9 5-9 5-9-5 9-5z" />
      </svg>
    ),
  },
  {
    id: "actions",
    label: "Actions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2l2.4 5 5.6.4-4.2 3.7 1.3 5.4L12 13.8 6.9 16.5l1.3-5.4L4 7.4 9.6 7 12 2z" />
      </svg>
    ),
  },
  {
    id: "rapports",
    label: "Rapports",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" />
        <path d="M14 3v6h6" />
      </svg>
    ),
  },
];

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

/* ── Detail panels (rich content per active section) ─────────── */
function ScopesDetail() {
  const rows = [
    { site: "Siege Paris", s1: "820", s2: "610", s3: "2 140", total: "3 570" },
    { site: "Usine Lyon", s1: "1 480", s2: "980", s3: "3 100", total: "5 560" },
    { site: "Usine Lille", s1: "910", s2: "825", s3: "1 982", total: "3 717" },
  ];
  return (
    <div className={styles.detailGrid}>
      <div className={styles.detailTable}>
        <div className={cx(styles.detailRow, styles.detailHeadRow)}>
          <span>Site</span>
          <span>Scope 1</span>
          <span>Scope 2</span>
          <span>Scope 3</span>
          <span className={styles.tRight}>Total tCO2e</span>
        </div>
        {rows.map((r) => (
          <div key={r.site} className={styles.detailRow}>
            <span className={styles.detailSite}>{r.site}</span>
            <span>{r.s1}</span>
            <span>{r.s2}</span>
            <span>{r.s3}</span>
            <span className={cx(styles.tRight, styles.detailBold)}>{r.total}</span>
          </div>
        ))}
      </div>
      <div className={styles.detailNote}>
        <div className={styles.noteTitle}>Trajectoire SBTi 1.5°C</div>
        <div className={styles.noteRow}>
          <span>Reduction requise 2030</span>
          <span className={styles.noteValueDim}>−42%</span>
        </div>
        <div className={styles.noteRow}>
          <span>Atteint 2025</span>
          <span className={styles.noteValueGreen}>−18%</span>
        </div>
        <div className={styles.noteGauge}>
          <div className={styles.noteGaugeFill} style={{ width: "43%" }} />
        </div>
        <div className={styles.noteFoot}>En avance de 4 mois sur le plan</div>
      </div>
    </div>
  );
}

function KpisDetail() {
  const items = [
    { label: "Total tCO2e", value: "12 847", target: "Target SBTi : 11 200", delta: "−12% YoY", color: "#22c55e" },
    { label: "Scope 1", value: "3 210", target: "Benchmark secteur : 3 540", delta: "−8% YoY", color: "#22d3ee" },
    { label: "Scope 2", value: "2 415", target: "Mix energie 78% renouvelable", delta: "−18% YoY", color: "#a78bfa" },
    { label: "Scope 3", value: "7 222", target: "Couverture chaine : 84%", delta: "−9% YoY", color: "#fb923c" },
  ];
  return (
    <div className={styles.kpiDetailGrid}>
      {items.map((k) => (
        <div key={k.label} className={styles.kpiDetailCard}>
          <div className={styles.kpiDetailLabel}>{k.label}</div>
          <div className={styles.kpiDetailValue}>{k.value}</div>
          <div className={styles.kpiDetailDelta} style={{ color: k.color }}>
            {k.delta}
          </div>
          <div className={styles.kpiDetailTarget}>{k.target}</div>
        </div>
      ))}
    </div>
  );
}

function PostesDetail() {
  const groups = [
    {
      name: "Energie",
      total: "28%",
      color: "#16a34a",
      sub: [
        { name: "Electricite reseau", pct: 65 },
        { name: "Gaz naturel", pct: 25 },
        { name: "Fioul / autres", pct: 10 },
      ],
    },
    {
      name: "Transport",
      total: "34%",
      color: "#0891b2",
      sub: [
        { name: "Routier flotte", pct: 70 },
        { name: "Avion (deplacements)", pct: 20 },
        { name: "Ferroviaire / autre", pct: 10 },
      ],
    },
    {
      name: "Achats",
      total: "22%",
      color: "#7c3aed",
      sub: [
        { name: "Matieres premieres", pct: 58 },
        { name: "Sous-traitance", pct: 30 },
        { name: "Services divers", pct: 12 },
      ],
    },
    {
      name: "Numerique",
      total: "16%",
      color: "#ea580c",
      sub: [
        { name: "Cloud / hosting", pct: 55 },
        { name: "Devices / EOL", pct: 30 },
        { name: "Reseau / SaaS", pct: 15 },
      ],
    },
  ];
  return (
    <div className={styles.postesDetailGrid}>
      {groups.map((g) => (
        <div key={g.name} className={styles.postesDetailCol}>
          <div className={styles.postesDetailHead}>
            <span className={styles.posteName}>{g.name}</span>
            <span className={styles.postePct}>{g.total}</span>
          </div>
          {g.sub.map((s) => (
            <div key={s.name} className={styles.postesDetailRow}>
              <span className={styles.postesDetailSub}>{s.name}</span>
              <div className={styles.track}>
                <i style={{ width: `${s.pct}%`, background: g.color }} />
              </div>
              <span className={styles.postesDetailPct}>{s.pct}%</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ActionsDetail() {
  const actions = [
    { name: "Migrer vers electricite verte (PPA solaire)", impact: "−840 tCO2e", invest: "210 k€", roi: "14 mois", priority: "Haute", color: "#22c55e" },
    { name: "Optimiser flotte vehicules (electrification)", impact: "−520 tCO2e", invest: "380 k€", roi: "26 mois", priority: "Moyenne", color: "#22d3ee" },
    { name: "Reduire deplacements pro (visio + train)", impact: "−310 tCO2e", invest: "20 k€", roi: "3 mois", priority: "Haute", color: "#a78bfa" },
    { name: "Optimisation cloud (rightsizing + region)", impact: "−180 tCO2e", invest: "45 k€", roi: "9 mois", priority: "Moyenne", color: "#fb923c" },
    { name: "Sourcing matieres bas-carbone", impact: "−420 tCO2e", invest: "150 k€", roi: "18 mois", priority: "Haute", color: "#22c55e" },
    { name: "Programme reduction dechets bureau", impact: "−85 tCO2e", invest: "12 k€", roi: "6 mois", priority: "Faible", color: "#22d3ee" },
  ];
  return (
    <div className={styles.actionsDetailList}>
      <div className={cx(styles.actionsDetailRow, styles.actionsDetailHead)}>
        <span>Levier</span>
        <span className={styles.tRight}>Impact</span>
        <span className={styles.tRight}>Investissement</span>
        <span className={styles.tRight}>ROI</span>
        <span className={styles.tRight}>Priorite</span>
      </div>
      {actions.map((a) => (
        <div key={a.name} className={styles.actionsDetailRow}>
          <span className={styles.actionsDetailName}>{a.name}</span>
          <span className={cx(styles.tRight, styles.actionsDetailImpact)} style={{ color: a.color }}>
            {a.impact}
          </span>
          <span className={cx(styles.tRight, styles.actionsDetailMuted)}>{a.invest}</span>
          <span className={cx(styles.tRight, styles.actionsDetailMuted)}>{a.roi}</span>
          <span className={styles.tRight}>
            <span
              className={cx(
                styles.actionsDetailPrio,
                a.priority === "Haute" && styles.prioHigh,
                a.priority === "Moyenne" && styles.prioMid,
                a.priority === "Faible" && styles.prioLow,
              )}
            >
              {a.priority}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function RapportsDetail() {
  const reports = [
    { code: "ESRS E1", title: "Climat — emissions GES, energie, transition", date: "12 mars 2026", status: "Pret a signer", color: "#16a34a" },
    { code: "ESRS S1", title: "Effectifs propres — main d'oeuvre, sante, securite", date: "08 mars 2026", status: "Pret a signer", color: "#0891b2" },
    { code: "ESRS G1", title: "Gouvernance — conduite des affaires, lutte corruption", date: "05 mars 2026", status: "Pret a signer", color: "#7c3aed" },
  ];
  return (
    <div className={styles.rapportsDetailList}>
      {reports.map((r) => (
        <div key={r.code} className={styles.rapportsDetailCard}>
          <div className={styles.rapportsDetailMain}>
            <div className={styles.rapportsDetailCode} style={{ color: r.color, borderColor: r.color }}>
              {r.code}
            </div>
            <div className={styles.rapportsDetailBody}>
              <div className={styles.rapportsDetailTitle}>{r.title}</div>
              <div className={styles.rapportsDetailMeta}>
                Genere le {r.date} · Format auditeur · Signataire : DAF
              </div>
            </div>
          </div>
          <div className={styles.rapportsDetailActions}>
            <span className={styles.rapportsDetailStatus}>{r.status}</span>
            <span className={cx(styles.btn, styles.btnPrimary)}>PDF</span>
            <span className={cx(styles.btn, styles.btnGhost)}>Excel</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const DETAIL_RENDERERS: Record<string, () => ReactNode> = {
  scopes: () => <ScopesDetail />,
  kpis: () => <KpisDetail />,
  postes: () => <PostesDetail />,
  actions: () => <ActionsDetail />,
  rapports: () => <RapportsDetail />,
};

/* ── Main component ─────────────────────────────────────────── */
export function PremiumDashboardMockup() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeHotspot = useMemo(
    () => (activeId ? HOTSPOTS.find((h) => h.id === activeId) ?? null : null),
    [activeId],
  );

  const handleSelect = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : id));
  }, []);

  const handleReset = useCallback(() => setActiveId(null), []);

  /* Keyboard navigation */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in form fields
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (e.key === "Escape") {
        if (activeId !== null) {
          e.preventDefault();
          handleReset();
        }
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const idx = activeId ? HOTSPOTS.findIndex((h) => h.id === activeId) : -1;
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = (idx + dir + HOTSPOTS.length) % HOTSPOTS.length;
        setActiveId(HOTSPOTS[next].id);
        e.preventDefault();
        return;
      }
      if (/^[1-5]$/.test(e.key)) {
        const target = HOTSPOTS[Number(e.key) - 1];
        if (target) {
          setActiveId(target.id);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, handleReset]);

  /* Bezier connection lines (rebuild on resize + active change) */
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

      const hots = wrap.querySelectorAll<HTMLElement>("[data-target]");
      hots.forEach((hot, i) => {
        const targetId = hot.dataset.target;
        const side = hot.dataset.side as "left" | "right" | "top" | undefined;
        const color = hot.dataset.color || "#16a34a";
        const hotspotId = hot.dataset.hotspotId;
        if (!targetId || !side || !hotspotId) return;
        const target = wrap.querySelector<HTMLElement>(`#${targetId}`);
        if (!target) return;

        const isActive = activeId === hotspotId;
        const isOtherActive = activeId !== null && !isActive;

        const startStop = isActive ? 1 : isOtherActive ? 0.18 : 0.55;
        const endStop = isActive ? 0.5 : isOtherActive ? 0.04 : 0.05;
        const strokeWidth = isActive ? 2.2 : 1;

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
          <stop offset="0%" stop-color="${color}" stop-opacity="${startStop}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="${endStop}"/>
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
        path.setAttribute("stroke-width", String(strokeWidth));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        if (isActive) {
          path.setAttribute("filter", "drop-shadow(0 0 6px " + color + ")");
        }
        svg.appendChild(path);

        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", String(x2));
        c.setAttribute("cy", String(y2));
        c.setAttribute("r", isActive ? "4.5" : "3.5");
        c.setAttribute("fill", color);
        c.setAttribute("stroke", "#0b1220");
        c.setAttribute("stroke-width", "1.5");
        if (isOtherActive) c.setAttribute("opacity", "0.35");
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
  }, [activeId]);

  const isActive = (id: string) => activeId === id;
  const isDimmed = (id: string) => activeId !== null && activeId !== id;

  const detailNode = activeId ? DETAIL_RENDERERS[activeId]?.() : null;

  return (
    <div ref={wrapRef} className={cx(styles.mockupWrap, activeId && styles.mockupWrapFocus)}>
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
              app.carbonco.fr/dashboard{activeHotspot ? `/${activeId}` : ""}
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
            <button
              type="button"
              onClick={handleReset}
              className={cx(styles.navi, activeId === null && styles.naviActive)}
              aria-pressed={activeId === null}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              Dashboard
            </button>
            {SIDENAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={cx(styles.navi, activeId === item.id && styles.naviActive)}
                aria-pressed={activeId === item.id}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </aside>

          <main className={styles.screen}>
            <div className={styles.dashHead}>
              <div>
                <div className={styles.hTitle}>
                  Bilan Carbone — {activeHotspot ? activeHotspot.label : "Vue globale"}
                </div>
                <div className={styles.hSub}>
                  Annee 2025 · GHG Protocol · Mise a jour il y a 4 min
                </div>
              </div>
              {activeHotspot ? (
                <button type="button" onClick={handleReset} className={styles.resetBtn}>
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Vue globale
                </button>
              ) : (
                <div className={styles.seg}>
                  <span>Mois</span>
                  <span>Trim.</span>
                  <span className={styles.segOn}>Annee</span>
                </div>
              )}
            </div>

            <div className={styles.kpiRow}>
              <button
                type="button"
                onClick={() => handleSelect("kpis")}
                id="card-kpis"
                className={cx(
                  styles.kpi,
                  styles.kpiButton,
                  isActive("kpis") && styles.cardActive,
                  isDimmed("kpis") && styles.cardDim,
                )}
                aria-pressed={isActive("kpis")}
              >
                <div className={styles.kpiLabel}>Total tCO2e</div>
                <div className={styles.kpiValue}>12 847</div>
                <div className={styles.kpiFoot}>
                  <span className={`${styles.delta} ${styles.deltaGreen}`}>▼ 12% YoY</span>
                  <svg width="44" height="14" viewBox="0 0 44 14">
                    <polyline fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,4 8,5 16,7 24,8 32,10 44,12" />
                  </svg>
                </div>
              </button>
              <div className={cx(styles.kpi, isDimmed("kpis") && styles.cardDim)}>
                <div className={styles.kpiLabel}>Scope 1</div>
                <div className={styles.kpiValue}>3 210</div>
                <div className={styles.kpiFoot}>
                  <span className={`${styles.delta} ${styles.deltaTeal}`}>▼ 8% YoY</span>
                  <svg width="44" height="14" viewBox="0 0 44 14">
                    <polyline fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,5 8,5.5 16,6 24,7 32,8 44,9" />
                  </svg>
                </div>
              </div>
              <div className={cx(styles.kpi, isDimmed("kpis") && styles.cardDim)}>
                <div className={styles.kpiLabel}>Scope 2</div>
                <div className={styles.kpiValue}>2 415</div>
                <div className={styles.kpiFoot}>
                  <span className={`${styles.delta} ${styles.deltaViolet}`}>▼ 18% YoY</span>
                  <svg width="44" height="14" viewBox="0 0 44 14">
                    <polyline fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,3 8,4 16,6 24,8 32,10 44,11" />
                  </svg>
                </div>
              </div>
              <div className={cx(styles.kpi, isDimmed("kpis") && styles.cardDim)}>
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
              <button
                type="button"
                onClick={() => handleSelect("scopes")}
                id="card-scopes"
                className={cx(
                  styles.panel,
                  styles.panelButton,
                  isActive("scopes") && styles.cardActive,
                  isDimmed("scopes") && styles.cardDim,
                )}
                aria-pressed={isActive("scopes")}
              >
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
              </button>

              <button
                type="button"
                onClick={() => handleSelect("postes")}
                id="card-postes"
                className={cx(
                  styles.panel,
                  styles.panelButton,
                  isActive("postes") && styles.cardActive,
                  isDimmed("postes") && styles.cardDim,
                )}
                aria-pressed={isActive("postes")}
              >
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
              </button>

              <button
                type="button"
                onClick={() => handleSelect("actions")}
                id="card-actions"
                className={cx(
                  styles.panel,
                  styles.panelButton,
                  isActive("actions") && styles.cardActive,
                  isDimmed("actions") && styles.cardDim,
                )}
                aria-pressed={isActive("actions")}
              >
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
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSelect("rapports")}
              id="card-rapports"
              className={cx(
                styles.footerRep,
                styles.footerRepButton,
                isActive("rapports") && styles.cardActive,
                isDimmed("rapports") && styles.cardDim,
              )}
              aria-pressed={isActive("rapports")}
            >
              <div className={styles.ftxt}>
                <div className={styles.fL1}>Rapports CSRD</div>
                <div className={styles.fL2}>3 rapports prets · E1, S1, G1</div>
              </div>
              <div className={styles.actionsFoot}>
                <span className={`${styles.btn} ${styles.btnPrimary}`}>Telecharger PDF</span>
                <span className={`${styles.btn} ${styles.btnGhost}`}>Excel</span>
              </div>
            </button>

            {activeHotspot && detailNode && (
              <div
                className={styles.detailDrawer}
                role="region"
                aria-label={`Detail ${activeHotspot.label}`}
              >
                <div className={styles.detailHeadBar}>
                  <div className={styles.detailHeadLeft}>
                    <span className={styles.detailDot} style={{ background: activeHotspot.color }} />
                    <span className={styles.detailLabel}>
                      {activeHotspot.label} · Detail
                    </span>
                  </div>
                  <button type="button" onClick={handleReset} className={styles.detailClose} aria-label="Fermer">
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className={styles.detailBody}>{detailNode}</div>
              </div>
            )}
          </main>
        </div>
      </div>

      <svg ref={svgRef} className={styles.links} preserveAspectRatio="none" />

      {HOTSPOTS.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => handleSelect(h.id)}
          className={cx(
            styles.hot,
            styles[h.posClass as string],
            isActive(h.id) && styles.hotActive,
            isDimmed(h.id) && styles.hotDim,
          )}
          data-target={h.targetId}
          data-side={h.side}
          data-color={h.color}
          data-hotspot-id={h.id}
          aria-pressed={isActive(h.id)}
          style={isActive(h.id) ? { background: h.color, borderColor: h.color } : undefined}
        >
          <span className={styles.dot} style={{ color: h.color, background: h.color }} />
          {h.label}
          <span className={styles.num}>{h.number}</span>
        </button>
      ))}

      <div className={styles.hint} aria-hidden="true">
        ← → naviguer · Esc revenir · 1-5 acces direct
      </div>
    </div>
  );
}

export const PREMIUM_DASHBOARD_HOTSPOTS = HOTSPOTS;
