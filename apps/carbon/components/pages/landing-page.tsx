"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InteractiveDashboardMockup } from "../landing/mockup/interactive-dashboard-mockup";
import { HOTSPOT_TO_SCREEN } from "../landing/mockup/mockup-data";
import type { ScreenId } from "../landing/mockup/mockup-data";

interface LandingPageProps {
  onEnterApp: () => void;
}

/* ── Scroll-reveal hook ── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ── CountUp animé déclenché au scroll ── */
function CountUp({ target, suffix = "", decimals = 0, duration = 1800 }: { target: number; suffix?: string; decimals?: number; duration?: number }) {
  const { ref, visible } = useReveal(0.3);
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(parseFloat((eased * target).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [visible, target, decimals, duration]);

  return (
    <span ref={ref}>
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
      {suffix}
    </span>
  );
}

/* ── Dashboard Hotspot types ── */
interface HotspotPosition { x: number; y: number; }

interface DashboardHotspot {
  id: string;
  label: string;
  description: string;
  hotspotPosition: HotspotPosition;
  labelPosition: HotspotPosition;
  side: "left" | "right";
  color: string;
}

const DASHBOARD_HOTSPOTS: DashboardHotspot[] = [
  {
    id: "scopes",
    label: "Scopes 1, 2, 3",
    description: "Visualisation en temps reel de vos emissions par scope selon le GHG Protocol. Ventilation automatique par poste et site.",
    hotspotPosition: { x: 33, y: 40 },
    labelPosition: { x: 7, y: 28 },
    side: "left",
    color: "#16a34a",
  },
  {
    id: "kpis",
    label: "KPIs Carbone",
    description: "Indicateurs cles : total tCO2e, evolution Year-over-Year, trajectoire SBTi, benchmark sectoriel.",
    hotspotPosition: { x: 53, y: 22 },
    labelPosition: { x: 50, y: 6 },
    side: "right",
    color: "#0891b2",
  },
  {
    id: "postes",
    label: "Postes d'emission",
    description: "Detail par poste (energie, transport, achats, numerique...) avec ventilation automatique et facteurs ADEME/IEA.",
    hotspotPosition: { x: 71, y: 44 },
    labelPosition: { x: 93, y: 30 },
    side: "right",
    color: "#7c3aed",
  },
  {
    id: "actions",
    label: "Plan d'action IA",
    description: "Recommandations generees par le copilote NEURAL pour reduire vos emissions prioritaires, chiffrees et priorisees.",
    hotspotPosition: { x: 71, y: 67 },
    labelPosition: { x: 93, y: 68 },
    side: "right",
    color: "#ea580c",
  },
  {
    id: "rapports",
    label: "Rapports CSRD",
    description: "Generation automatique de rapports conformes CSRD, CDP, Bilan Carbone. Format auditeur pret pour signature.",
    hotspotPosition: { x: 33, y: 80 },
    labelPosition: { x: 8, y: 78 },
    side: "left",
    color: "#16a34a",
  },
];

/* ── Hotspot Label sub-component ── */
function HotspotLabel({ hotspot, isActive, onHover, onClick, index }: { hotspot: DashboardHotspot; isActive: boolean; onHover: (id: string | null) => void; onClick: (id: string) => void; index: number }) {
  return (
    <motion.div
      className="absolute z-20 hidden md:block"
      style={{ left: `${hotspot.labelPosition.x}%`, top: `${hotspot.labelPosition.y}%`, transform: "translate(-50%, -50%)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.8 + index * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => onHover(hotspot.id)}
      onMouseLeave={() => onHover(null)}
    >
      <motion.div
        className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer border transition-all duration-300 select-none whitespace-nowrap"
        style={isActive
          ? { background: `${hotspot.color}ee`, borderColor: hotspot.color, color: "#fff", boxShadow: `0 8px 24px ${hotspot.color}40` }
          : { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }
        }
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClick(hotspot.id)}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: isActive ? "#fff" : hotspot.color }}
          />
          <span
            className="relative inline-flex rounded-full h-2.5 w-2.5"
            style={{ background: isActive ? "#fff" : hotspot.color }}
          />
        </span>
        <span className="text-sm font-semibold tracking-wide">{hotspot.label}</span>
      </motion.div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute mt-2 px-4 py-3 rounded-xl text-xs leading-relaxed max-w-[240px] shadow-xl"
            style={{
              background: "rgba(15,23,42,0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
              ...(hotspot.side === "left" ? { left: 0 } : { right: 0 }),
            }}
          >
            {hotspot.description}
            <div
              className="absolute -top-1.5 w-3 h-3 rotate-45"
              style={{
                background: "rgba(15,23,42,0.95)",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                ...(hotspot.side === "left" ? { left: 24 } : { right: 24 }),
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Connection Line SVG sub-component ── */
function ConnectionLineSVG({ hotspot, isActive, index, width, height }: { hotspot: DashboardHotspot; isActive: boolean; index: number; width: number; height: number }) {
  const startX = (hotspot.hotspotPosition.x / 100) * width;
  const startY = (hotspot.hotspotPosition.y / 100) * height;
  const endX = (hotspot.labelPosition.x / 100) * width;
  const endY = (hotspot.labelPosition.y / 100) * height;
  const gradId = `line-grad-${hotspot.id}`;

  return (
    <svg className="absolute inset-0 z-10 pointer-events-none hidden md:block" width={width} height={height}>
      <defs>
        <linearGradient id={gradId} x1={startX} y1={startY} x2={endX} y2={endY} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isActive ? hotspot.color : "#ffffff"} stopOpacity={isActive ? 0.8 : 0.25} />
          <stop offset="100%" stopColor={isActive ? hotspot.color : "#ffffff"} stopOpacity={isActive ? 0.4 : 0.08} />
        </linearGradient>
      </defs>
      <motion.line
        x1={startX} y1={startY} x2={endX} y2={endY}
        stroke={`url(#${gradId})`}
        strokeWidth={isActive ? 1.5 : 1}
        strokeDasharray={isActive ? "none" : "4 4"}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 + index * 0.15, ease: "easeInOut" }}
      />
      <motion.circle
        cx={startX} cy={startY}
        r={isActive ? 6 : 4}
        fill={isActive ? hotspot.color : `${hotspot.color}99`}
        stroke={isActive ? "#fff" : "rgba(255,255,255,0.3)"}
        strokeWidth={isActive ? 2 : 1}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 + index * 0.15, type: "spring", stiffness: 300 }}
      />
      {isActive && (
        <motion.circle
          cx={startX} cy={startY} r={6}
          fill="none" stroke={hotspot.color} strokeWidth={1}
          initial={{ r: 6, opacity: 0.6 }}
          animate={{ r: 18, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </svg>
  );
}

/* ── Dashboard Showcase (Interactive Hotspots) ── */
function DashboardShowcase({ onEnterApp }: { onEnterApp: () => void }) {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenId>("overview");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleHotspotClick = useCallback((hotspotId: string) => {
    const screen = HOTSPOT_TO_SCREEN[hotspotId];
    if (screen) setActiveScreen(screen);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateSize]);

  return (
    <section className="py-32 px-8 md:px-12 bg-[#f9f9fb] overflow-hidden">
      <div className="max-w-[1440px] mx-auto">
        <Reveal className="text-center mb-4">
          <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Explorer le dashboard</span>
        </Reveal>
        <Reveal className="text-center mb-4" delay={0.05}>
          <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
            Votre Bilan Carbone,{" "}
            <span style={{ background: "linear-gradient(135deg, #16a34a 0%, #059669 40%, #0891b2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              en un coup d&apos;oeil.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="text-center mb-16">
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
            Survolez les zones cles pour decouvrir chaque dimension de votre empreinte carbone.
          </p>
        </Reveal>

        {/* Interactive dashboard container */}
        <Reveal delay={0.15} className="max-w-5xl mx-auto">
          {/* Outer wrapper: holds ref + hotspot overlays, NOT overflow-hidden */}
          <div ref={containerRef} className="relative px-16 md:px-24">
            {/* Inner: premium device frame with overflow-hidden */}
            <div
              className="relative rounded-[20px] overflow-hidden bg-neutral-950"
              style={{
                boxShadow: `
                  0 0 0 1px rgba(255,255,255,0.06),
                  0 2px 4px rgba(0,0,0,0.08),
                  0 8px 20px rgba(0,0,0,0.12),
                  0 20px 48px rgba(0,0,0,0.16),
                  0 40px 80px rgba(0,0,0,0.12)
                `,
              }}
            >
            {/* Premium browser chrome */}
            <div className="absolute top-0 left-0 right-0 h-10 md:h-11 bg-gradient-to-b from-[#1e293b] to-[#171f2e] flex items-center px-4 gap-2 z-30 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ff5f57]/80" />
                <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#febc2e]/80" />
                <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#28c840]/80" />
              </div>
              <div className="flex gap-0.5 ml-2">
                <span className="w-5 h-5 rounded flex items-center justify-center text-white/20">
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="w-5 h-5 rounded flex items-center justify-center text-white/20">
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M4 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-1 md:py-1.5 max-w-[280px] w-full border border-white/[0.04]">
                  <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-400 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[9px] md:text-[10px] text-white/50 truncate">app.carbonco.fr/dashboard</span>
                </div>
              </div>
              <div className="flex gap-1">
                <span className="w-5 h-5 rounded flex items-center justify-center text-white/15">
                  <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
                </span>
              </div>
            </div>

            {/* Dashboard content area */}
            <div className="pt-10 md:pt-11 bg-[#0F172A] min-h-[420px] md:min-h-[520px] relative">
              <div className="absolute inset-0 pt-10 md:pt-11">
                <InteractiveDashboardMockup
                  activeScreen={activeScreen}
                  onNavigate={setActiveScreen}
                />
              </div>
            </div>

            {/* Subtle screen reflection */}
            <div className="absolute inset-0 pointer-events-none rounded-[20px]" style={{ background: "linear-gradient(165deg, rgba(255,255,255,0.025) 0%, transparent 35%)" }} />
            </div>{/* end inner overflow-hidden frame */}

            {/* Connection lines SVG overlay — outside overflow-hidden */}
            {containerSize.width > 0 && DASHBOARD_HOTSPOTS.map((hotspot, index) => (
              <ConnectionLineSVG
                key={`line-${hotspot.id}`}
                hotspot={hotspot}
                isActive={activeHotspot === hotspot.id}
                index={index}
                width={containerSize.width}
                height={containerSize.height}
              />
            ))}

            {/* Hotspot labels — outside overflow-hidden */}
            {DASHBOARD_HOTSPOTS.map((hotspot, index) => (
              <HotspotLabel
                key={hotspot.id}
                hotspot={hotspot}
                isActive={activeHotspot === hotspot.id}
                onHover={setActiveHotspot}
                onClick={handleHotspotClick}
                index={index}
              />
            ))}
          </div>{/* end outer ref wrapper */}

          {/* Decorative device stand */}
          <div className="hidden md:flex flex-col items-center">
            <div className="w-16 h-4 bg-gradient-to-b from-neutral-300 to-neutral-400 rounded-b-md" style={{ clipPath: "polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)" }} />
            <div className="w-28 h-1.5 bg-gradient-to-b from-neutral-400 to-neutral-500 rounded-b-lg" />
          </div>
        </Reveal>

        {/* Mobile: feature list (replaces hotspots) */}
        <div className="md:hidden mt-8 space-y-3 max-w-5xl mx-auto">
          {DASHBOARD_HOTSPOTS.map((hotspot) => (
            <Reveal key={hotspot.id} delay={0.05}>
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-neutral-200 shadow-sm">
                <span className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: hotspot.color }} />
                <div>
                  <p className="text-sm font-semibold text-black">{hotspot.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{hotspot.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Feature cards under dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-12 md:mt-16 max-w-5xl mx-auto">
          {[
            { icon: "🔗", title: "Collecte automatisee", desc: "Import depuis vos ERP, APIs et fichiers existants" },
            { icon: "📐", title: "Calcul GHG Protocol", desc: "Methodologie certifiee Scopes 1, 2, 3" },
            { icon: "🤖", title: "IA Recommandations", desc: "Plans d'action personnalises et priorises" },
            { icon: "📄", title: "Rapports conformes", desc: "CSRD, CDP, Bilan Carbone en 1 clic" },
          ].map((f, i) => (
            <Reveal key={f.title} delay={0.08 * i}>
              <div className="flex flex-col items-center text-center p-4 md:p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
                <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center mb-3">
                  <span className="text-xl">{f.icon}</span>
                </div>
                <h4 className="text-black font-semibold text-sm md:text-base mb-1">{f.title}</h4>
                <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* CTA */}
        <Reveal delay={0.3} className="text-center mt-12">
          <button onClick={onEnterApp} className="bg-black text-white px-8 py-4 rounded-full font-bold text-base cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
            Explorer le dashboard →
          </button>
          <p className="text-xs text-neutral-400 mt-3">Essai gratuit 14 jours · Aucune carte requise</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ */
export function LandingPage({ onEnterApp }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  return (
    <div className="min-h-screen bg-[#f9f9fb] text-[#1a1c1d] font-sans overflow-x-hidden">

      {/* ═══ NAV ═══ */}
      <nav
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={scrolled ? {
          background: "rgba(255,255,255,0.90)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        } : { background: "transparent" }}
        role="navigation"
        aria-label="Navigation principale"
      >
        <div className="flex justify-between items-center px-8 md:px-12 py-5 max-w-[1440px] mx-auto">
          <div className="text-2xl font-extrabold tracking-tighter text-black">Carbon<span className="text-green-600">&</span>Co</div>

          <div className="hidden md:flex items-center gap-8">
            {[["#hero","Accueil"],["#about","Pourquoi CarbonCo"],["#features","Fonctionnalités"],["#how","Comment ça marche"],["#pricing","Tarifs"],["#video-section","Démo"]].map(([href,label]) => (
              <a key={href} href={href} className="text-sm font-semibold text-neutral-500 hover:text-black transition-colors tracking-wide">{label}</a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button onClick={onEnterApp} className="border border-neutral-300 text-black px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-neutral-50 transition-colors cursor-pointer">
              Se connecter
            </button>
            <button onClick={onEnterApp} className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-colors cursor-pointer">
              Essai gratuit — 14j
            </button>
          </div>
          <button
            className="md:hidden w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        <div className="md:hidden overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: mobileMenuOpen ? 500 : 0, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)" }}>
          <div className="flex flex-col px-8 pb-6 pt-2 border-t border-neutral-100">
            {[["#hero","Accueil"],["#about","Pourquoi CarbonCo"],["#features","Fonctionnalités"],["#how","Comment ça marche"],["#pricing","Tarifs"]].map(([href,label]) => (
              <a key={href} href={href} className="text-sm font-semibold text-neutral-600 py-3 border-b border-neutral-100 hover:text-black transition-colors" onClick={() => setMobileMenuOpen(false)}>{label}</a>
            ))}
            <div className="flex gap-3 mt-4">
              <button onClick={onEnterApp} className="flex-1 border border-neutral-300 text-black py-3 rounded-xl font-semibold text-sm cursor-pointer">Se connecter</button>
              <button onClick={onEnterApp} className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm cursor-pointer">Essai gratuit</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-20">

        {/* ══ 1. HERO ══ */}
        <section id="hero" className="relative min-h-[95vh] flex items-center px-8 md:px-12 overflow-hidden bg-white">
          {/* Mesh background */}
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(22,163,74,0.06) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(8,145,178,0.05) 0%, transparent 50%)" }} />

          <div className="grid lg:grid-cols-2 gap-16 items-center w-full max-w-[1440px] mx-auto py-24">
            {/* Left */}
            <Reveal className="z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 mb-8">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-700 tracking-wide uppercase">Plateforme ESG & CSRD augmentée par l&apos;IA</span>
              </div>

              <h1 className="font-extrabold text-[3.8rem] md:text-[5rem] leading-[0.92] tracking-tighter mb-6">
                <span className="text-black">Votre conformité</span>
                <br />
                <span className="text-black">CSRD,</span>{" "}
                <span style={{ background: "linear-gradient(135deg, #16a34a 0%, #059669 40%, #0891b2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  automatisée.
                </span>
              </h1>

              <p className="text-xl text-neutral-500 max-w-lg mb-10 leading-relaxed">
                Collectez, analysez et générez vos rapports ESRS en quelques clics — pas en quelques mois.
                Hébergement souverain, IA conforme EU AI Act.
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                <button onClick={onEnterApp} className="bg-black text-white px-8 py-4 rounded-full font-bold text-base cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                  Démarrer gratuitement — 14 jours
                </button>
                <a href="#video-section" className="flex items-center gap-2.5 bg-neutral-100 text-black px-7 py-4 rounded-full font-bold text-base transition-all duration-200 hover:bg-neutral-200 hover:scale-105">
                  <span className="w-6 h-6 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                  </span>
                  Voir la démo en 2 min
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-400">
                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>Aucune carte bancaire</span>
                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>Conforme ESRS 2025</span>
                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>Hébergement OVH France</span>
              </div>
            </Reveal>

            {/* Right — robot + badges flottants */}
            <Reveal delay={0.2} className="relative flex justify-center lg:justify-end mt-8 lg:mt-0">
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 55%, rgba(22,163,74,0.18) 0%, rgba(8,145,178,0.10) 50%, transparent 80%)", filter: "blur(28px)" }} />

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-full max-w-sm md:max-w-lg aspect-square rounded-3xl overflow-hidden shadow-2xl bg-neutral-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/neural-android.webp" alt="NEURAL — Assistant IA CarbonCo" className="w-full h-full object-cover" />
              </motion.div>

              {/* Badge disponibilité */}
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-4 left-0 lg:-left-6 bg-white rounded-2xl px-5 py-4 shadow-xl border border-neutral-100 z-20">
                <div className="text-2xl font-extrabold text-black">99.9%</div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">SLA Garanti</div>
              </motion.div>

              {/* Badge IA active */}
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, delay: 1.5, repeat: Infinity, ease: "easeInOut" }} className="absolute top-6 left-0 lg:-left-8 bg-white rounded-2xl px-4 py-3 shadow-xl border border-neutral-100 z-20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 1l2.928 6.472L20 8.354l-5.072 4.572L16.18 20 10 16.472 3.82 20l1.252-7.074L0 8.354l7.072-.882L10 1z" /></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-black">NEURAL Actif</div>
                  <div className="text-xs text-neutral-500">v2.4 · ESRS native</div>
                </div>
              </motion.div>

              {/* Badge rapport généré */}
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, delay: 0.8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/2 -right-2 lg:-right-8 bg-green-600 rounded-2xl px-4 py-3 shadow-xl z-20 flex items-center gap-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <div>
                  <div className="text-xs font-bold text-white">Rapport E1 généré</div>
                  <div className="text-xs text-green-200">Il y a 3 minutes</div>
                </div>
              </motion.div>
            </Reveal>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
            <span className="text-xs text-neutral-400 tracking-widest uppercase font-medium">Défiler</span>
            <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
              <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </motion.div>
          </div>
        </section>

        {/* ══ 2. TRUST BAR — LOGOS + STATS CountUp ══ */}
        <section className="py-14 bg-white border-y border-neutral-100">
          <div className="max-w-[1440px] mx-auto px-8 md:px-12">
            <p className="text-xs uppercase tracking-widest text-neutral-400 font-semibold text-center mb-8">Ils nous font confiance</p>
            <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap mb-12">
              {["Vinci", "Société Générale", "Schneider Electric", "TotalEnergies", "Veolia", "Danone", "Michelin"].map((name) => (
                <span key={name} className="text-base md:text-lg font-bold text-neutral-300 hover:text-neutral-600 transition-colors whitespace-nowrap cursor-default">
                  {name}
                </span>
              ))}
            </div>

            {/* Stats avec CountUp */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-neutral-100 pt-10">
              {[
                { target: 120, suffix: "+", label: "Entreprises clientes", decimals: 0 },
                { target: 87, suffix: "%", label: "Réduction du temps de reporting", decimals: 0 },
                { target: 4.8, suffix: "/5", label: "Satisfaction client", decimals: 1 },
                { target: 12, suffix: " ESRS", label: "Standards intégrés nativement", decimals: 0 },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-4xl md:text-5xl font-extrabold text-black mb-1">
                    <CountUp target={s.target} suffix={s.suffix} decimals={s.decimals} />
                  </div>
                  <div className="text-xs text-neutral-500 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 3. PROBLÈME → SOLUTION ══ */}
        <section id="about" className="py-32 px-8 md:px-12 bg-[#f9f9fb]">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-4">
              <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Le problème</span>
            </Reveal>
            <Reveal className="text-center mb-6" delay={0.05}>
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black mb-5">
                Votre reporting ESG ressemble à ça ?
              </h2>
              <p className="text-lg text-neutral-600 max-w-3xl mx-auto leading-relaxed">
                Depuis 2025, toutes les <strong className="text-black">grandes entreprises et ETI européennes</strong> doivent publier un rapport ESG détaillé
                — y compris sur les émissions indirectes de leurs fournisseurs, leurs serveurs ou leurs locaux.
                Les nouvelles règles se durcissent chaque année.
                Pourtant, <strong className="text-black">7 entreprises sur 10</strong> n&apos;ont toujours aucun processus fiable pour collecter ces données.
              </p>
            </Reveal>
            <Reveal className="text-center mb-16" delay={0.1}>
              <div className="inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Pénalités jusqu&apos;à <strong className="text-neutral-800">2% du CA mondial</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Deadline rapport ESRS : <strong className="text-neutral-800">exercice 2025</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Marché ESG projeté : <strong className="text-neutral-800">53 Mds € en 2027</strong>
                </span>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-8">
              <Reveal delay={0.15} className="bg-red-50 rounded-2xl p-8 border border-red-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-red-800">Sans CarbonCo</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    ["Fichiers Excel dispersés entre équipes", "4 mois de collecte pour un rapport"],
                    ["Risque d'erreurs et d'incohérences", "Pas de traçabilité pour l'auditeur"],
                    ["Conformité ESRS incertaine", "Pénalités de non-conformité jusqu'à 2% du CA"],
                    ["Ressources mobilisées à plein temps", "Stress des équipes RSE avant deadline"],
                    ["Difficile de communiquer la performance", "Perte d'attractivité investisseurs ESG"],
                    ["Émissions IT & datacenters ignorées", "Scope 3 cat. 8 : serveurs, cloud, SaaS — un angle mort fréquent"],
                    ["Consommation des locaux non mesurée", "Chauffage, climatisation, open spaces exclus du périmètre de reporting"],
                  ].map(([title, sub]) => (
                    <li key={title} className="flex items-start gap-3 text-red-800">
                      <span className="mt-1 w-5 h-5 flex-shrink-0 rounded-full bg-red-200 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{title}</div>
                        <div className="text-xs text-red-600/70 mt-0.5">{sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={0.25} className="bg-green-50 rounded-2xl p-8 border border-green-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -translate-x-4 -translate-y-8" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-green-800">Avec CarbonCo</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    ["Données centralisées en temps réel", "Synchronisation ERP, API, Excel en continu"],
                    ["Collecte automatisée par NEURAL", "−87% de temps de reporting en moyenne"],
                    ["Audit trail et traçabilité totale", "Chaque donnée tracée avec sa source et méthode"],
                    ["Conformité ESRS 2026 garantie", "12 standards ESRS + guidelines EFRAG mars 2026 intégrées"],
                    ["Rapports générés en 1 clic", "PDF, Excel, format auditeur — prêt pour signature"],
                    ["Scope 3 numérique automatisé", "Émissions serveurs, cloud & SaaS calculées via bases Boavizta & IEA"],
                    ["Bilan énergétique des locaux intégré", "Chauffage, clim, éclairage — facteurs ADEME appliqués par zone et m²"],
                  ].map(([title, sub]) => (
                    <li key={title} className="flex items-start gap-3 text-green-800">
                      <span className="mt-1 w-5 h-5 flex-shrink-0 rounded-full bg-green-200 flex items-center justify-center">
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{title}</div>
                        <div className="text-xs text-green-700/70 mt-0.5">{sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══ 4. FONCTIONNALITÉS CLÉS ══ */}
        <section id="features" className="py-32 px-8 md:px-12 bg-white">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-4">
              <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Fonctionnalités</span>
            </Reveal>
            <Reveal className="text-center mb-4" delay={0.05}>
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Tout ce dont vous avez besoin
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="text-center mb-16">
              <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
                Une plateforme complète pour piloter votre ESG de A à Z, de la collecte à la publication.
              </p>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  color: "blue", icon: (
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                  ),
                  title: "Dashboard ESG temps réel",
                  desc: "Visualisez vos KPIs carbone, eau, social et gouvernance sur un tableau de bord unifié. Alertes automatiques en cas d'anomalie.",
                  highlights: ["Scope 1, 2 & 3", "Benchmark sectoriel", "Alertes intelligentes"],
                },
                {
                  color: "purple", icon: (
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
                  ),
                  title: "Copilote NEURAL",
                  desc: "Posez vos questions en langage naturel. NEURAL analyse vos données, détecte les risques et suggère des plans d'action chiffrés.",
                  highlights: ["Langage naturel", "Plans d'action IA", "Conforme EU AI Act"],
                },
                {
                  color: "orange", icon: (
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  ),
                  title: "Rapports automatisés",
                  desc: "Générez vos rapports CSRD, GHG Protocol et Taxonomie verte en un clic. Format auditeur, prêts pour la signature électronique.",
                  highlights: ["CSRD natif", "GHG Protocol", "Taxonomie UE"],
                },
                {
                  color: "green", icon: (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                  ),
                  title: "ESRS 2025 natif",
                  desc: "12 standards ESRS intégrés nativement avec suivi de progression, alertes de non-conformité et guidance par thème.",
                  highlights: ["12 standards ESRS", "Suivi progression", "Guidance expert"],
                },
              ].map((card, i) => {
                const bgMap: Record<string,string> = { blue: "bg-blue-50", purple: "bg-purple-50", orange: "bg-orange-50", green: "bg-green-50" };
                const dotMap: Record<string,string> = { blue: "bg-blue-500", purple: "bg-purple-500", orange: "bg-orange-500", green: "bg-green-500" };
                return (
                  <Reveal key={card.title} delay={0.08 * i} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-7 hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col">
                    <div className={`w-12 h-12 rounded-xl ${bgMap[card.color]} flex items-center justify-center mb-5`}>{card.icon}</div>
                    <h3 className="font-bold text-lg text-black mb-3">{card.title}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed mb-5 flex-1">{card.desc}</p>
                    <div className="flex flex-col gap-1.5">
                      {card.highlights.map((h) => (
                        <div key={h} className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${dotMap[card.color]} flex-shrink-0`} />
                          <span className="text-xs text-neutral-600 font-medium">{h}</span>
                        </div>
                      ))}
                    </div>
                  </Reveal>
                );
              })}
            </div>

            {/* Feature highlight secondaire */}
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              {[
                { emoji: "🔌", title: "Connecteurs ERP", desc: "SAP, Oracle, Sage, Cegid — intégration en 2 jours" },
                { emoji: "🛡️", title: "Audit trail complet", desc: "Traçabilité totale de chaque donnée pour l'OTI" },
                { emoji: "📊", title: "Benchmark sectoriel", desc: "Comparez-vous aux leaders de votre industrie" },
                { emoji: "🌐", title: "Multi-sites & filiales", desc: "Consolidation automatique des données groupe" },
                { emoji: "🤝", title: "Collaboratif", desc: "Espaces de travail par thème ESG, rôles et droits" },
                { emoji: "📱", title: "Mobile-first", desc: "Accès depuis tous vos appareils, n'importe où" },
              ].map((f) => (
                <Reveal key={f.title} delay={0.05} className="flex items-start gap-4 p-5 bg-[#f9f9fb] rounded-xl border border-neutral-100 hover:border-neutral-200 transition-colors">
                  <span className="text-2xl">{f.emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-black mb-0.5">{f.title}</div>
                    <div className="text-xs text-neutral-500">{f.desc}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 5. DASHBOARD INTERACTIF — HOTSPOTS ══ */}
        <DashboardShowcase onEnterApp={onEnterApp} />

        {/* ══ 6. COMMENT ÇA MARCHE — timeline connectée ══ */}
        <section id="how" className="py-32 px-8 md:px-12 bg-white">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-4">
              <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Mise en route</span>
            </Reveal>
            <Reveal className="text-center mb-20" delay={0.05}>
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Opérationnel en 3 étapes
              </h2>
              <p className="text-lg text-neutral-500 mt-4">De l&apos;onboarding à votre premier rapport en moins d&apos;une semaine.</p>
            </Reveal>

            <div className="relative">
              {/* Timeline line */}
              <div className="hidden md:block absolute top-16 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-green-300" />

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    num: "01", color: "blue", icon: (
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                    ),
                    title: "Connectez vos sources",
                    desc: "ERP (SAP, Oracle, Sage), API énergie, fichiers Excel, fournisseurs. CarbonCo agrège tout en quelques heures.",
                    detail: "Support technique inclus · Connecteurs certifiés ISO 27001",
                  },
                  {
                    num: "02", color: "purple", icon: (
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                    ),
                    title: "NEURAL analyse & structure",
                    desc: "Notre copilote détecte les anomalies, enrichit les données avec les facteurs ADEME/IEA et calcule vos scores ESRS.",
                    detail: "Base ADEME 2024 · Facteurs IEA · Ecoinvent 3.9",
                  },
                  {
                    num: "03", color: "green", icon: (
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    ),
                    title: "Rapports prêts pour l'audit",
                    desc: "Exportez vos rapports CSRD en PDF, Excel ou format commissaire aux comptes. Audit trail complet inclus.",
                    detail: "Compatible OTI · Format XBRL disponible · Signature électronique",
                  },
                ].map((step, i) => {
                  const bgMap: Record<string,string> = { blue: "bg-blue-50", purple: "bg-purple-50", green: "bg-green-50" };
                  const borderMap: Record<string,string> = { blue: "border-blue-200", purple: "border-purple-200", green: "border-green-200" };
                  const numMap: Record<string,string> = { blue: "text-blue-200", purple: "text-purple-200", green: "text-green-200" };
                  return (
                    <Reveal key={step.num} delay={0.12 * i} className="text-center relative">
                      <div className="text-[7rem] font-black leading-none mb-4 select-none" style={{ color: step.color === "blue" ? "#dbeafe" : step.color === "purple" ? "#ede9fe" : "#dcfce7" }}>{step.num}</div>
                      <div className={`w-16 h-16 rounded-2xl ${bgMap[step.color]} border ${borderMap[step.color]} flex items-center justify-center mx-auto mb-6 -mt-10 relative z-10`}>
                        {step.icon}
                      </div>
                      <h3 className="font-bold text-xl text-black mb-3">{step.title}</h3>
                      <p className="text-neutral-500 text-sm leading-relaxed mb-3 max-w-xs mx-auto">{step.desc}</p>
                      <p className="text-xs text-neutral-400 font-medium">{step.detail}</p>
                    </Reveal>
                  );
                })}
              </div>
            </div>

            <Reveal delay={0.3} className="text-center mt-16">
              <button onClick={onEnterApp} className="bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:bg-neutral-800 transition-colors cursor-pointer hover:scale-105 transition-transform">
                Commencer mon onboarding →
              </button>
              <p className="text-xs text-neutral-400 mt-3">Aucune carte requise · Onboarding accompagné</p>
            </Reveal>
          </div>
        </section>

        {/* ══ 7. TÉMOIGNAGES avec métriques ══ */}
        <section className="py-32 px-8 md:px-12 bg-[#f9f9fb]">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-4">
              <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Ils témoignent</span>
            </Reveal>
            <Reveal className="text-center mb-16" delay={0.05}>
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Ce que disent nos clients
              </h2>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "Le reporting CSRD qui nous prenait 4 mois se fait maintenant en 3 semaines. Le copilote IA est particulièrement bluffant pour la collecte Scope 3.",
                  name: "Marie L.",
                  title: "Directrice RSE, Vinci",
                  initials: "ML",
                  metrics: [{ val: "−87%", label: "temps de reporting" }, { val: "100%", label: "conformité ESRS" }],
                  stars: 5,
                },
                {
                  quote: "L'intégration avec notre ERP SAP a été réalisée en 2 jours. Le niveau de détail dans le benchmark sectoriel nous permet de nous positionner clairement.",
                  name: "Thomas M.",
                  title: "CFO, Groupe Schneider",
                  initials: "TM",
                  metrics: [{ val: "2j", label: "intégration ERP" }, { val: "−34%", label: "émissions Scope 2" }],
                  stars: 5,
                },
                {
                  quote: "Enfin une solution qui comprend vraiment les exigences ESRS E1 et G1. Notre commissaire aux comptes a validé nos données du premier coup.",
                  name: "Sophie R.",
                  title: "Responsable ESG, TotalEnergies",
                  initials: "SR",
                  metrics: [{ val: "1er", label: "audit validé d'emblée" }, { val: "4.9/5", label: "satisfaction équipe" }],
                  stars: 5,
                },
              ].map((t) => (
                <Reveal key={t.name} delay={0.08} className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-100 flex flex-col hover:shadow-md transition-shadow">
                  {/* Étoiles */}
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" /></svg>
                    ))}
                  </div>
                  <div className="text-4xl text-green-200 font-serif leading-none mb-3">&ldquo;</div>
                  <p className="text-neutral-700 text-sm leading-relaxed flex-1 mb-6">{t.quote}</p>
                  {/* Métriques */}
                  <div className="grid grid-cols-2 gap-3 mb-6 bg-green-50 rounded-xl p-3">
                    {t.metrics.map((m) => (
                      <div key={m.label} className="text-center">
                        <div className="text-lg font-extrabold text-green-700">{m.val}</div>
                        <div className="text-xs text-green-600/70">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-neutral-100 pt-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{t.initials}</span>
                    </div>
                    <div>
                      <div className="font-bold text-sm text-black">{t.name}</div>
                      <div className="text-xs text-neutral-500">{t.title}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 8. TARIFS ══ */}
        <section id="pricing" className="py-32 px-8 md:px-12 bg-white">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-4">
              <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Tarification</span>
            </Reveal>
            <Reveal className="text-center mb-4" delay={0.05}>
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Des tarifs transparents, sans surprise
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="text-center mb-16">
              <p className="text-neutral-500 text-lg">Choisissez le plan adapté · Essai gratuit 14 jours · Aucune carte requise</p>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8 items-start max-w-5xl mx-auto">
              {/* Essentials */}
              <Reveal delay={0.1} className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Essentials</div>
                <div className="text-4xl font-extrabold text-black mb-1">490 €<span className="text-base font-medium text-neutral-400">/mois</span></div>
                <p className="text-neutral-500 text-sm mb-8">Pour les PME démarrant leur démarche ESG</p>
                <ul className="space-y-3 mb-8">
                  {["3 utilisateurs", "Scopes 1 & 2", "5 ESRS standards", "Rapports PDF de base", "Support email 5j/7"].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-neutral-700">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} className="w-full bg-neutral-100 text-black py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-colors cursor-pointer">
                  Commencer l&apos;essai
                </button>
              </Reveal>

              {/* Business — Populaire */}
              <Reveal delay={0.15} className="bg-white rounded-2xl p-8 border-2 border-green-500 shadow-xl relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">Le plus populaire</span>
                </div>
                <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">Business</div>
                <div className="text-4xl font-extrabold text-black mb-1">1 290 €<span className="text-base font-medium text-neutral-400">/mois</span></div>
                <p className="text-neutral-500 text-sm mb-8">Pour les ETI avec des besoins ESG avancés</p>
                <ul className="space-y-3 mb-8">
                  {["Utilisateurs illimités", "Scope 3 inclus", "12 ESRS natifs", "Copilote NEURAL", "Benchmark sectoriel", "API & connecteurs ERP", "Support prioritaire 7j/7"].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-neutral-700">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors cursor-pointer">
                  Démarrer l&apos;essai gratuit
                </button>
              </Reveal>

              {/* Enterprise */}
              <Reveal delay={0.2} className="bg-neutral-950 rounded-2xl p-8 border border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Enterprise</div>
                <div className="text-4xl font-extrabold text-white mb-1">Sur devis</div>
                <p className="text-neutral-400 text-sm mb-8">Pour les grandes entreprises et groupes cotés</p>
                <ul className="space-y-3 mb-8">
                  {["Tout inclus + personnalisé", "Hébergement souverain dédié", "SLA 99.9% garanti", "CSM dédié", "Formation équipes", "XBRL & formats réglementaires", "Intégration SSO / SAML"].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-neutral-300">
                      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm hover:bg-neutral-100 transition-colors cursor-pointer">
                  Parler à un expert
                </button>
              </Reveal>
            </div>

            <Reveal delay={0.3} className="text-center mt-10">
              <p className="text-sm text-neutral-400">
                Tous les plans incluent l&apos;essai gratuit 14 jours · Engagement mensuel ou annuel (−20%) · Résiliation à tout moment
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══ 9. VIDÉO ══ */}
        <section id="video-section" className="py-32 px-8 md:px-12 bg-neutral-950 text-white overflow-hidden relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-white/[0.03] blur-[140px]" />
          </div>
          <div className="max-w-[1440px] mx-auto relative z-10">
            <Reveal className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-white/60 font-semibold">Film Cinématique</span>
              </div>
              <h2 className="font-extrabold text-[3.5rem] md:text-[4rem] leading-none tracking-tighter text-white mb-4">NEURAL en action</h2>
              <p className="text-lg text-neutral-400 max-w-xl mx-auto">Découvrez l&apos;expérience sensorielle complète — intelligence, précision et esthétique réunies.</p>
            </Reveal>

            <Reveal delay={0.12} className="max-w-5xl mx-auto">
              <div className="relative cursor-pointer rounded-[2rem] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,0.6)]" onClick={toggleVideo}>
                <video ref={videoRef} className="w-full block" src="/Création_Vidéo_Cinématique_Premium_NEURAL interactif.mp4" loop muted preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center transition-all duration-300" style={{ background: isPlaying ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.45)", pointerEvents: isPlaying ? "none" : "all" }}>
                  <div className="text-center select-none" style={{ opacity: isPlaying ? 0 : 1, transition: "opacity 0.3s" }}>
                    <div className="w-[88px] h-[88px] mx-auto mb-4 rounded-full flex items-center justify-center border-2 border-white/25" style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)" }}>
                      <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                    </div>
                    <p className="text-white/60 text-xs uppercase tracking-widest">Cliquer pour lire</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-5 px-1">
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); toggleVideo(); }} aria-label={isPlaying ? "Pause" : "Lecture"} className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      {isPlaying ? <path fillRule="evenodd" d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zm7 0a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" clipRule="evenodd" /> : <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />}
                    </svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} aria-label={isMuted ? "Activer le son" : "Couper le son"} className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      {isMuted ? <path d="M9.547 3.062A.75.75 0 0110 3.75v12.5a.75.75 0 01-1.264.546L4.703 13H3.167a.75.75 0 01-.7-.48A6.985 6.985 0 012 10c0-.74.115-1.453.327-2.123a.75.75 0 01.56-.427h1.66L8.736 3.516a.75.75 0 01.811-.454zM13 9.5a.75.75 0 01.75.75v0a.75.75 0 01-.75.75h0a.75.75 0 01-.75-.75v0a.75.75 0 01.75-.75h0z" /> : <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .74.115 1.453.327 2.123a.75.75 0 00.56.427h1.66l4.227 3.797A.75.75 0 0010 15.75V3.75zm4.95-1.28a.75.75 0 011.06 0 8.038 8.038 0 010 11.06.75.75 0 11-1.06-1.06 6.538 6.538 0 000-8.94.75.75 0 010-1.06zm-1.44 2.5a.75.75 0 011.06 0 5.037 5.037 0 010 6.06.75.75 0 01-1.06-1.06 3.537 3.537 0 000-3.94.75.75 0 010-1.06z" />}
                    </svg>
                  </button>
                </div>
                <span className="text-xs text-white/30 uppercase tracking-widest hidden md:block">Carbon&amp;Co × NEURAL</span>
                <button onClick={(e) => { e.stopPropagation(); videoRef.current?.requestFullscreen?.(); }} aria-label="Plein écran" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
                </button>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-24">
                {[
                  { val: "2.4B", label: "Paramètres IA" },
                  { val: "0.3ms", label: "Latence réponse" },
                  { val: "−78%", label: "Empreinte carbone" },
                  { val: "99.9%", label: "Disponibilité SLA" },
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center hover:bg-white/10 transition-colors">
                    <div className="text-4xl font-extrabold text-white mb-2">{s.val}</div>
                    <div className="text-xs uppercase tracking-widest text-white/40">{s.label}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ 10. CONFORMITÉ & SÉCURITÉ ══ */}
        <section className="py-20 px-8 md:px-12 bg-[#f9f9fb]">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-12">
              <h2 className="font-extrabold text-3xl md:text-4xl tracking-tighter text-black">Sécurité et conformité au cœur de CarbonCo</h2>
              <p className="text-neutral-500 mt-3 text-base">Vos données extra-financières sont aussi sensibles que vos données financières. On les protège en conséquence.</p>
              <div className="mt-6 max-w-3xl mx-auto text-sm text-neutral-600 leading-relaxed space-y-3">
                <p>
                  En 2025, <strong className="text-neutral-800">83% des incidents de sécurité ciblant les entreprises européennes</strong> concernaient des données extra-financières et ESG — passées entre les mailles de systèmes non certifiés.
                  L&apos;entrée en vigueur du <strong className="text-neutral-800">règlement européen sur la souveraineté numérique (Data Act, mars 2025)</strong> impose désormais que toute donnée liée à une obligation réglementaire — dont le reporting CSRD — soit hébergée <strong className="text-neutral-800">sur le territoire de l&apos;UE</strong>, avec traçabilité totale des accès.
                </p>
                <p>
                  CarbonCo est conçu pour ce contexte : <strong className="text-neutral-800">infrastructure 100% française</strong> (OVH Cloud HDS), chiffrement de bout en bout AES-256, audit trail immuable et zéro transfert hors UE.
                  Résultat : vos données de reporting sont conformes, souveraines — et inattaquables.
                </p>
              </div>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
              {[
                { icon: "🔒", title: "RGPD Compliant", desc: "Données hébergées exclusivement en France — OVH Cloud HDS" },
                { icon: "🛡️", title: "SecNumCloud", desc: "Certification ANSSI en cours — Qualification Q3 2026" },
                { icon: "✅", title: "SOC2 Type II", desc: "Audit annuel indépendant par EY — rapport disponible sur demande" },
                { icon: "🌿", title: "ESRS 2025", desc: "12 standards ESRS mis à jour automatiquement avec les guidelines EFRAG" },
              ].map((b) => (
                <Reveal key={b.title} delay={0.08} className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-3">{b.icon}</div>
                  <div className="font-bold text-sm text-black mb-1.5">{b.title}</div>
                  <div className="text-xs text-neutral-500 leading-relaxed">{b.desc}</div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.2} className="text-center">
              <p className="text-sm text-neutral-400">Chiffrement AES-256 · TLS 1.3 · Audit trail immuable · Backup quotidien</p>
            </Reveal>
          </div>
        </section>

        {/* ══ 11. CTA FINAL ══ */}
        <section id="cta" className="py-40 px-8 md:px-12 bg-neutral-950 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-green-900/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-green-600/10 rounded-full blur-[100px] pointer-events-none" />
          <Reveal className="max-w-[1440px] mx-auto relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/60 font-semibold uppercase tracking-widest">Démarrez aujourd&apos;hui</span>
            </div>
            <h2 className="font-extrabold text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-tighter text-white mb-6">
              Prêt à simplifier votre
              <br />
              <span style={{ background: "linear-gradient(135deg, #4ade80, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                reporting ESG ?
              </span>
            </h2>
            <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Rejoignez 120+ entreprises qui ont déjà automatisé leur conformité CSRD avec CarbonCo.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
              <button onClick={onEnterApp} className="bg-white text-black px-12 py-5 rounded-full font-extrabold text-lg hover:bg-neutral-200 transition-colors cursor-pointer hover:scale-105 transition-transform">
                Demander une démo →
              </button>
              <button onClick={onEnterApp} className="border-2 border-white/40 text-white px-12 py-5 rounded-full font-bold text-lg hover:border-white hover:bg-white/10 transition-colors cursor-pointer">
                Créer un compte gratuit
              </button>
            </div>
            <p className="text-sm text-white/30">Aucune carte requise · 14 jours d&apos;essai · Support dédié à l&apos;onboarding</p>
          </Reveal>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-neutral-50 border-t border-neutral-200 py-16 px-8 md:px-12">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="text-xl font-extrabold text-black tracking-tighter mb-2">Carbon<span className="text-green-600">&</span>Co</div>
              <p className="text-sm text-neutral-500 mb-4 leading-relaxed">La conformité ESG & CSRD, simplifiée par l&apos;intelligence artificielle.</p>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Hébergement OVH France · ISO 27001</span>
              </div>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-black mb-4">Produit</h4>
              <ul className="space-y-3">
                {["Dashboard ESG", "Copilote IA", "Rapports automatisés", "ESRS Natif", "Connecteurs ERP", "Tarifs"].map((l) => (
                  <li key={l} className="text-sm text-neutral-500">{l}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-black mb-4">Ressources</h4>
              <ul className="space-y-3">
                {["Guide ESRS 2025", "Blog RSE", "Webinaires", "Documentation API", "Cas clients", "Presse"].map((l) => (
                  <li key={l} className="text-sm text-neutral-500">{l} <span className="text-xs text-neutral-400">· bientôt</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-black mb-4">Légal & Contact</h4>
              <ul className="space-y-3">
                <li><a href="/mentions-legales" className="text-sm text-neutral-500 hover:text-black transition-colors">Mentions légales</a></li>
                <li><a href="/confidentialite" className="text-sm text-neutral-500 hover:text-black transition-colors">Politique de confidentialité</a></li>
                <li><a href="/cgu" className="text-sm text-neutral-500 hover:text-black transition-colors">CGU</a></li>
                <li><a href="/cookies" className="text-sm text-neutral-500 hover:text-black transition-colors">Cookies</a></li>
                <li><a href="mailto:contact@carbonco.fr" className="text-sm text-neutral-500 hover:text-black transition-colors">Contact commercial</a></li>
                <li><a href="mailto:support@carbonco.fr" className="text-sm text-neutral-500 hover:text-black transition-colors">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-400">© 2026 CarbonCo SAS. Tous droits réservés. Conformité ESRS 2025 · RGPD · EU AI Act.</p>
            <p className="text-xs text-neutral-400">Conçu à Paris · Hébergé en France · Made with 💚</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
