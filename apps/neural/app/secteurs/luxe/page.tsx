'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const WorkflowDiagram = dynamic(() => import('@/components/workflow/WorkflowDiagram'), { ssr: false });
import {
  ArrowRight,
  Building2,
  Coins,
  Package,
  TrendingUp,
  Globe,
  Shield,
  Layers,
  Download,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useNeural } from '@/lib/neural-hub/context';

const AGENTS = [
  {
    id: 'consolidation',
    href: '/agents/consolidation',
    icon: Building2,
    accent: 'neural-violet',
    accentRing: 'ring-neural-violet/30',
    accentBg: 'bg-neural-violet/10',
    accentText: 'text-neural-violet',
    title: 'Consolidation Groupe',
    subtitle: 'NEURAL_Consolidation_Groupe',
    normes: ['IFRS 10', 'IFRS 3', 'IAS 36', 'IAS 21'],
    description:
      'Consolide les états financiers des 7 entités du groupe Maison Aurelia. Calcul automatique du goodwill, tests de dépréciation IAS 36, éliminations intercompagnies et conversion multi-devises.',
    features: [
      'Périmètre de consolidation dynamique (IG, MEE)',
      'Goodwill IFRS 3 — méthode partielle ou complète',
      'Tests de dépréciation IAS 36 — DCF + valeur terminale',
      'Bilan & P&L consolidés avec part NCI',
    ],
    kpiLabel: 'CA consolidé',
    kpiKey: 'consolidatedRevenue' as const,
    kpiUnit: 'K€',
    status: 'live',
  },
  {
    id: 'inventaire-luxe',
    href: '/agents/inventaire-luxe',
    icon: Package,
    accent: 'emerald-400',
    accentRing: 'ring-emerald-400/30',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-400',
    title: 'Inventaire Luxe',
    subtitle: 'NEURAL_Inventaire_Luxe',
    normes: ['IAS 2', 'IFRS 15', 'IAS 36'],
    description:
      'Valorisation des stocks multi-maisons (maroquinerie, joaillerie, horlogerie). Calcul au coût amorti, test de dépréciation NRV, élimination des marges internes sur produits finis.',
    features: [
      'Ventilation par catégorie : matières, en-cours, produits finis',
      'Test NRV (Net Realisable Value) automatique',
      'Élimination des marges intra-groupe sur stocks aval',
      'Reporting par maison et par devise',
    ],
    kpiLabel: 'Valeur nette stocks',
    kpiValue: '4 147',
    kpiUnit: 'K€',
    status: 'coming',
  },
  {
    id: 'multi-currency',
    href: '/agents/multi-currency',
    icon: Globe,
    accent: 'blue-400',
    accentRing: 'ring-blue-400/30',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
    title: 'Multi-Currency IAS 21',
    subtitle: 'NEURAL_MultiCurrency_IAS21',
    normes: ['IAS 21', 'IFRS 9', 'IAS 39'],
    description:
      'Gestion centralisée des taux de change pour les 7 devises du groupe. Calcul des écarts de conversion, comptabilité de couverture IFRS 9, impact P&L et OCI.',
    features: [
      '12 mois de taux EUR/USD/GBP/JPY/CHF/CNY/AED',
      'Écarts de conversion clôture vs. moyen vs. historique',
      'Couverture de flux de trésorerie — part efficace/inefficace',
      'Impact automatique sur le bilan consolidé',
    ],
    kpiLabel: 'Impact P&L change',
    kpiValue: '+550',
    kpiUnit: 'K€',
    status: 'coming',
  },
];

const STATS = [
  { label: 'Entités consolidées', value: '7', icon: Building2 },
  { label: 'Devises gérées', value: '7', icon: Coins },
  { label: 'Normes IFRS couvertes', value: '8', icon: Shield },
  { label: 'Agents interconnectés', value: '3', icon: Layers },
];

