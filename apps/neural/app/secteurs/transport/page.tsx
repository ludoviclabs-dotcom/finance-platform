'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Truck,
  Receipt,
  Calculator,
  FileText,
  Layers,
  Shield,
  TrendingUp,
  Sparkles,
  Landmark,
  Cog,
  BarChart3,
  Clock,
  Building2,
  Globe,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  Target,
  Workflow,
} from 'lucide-react';

/* ── Agent data ── */

const AGENTS = [
  {
    id: 'tva-transport',
    icon: Receipt,
    accent: 'blue-400',
    accentRing: 'ring-blue-400/30',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
    accentHex: '#60A5FA',
    title: 'TVA Transport',
    subtitle: 'NEURAL_Agent_TVATransport',
    norm: 'CGI art. 256-298 · Dir. 2006/112/CE',
    tags: ['TVA', 'CA3', 'International', 'Compliance'],
    description:
      'Classification automatique des opérations de transport par régime TVA applicable — fret routier, passagers, flux internationaux. Décision instantanée : taux, ligne CA3, référence légale.',
    features: [
      { icon: Target, text: 'Matrice décisionnelle 31 types d\'opérations transport' },
      { icon: Calculator, text: 'Simulateur TVA — calcul automatique par transaction' },
      { icon: Shield, text: 'Conformité CGI + Directive UE 2006/112/CE' },
      { icon: AlertTriangle, text: 'Détection des exceptions et opérations triangulaires' },
    ],
    kpis: [
      { label: 'Régimes TVA', value: '31' },
      { label: 'Déploiement', value: '6 sem.' },
    ],
    sheets: 6,
    complexity: 'Niveau 1',
  },
  {
    id: 'fleet-accounting',
    icon: Truck,
    accent: 'emerald-400',
    accentRing: 'ring-emerald-400/30',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-400',
    accentHex: '#34D399',
    title: 'Fleet Accounting',
    subtitle: 'NEURAL_Agent_FleetAccounting',
    norm: 'IAS 16 · IAS 36 · PCG 214',
    tags: ['Amortissement', 'Composants', 'Flotte', 'IAS 16'],
    description:
      'Comptabilité d\'actifs de flotte par composants — amortissement IAS 16, suivi VNC temps réel, tests de dépréciation IAS 36, calcul des plus-values/moins-values de cession.',
    features: [
      { icon: Truck, text: 'Barèmes d\'amortissement par composant : châssis, moteur, pneus, remorque' },
      { icon: Calculator, text: 'Simulateur flotte 8 véhicules — dépréciation 2026 complète' },
      { icon: AlertTriangle, text: 'Détection automatique des triggers d\'impairment (IAS 36)' },
      { icon: BarChart3, text: 'Suivi VNC en temps réel et calcul de cession' },
    ],
    kpis: [
      { label: 'Véhicules suivis', value: '8' },
      { label: 'Déploiement', value: '7 sem.' },
    ],
    sheets: 6,
    complexity: 'Niveau 2',
  },
  {
    id: 'concession-accounting',
    icon: Landmark,
    accent: 'neural-violet',
    accentRing: 'ring-neural-violet/30',
    accentBg: 'bg-neural-violet/10',
    accentText: 'text-neural-violet',
    accentHex: '#A78BFA',
    title: 'Concession Accounting',
    subtitle: 'NEURAL_Agent_ConcessionAccounting',
    norm: 'IFRIC 12 · IFRS 9 · IFRS 15',
    tags: ['DSP', 'IFRIC 12', 'Concession', 'Tramway'],
    description:
      'L\'agent le plus complexe du portefeuille. Qualification IFRIC 12 des contrats de concession — modèle financier vs. incorporel, reconnaissance du revenu, comptabilisation d\'infrastructure sur 25 ans.',
    features: [
      { icon: BookOpen, text: 'Arbre décision IFRIC 12 complet — qualification modèle financier/incorporel/bifurqué' },
      { icon: Building2, text: 'Simulateur concession 25 ans — Tramway Ligne T3 Métropole Sud' },
      { icon: Shield, text: 'Multi-normes : IFRIC 12, IFRS 9, IFRS 13, IFRS 15' },
      { icon: Clock, text: 'Comptabilisation sur le cycle de vie complet de la concession' },
    ],
    kpis: [
      { label: 'Durée concession', value: '25 ans' },
      { label: 'Déploiement', value: '16 sem.' },
    ],
    sheets: 6,
    complexity: 'Niveau 3 ADV',
  },
];

const ORCHESTRATOR = {
  icon: Workflow,
  title: 'Orchestrateur Compta Transport',
  subtitle: 'NEURAL_Orchestrateur_ComptaTransport',
  description:
    'Couche d\'orchestration multi-agents qui coordonne la clôture comptable mensuelle et trimestrielle. Route les tâches, séquence les flux, gère les escalations Human-in-the-Loop et consolide les outputs.',
  features: [
    '16 flux de données inter-agents identifiés (JSON, event-driven)',
    'Séquence de clôture avec gates HITL pour validation humaine',
    'Bilan consolidé TransLogistic SAS au 31/03/2026',
    'Architecture hybride REST/HTTP2 + Message Queue',
    'ROI consolidé sur les 3 agents + orchestrateur',
  ],
  specs: [
    { label: 'Flux inter-agents', value: '16' },
    { label: 'Architecture', value: 'Event-driven' },
    { label: 'Gates HITL', value: '4' },
  ],
};

