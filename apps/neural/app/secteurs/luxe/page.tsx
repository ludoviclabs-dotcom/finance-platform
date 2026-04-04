'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Users,
  Shield,
  Layers,
  Coins,
  Globe,
  TrendingUp,
  Gem,
  Sparkles,
  Package,
  Receipt,
  UserCheck,
  BarChart3,
  GraduationCap,
} from 'lucide-react';

/* ── Branches (hub cards) ── */
const BRANCHES = [
  {
    id: 'finance',
    href: '/secteurs/luxe/finance',
    icon: Building2,
    gradient: 'from-neural-violet/20 via-neural-violet/5 to-transparent',
    borderHover: 'hover:border-neural-violet/40',
    accentText: 'text-neural-violet',
    accentBg: 'bg-neural-violet/10',
    title: 'Finance & Comptabilité IFRS',
    subtitle: '4 agents interconnectés',
    description:
      'Consolidation groupe, inventaire haute couture, gestion multi-devises et comptabilité des redevances. Normes IFRS 10, 3, IAS 2, 21, 36, IFRS 9.',
    agents: [
      { icon: Building2, name: 'Consolidation Groupe', status: 'live' },
      { icon: Package, name: 'Inventaire Luxe', status: 'coming' },
      { icon: Globe, name: 'Multi-Currency IAS 21', status: 'coming' },
      { icon: Receipt, name: 'Royalty Accounting', status: 'coming' },
    ],
    stats: [
      { label: 'Entités consolidées', value: '8' },
      { label: 'Devises gérées', value: '7' },
      { label: 'Normes IFRS', value: '10+' },
    ],
    ctaLabel: 'Explorer les simulateurs Finance',
  },
  {
    id: 'rh',
    href: '/secteurs/luxe/rh',
    icon: Users,
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    borderHover: 'hover:border-emerald-400/40',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    title: 'Ressources Humaines',
    subtitle: '3 agents spécialisés luxe',
    description:
      'Gestion des talents artisanaux, benchmark de rémunération sectoriel et onboarding personnalisé par maison. Conçu pour les métiers rares du luxe.',
    agents: [
      { icon: UserCheck, name: 'Artisan Talent', status: 'coming' },
      { icon: BarChart3, name: 'Comp & Benchmark', status: 'coming' },
      { icon: GraduationCap, name: 'Onboarding Luxe', status: 'coming' },
    ],
    stats: [
      { label: 'Métiers référencés', value: '30+' },
      { label: 'Pays couverts', value: '7' },
      { label: 'Maisons configurables', value: '15+' },
    ],
    ctaLabel: 'Explorer les outils RH',
  },
];

const GLOBAL_STATS = [
  { label: 'Agents IA', value: '7', icon: Layers },
  { label: 'Fichiers Excel connectés', value: '7', icon: Sparkles },
  { label: 'Normes & Standards', value: '15+', icon: Shield },
  { label: 'Branches métier', value: '2', icon: TrendingUp },
];

