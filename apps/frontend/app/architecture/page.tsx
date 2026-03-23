'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, X, ChevronRight, Zap, Eye, Download, Bell } from 'lucide-react';
import {
  ARCH_MODULES, STACK_DATA, TIMELINE_DATA, TICKER_ITEMS,
  type ArchModule,
} from '@/lib/data/architecture';

// ═══════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════

function useCounter(target: number, decimals = 0, duration = 2200) {
  const [value, setValue] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const start = performance.now();
          const update = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 4);
            const cur = eased * target;
            setValue(decimals > 0 ? cur.toFixed(decimals) : Math.floor(cur).toLocaleString('fr-FR'));
            if (p < 1) requestAnimationFrame(update);
          };
          requestAnimationFrame(update);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, decimals, duration]);

  return { ref, value };
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('arch-visible'); },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ═══════════════════════════════════════════════════════════════════════
// TICKER
// ═══════════════════════════════════════════════════════════════════════

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="w-full bg-zinc-950/80 border-b border-zinc-800/40 h-8 flex items-center overflow-hidden">
      <div className="flex items-center gap-8 whitespace-nowrap text-[10px] font-mono tracking-wider animate-[archTicker_40s_linear_infinite]">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-zinc-500">{item.label}</span>
            <span className={`font-bold ${item.positive === true ? 'text-emerald-400' : item.positive === false ? 'text-red-400' : 'text-amber-400'}`}>
              {item.value}
            </span>
            <span className="text-zinc-800">&bull;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════════════