const GLOBAL_STATS = [
  { label: 'Agents IA', value: '3+1', icon: Layers },
  { label: 'Fichiers Excel', value: '4', icon: Sparkles },
  { label: 'Normes & Standards', value: '8+', icon: Shield },
  { label: 'Cas d\'entreprise', value: 'TransLogistic SAS', icon: TrendingUp },
];

/* ── Complexity badge ── */
function ComplexityBadge({ level }: { level: string }) {
  const isAdv = level.includes('ADV');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
        isAdv
          ? 'bg-neural-violet/15 text-neural-violet border border-neural-violet/30'
          : 'bg-white/5 text-[var(--color-foreground-subtle)] border border-[var(--color-border)]'
      }`}
    >
      {isAdv && <span className="w-1.5 h-1.5 rounded-full bg-neural-violet animate-pulse" />}
      {level}
    </span>
  );
}

/* ── Page ── */

export default function TransportPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-6 pb-20 pt-32 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent" />
        <div className="absolute -left-60 -top-60 h-[500px] w-[500px] rounded-full bg-blue-500/8 blur-[150px]" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-neural-violet/5 blur-[120px]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/3 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Truck className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">
                  Secteur Transport
                </span>
                <p className="text-[11px] text-[var(--color-foreground-subtle)]">TransLogistic SAS</p>
              </div>
            </div>

            {/* Headline */}
            <h1 className="font-display font-extrabold text-4xl md:text-5xl lg:text-6xl xl:text-7xl tracking-tighter max-w-4xl leading-[0.95]">
              <span className="text-[var(--color-foreground)]">Comptabilité</span>
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #60A5FA 0%, #93C5FD 30%, #A78BFA 70%, #C4B5FD 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                transport
              </span>
              <br />
              <span className="text-[var(--color-foreground)]">augmentée</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-[var(--color-foreground-muted)] max-w-2xl leading-relaxed">
              3 agents comptables spécialisés + 1 orchestrateur. TVA transport, amortissement
              flotte, concessions IFRIC 12 — pilotés par un cerveau central qui séquence
              la clôture et consolide les outputs.
            </p>
          </motion.div>

          {/* Global stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {GLOBAL_STATS.map(stat => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <stat.icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="font-display text-xl font-bold">{stat.value}</p>
                  <p className="text-[11px] text-[var(--color-foreground-muted)]">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Data Flow Banner ── */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-2 text-sm">
            <span className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400">
              TVA Transport
            </span>
            <ChevronRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />
            <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400">
              Fleet Accounting
            </span>
            <ChevronRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />
            <span className="rounded-lg bg-neural-violet/10 border border-neural-violet/20 px-3 py-1.5 text-xs font-medium text-neural-violet">
              Concession Accounting
            </span>
            <ChevronRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />
            <span className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-400 flex items-center gap-1.5">
              <Workflow className="h-3 w-3" />
              Orchestrateur
            </span>
          </div>
          <p className="mt-3 text-center text-[11px] text-[var(--color-foreground-subtle)]">
            Les 3 agents alimentent l&apos;orchestrateur qui séquence la clôture et produit le bilan consolidé.
          </p>
        </div>
      </section>

      {/* ── Agents ── */}
      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-12"
          >
            <span className="text-xs font-bold text-blue-400 uppercase tracking-[0.15em]">
              Agents comptables
            </span>
            <h2 className="mt-3 font-display font-extrabold text-3xl md:text-4xl tracking-tight">
              3 agents spécialisés transport
            </h2>
            <p className="mt-2 text-[var(--color-foreground-muted)] max-w-xl">
              Chaque agent maîtrise un domaine comptable spécifique. Complexité croissante, du calcul TVA à la modélisation IFRIC 12.
            </p>
          </motion.div>

          <div className="space-y-8">
            {AGENTS.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.15 }}
              >
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all hover:shadow-lg hover:shadow-blue-500/5">
                  <div className="grid md:grid-cols-[1fr_220px]">
                    {/* Main content */}
                    <div className="p-8">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${agent.accentBg}`}>
                          <agent.icon className={`h-5 w-5 ${agent.accentText}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-xl font-bold">{agent.title}</h3>
                          <p className="text-xs text-[var(--color-foreground-subtle)]">{agent.subtitle}</p>
                        </div>
                        <ComplexityBadge level={agent.complexity} />
                      </div>

                      {/* Norm badge */}
                      <p className={`text-xs ${agent.accentText} font-medium mb-4`}>{agent.norm}</p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {agent.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-foreground-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed mb-5">
                        {agent.description}
                      </p>

                      {/* Features */}
                      <ul className="space-y-2.5 mb-6">
                        {agent.features.map(f => (
                          <li key={f.text} className="flex items-start gap-3 text-xs text-[var(--color-foreground-muted)]">
                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${agent.accentBg}`}>
                              <f.icon className={`h-3 w-3 ${agent.accentText}`} />
                            </div>
                            {f.text}
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <div className="flex items-center justify-center gap-2 w-full md:w-auto md:inline-flex rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-foreground-subtle)] cursor-default">
                        Disponible prochainement
                      </div>
                    </div>

                    {/* KPI sidebar */}
                    <div className="border-t md:border-t-0 md:border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 flex flex-col justify-center gap-4">
                      {agent.kpis.map(kpi => (
                        <div key={kpi.label} className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-4">
                          <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider mb-1">
                            {kpi.label}
                          </p>
                          <p className={`font-display text-2xl font-bold ${agent.accentText}`}>
                            {kpi.value}
                          </p>
                        </div>
                      ))}
                      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-4">
                        <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider mb-1">
                          Onglets Excel
                        </p>
                        <p className={`font-display text-2xl font-bold ${agent.accentText}`}>
                          {agent.sheets}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                          <span className="text-[10px] text-blue-400 font-medium">Données connectées</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Orchestrateur ── */}
      <section className="border-t border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface)] to-transparent px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="text-center mb-10">
              <span className="text-xs font-bold text-yellow-400 uppercase tracking-[0.15em]">
                Orchestration
              </span>
              <h2 className="mt-3 font-display font-extrabold text-3xl md:text-4xl tracking-tight">
                Le cerveau de la clôture
              </h2>
              <p className="mt-2 text-[var(--color-foreground-muted)] max-w-lg mx-auto">
                L&apos;orchestrateur ne fait pas de comptabilité — il route, séquence, valide et consolide.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-yellow-500/20 bg-[var(--color-surface)] overflow-hidden relative">
              {/* Glow */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-80 rounded-full bg-yellow-500/10 blur-[80px]" />

              <div className="relative p-8 md:p-10">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Left: description */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <Workflow className="h-6 w-6 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="font-display text-2xl font-bold">{ORCHESTRATOR.title}</h3>
                        <p className="text-xs text-[var(--color-foreground-subtle)]">{ORCHESTRATOR.subtitle}</p>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed mb-6">
                      {ORCHESTRATOR.description}
                    </p>

                    <ul className="space-y-2.5">
                      {ORCHESTRATOR.features.map(f => (
                        <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-foreground-muted)]">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Right: specs */}
                  <div className="flex flex-col gap-4 md:w-56">
                    {ORCHESTRATOR.specs.map(spec => (
                      <div key={spec.label} className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-4 py-4 text-center">
                        <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider mb-1">
                          {spec.label}
                        </p>
                        <p className="font-display text-xl font-bold text-yellow-400">{spec.value}</p>
                      </div>
                    ))}

                    {/* Agent connections */}
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-4">
                      <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider mb-3">
                        Agents connectés
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-[var(--color-foreground-muted)]">TVA Transport</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-[var(--color-foreground-muted)]">Fleet Accounting</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full bg-neural-violet" />
                          <span className="text-[var(--color-foreground-muted)]">Concession Accounting</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Architecture diagram (simplified flow) ── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-[0.15em]">
              Architecture
            </span>
            <h2 className="mt-3 font-display font-extrabold text-3xl tracking-tight">
              Flux de données
            </h2>
            <p className="mt-2 text-[var(--color-foreground-muted)] max-w-lg mx-auto">
              Les 4 fichiers Excel alimentent les agents spécialisés, orchestrés pour produire le bilan consolidé.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2">
            {/* Sources */}
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400 text-center">
                4 Fichiers Excel
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 text-[10px] text-[var(--color-foreground-subtle)] text-center">
                TVA · Flotte · Concessions · Orchestrateur
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />

            {/* Agents */}
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 text-center">
                TVA Transport
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 text-center">
                Fleet Accounting
              </div>
              <div className="rounded-lg border border-neural-violet/20 bg-neural-violet/10 px-3 py-1.5 text-xs font-medium text-neural-violet text-center">
                Concession Accounting
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />

            {/* Orchestrator */}
            <div className="rounded-xl border-2 border-yellow-500/30 bg-yellow-500/5 px-6 py-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-yellow-400">Orchestrateur</span>
              </div>
              <p className="text-[10px] text-[var(--color-foreground-subtle)]">Clôture · HITL · Consolidation</p>
            </div>

            <ArrowRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />

            {/* Outputs */}
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-xs font-medium text-yellow-400 text-center">
                Bilan Consolidé
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 text-[10px] text-[var(--color-foreground-subtle)] text-center">
                CA3 · VNC · IFRIC 12 · Dashboard
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <section className="border-t border-[var(--color-border)] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1440px] text-center">
          <p className="text-xs text-[var(--color-foreground-subtle)]">
            NEURAL — Intelligence Augmentée pour le Transport · TransLogistic SAS · Données connectées en temps réel via Excel
          </p>
        </div>
      </section>
    </div>
  );
}
