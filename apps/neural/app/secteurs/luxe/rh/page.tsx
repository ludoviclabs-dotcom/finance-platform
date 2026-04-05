'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const TalentWorkflowDiagram = dynamic(
  () => import('@/components/workflow/TalentWorkflowDiagram'),
  { ssr: false }
);
import {
  ArrowLeft,
  ArrowRight,
  Users,
  UserCheck,
  BarChart3,
  GraduationCap,
  Shield,
  Layers,
  Globe,
  Gem,
  ChevronRight,
  Zap,
  Target,
  Heart,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Scale,
  ClipboardCheck,
  BookOpen,
} from 'lucide-react';

const AGENTS = [
  {
    id: 'artisan-talent',
    href: '/agents/artisan-talent',
    icon: UserCheck,
    accent: 'emerald-400',
    accentRing: 'ring-emerald-400/30',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-400',
    title: 'Artisan Talent',
    subtitle: 'NEURAL_LuxeArtisanTalent',
    tags: ['GPEC', 'Talent Management', 'Succession'],
    description:
      'Gestion prévisionnelle des métiers d\'art rares — selliers-maroquiniers, sertisseurs, lapidaires, guillocheurs. Cartographie des compétences, gap analysis, plans de succession et vivier de talents.',
    features: [
      { icon: Target, text: '30+ métiers artisanaux référencés avec scoring de rareté' },
      { icon: AlertTriangle, text: 'Gap analysis automatique — 14 postes en déficit, 8 urgences critiques' },
      { icon: Users, text: 'Vivier de 60 talents avec pipeline actif et alertes dormants' },
      { icon: Heart, text: 'Plans de succession pour 12 titulaires critiques' },
    ],
    kpiLabel: 'Artisans en poste',
    kpiValue: '38',
    kpiUnit: '',
    kpi2Label: 'Gaps critiques',
    kpi2Value: '8',
    status: 'coming',
  },
  {
    id: 'comp-benchmark',
    href: '/agents/comp-benchmark',
    icon: BarChart3,
    accent: 'blue-400',
    accentRing: 'ring-blue-400/30',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
    title: 'Comp & Benchmark',
    subtitle: 'NEURAL_LuxeCompBenchmark',
    tags: ['Rémunération', 'Benchmark', 'Équité'],
    description:
      'Benchmark de rémunération sectoriel pour les métiers du luxe — grille salariale multi-pays, simulateur de package, calculateur expatriation, analyse d\'équité interne H/F.',
    features: [
      { icon: DollarSign, text: 'Masse salariale de référence : 4,3M€ sur 25 postes' },
      { icon: Scale, text: 'Analyse d\'équité interne — 11 alertes, écart H/F -11%' },
      { icon: Globe, text: 'Calculateur expatriation FR ↔ CH/US/JP/AE' },
      { icon: TrendingUp, text: 'Historique CAGR 2022-2026 par métier et pays' },
    ],
    kpiLabel: 'Masse salariale',
    kpiValue: '4 329',
    kpiUnit: 'K€',
    kpi2Label: 'Compa-ratio médian',
    kpi2Value: '0.95',
    status: 'coming',
  },
  {
    id: 'onboarding',
    href: '/agents/onboarding',
    icon: GraduationCap,
    accent: 'neural-violet',
    accentRing: 'ring-neural-violet/30',
    accentBg: 'bg-neural-violet/10',
    accentText: 'text-neural-violet',
    title: 'Onboarding Luxe',
    subtitle: 'NEURAL_LuxeOnboarding',
    tags: ['Intégration', 'Culture', 'Probation'],
    description:
      'Parcours d\'intégration personnalisé par maison de luxe — 26 jalons, culture de la maison, checklist formations obligatoires, système buddy/mentorat, évaluations J+30 à J+365.',
    features: [
      { icon: ClipboardCheck, text: '26 actions d\'onboarding avec timeline et responsables' },
      { icon: BookOpen, text: 'Culture de 15+ maisons (LV, Hermès, Chanel, Cartier...)' },
      { icon: Users, text: 'Système buddy/mentorat avec suivi des interactions' },
      { icon: Target, text: '7 critères d\'évaluation sur 5 jalons (J+30 à J+365)' },
    ],
    kpiLabel: 'Jours restants',
    kpiValue: '90',
    kpiUnit: 'j',
    kpi2Label: 'Évaluations',
    kpi2Value: '7 critères',
    status: 'coming',
  },
];

const STATS = [
  { label: 'Métiers référencés', value: '30+', icon: Gem },
  { label: 'Pays couverts', value: '7', icon: Globe },
  { label: 'Agents RH', value: '3', icon: Layers },
  { label: 'Maisons configurables', value: '15+', icon: Shield },
];

