"use client";

/**
 * Section "Opérationnel en 3 étapes" — refonte premium éditoriale.
 *
 * Composition harmonisée :
 * - Numéro géant (140 px) en backdrop avec gradient emerald clip + text-stroke
 * - Disque blanc 72 px (icône 28 px) avec halo blanc 6 px qui le détache du chiffre
 * - Mini-prototypes UI sous chaque étape (connecteurs / NEURAL / rapport)
 * - Timeline rail desktop avec pulse lumineux qui glisse
 * - CTA principal + 3 trust badges
 *
 * Animations CSS définies dans apps/carbon/app/globals.css :
 *   .how-bg, .how-rail-pulse, .how-live-dot, .how-typing-dot, .how-progress-fill
 */

import { useEffect, useRef, useState } from "react";

/* ============================================================
   Reveal (local) — IntersectionObserver fade-in
   ============================================================ */

function useReveal({ threshold = 0.15 }: { threshold?: number } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity .8s cubic-bezier(.16,1,.3,1) ${delay}s, transform .8s cubic-bezier(.16,1,.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Sub-components — protos UI par étape
   ============================================================ */

function ProtoBar({ label, badge, badgeColor = "emerald" }: { label: string; badge?: string; badgeColor?: "emerald" | "slate" }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-neutral-200 bg-neutral-50">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
      </div>
      <span className="ml-1.5 font-mono text-[10px] tracking-[0.04em] text-slate-400">{label}</span>
      {badge && (
        <span
          className={`ml-auto inline-flex items-center gap-1.5 font-mono text-[9.5px] font-semibold tracking-[0.08em] uppercase ${
            badgeColor === "emerald" ? "text-emerald-600" : "text-slate-700"
          }`}
        >
          <span
            className={`how-live-dot inline-block w-[5px] h-[5px] rounded-full ${
              badgeColor === "emerald" ? "bg-emerald-600" : "bg-slate-700"
            }`}
            style={{ boxShadow: "0 0 0 3px rgba(5,150,105,.2)" }}
          />
          {badge}
        </span>
      )}
    </div>
  );
}

function ProtoSources() {
  const connectors: { logo: "xls" | "sap" | "api"; name: string; sub: string; status: "ok" | "sync" | "beta" }[] = [
    { logo: "xls", name: "Factures énergie 2024", sub: "12 fichiers · 4 sites", status: "ok" },
    { logo: "api", name: "EDF Pro · compteurs", sub: "temps réel · OAuth 2.0", status: "sync" },
    { logo: "sap", name: "Achats fournisseurs", sub: "S/4 HANA · prochainement", status: "beta" },
  ];
  const logoStyles: Record<string, string> = {
    xls: "bg-gradient-to-br from-[#107C41] to-[#0E6B38] text-[13px]",
    sap: "bg-gradient-to-br from-[#0FAAFF] to-[#0070C0] text-[10px]",
    api: "bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] text-[10px]",
  };
  const logoLabels: Record<string, string> = { xls: "XLS", sap: "SAP", api: "API" };
  const statusStyles: Record<string, string> = {
    ok: "text-emerald-600 bg-emerald-50 border-emerald-200",
    sync: "text-sky-700 bg-sky-50 border-sky-200",
    beta: "text-slate-700 bg-slate-50 border-slate-200",
  };
  return (
    <div className="px-3.5 py-3.5 flex flex-col gap-2 text-left">
      {connectors.map((c) => (
        <div key={c.name} className="flex items-center gap-2.5 px-3 py-2.5 border border-neutral-200 rounded-lg bg-white">
          <div
            className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${logoStyles[c.logo]}`}
            style={{ letterSpacing: "-0.02em" }}
          >
            {logoLabels[c.logo]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-slate-900 leading-tight truncate">{c.name}</div>
            <div className="text-[10.5px] text-slate-400 font-mono mt-0.5 tracking-[0.02em] truncate">{c.sub}</div>
          </div>
          <span
            className={`flex-none font-mono text-[9.5px] font-semibold tracking-[0.06em] uppercase border rounded-full px-2 py-[3px] ${statusStyles[c.status]}`}
          >
            {c.status === "sync" && (
              <span
                className="how-live-dot inline-block w-[5px] h-[5px] rounded-full bg-sky-700 mr-1.5 align-middle"
                style={{ boxShadow: "0 0 0 3px rgba(3,105,161,.2)" }}
              />
            )}
            {c.status}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-neutral-50 rounded-lg">
        <span className="font-mono text-[11px] text-slate-500 tracking-[0.04em]">Mapping</span>
        <div className="flex-1 h-[5px] bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="how-progress-fill h-full rounded-full"
            style={
              {
                width: 0,
                background: "linear-gradient(90deg, #059669, #34D399)",
                ["--how-fill" as string]: "73%",
              } as React.CSSProperties
            }
          />
        </div>
        <span className="font-mono text-[11px] font-semibold text-emerald-700">73 %</span>
      </div>
    </div>
  );
}

function ProtoNeural() {
  const factors = [
    { label: "Électricité FR", src: "ADEME 2024", val: "0.052 kgCO₂e/kWh" },
    { label: "Gaz naturel", src: "Base Empreinte®", val: "0.227 kgCO₂e/kWh" },
    { label: "Diesel B7", src: "Ecoinvent 3.9", val: "2.514 kgCO₂e/L" },
  ];
  return (
    <div className="px-3.5 py-3.5 flex flex-col gap-2.5 text-left">
      <div
        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border"
        style={{
          background: "linear-gradient(135deg, rgba(5,150,105,.06), rgba(52,211,153,.06))",
          borderColor: "#D1FAE5",
        }}
      >
        <div
          className="flex-none w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 30% 30%, #34D399, #059669 70%)",
            boxShadow: "0 0 0 3px rgba(5,150,105,.15)",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10.5px] font-semibold text-emerald-800 tracking-[0.04em]">NEURAL · v2.4</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            Analyse en cours
            <span className="inline-flex gap-[3px] ml-1">
              <span className="how-typing-dot w-1 h-1 rounded-full bg-emerald-600" />
              <span className="how-typing-dot w-1 h-1 rounded-full bg-emerald-600" style={{ animationDelay: "0.2s" }} />
              <span className="how-typing-dot w-1 h-1 rounded-full bg-emerald-600" style={{ animationDelay: "0.4s" }} />
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 px-2.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-none w-3.5 h-3.5 text-amber-600 mt-0.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-[11.5px] leading-snug text-amber-900 m-0">
          <b className="font-semibold text-amber-950">Site Lyon</b> · consommation gaz +218 % vs N-1. Vérifier facture #FA-2024-0892.
        </p>
      </div>

      <div className="flex flex-col">
        {factors.map((f, i) => (
          <div
            key={f.label}
            className={`flex items-center justify-between px-2.5 py-1.5 font-mono text-[11px] ${
              i < factors.length - 1 ? "border-b border-dashed border-neutral-200" : ""
            }`}
          >
            <span className="text-slate-500">
              <b className="font-semibold text-slate-900 font-sans text-[12px]">{f.label}</b>
              <span className="ml-1.5 text-slate-400">{f.src}</span>
            </span>
            <span className="font-semibold text-emerald-700">{f.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtoReport() {
  const cells: { lbl: string; state: "done" | "partial" }[] = [
    { lbl: "E1", state: "done" },
    { lbl: "E2", state: "done" },
    { lbl: "E3", state: "done" },
    { lbl: "E4", state: "partial" },
    { lbl: "S1", state: "done" },
    { lbl: "S2", state: "done" },
    { lbl: "G1", state: "partial" },
    { lbl: "G2", state: "done" },
  ];
  return (
    <div className="px-3.5 py-3.5 flex flex-col gap-2.5 text-left">
      <div
        className="relative bg-white border border-neutral-200 rounded-lg p-3.5 pb-3"
        style={{ backgroundImage: "linear-gradient(180deg, transparent 0, transparent calc(100% - 24px), #FAFAFA 100%)" }}
      >
        <span
          className="absolute top-2 right-2 w-9 h-9 block"
          aria-hidden
          style={{
            background:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36' fill='none'><circle cx='18' cy='18' r='17' stroke='%23059669' stroke-width='1.4' stroke-dasharray='2 2'/><path d='M11 18l5 5 9-10' stroke='%23059669' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>\") no-repeat center/contain",
          }}
        />
        <div className="font-bold text-[13px] text-slate-900 mb-0.5 pr-12" style={{ fontFamily: "var(--font-display, var(--font-sans))" }}>
          Rapport CSRD · ESRS E1
        </div>
        <div className="font-mono text-[10px] text-slate-400 tracking-[0.04em] mb-2.5">Exercice 2024 · v.1.3 · signé OTI</div>
        <div className="h-[5px] bg-neutral-100 rounded-full my-1.5" style={{ width: "100%" }} />
        <div className="h-[5px] bg-neutral-100 rounded-full my-1.5" style={{ width: "80%" }} />
        <div className="h-[5px] bg-neutral-100 rounded-full my-1.5" style={{ width: "60%" }} />
        <div className="grid grid-cols-4 gap-1.5 mt-2.5">
          {cells.map((c) => (
            <div
              key={c.lbl}
              className={`aspect-square rounded-md border flex flex-col items-center justify-center font-mono text-[9px] font-semibold tracking-[0.04em] ${
                c.state === "done"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {c.lbl}
              <span className={`mt-0.5 ${c.state === "done" ? "text-emerald-600 text-[11px]" : "text-amber-600 text-[9px]"}`}>
                {c.state === "done" ? "✓" : "●"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5">
        {[
          { lbl: "PDF", primary: false },
          { lbl: "Excel", primary: false },
          { lbl: "XBRL", primary: true },
        ].map((b) => (
          <button
            key={b.lbl}
            type="button"
            tabIndex={-1}
            className={`flex-1 px-2 py-1.5 rounded-md font-mono text-[10px] font-semibold tracking-[0.04em] border transition-colors ${
              b.primary
                ? "bg-slate-900 text-white border-slate-900 hover:bg-black hover:border-black"
                : "bg-white text-slate-900 border-neutral-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
            }`}
          >
            {b.lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   STEPS data
   ============================================================ */

const STEPS = [
  {
    num: "01",
    title: "Connectez vos sources",
    desc: "Import Excel structuré, API énergie, fournisseurs. Connecteurs ERP SAP, Oracle et Sage en roadmap.",
    tags: ["Excel · CSV", "API énergie", "SAP · Oracle"],
    meta: "Support technique inclus · Import guidé pas à pas",
    protoBar: { label: "/sources", badge: "3 actives" },
    proto: <ProtoSources />,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
        <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "NEURAL analyse & structure",
    desc: "Notre copilote détecte les anomalies, enrichit vos données avec les facteurs ADEME / IEA et calcule vos scores ESRS.",
    tags: ["ADEME 2024", "Facteurs IEA", "Ecoinvent 3.9"],
    meta: "Détection d'anomalies · Audit trail automatique",
    protoBar: { label: "NEURAL · copilote", badge: "Analyse" },
    proto: <ProtoNeural />,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Rapports prêts pour l'audit",
    desc: "Exportez en PDF, Excel ou format commissaire aux comptes — avec audit trail complet et signature électronique.",
    tags: ["CSRD · ESRS", "XBRL", "Compatible OTI"],
    meta: "Signature électronique · Versioning intégré",
    protoBar: { label: "rapport-csrd-2024.pdf", badge: "Validé" },
    proto: <ProtoReport />,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
];

/* ============================================================
   Section
   ============================================================ */

export function HowItWorksSection({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <section id="how" className="how-bg relative py-32 px-6 md:px-12 overflow-hidden isolate">
      <div className="relative max-w-[1280px] mx-auto">
        {/* Header */}
        <Reveal className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 font-mono">
            <span
              className="how-live-dot h-1.5 w-1.5 rounded-full bg-emerald-600"
              style={{ boxShadow: "0 0 0 4px rgba(5,150,105,.18)" }}
            />
            Mise en route
          </span>
        </Reveal>

        <Reveal delay={0.05} className="text-center mt-5">
          <h2 className="font-extrabold text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.05] tracking-[-0.03em] text-slate-900 text-balance">
            Opérationnel{" "}
            <span
              className="text-emerald-800"
              style={{
                backgroundColor: "rgba(52,211,153,.18)",
                padding: ".04em .22em .08em",
                borderRadius: ".18em",
                WebkitBoxDecorationBreak: "clone",
                boxDecorationBreak: "clone",
              }}
            >
              en 3 étapes
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto text-pretty">
            De l&apos;onboarding à votre premier rapport CSRD prêt pour l&apos;audit — en moins d&apos;une semaine.
          </p>
        </Reveal>

        {/* Timeline */}
        <div className="relative mt-20 md:mt-24">
          {/* Rail desktop */}
          <div
            aria-hidden
            className="hidden md:block absolute left-[calc(16.6667%+1.5rem)] right-[calc(16.6667%+1.5rem)] top-[70px] h-0.5 rounded-full overflow-hidden"
            style={{
              background: "linear-gradient(90deg, rgba(20,83,45,.12) 0%, rgba(5,150,105,.35) 50%, rgba(52,211,153,.55) 100%)",
            }}
          >
            <span className="how-rail-pulse absolute inset-0 block" />
            {[0, 50, 100].map((left) => (
              <span
                key={left}
                className="absolute top-1/2 h-2.5 w-2.5 rounded-full bg-white border-2 border-emerald-600 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, boxShadow: "0 0 0 4px rgba(5,150,105,.1)" }}
              />
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={0.12 * i} className="group relative flex flex-col items-center text-center px-2">
                {/* Numéro géant + disque icône */}
                <div className="relative mb-7 h-[140px] w-[180px] flex items-center justify-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center font-extrabold leading-none select-none transition-all duration-700"
                    style={{
                      fontSize: "140px",
                      letterSpacing: "-0.05em",
                      color: "transparent",
                      WebkitTextStroke: "1.4px rgba(15,23,42,0.07)",
                      backgroundImage: "linear-gradient(180deg, rgba(5,150,105,.08) 0%, rgba(5,150,105,0) 70%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                    }}
                  >
                    {step.num}
                  </span>
                  <div
                    className="relative z-[2] flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-white border border-neutral-200 text-emerald-800 transition-all duration-500 group-hover:-translate-y-[3px] group-hover:scale-[1.04] group-hover:border-emerald-200"
                    style={{
                      boxShadow:
                        "0 1px 2px rgba(15,23,42,.04), 0 12px 32px -12px rgba(15,23,42,.12), 0 0 0 6px rgba(255,255,255,.9), inset 0 0 0 1px rgba(255,255,255,.6)",
                    }}
                  >
                    {step.icon}
                  </div>
                </div>

                <h3 className="font-bold text-[22px] tracking-[-0.015em] text-slate-900 mb-2.5">{step.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-slate-500 max-w-[320px] mb-5 text-pretty">{step.desc}</p>

                {/* Proto UI */}
                <div className="w-full max-w-[380px] mb-5 rounded-xl bg-white border border-neutral-200 overflow-hidden transition-all duration-500 group-hover:-translate-y-1"
                  style={{
                    boxShadow:
                      "0 1px 0 rgba(15,23,42,.02), 0 24px 48px -28px rgba(15,23,42,.18), 0 8px 24px -16px rgba(5,150,105,.1)",
                  }}
                >
                  <ProtoBar label={step.protoBar.label} badge={step.protoBar.badge} />
                  {step.proto}
                </div>

                {/* Tags techniques */}
                <div className="flex flex-wrap justify-center gap-1.5 mb-1">
                  {step.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center font-mono text-[11px] font-medium text-slate-700 bg-white border border-neutral-200 rounded-md px-2.5 py-[5px] transition-colors duration-200 group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-800"
                    >
                      <span className="mr-[7px] inline-block h-[5px] w-[5px] rounded-full bg-emerald-400" />
                      {t}
                    </span>
                  ))}
                </div>

                <p className="mt-3 font-mono text-[11px] tracking-[0.04em] text-slate-400">{step.meta}</p>
              </Reveal>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Reveal delay={0.34} className="mt-20 md:mt-24 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={onEnterApp}
            className="group inline-flex items-center gap-2.5 rounded-full bg-slate-900 text-white font-semibold text-[15px] px-7 py-4 cursor-pointer transition-all duration-200 hover:bg-black hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-[3px]"
            style={{ boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 12px 24px -10px rgba(15,23,42,.4)" }}
          >
            Commencer mon onboarding
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-emerald-600 transition-transform duration-300 group-hover:translate-x-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-white">
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 text-[13px] text-slate-400">
            {["Aucune carte requise", "Onboarding accompagné", "< 1 semaine"].map((label, idx) => (
              <span key={label} className="inline-flex items-center gap-3.5">
                {idx > 0 && <span className="h-[3px] w-[3px] rounded-full bg-slate-300" />}
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-600">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {label}
                </span>
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