export default function SecteursLuxePage() {
  const { results, flow } = useNeural();
  const conso = results.consolidation;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-gradient-to-b from-neural-violet/5 to-transparent px-6 pb-16 pt-32 md:px-12">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-neural-violet/8 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-emerald-500/5 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">👜</span>
              <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">
                Secteur Luxe — Maison Aurelia
              </span>
            </div>

            <h1 className="font-display font-extrabold text-4xl md:text-5xl lg:text-6xl tracking-tighter max-w-3xl">
              Agents IA pour le{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #a78bfa 0%, #c4b5fd 50%, #10b981 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                secteur Luxe
              </span>
            </h1>

            <p className="mt-5 text-lg text-[var(--color-foreground-muted)] max-w-2xl leading-relaxed">
              Trois simulateurs IFRS interconnectés, calibrés pour les spécificités du luxe :
              consolidation multi-maisons, valorisation d&apos;inventaire haute couture et gestion
              multi-devises sur 7 pays.
            </p>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
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

      {/* ── Data flow banner ── */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-sm font-semibold text-[var(--color-foreground-muted)]">
              Flux de données temps réel entre agents
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-blue-400 font-medium">
              MultiCurrency
            </span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="text-[var(--color-foreground-muted)]">Taux clôture + P&L change</span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-emerald-400 font-medium">
              Inventaire Luxe
            </span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="text-[var(--color-foreground-muted)]">Stocks valorisés + marges internes</span>
            <ChevronRight className="h-3 w-3 text-[var(--color-foreground-subtle)]" />
            <span className="rounded-lg bg-neural-violet/10 border border-neural-violet/20 px-3 py-1.5 text-neural-violet font-medium">
              Consolidation
            </span>
          </div>
        </div>
      </section>

      {/* ── Agent cards ── */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10">
            <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">
              Simulateurs
            </span>
            <h2 className="mt-2 font-display font-extrabold text-3xl md:text-4xl tracking-tight">
              3 agents, un écosystème
            </h2>
            <p className="mt-2 text-[var(--color-foreground-muted)]">
              Chaque agent se spécialise sur un domaine IFRS et alimente les autres en données.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {AGENTS.map((agent, i) => {
              // Compute KPI from live store for consolidation
              let kpiDisplay = agent.kpiValue ?? '—';
              if (agent.kpiKey && conso[agent.kpiKey] !== undefined) {
                kpiDisplay = conso[agent.kpiKey].toLocaleString('fr-FR');
              }

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                >
                  <div className={`group relative h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all hover:border-${agent.accent}/30 hover:shadow-lg hover:shadow-${agent.accent}/5`}>
                    {/* Status badge */}
                    <div className="absolute top-4 right-4">
                      {agent.status === 'live' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Opérationnel
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                          <Zap className="h-2.5 w-2.5" />
                          Bientôt
                        </span>
                      )}
                    </div>

                    {/* Icon */}
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${agent.accentBg} mb-4`}>
                      <agent.icon className={`h-6 w-6 ${agent.accentText}`} />
                    </div>

                    {/* Title */}
                    <h3 className="font-display text-xl font-bold mb-0.5">{agent.title}</h3>
                    <p className="text-[11px] font-mono text-[var(--color-foreground-subtle)] mb-3">
                      {agent.subtitle}
                    </p>

                    {/* Normes tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {agent.normes.map(n => (
                        <span
                          key={n}
                          className="rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-foreground-muted)]"
                        >
                          {n}
                        </span>
                      ))}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed mb-5">
                      {agent.description}
                    </p>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {agent.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs text-[var(--color-foreground-muted)]">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${agent.accentBg} ring-2 ${agent.accentRing}`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* KPI */}
                    <div className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-4 py-3 mb-5">
                      <p className="text-[10px] text-[var(--color-foreground-subtle)] uppercase tracking-wider mb-0.5">
                        {agent.kpiLabel}
                      </p>
                      <p className={`font-display text-2xl font-bold ${agent.accentText}`}>
                        {kpiDisplay}
                        <span className="text-sm font-normal text-[var(--color-foreground-muted)] ml-1">
                          {agent.kpiUnit}
                        </span>
                      </p>
                    </div>

                    {/* CTA */}
                    {agent.status === 'live' ? (
                      <Link
                        href={agent.href}
                        className={`flex items-center justify-center gap-2 w-full rounded-xl ${agent.accentBg} border border-${agent.accent}/20 px-4 py-2.5 text-sm font-semibold ${agent.accentText} transition-all hover:bg-${agent.accent}/20 group-hover:gap-3`}
                      >
                        Ouvrir le simulateur
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ) : (
                      <div className="flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-foreground-subtle)] cursor-default">
                        Disponible prochainement
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Export section ── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="font-display font-bold text-lg">Export des données</h3>
              <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
                Téléchargez les fichiers Excel interconnectés — les taux de change et marges
                se propagent automatiquement entre les fichiers.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/export/consolidation"
                className="inline-flex items-center gap-2 rounded-xl border border-neural-violet/30 bg-neural-violet/10 px-5 py-2.5 text-sm font-medium text-neural-violet hover:bg-neural-violet/20 transition-all"
              >
                <Download className="h-4 w-4" />
                Consolidation (.xlsx)
              </a>
              <a
                href="/api/export/full-pack"
                className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-2.5 text-sm font-medium text-yellow-400 hover:bg-yellow-500/20 transition-all"
              >
                <Download className="h-4 w-4" />
                Pack Complet (.zip)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture — Interactive Workflow ── */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <WorkflowDiagram />
        </div>
      </section>
    </div>
  );
}