export default function LuxeRHPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-gradient-to-b from-emerald-500/5 to-transparent px-6 pb-16 pt-32 md:px-12">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-neural-violet/5 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px]">
          {/* Back link */}
          <Link
            href="/secteurs/luxe"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-foreground-muted)] hover:text-emerald-400 transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au Hub Luxe
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">👥</span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                Ressources Humaines — Maison Aurelia
              </span>
            </div>

            <h1 className="font-display font-extrabold text-4xl md:text-5xl lg:text-6xl tracking-tighter max-w-3xl">
              Outils{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #34d399 0%, #6ee7b7 50%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                RH Luxe
              </span>
            </h1>

            <p className="mt-5 text-lg text-[var(--color-foreground-muted)] max-w-2xl leading-relaxed">
              Trois agents spécialisés pour les métiers rares du luxe : gestion des talents
              artisanaux, benchmark de rémunération sectoriel et onboarding personnalisé
              par maison.
            </p>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {STATS.map(stat => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <stat.icon className="h-4 w-4 text-emerald-400" />
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

      {/* ── Data flow banner ── */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-sm font-semibold text-[var(--color-foreground-muted)]">
              Flux de données entre agents RH
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-emerald-400 font-medium">
              Artisan Talent
            </span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="text-[var(--color-foreground-muted)]">Métiers + Gaps + Scoring</span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-blue-400 font-medium">
              Comp & Benchmark
            </span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="text-[var(--color-foreground-muted)]">Grille salariale + Package</span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="rounded-lg bg-neural-violet/10 border border-neural-violet/20 px-3 py-1.5 text-neural-violet font-medium">
              Onboarding Luxe
            </span>
          </div>
        </div>
      </section>

      {/* ── Agent cards ── */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Outils RH
            </span>
            <h2 className="mt-2 font-display font-extrabold text-3xl md:text-4xl tracking-tight">
              3 agents, les métiers du luxe
            </h2>
            <p className="mt-2 text-[var(--color-foreground-muted)]">
              Chaque agent est conçu pour les spécificités des maisons de luxe — métiers rares,
              mobilité internationale, culture de la maison.
            </p>
          </div>

          <div className="grid gap-8">
            {AGENTS.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.12 }}
              >
                <div className={`group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all hover:border-${agent.accent}/30 hover:shadow-lg hover:shadow-${agent.accent}/5`}>
                  <div className="grid md:grid-cols-[1fr_320px]">
                    {/* Left: Content */}
                    <div className="p-8">
                      {/* Status badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${agent.accentBg}`}>
                            <agent.icon className={`h-6 w-6 ${agent.accentText}`} />
                          </div>
                          <div>
                            <h3 className="font-display text-xl font-bold">{agent.title}</h3>
                            <p className="text-[11px] font-mono text-[var(--color-foreground-subtle)]">
                              {agent.subtitle}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                          <Zap className="h-2.5 w-2.5" />
                          Bientôt
                        </span>
                      </div>

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

                      {/* Features with icons */}
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

                    {/* Right: KPIs sidebar */}
                    <div className="border-t md:border-t-0 md:border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 flex flex-col justify-center gap-4">
                      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-4">
                        <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider mb-1">
                          {agent.kpiLabel}
                        </p>
                        <p className={`font-display text-3xl font-bold ${agent.accentText}`}>
                          {agent.kpiValue}
                          {agent.kpiUnit && (
                            <span className="text-sm font-normal text-[var(--color-foreground-muted)] ml-1">
                              {agent.kpiUnit}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-4">
                        <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider mb-1">
                          {agent.kpi2Label}
                        </p>
                        <p className={`font-display text-3xl font-bold ${agent.accentText}`}>
                          {agent.kpi2Value}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-[var(--color-foreground-subtle)]">
                          Données Excel connectées
                        </p>
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                          <span className="text-[10px] text-green-400 font-medium">Temps réel</span>
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

      {/* ── Talent Workflow Diagram ── */}
      <section className="border-t border-[var(--color-border)] bg-gradient-to-b from-[#0A1628] to-[#080F1E] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <TalentWorkflowDiagram />
        </div>
      </section>

      {/* ── Footer ── */}
      <section className="border-t border-[var(--color-border)] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1440px] text-center">
          <p className="text-xs text-[var(--color-foreground-subtle)]">
            NEURAL — Intelligence Augmentée pour les Maisons de Luxe · Branche Ressources Humaines
          </p>
        </div>
      </section>
    </div>
  );
}
