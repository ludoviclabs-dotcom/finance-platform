"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface LandingPageProps {
  onEnterApp: () => void;
}

/* ── Scroll-reveal hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
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
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

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

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
  };

  return (
    <div className="min-h-screen bg-[#f9f9fb] text-[#1a1c1d] font-sans overflow-x-hidden">

      {/* ═══ NAV ═══ */}
      <nav
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={scrolled ? {
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        } : {
          background: "transparent",
        }}
      >
        <div className="flex justify-between items-center px-8 md:px-12 py-5 max-w-[1440px] mx-auto">
          <div className="text-2xl font-extrabold tracking-tighter text-black">
            Carbon&amp;Co
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#hero" className="text-sm font-semibold text-black tracking-wide border-b-2 border-black pb-0.5">Accueil</a>
            <a href="#about" className="text-sm font-semibold text-neutral-500 hover:text-black transition-colors tracking-wide">Nous découvrir</a>
            <a href="#video-section" className="text-sm font-semibold text-neutral-500 hover:text-black transition-colors tracking-wide">Voir NEURAL</a>
            <a href="#cta" className="text-sm font-semibold text-neutral-500 hover:text-black transition-colors tracking-wide">Contact</a>
          </div>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={onEnterApp}
              className="border border-neutral-300 text-black px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Se connecter
            </button>
            <button
              onClick={onEnterApp}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Essai gratuit
            </button>
          </div>
          <button
            className="md:hidden w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu — slide animé */}
        <div
          className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: mobileMenuOpen ? 400 : 0,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex flex-col px-8 pb-6 pt-2 border-t border-neutral-100">
            <a href="#hero" className="text-sm font-semibold text-black py-3 border-b border-neutral-100">Accueil</a>
            <a href="#about" className="text-sm font-semibold text-neutral-500 py-3 border-b border-neutral-100 hover:text-black transition-colors">Nous découvrir</a>
            <a href="#video-section" className="text-sm font-semibold text-neutral-500 py-3 border-b border-neutral-100 hover:text-black transition-colors">Voir NEURAL</a>
            <a href="#cta" className="text-sm font-semibold text-neutral-500 py-3 border-b border-neutral-100 hover:text-black transition-colors">Contact</a>
            <div className="flex gap-3 mt-4">
              <button onClick={onEnterApp} className="flex-1 border border-neutral-300 text-black py-3 rounded-xl font-semibold text-sm cursor-pointer">
                Se connecter
              </button>
              <button onClick={onEnterApp} className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm cursor-pointer">
                Essai gratuit
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ MAIN ═══ */}
      <main className="pt-20">

        {/* ── 1. HERO ── */}
        <section id="hero" className="relative min-h-[92vh] flex items-center px-8 md:px-12 overflow-hidden bg-white">
          <div className="grid lg:grid-cols-2 gap-16 items-center w-full max-w-[1440px] mx-auto py-24">

            {/* Left column */}
            <Reveal className="z-10">
              {/* Surtitre pill vert */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 mb-8">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-semibold text-green-700 tracking-wide">Plateforme de pilotage ESG augmentée par l&apos;IA</span>
              </div>

              {/* H1 avec gradient */}
              <h1 className="font-extrabold text-[4rem] md:text-[5rem] leading-[0.95] tracking-tighter mb-6">
                <span className="text-black">Votre conformité CSRD,</span>
                <span
                  className="block"
                  style={{
                    background: "linear-gradient(135deg, #16a34a 0%, #059669 40%, #0891b2 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  automatisée.
                </span>
              </h1>

              {/* Sous-titre */}
              <p className="text-xl text-neutral-500 max-w-lg mb-10 leading-relaxed">
                Collectez, analysez et générez vos rapports ESRS en quelques clics — pas en quelques mois.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-4 mb-8">
                <button
                  onClick={onEnterApp}
                  className="bg-black text-white px-8 py-4 rounded-full font-bold text-base cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
                >
                  Démarrer gratuitement
                </button>
                <a
                  href="#video-section"
                  className="flex items-center gap-2 bg-neutral-100 text-black px-8 py-4 rounded-full font-bold text-base transition-all duration-200 hover:bg-neutral-200 hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                  Voir la démo en 2 min
                </a>
              </div>

              {/* Social proof */}
              <p className="text-sm text-neutral-400 font-medium">
                Déjà utilisé par 120+ entreprises · Conforme ESRS 2025 · Hébergement souverain
              </p>
            </Reveal>

            {/* Right column — android image + badges */}
            <Reveal delay={0.2} className="relative flex justify-center lg:justify-end mt-8 lg:mt-0">
              {/* Glow derrière le robot */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse 70% 60% at 50% 55%, rgba(22,163,74,0.18) 0%, rgba(8,145,178,0.10) 50%, transparent 80%)",
                  filter: "blur(24px)",
                }}
              />

              {/* Robot avec breathing float */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-full max-w-sm md:max-w-lg aspect-square rounded-3xl overflow-hidden shadow-2xl bg-neutral-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/neural-android.webp"
                  alt="CarbonCo ESG Platform"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                {/* Fallback */}
                <div className="w-full h-full bg-gradient-to-br from-green-50 to-neutral-100 items-center justify-center hidden absolute inset-0">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>
                    </div>
                    <p className="text-green-600 font-bold text-sm uppercase tracking-widest">CarbonCo Dashboard</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating badge — disponibilité */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-4 left-0 lg:-left-4 bg-white rounded-2xl px-5 py-4 shadow-xl border border-neutral-100 z-20"
              >
                <div className="text-2xl font-extrabold text-black">99.9%</div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Disponibilité</div>
              </motion.div>

              {/* Floating badge — IA */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, delay: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-6 left-0 lg:-left-6 bg-white rounded-2xl px-4 py-3 shadow-xl border border-neutral-100 z-20 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 1l2.928 6.472L20 8.354l-5.072 4.572L16.18 20 10 16.472 3.82 20l1.252-7.074L0 8.354l7.072-.882L10 1z" /></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-black">IA Active</div>
                  <div className="text-xs text-neutral-500">Neural v2.4</div>
                </div>
              </motion.div>
            </Reveal>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
            <span className="text-xs text-neutral-400 tracking-widest uppercase font-medium">Scroll</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>
        </section>

        {/* ── 2. BARRE LOGOS CLIENTS ── */}
        <section className="py-12 bg-white border-y border-neutral-100 overflow-hidden">
          <div className="max-w-[1440px] mx-auto px-8 md:px-12">
            <p className="text-xs uppercase tracking-widest text-neutral-400 font-semibold text-center mb-8">Ils nous font confiance</p>
            <div className="flex items-center justify-center gap-12 flex-wrap">
              {["Vinci", "Société Générale", "Schneider Electric", "TotalEnergies", "Veolia", "Danone"].map((name) => (
                <span key={name} className="text-lg font-bold text-neutral-300 hover:text-neutral-500 transition-colors whitespace-nowrap">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. PROBLÈME → SOLUTION ── */}
        <section id="about" className="py-32 px-8 md:px-12 bg-[#f9f9fb]">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-16">
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black mb-4">
                Votre reporting ESG ressemble à ça ?
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Sans CarbonCo */}
              <Reveal delay={0.1} className="bg-red-50 rounded-2xl p-8 border border-red-100">
                <h3 className="text-xl font-bold text-red-700 mb-6">❌ Sans CarbonCo</h3>
                <ul className="space-y-4">
                  {[
                    "Fichiers Excel dispersés entre équipes",
                    "Mois de collecte manuelle",
                    "Risque d'erreurs et d'incohérences",
                    "Conformité ESRS incertaine",
                    "Audits stressants et coûteux",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-red-800">
                      <span className="mt-1 w-5 h-5 flex-shrink-0 rounded-full bg-red-200 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      <span className="text-sm font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>

              {/* Avec CarbonCo */}
              <Reveal delay={0.2} className="bg-green-50 rounded-2xl p-8 border border-green-100">
                <h3 className="text-xl font-bold text-green-700 mb-6">✅ Avec CarbonCo</h3>
                <ul className="space-y-4">
                  {[
                    "Données centralisées en temps réel",
                    "Collecte automatisée par l'IA",
                    "Audit trail et traçabilité totale",
                    "Conformité ESRS 2025 garantie",
                    "Rapports générés en 1 clic",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-green-800">
                      <span className="mt-1 w-5 h-5 flex-shrink-0 rounded-full bg-green-200 flex items-center justify-center">
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <span className="text-sm font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── 4. FONCTIONNALITÉS CLÉS ── */}
        <section className="py-32 px-8 md:px-12 bg-white">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-4">
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Tout ce dont vous avez besoin
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="text-center mb-16">
              <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
                Une plateforme complète pour piloter votre ESG de A à Z
              </p>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 */}
              <Reveal delay={0.1} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                </div>
                <h3 className="font-bold text-lg text-black mb-3">Dashboard ESG</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Visualisez vos KPIs carbone, eau, social en temps réel sur un tableau de bord unifié.
                </p>
              </Reveal>

              {/* Card 2 */}
              <Reveal delay={0.15} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
                </div>
                <h3 className="font-bold text-lg text-black mb-3">Copilote IA</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Posez vos questions en langage naturel. Notre IA répond, analyse et suggère des plans d&apos;action.
                </p>
              </Reveal>

              {/* Card 3 */}
              <Reveal delay={0.2} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                </div>
                <h3 className="font-bold text-lg text-black mb-3">Rapports automatisés</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Générez vos rapports CSRD, GHG Protocol et Taxonomie verte en un clic, prêts pour l&apos;audit.
                </p>
              </Reveal>

              {/* Card 4 */}
              <Reveal delay={0.25} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                </div>
                <h3 className="font-bold text-lg text-black mb-3">ESRS natif</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  12 standards ESRS intégrés nativement avec suivi de progression et alertes de non-conformité.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── 5. SCREENSHOT DASHBOARD ── */}
        <section className="py-32 px-8 md:px-12 bg-[#f9f9fb]">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-16">
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Un tableau de bord pensé pour les équipes RSE
              </h2>
            </Reveal>
            <Reveal delay={0.15} className="max-w-5xl mx-auto">
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 relative aspect-video bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/neural-android.webp"
                  alt="Dashboard CarbonCo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <p className="text-white text-2xl font-bold tracking-wide">Dashboard CarbonCo</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── 6. COMMENT ÇA MARCHE ── */}
        <section className="py-32 px-8 md:px-12 bg-white">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-20">
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                En 3 étapes, votre reporting est prêt
              </h2>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Arrows between steps on desktop */}
              <div className="hidden md:flex absolute top-16 left-1/3 right-1/3 items-center justify-between pointer-events-none" style={{ width: "calc(66.66% - 2rem)", left: "calc(16.66% + 1rem)" }}>
                <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>

              {/* Étape 1 */}
              <Reveal delay={0.1} className="text-center relative">
                <div className="text-[8rem] font-black text-neutral-100 leading-none mb-4 select-none">1</div>
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-6 -mt-8 relative z-10">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                </div>
                <h3 className="font-bold text-xl text-black mb-3">Connectez vos sources</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">ERP, API, fichiers Excel. CarbonCo agrège tout automatiquement.</p>
              </Reveal>

              {/* Étape 2 */}
              <Reveal delay={0.2} className="text-center relative">
                <div className="text-[8rem] font-black text-neutral-100 leading-none mb-4 select-none">2</div>
                <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-6 -mt-8 relative z-10">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                </div>
                <h3 className="font-bold text-xl text-black mb-3">L&apos;IA analyse et structure</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">Notre copilote détecte les anomalies, enrichit les données et calcule vos scores ESRS.</p>
              </Reveal>

              {/* Étape 3 */}
              <Reveal delay={0.3} className="text-center relative">
                <div className="text-[8rem] font-black text-neutral-100 leading-none mb-4 select-none">3</div>
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-6 -mt-8 relative z-10">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                </div>
                <h3 className="font-bold text-xl text-black mb-3">Vos rapports sont prêts</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">Exportez en PDF, Excel ou directement vers votre commissaire aux comptes.</p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── 7. TÉMOIGNAGES ── */}
        <section className="py-32 px-8 md:px-12 bg-[#f9f9fb]">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-16">
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Ce que disent nos clients
              </h2>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "Le reporting CSRD qui nous prenait 4 mois se fait maintenant en 3 semaines. Incroyable.",
                  name: "Marie L.",
                  title: "Directrice RSE, Vinci",
                  initials: "ML",
                },
                {
                  quote: "L'intégration avec notre ERP SAP a été faite en 2 jours. Le copilote IA est bluffant.",
                  name: "Thomas M.",
                  title: "CFO, Groupe Schneider",
                  initials: "TM",
                },
                {
                  quote: "Enfin une solution qui comprend vraiment les exigences ESRS. Notre auditeur est satisfait.",
                  name: "Sophie R.",
                  title: "Responsable ESG, TotalEnergies",
                  initials: "SR",
                },
              ].map((t) => (
                <Reveal key={t.name} delay={0.1} className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-100 flex flex-col">
                  <div className="text-5xl text-green-200 font-serif leading-none mb-4">&ldquo;</div>
                  <p className="text-neutral-700 text-base leading-relaxed flex-1 mb-6">{t.quote}</p>
                  <div className="border-t border-neutral-100 pt-6 flex items-center gap-4">
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

        {/* ── 8. TARIFS ── */}
        <section className="py-32 px-8 md:px-12 bg-white">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-4">
              <h2 className="font-extrabold text-4xl md:text-5xl tracking-tighter text-black">
                Des tarifs transparents, sans surprise
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="text-center mb-16">
              <p className="text-neutral-500 text-lg">Choisissez le plan adapté à votre organisation</p>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8 items-start">
              {/* Essentials */}
              <Reveal delay={0.1} className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
                <h3 className="font-bold text-xl text-black mb-2">Essentials</h3>
                <div className="text-4xl font-extrabold text-black mb-1">€490<span className="text-lg font-medium text-neutral-400">/mois</span></div>
                <p className="text-neutral-500 text-sm mb-8">Pour les PME qui démarrent leur démarche ESG</p>
                <ul className="space-y-3 mb-8">
                  {["Jusqu'à 3 utilisateurs", "Scopes 1 & 2", "Rapports de base", "Support email"].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-neutral-700">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} className="w-full bg-neutral-100 text-black py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-colors cursor-pointer">
                  Commencer
                </button>
              </Reveal>

              {/* Business — Populaire */}
              <Reveal delay={0.15} className="bg-white rounded-2xl p-8 border-2 border-green-500 shadow-lg relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">Populaire</span>
                </div>
                <h3 className="font-bold text-xl text-black mb-2">Business</h3>
                <div className="text-4xl font-extrabold text-black mb-1">€1290<span className="text-lg font-medium text-neutral-400">/mois</span></div>
                <p className="text-neutral-500 text-sm mb-8">Pour les ETI avec des besoins ESG avancés</p>
                <ul className="space-y-3 mb-8">
                  {["Utilisateurs illimités", "Scope 3 inclus", "Copilote IA", "ESRS natif", "Support prioritaire"].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-neutral-700">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors cursor-pointer">
                  Démarrer l&apos;essai
                </button>
              </Reveal>

              {/* Enterprise */}
              <Reveal delay={0.2} className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
                <h3 className="font-bold text-xl text-black mb-2">Enterprise</h3>
                <div className="text-4xl font-extrabold text-black mb-1">Sur devis</div>
                <p className="text-neutral-500 text-sm mb-8">Pour les grandes entreprises et groupes cotés</p>
                <ul className="space-y-3 mb-8">
                  {["Tout inclus", "Hébergement souverain", "SLA 99.9%", "CSM dédié"].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-neutral-700">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onEnterApp} className="w-full bg-neutral-100 text-black py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-colors cursor-pointer">
                  Nous contacter
                </button>
              </Reveal>
            </div>

            <Reveal delay={0.3} className="text-center mt-10">
              <p className="text-sm text-neutral-400">
                Tous les plans incluent l&apos;essai gratuit 14 jours · Pas de carte bancaire requise
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── 9. VIDÉO SECTION (conservée) ── */}
        <section id="video-section" className="py-32 px-8 md:px-12 bg-neutral-950 text-white overflow-hidden relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-white/[0.03] blur-[140px]" />
          </div>

          <div className="max-w-[1440px] mx-auto relative z-10">
            <Reveal className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 mb-6">
                <span className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-white/60 font-semibold">Film Cinématique</span>
              </div>
              <h2 className="font-extrabold text-[3.5rem] md:text-[4rem] leading-none tracking-tighter text-white mb-4">
                NEURAL en action
              </h2>
              <p className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed">
                Découvrez l&apos;expérience sensorielle complète — intelligence, précision et esthétique réunies dans un seul film.
              </p>
            </Reveal>

            {/* Player */}
            <Reveal delay={0.12} className="max-w-5xl mx-auto">
              <div
                className={`relative cursor-pointer rounded-[2rem] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,0.6)] group ${isPlaying ? "playing" : ""}`}
                onClick={toggleVideo}
              >
                <video
                  ref={videoRef}
                  className="w-full block"
                  src="/Création_Vidéo_Cinématique_Premium_NEURAL interactif.mp4"
                  loop
                  muted
                  preload="metadata"
                />
                {/* Overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center transition-all duration-300"
                  style={{
                    background: isPlaying ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.4)",
                    pointerEvents: isPlaying ? "none" : "all",
                  }}
                >
                  <div className="text-center select-none">
                    <div
                      className="w-[88px] h-[88px] mx-auto mb-4 rounded-full flex items-center justify-center border-2 border-white/25 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        backdropFilter: "blur(12px)",
                        opacity: isPlaying ? 0 : 1,
                      }}
                    >
                      <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                    </div>
                    {!isPlaying && <p className="text-white/60 text-xs uppercase tracking-widest">Cliquer pour lire</p>}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between mt-5 px-1">
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); toggleVideo(); }} className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      {isPlaying
                        ? <path fillRule="evenodd" d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zm7 0a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" clipRule="evenodd" />
                        : <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      }
                    </svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      {isMuted
                        ? <path d="M9.547 3.062A.75.75 0 0110 3.75v12.5a.75.75 0 01-1.264.546L4.703 13H3.167a.75.75 0 01-.7-.48A6.985 6.985 0 012 10c0-.74.115-1.453.327-2.123a.75.75 0 01.56-.427h1.66L8.736 3.516a.75.75 0 01.811-.454zM13 9.5a.75.75 0 01.75.75v0a.75.75 0 01-.75.75h0a.75.75 0 01-.75-.75v0a.75.75 0 01.75-.75h0z" />
                        : <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .74.115 1.453.327 2.123a.75.75 0 00.56.427h1.66l4.227 3.797A.75.75 0 0010 15.75V3.75zm4.95-1.28a.75.75 0 011.06 0 8.038 8.038 0 010 11.06.75.75 0 11-1.06-1.06 6.538 6.538 0 000-8.94.75.75 0 010-1.06zm-1.44 2.5a.75.75 0 011.06 0 5.037 5.037 0 010 6.06.75.75 0 01-1.06-1.06 3.537 3.537 0 000-3.94.75.75 0 010-1.06z" />
                      }
                    </svg>
                  </button>
                </div>
                <span className="text-xs text-white/30 uppercase tracking-widest hidden md:block">Carbon&amp;Co × NEURAL</span>
                <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
                </button>
              </div>
            </Reveal>

            {/* Stats */}
            <Reveal delay={0.24}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-24">
                {[
                  { val: "2.4B", label: "Paramètres IA" },
                  { val: "0.3ms", label: "Latence Réponse" },
                  { val: "−78%", label: "Empreinte Carbone" },
                  { val: "99.9%", label: "Disponibilité" },
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

        {/* ── 10. CONFORMITÉ & SÉCURITÉ ── */}
        <section className="py-20 px-8 md:px-12 bg-[#f9f9fb]">
          <div className="max-w-[1440px] mx-auto">
            <Reveal className="text-center mb-12">
              <h2 className="font-extrabold text-3xl md:text-4xl tracking-tighter text-black">
                Sécurité et conformité au cœur de CarbonCo
              </h2>
            </Reveal>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
              {[
                { icon: "🔒", title: "RGPD Compliant", desc: "Données hébergées en France" },
                { icon: "🛡️", title: "SecNumCloud", desc: "Certification ANSSI en cours" },
                { icon: "✅", title: "SOC2 Type II", desc: "Audit annuel indépendant" },
                { icon: "🌿", title: "ESRS 2025", desc: "Standards européens natifs" },
              ].map((b) => (
                <Reveal key={b.title} delay={0.1} className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-3">{b.icon}</div>
                  <div className="font-bold text-sm text-black mb-1">{b.title}</div>
                  <div className="text-xs text-neutral-500">{b.desc}</div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2} className="text-center">
              <p className="text-sm text-neutral-400">
                Hébergement souverain européen · Chiffrement AES-256 · Audit trail complet
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── 11. CTA FINAL ── */}
        <section id="cta" className="py-40 px-8 md:px-12 bg-neutral-950 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
          <Reveal className="max-w-[1440px] mx-auto relative z-10 text-center">
            <h2 className="font-extrabold text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-tighter text-white mb-6">
              Prêt à simplifier votre reporting ESG ?
            </h2>
            <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Rejoignez 120+ entreprises qui ont déjà automatisé leur conformité CSRD.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <button
                onClick={onEnterApp}
                className="bg-white text-black px-12 py-5 rounded-full font-extrabold text-lg hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Demander une démo
              </button>
              <button
                onClick={onEnterApp}
                className="border-2 border-white/40 text-white px-12 py-5 rounded-full font-bold text-lg hover:border-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Créer un compte gratuit
              </button>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-neutral-50 border-t border-neutral-200 py-16 px-8 md:px-12">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Col 1 */}
            <div>
              <div className="text-xl font-extrabold text-black tracking-tighter mb-2">Carbon&amp;Co</div>
              <p className="text-sm text-neutral-500 mb-4">La conformité ESG, simplifiée.</p>
              <p className="text-xs text-neutral-400">© 2026 Carbon&amp;Co.</p>
            </div>

            {/* Col 2 — Produit */}
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-black mb-4">Produit</h4>
              <ul className="space-y-3">
                {["Dashboard", "Copilote IA", "Rapports", "ESRS", "Tarifs"].map((l) => (
                  <li key={l}><a href="#" className="text-sm text-neutral-500 hover:text-black transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Col 3 — Entreprise */}
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-black mb-4">Entreprise</h4>
              <ul className="space-y-3">
                {["À propos", "Blog", "Presse", "Carrières", "Contact"].map((l) => (
                  <li key={l}><a href="#" className="text-sm text-neutral-500 hover:text-black transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Col 4 — Légal */}
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-black mb-4">Légal</h4>
              <ul className="space-y-3">
                {["Mentions légales", "Confidentialité", "CGU", "Cookies"].map((l) => (
                  <li key={l}><a href="#" className="text-sm text-neutral-500 hover:text-black transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>

          {/* Barre bas */}
          <div className="border-t border-neutral-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-400">© 2026 Carbon&amp;Co. Tous droits réservés.</p>
            <p className="text-xs text-neutral-400">Hébergement OVH Cloud France</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