function Hero() {
  const c1 = useCounter(8);
  const c2 = useCounter(140);
  const c3 = useCounter(500);
  const c4 = useCounter(15);

  return (
    <section className="relative min-h-[520px] flex items-center px-6 md:px-12 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_30%,#1e293b_0%,transparent_70%)] opacity-60" />
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,#064e3b_0%,transparent_50%)] opacity-10" />
      </div>

      <div className="grid lg:grid-cols-2 gap-10 items-center w-full max-w-6xl mx-auto z-10 py-16">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase tracking-[.2em] font-bold rounded-full mb-5 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            8 Modules &bull; 140+ Onglets &bull; Full Stack
          </span>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1] mb-5" style={{ fontFamily: 'var(--font-display)' }}>
            L&apos;Architecture{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
              Financière Intégrale
            </span>
          </h1>

          <p className="text-zinc-400 text-base max-w-lg mb-8 leading-relaxed">
            De la gouvernance cyber à la fiscalité GloBE, du crédit bancaire au
            patrimoine PL Santé — une plateforme souveraine couvrant l&apos;ensemble
            du spectre analytique financier.
          </p>

          <div className="flex flex-wrap gap-3">
            <a href="#modules" className="bg-emerald-500 text-zinc-950 px-6 py-3 rounded-lg font-bold text-sm hover:bg-emerald-400 transition-all active:scale-95 flex items-center gap-2">
              <Play className="w-4 h-4" /> Explorer les Modules
            </a>
            <a href="#stack" className="border border-zinc-700 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-zinc-800 transition-all flex items-center gap-2">
              <Zap className="w-4 h-4" /> Voir la Stack
            </a>
          </div>

          <div className="flex gap-8 mt-10">
            {[
              { ref: c1.ref, val: c1.value, label: 'Modules', suffix: '' },
              { ref: c2.ref, val: c2.value, label: 'Onglets', suffix: '+' },
              { ref: c3.ref, val: c3.value, label: 'KPIs', suffix: '+' },
              { ref: c4.ref, val: c4.value, label: 'Normes IFRS', suffix: '' },
            ].map((c, i) => (
              <div key={i}>
                <p className="text-2xl font-bold tabular-nums"><span ref={c.ref}>{c.val}</span>{c.suffix}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{c.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture widget */}
        <div className="hidden lg:block">
          <div className="bg-zinc-900/60 border border-zinc-800/50 p-5 rounded-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Architecture Plateforme</p>
              <span className="text-emerald-400 text-lg">⬡</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {ARCH_MODULES.map((m) => (
                <div key={m.id} className="p-2 rounded-lg text-center" style={{ background: m.color + '15' }}>
                  <span className="text-sm">{m.icon}</span>
                  <p className="text-[8px] text-zinc-400 mt-1">{m.shortName}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/20 text-center">
                <p className="text-[10px] text-zinc-500 mb-0.5">Latence</p>
                <p className="font-bold text-zinc-200 text-sm tabular-nums">12ms</p>
              </div>
              <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/20 text-center">
                <p className="text-[10px] text-zinc-500 mb-0.5">Couverture</p>
                <p className="font-bold text-zinc-200 text-sm">Global</p>
              </div>
              <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/20 text-center">
                <p className="text-[10px] text-zinc-500 mb-0.5">Fichiers</p>
                <p className="font-bold text-emerald-400 text-sm">8 Excel</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULES GRID
// ═══════════════════════════════════════════════════════════════════════

function ModulesGrid({ onOpenDetail }: { onOpenDetail: (m: ArchModule) => void }) {
  const ref = useReveal();
  return (
    <section className="px-6 md:px-12 py-12" id="modules">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 arch-reveal" ref={ref}>
          <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Architecture Complète</span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">8 Modules — 140+ Onglets</h2>
          <p className="text-zinc-400 mt-1 text-sm">Chaque carte représente un fichier Excel source avec ses onglets spécialisés.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ARCH_MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => onOpenDetail(m)}
              className="text-left p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/40 hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{m.icon}</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest" style={{ background: m.color + '20', color: m.color }}>
                  {m.status}
                </span>
              </div>
              <h3 className="font-bold text-white text-sm mb-1">{m.shortName}</h3>
              <p className="text-zinc-500 text-xs mb-3 line-clamp-2">{m.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-600">{m.tabs} onglets</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// EXPLORER (tabs)
// ═══════════════════════════════════════════════════════════════════════

function Explorer() {
  const [activeId, setActiveId] = useState('cyber');
  const mod = ARCH_MODULES.find((m) => m.id === activeId)!;

  return (
    <section className="py-12 px-6 md:px-12 bg-zinc-950/50" id="explorer">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Exploration Détaillée</span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Plongez dans chaque module</h2>
        </div>

        <div className="flex overflow-x-auto gap-1 border-b border-zinc-800 mb-6">
          {ARCH_MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveId(m.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
                activeId === m.id ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m.shortName}
              {activeId === m.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t" />}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{mod.icon}</span>
            <div>
              <h3 className="text-lg font-bold">{mod.name}</h3>
              <p className="text-zinc-500 text-xs">{mod.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {mod.kpis.map((kpi) => (
              <span key={kpi} className="px-2.5 py-1 text-xs rounded-md font-medium" style={{ background: mod.color + '15', color: mod.color }}>
                {kpi}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {mod.onglets.map((tab, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/30 hover:bg-zinc-900/60 transition-all">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold" style={{ color: mod.color }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-white text-sm font-medium">{tab.name}</span>
                </div>
                <p className="text-zinc-500 text-xs pl-6">{tab.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// METRICS ROW
// ═══════════════════════════════════════════════════════════════════════

function MetricCard({ icon, color, target, label, suffix }: { icon: string; color: string; target: number; label: string; suffix?: string }) {
  const c = useCounter(target);
  return (
    <div className="text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
      <span className="text-lg mb-1 block">{icon}</span>
      <p className="text-lg font-bold tabular-nums"><span ref={c.ref}>{c.value}</span>{suffix || ''}</p>
      <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function Metrics() {
  const data = [
    { icon: '🛡️', color: '#4edea3', target: 14, label: 'Onglets Cyber' },
    { icon: '🌍', color: '#60a5fa', target: 8, label: 'Onglets GloBE' },
    { icon: '📊', color: '#a78bfa', target: 19, label: 'Onglets Analyse', suffix: '+' },
    { icon: '💳', color: '#f59e0b', target: 6, label: 'Onglets Crédit' },
    { icon: '🤝', color: '#f43f5e', target: 10, label: 'Onglets M&A', suffix: '+' },
    { icon: '✅', color: '#14b8a6', target: 38, label: 'Onglets IFRS' },
    { icon: '🎯', color: '#6366f1', target: 15, label: 'Onglets Défense' },
    { icon: '🏦', color: '#06b6d4', target: 20, label: 'Onglets Patrimoine', suffix: '+' },
  ];
  return (
    <section className="py-10 px-6 md:px-12">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {data.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TECH STACK
// ═══════════════════════════════════════════════════════════════════════

function TechStack() {
  const ref = useReveal();
  return (
    <section className="py-12 px-6 md:px-12 bg-zinc-950/30" id="stack">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 arch-reveal" ref={ref}>
          <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Infrastructure</span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Stack Technologique</h2>
          <p className="text-zinc-400 mt-1 text-sm">Next.js + FastAPI + PostgreSQL — déployé via Vercel</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STACK_DATA.map((layer) => (
            <div key={layer.layer} className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">{layer.icon}</span>
                <h3 className="font-bold text-white">{layer.layer}</h3>
              </div>
              <div className="space-y-2.5">
                {layer.items.map((item) => (
                  <div key={item.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/15">
                    <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center font-bold text-[10px] shrink-0`}>
                      {item.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// REGULATORY TIMELINE
// ═══════════════════════════════════════════════════════════════════════

function RegulatoryTimeline() {
  const ref = useReveal();
  return (
    <section className="py-12 px-6 md:px-12" id="timeline">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 arch-reveal" ref={ref}>
          <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Cartographie Réglementaire</span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Timeline 2024 → 2030</h2>
          <p className="text-zinc-400 mt-1 text-sm">Toutes les réglementations couvertes par la plateforme</p>
        </div>

        {/* Dots */}
        <div className="relative mb-6">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-800 -translate-y-1/2" />
          <div className="flex justify-between items-center relative z-10">
            {TIMELINE_DATA.map((t) => (
              <div key={t.year} className="flex flex-col items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-zinc-950 hover:scale-150 transition-transform cursor-pointer" style={{ background: t.color }} />
                <span className="text-xs font-bold" style={{ color: t.color }}>{t.year}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TIMELINE_DATA.map((t) => (
            <div key={t.year} className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/30 hover:border-opacity-60 transition-all" style={{ borderColor: t.color + '30' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                <span className="text-sm font-bold" style={{ color: t.color }}>{t.year}</span>
              </div>
              <ul className="space-y-1">
                {t.items.map((item) => (
                  <li key={item} className="text-xs text-zinc-400 flex items-start gap-2">
                    <span className="text-zinc-600 mt-0.5">&#x25B8;</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════

function DetailModal({ mod, onClose }: { mod: ArchModule | null; onClose: () => void }) {
  useEffect(() => {
    if (!mod) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mod, onClose]);

  if (!mod) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[80vh] bg-zinc-900 rounded-xl border border-zinc-700/30 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-zinc-800/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{mod.icon}</span>
            <div>
              <h3 className="text-lg font-bold text-white">{mod.name}</h3>
              <p className="text-xs text-zinc-500">{mod.tabs} onglets — {mod.file}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          <p className="text-zinc-400 text-sm mb-5">{mod.description}</p>

          <div className="mb-5">
            <h4 className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-2">KPIs Principaux</h4>
            <div className="flex flex-wrap gap-2">
              {mod.kpis.map((kpi) => (
                <span key={kpi} className="px-2.5 py-1 text-xs rounded-md font-medium" style={{ background: mod.color + '15', color: mod.color }}>
                  {kpi}
                </span>
              ))}
            </div>
          </div>

          <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Onglets ({mod.onglets.length})</h4>
          <div className="space-y-1.5">
            {mod.onglets.map((tab, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                <span className="text-xs font-bold mt-0.5" style={{ color: mod.color }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-white text-sm font-medium">{tab.name}</p>
                  <p className="text-zinc-500 text-xs">{tab.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════

export default function ArchitecturePage() {
  const [detailMod, setDetailMod] = useState<ArchModule | null>(null);
  const closeDetail = useCallback(() => setDetailMod(null), []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* CSS animations */}
      <style jsx global>{`
        @keyframes archTicker { 0%{transform:translateX(0)}100%{transform:translateX(-50%)} }
        .arch-reveal { opacity:0; transform:translateY(20px); transition:all .6s cubic-bezier(.16,1,.3,1); }
        .arch-reveal.arch-visible { opacity:1; transform:translateY(0); }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/30">
        <div className="flex items-center justify-between px-6 md:px-12 h-14">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-zinc-950 font-black text-xs">F</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">FinArchitect</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5 text-sm">
            <a href="#modules" className="text-zinc-400 hover:text-white transition-colors">Modules</a>
            <a href="#explorer" className="text-zinc-400 hover:text-white transition-colors">Explorer</a>
            <a href="#timeline" className="text-zinc-400 hover:text-white transition-colors">Réglementation</a>
            <a href="#stack" className="text-zinc-400 hover:text-white transition-colors">Stack</a>
          </div>
        </div>
      </div>

      <Ticker />
      <Hero />
      <ModulesGrid onOpenDetail={setDetailMod} />
      <Explorer />
      <Metrics />
      <TechStack />
      <RegulatoryTimeline />

      {/* CTA */}
      <section className="py-16 px-6 md:px-12 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Prêt à transformer vos analyses ?
          </h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
            8 modules intégrés, 140+ onglets, de la cyber à la fiscalité GloBE. Une seule plateforme.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="bg-emerald-500 text-zinc-950 px-8 py-3 rounded-lg font-bold hover:bg-emerald-400 transition-all active:scale-95">
              Accéder au Dashboard
            </Link>
            <Link href="/modules/analyse-entreprise" className="border border-zinc-700 text-white px-8 py-3 rounded-lg font-bold hover:bg-zinc-900 transition-all">
              Lancer une Analyse
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center">
              <span className="text-zinc-950 font-black text-[10px]">F</span>
            </div>
            <span className="text-zinc-50 font-bold">FinArchitect</span>
            <span className="text-zinc-600 text-xs ml-2">© 2024 — Architecture Financière Intégrale</span>
          </div>
          <div className="text-zinc-600 text-xs">
            8 Modules &bull; 140+ Onglets &bull; Next.js 16 &bull; Vercel
          </div>
        </div>
      </footer>

      <DetailModal mod={detailMod} onClose={closeDetail} />
    </div>
  );
}
