"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  ShieldCheck,
  BarChart3,
  Users,
  Leaf,
  Building2,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Scroll-reveal hook
// ---------------------------------------------------------------------------

function useReveal(threshold = 0.12) {
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
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STATS = [
  { value: "−10 à −30", unit: "bps", label: "sur le taux d'intérêt (green loans)", source: "BdF / LMA 2023" },
  { value: "−20 à −50", unit: "bps", label: "de réduction du coût de la dette documentée", source: "BCE 2021 · Friede et al." },
  { value: "−5 à −20", unit: "%", label: "de la facture énergétique après diagnostic ESG", source: "ADEME 2022" },
];

const PERSONAS = [
  {
    icon: Building2,
    role: "Direction Générale",
    headline: "Anticiper la norme, c'est choisir son tempo de transformation.",
    points: [
      "Les entreprises qui attendent l'obligation réglementaire subissent la transition. Celles qui anticipent la pilotent.",
      "L'adhésion volontaire réduit l'exposition aux risques réglementaires, physiques et de réputation simultanément.",
    ],
  },
  {
    icon: BarChart3,
    role: "DAF",
    headline: "Réduire le risque perçu, c'est améliorer l'accès au capital.",
    points: [
      "Les instruments de financement durable (green loans, SLL) sont conditionnés à la capacité à produire des données ESG fiables.",
      "Un reporting structuré donne une visibilité sur les coûts carbone et réglementaires futurs, aujourd'hui invisibles dans les comptes.",
    ],
  },
  {
    icon: TrendingDown,
    role: "Investisseur",
    headline: "La transparence ESG réduit l'asymétrie d'information — et donc le risque perçu.",
    points: [
      "Les entreprises non-transparentes sont de plus en plus exclues ou décotées par les fonds ISR.",
      "La résilience aux chocs réglementaires (CBAM, taxonomie, SFDR) est un facteur de stabilité du portefeuille.",
    ],
  },
  {
    icon: Users,
    role: "Donneur d'ordre",
    headline: "Vos fournisseurs ESG-ready réduisent votre scope 3 et votre risque supply chain.",
    points: [
      "Les grands groupes soumis à CSRD doivent documenter leur scope 3 — ils privilégient les fournisseurs capables de fournir des données carbone fiables.",
      "Être ESG-ready est devenu un critère de qualification fournisseur dans de nombreux secteurs.",
    ],
  },
];

const VALUE_CHAIN = [
  { step: "01", label: "Investissements initiaux", desc: "RH, SI, conseil, gouvernance → capacité à produire une donnée ESG fiable et continue." },
  { step: "02", label: "Réduction de l'asymétrie", desc: "Donnée fiable → transparence accrue → réduction du risque perçu par les parties prenantes." },
  { step: "03", label: "Meilleur accès au capital", desc: "Risque réduit → meilleure notation ESG → conditions de financement potentiellement améliorées." },
  { step: "04", label: "Gains commerciaux", desc: "Crédibilité ESG → maintien/gain d'appels d'offres grands comptes + différenciation + attractivité RH." },
  { step: "05", label: "Résilience & externalités", desc: "Pilotage structuré → anticipation des risques physiques et réglementaires + amélioration continue." },
];

const BEFORE_AFTER = [
  { category: "Accès au financement", before: "Financements standard uniquement", after: "Éligibilité aux green loans et sustainability-linked loans" },
  { category: "Relation grands comptes", before: "Risque d'exclusion appels d'offres ESG", after: "Capacité à répondre aux questionnaires scope 3 fournisseurs" },
  { category: "Pilotage opérationnel", before: "Coûts carbone et réglementaires invisibles", after: "Indicateurs carbone intégrés aux décisions d'investissement" },
  { category: "Exposition réglementaire", before: "Risque de mise en conformité en urgence", after: "Anticipation progressive, sans rupture opérationnelle" },
];

const CAPABILITIES = [
  { icon: BarChart3, label: "Dashboard consolidé", desc: "Snapshot automatisé multi-domaine Carbon, VSME, ESG, Finance." },
  { icon: TrendingDown, label: "Module Finance Climat & SFDR", desc: "14 indicateurs PAI calculés et exportables via rapport PDF." },
  { icon: ShieldCheck, label: "Rapport VSME exportable", desc: "Répondez aux questionnaires scope 3 fournisseurs des grands comptes." },
  { icon: Leaf, label: "Copilote IA grounded", desc: "Analyse en langage naturel sur données réelles — sans hallucination." },
];

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Navbar({ onCta }: { onCta: () => void }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--color-background)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-display font-bold text-[var(--color-foreground)] tracking-tight">
          Carbon <span className="text-[var(--color-primary)]">&</span> Co
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors"
          >
            Accueil
          </Link>
          <button
            type="button"
            onClick={onCta}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Accéder à la plateforme
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-20 pb-16">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-[var(--color-primary)]/8 blur-[80px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-3xl space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 text-xs font-medium text-[var(--color-primary)]">
          <Leaf className="w-3.5 h-3.5" />
          Value Mapping ESG — Adhésion volontaire
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--color-foreground)] leading-tight tracking-tight">
          L'adhésion volontaire ESG :{" "}
          <span className="text-[var(--color-primary)]">un investissement,</span>
          <br />
          pas une contrainte
        </h1>

        <p className="text-lg text-[var(--color-foreground-muted)] leading-relaxed max-w-2xl mx-auto">
          Les entreprises qui engagent une démarche ESG avant l'obligation réglementaire
          ne subissent pas un coût supplémentaire — elles transforment l'incertitude
          en actif stratégique.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCta}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity shadow-lg shadow-[var(--color-primary)]/20"
          >
            Accéder au mapping complet
            <ArrowRight className="w-4 h-4" />
          </button>
          <span className="text-xs text-[var(--color-foreground-muted)]">
            Contenu 100% éditorial · Sources vérifiées
          </span>
        </div>
      </motion.div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="py-16 px-6 border-y border-[var(--color-border)] bg-[var(--color-surface)]/50">
      <div className="max-w-5xl mx-auto">
        <Reveal className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center space-y-2">
              <div className="font-display text-3xl font-bold text-[var(--color-primary)]">
                {s.value}
                <span className="text-lg ml-1 text-[var(--color-foreground-muted)]">{s.unit}</span>
              </div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">{s.label}</p>
              <p className="text-xs text-[var(--color-foreground-muted)] opacity-70">{s.source}</p>
            </div>
          ))}
        </Reveal>
        <Reveal delay={0.1} className="mt-6 text-center">
          <p className="text-xs text-[var(--color-foreground-muted)] opacity-60 italic">
            Gains formulés en potentiel conditionnel · Sources : BCE 2021, BdF 2023, LMA 2023, ADEME 2022
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function PersonasSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        <Reveal className="text-center space-y-3">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-foreground)]">
            La logique économique selon votre fonction
          </h2>
          <p className="text-[var(--color-foreground-muted)] max-w-xl mx-auto">
            La valeur de l'adhésion ESG n'est pas la même selon votre rôle — mais elle est réelle pour chacun.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {PERSONAS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.role} delay={i * 0.08}>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 h-full">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-[var(--color-primary)]" style={{ width: 18, height: 18 }} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide">
                      {p.role}
                    </span>
                  </div>
                  <p className="font-semibold text-[var(--color-foreground)] leading-snug">
                    {p.headline}
                  </p>
                  <ul className="space-y-2">
                    {p.points.map((pt, j) => (
                      <li key={j} className="flex gap-2.5 text-sm text-[var(--color-foreground-muted)]">
                        <ChevronRight className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ValueChainSection() {
  return (
    <section className="py-20 px-6 bg-[var(--color-surface)]/40">
      <div className="max-w-4xl mx-auto space-y-12">
        <Reveal className="text-center space-y-3">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-foreground)]">
            De l'investissement initial à la création de valeur
          </h2>
          <p className="text-[var(--color-foreground-muted)] max-w-xl mx-auto">
            La chaîne de valeur ESG est linéaire et documentée. Voici comment chaque étape alimente la suivante.
          </p>
        </Reveal>

        <div className="relative space-y-4">
          {VALUE_CHAIN.map((item, i) => (
            <Reveal key={item.step} delay={i * 0.07}>
              <div className="flex gap-5 items-start">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-[var(--color-primary)]">{item.step}</span>
                  </div>
                  {i < VALUE_CHAIN.length - 1 && (
                    <div className="w-px h-6 bg-[var(--color-border)]" />
                  )}
                </div>
                <div className="pb-2 space-y-1">
                  <p className="font-semibold text-[var(--color-foreground)] text-sm">{item.label}</p>
                  <p className="text-sm text-[var(--color-foreground-muted)]">{item.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function BeforeAfterSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <Reveal className="text-center space-y-3">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-foreground)]">
            Avant / Après la démarche ESG
          </h2>
          <p className="text-[var(--color-foreground-muted)] max-w-xl mx-auto">
            Les transformations concrètes, domaine par domaine.
          </p>
        </Reveal>

        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 px-4 text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
            <span>Domaine</span>
            <span>Avant</span>
            <span>Après</span>
          </div>
          {BEFORE_AFTER.map((item, i) => (
            <Reveal key={item.category} delay={i * 0.06}>
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 items-center">
                <span className="text-sm font-semibold text-[var(--color-foreground)]">
                  {item.category}
                </span>
                <div className="flex gap-2 items-start">
                  <span className="text-red-400 mt-0.5 shrink-0 text-base leading-none">✗</span>
                  <span className="text-sm text-[var(--color-foreground-muted)]">{item.before}</span>
                </div>
                <div className="flex gap-2 items-start">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)] mt-0.5 shrink-0" />
                  <span className="text-sm text-[var(--color-foreground)]">{item.after}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilitiesSection({ onCta }: { onCta: () => void }) {
  return (
    <section className="py-20 px-6 bg-[var(--color-surface)]/40">
      <div className="max-w-5xl mx-auto space-y-12">
        <Reveal className="text-center space-y-3">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-foreground)]">
            Ce que Carbon & Co active pour vous
          </h2>
          <p className="text-[var(--color-foreground-muted)] max-w-xl mx-auto">
            Chaque module de la plateforme active un levier spécifique de la chaîne de valeur ESG.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <Reveal key={cap.label} delay={i * 0.07}>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex gap-4 items-start">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                    <Icon className="text-[var(--color-primary)]" style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-[var(--color-foreground)]">{cap.label}</p>
                    <p className="text-sm text-[var(--color-foreground-muted)]">{cap.desc}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2} className="text-center">
          <button
            type="button"
            onClick={onCta}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity shadow-lg shadow-[var(--color-primary)]/20"
          >
            Voir le mapping complet avec vos données
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="mt-3 text-xs text-[var(--color-foreground-muted)]">
            Connexion requise · Gratuit pendant la période d'accès anticipé
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-8 px-6 text-center space-y-2">
      <p className="text-xs text-[var(--color-foreground-muted)]">
        <span className="font-medium">Carbon & Co</span>
        {" · "}Contenu 100% éditorial et déterministe — aucun appel LLM pour ces données
        {" · "}Sources vérifiées · Gains formulés en potentiel conditionnel
      </p>
      <p className="text-xs text-[var(--color-foreground-muted)] opacity-60">
        Version 1.0 · Dernière révision : 2026-04-13 · Prochaine révision prévue : 2026-07-01
      </p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface ValueMappingEsgLandingProps {
  onCta: () => void;
}

export function ValueMappingEsgLanding({ onCta }: ValueMappingEsgLandingProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Navbar onCta={onCta} />

      <main id="main-content" className="pt-14">
        <HeroSection onCta={onCta} />
        <StatsSection />
        <PersonasSection />
        <ValueChainSection />
        <BeforeAfterSection />
        <CapabilitiesSection onCta={onCta} />
      </main>

      <Footer />
    </div>
  );
}