export default function LuxeHubPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-6 pb-20 pt-32 md:px-12">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-neural-violet/5 via-transparent to-transparent" />
        <div className="absolute -left-60 -top-60 h-[500px] w-[500px] rounded-full bg-neural-violet/8 blur-[150px]" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/3 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neural-violet/10 border border-neural-violet/20">
                <Gem className="h-5 w-5 text-neural-violet" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-neural-violet uppercase tracking-[0.2em]">
                  Secteur Luxe
                </span>
                <p className="text-[11px] text-[var(--color-foreground-subtle)]">Maison Aurelia</p>
              </div>
            </div>

            {/* Headline */}
            <h1 className="font-display font-extrabold text-4xl md:text-5xl lg:text-6xl xl:text-7xl tracking-tighter max-w-4xl leading-[0.95]">
              <span className="text-[var(--color-foreground)]">L&apos;intelligence</span>
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #a78bfa 0%, #c4b5fd 30%, #34d399 70%, #10b981 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                augmentée
              </span>
              <br />
              <span className="text-[var(--color-foreground)]">du luxe</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-[var(--color-foreground-muted)] max-w-2xl leading-relaxed">
              7 agents IA spécialisés, répartis en 2 branches métier, connectés à vos données
              Excel en temps réel. Finance IFRS et Ressources Humaines — conçus pour les
              spécificités des maisons de luxe.
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
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neural-violet/10">
                  <stat.icon className="h-4 w-4 text-neural-violet" />
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

      {/* ── Branches ── */}
      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-12"
          >
            <span className="text-xs font-bold text-neural-violet uppercase tracking-[0.15em]">
              Branches métier
            </span>
            <h2 className="mt-3 font-display font-extrabold text-3xl md:text-4xl tracking-tight">
              Choisissez votre domaine
            </h2>
            <p className="mt-2 text-[var(--color-foreground-muted)] max-w-xl">
              Chaque branche regroupe des agents IA spécialisés, interconnectés via le Neural Data Hub.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2">
            {BRANCHES.map((branch, i) => (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.15 }}
              >
                <Link href={branch.href} className="block group">
                  <div className={`relative h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all duration-300 ${branch.borderHover} hover:shadow-2xl hover:shadow-neural-violet/5`}>
                    {/* Gradient top */}
                    <div className={`absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${branch.gradient} opacity-60`} />

                    <div className="relative p-8">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${branch.accentBg} border border-[var(--color-border)]`}>
                            <branch.icon className={`h-7 w-7 ${branch.accentText}`} />
                          </div>
                          <div>
                            <h3 className="font-display text-2xl font-bold">{branch.title}</h3>
                            <p className={`text-sm ${branch.accentText} font-medium`}>{branch.subtitle}</p>
                          </div>
                        </div>
                        <ArrowRight className={`h-5 w-5 ${branch.accentText} opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1`} />
                      </div>

                      {/* Description */}
                      <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed mb-6">
                        {branch.description}
                      </p>

                      {/* Agent mini-cards */}
                      <div className="grid grid-cols-2 gap-2 mb-6">
                        {branch.agents.map(agent => (
                          <div
                            key={agent.name}
                            className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2"
                          >
                            <agent.icon className={`h-4 w-4 ${branch.accentText} shrink-0`} />
                            <span className="text-xs font-medium truncate">{agent.name}</span>
                            {agent.status === 'live' && (
                              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Stats bar */}
                      <div className="flex gap-6 pt-5 border-t border-[var(--color-border)]">
                        {branch.stats.map(stat => (
                          <div key={stat.label}>
                            <p className={`font-display text-lg font-bold ${branch.accentText}`}>{stat.value}</p>
                            <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className={`mt-6 flex items-center justify-center gap-2 w-full rounded-xl ${branch.accentBg} border border-[var(--color-border)] px-4 py-3 text-sm font-semibold ${branch.accentText} transition-all group-hover:gap-3`}>
                        {branch.ctaLabel}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture overview ── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-neural-violet uppercase tracking-[0.15em]">
              Architecture
            </span>
            <h2 className="mt-3 font-display font-extrabold text-3xl tracking-tight">
              Données interconnectées
            </h2>
            <p className="mt-2 text-[var(--color-foreground-muted)] max-w-lg mx-auto">
              Tous les agents partagent un flux de données commun. Les taux de change,
              marges et KPIs se propagent automatiquement entre branches.
            </p>
          </div>

          {/* Flow visualization */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2">
            {/* Sources */}
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400 text-center">
                7 Fichiers Excel
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 text-[10px] text-[var(--color-foreground-subtle)] text-center">
                ERP / Taux BCE / Stocks
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />

            {/* Neural Hub */}
            <div className="rounded-xl border-2 border-neural-violet/30 bg-neural-violet/5 px-6 py-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 bg-neural-violet rounded-full animate-pulse" />
                <span className="text-sm font-bold text-neural-violet">Neural Data Hub</span>
              </div>
              <p className="text-[10px] text-[var(--color-foreground-subtle)]">API /api/data — temps réel</p>
            </div>

            <ArrowRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />

            {/* Branches */}
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-neural-violet/20 bg-neural-violet/10 px-4 py-2 text-xs font-medium text-neural-violet text-center">
                Finance — 4 agents
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-400 text-center">
                RH — 3 agents
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-[var(--color-foreground-subtle)] rotate-90 md:rotate-0" />

            {/* Outputs */}
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-xs font-medium text-yellow-400 text-center">
                Dashboard / Export
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 text-[10px] text-[var(--color-foreground-subtle)] text-center">
                Excel / ZIP / PDF
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer note ── */}
      <section className="border-t border-[var(--color-border)] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1440px] text-center">
          <p className="text-xs text-[var(--color-foreground-subtle)]">
            NEURAL — Intelligence Augmentée pour les Maisons de Luxe · Données connectées en temps réel via Excel
          </p>
        </div>
      </section>
    </div>
  );
}
