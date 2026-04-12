"use client";

import {
  Package,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileText,
  Recycle,
  Zap,
  Globe,
  ShieldCheck,
  QrCode,
  CalendarClock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Static roadmap data — DPP/ESPR not yet in backend snapshot
// ---------------------------------------------------------------------------

const timeline = [
  {
    date: "2024",
    label: "ESPR publiée",
    description: "Règlement européen Ecodesign for Sustainable Products (ESPR) en vigueur.",
    done: true,
  },
  {
    date: "2026",
    label: "Pilotes sectoriels",
    description: "Premiers secteurs couverts : textiles, batteries, électronique. Phase de test du registre ESPR.",
    done: false,
    active: true,
  },
  {
    date: "2027",
    label: "DPP obligatoire",
    description: "Passeport Produit Numérique obligatoire pour les secteurs prioritaires. Intégration dans CarbonCo prévue.",
    done: false,
  },
  {
    date: "2030",
    label: "Couverture étendue",
    description: "Extension à tous les groupes de produits couverts par ESPR.",
    done: false,
  },
];

const features = [
  {
    icon: Zap,
    color: "text-amber-500",
    label: "PCF — Product Carbon Footprint",
    description: "Empreinte carbone du produit sur cycle de vie complet (ACV). Lié au Scope 3 aval.",
    status: "planned" as const,
  },
  {
    icon: Recycle,
    color: "text-emerald-500",
    label: "Recyclabilité & matières",
    description: "Part recyclable, matières premières critiques, contenu recyclé.",
    status: "planned" as const,
  },
  {
    icon: Clock,
    color: "text-cyan-500",
    label: "Durabilité & durée de vie",
    description: "Durée de vie déclarée, réparabilité, disponibilité des pièces.",
    status: "planned" as const,
  },
  {
    icon: Globe,
    color: "text-blue-500",
    label: "Traçabilité chaîne de valeur",
    description: "Origine des composants, fournisseurs, conformité UNGC.",
    status: "planned" as const,
  },
  {
    icon: ShieldCheck,
    color: "text-violet-500",
    label: "Conformité réglementaire",
    description: "Marquage CE, substances SVHC, RoHS, REACH.",
    status: "planned" as const,
  },
  {
    icon: QrCode,
    color: "text-pink-500",
    label: "QR code & registre ESPR",
    description: "Lien vers le registre européen DPP. Scan produit via QR.",
    status: "planned" as const,
  },
];

const sectors = [
  { label: "Textiles & vêtements", covered: true },
  { label: "Batteries & accumulateurs", covered: true },
  { label: "Électronique & informatique", covered: true },
  { label: "Meubles & ameublement", covered: false },
  { label: "Acier & aluminium", covered: false },
  { label: "Produits chimiques", covered: false },
  { label: "Plastiques", covered: false },
  { label: "Construction & BTP", covered: false },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DppPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <Package className="w-6 h-6 text-carbon-emerald" />
          Digital Product Passport
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Passeport Produit Numérique — conformité ESPR 2027, PCF, recyclabilité, traçabilité.
        </p>
      </div>

      {/* Status banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-semibold text-amber-800 mb-1">Module en cours de développement</h2>
          <p className="text-sm text-amber-700">
            Le règlement ESPR entre en vigueur progressivement à partir de 2026. Le module DPP de
            CarbonCo sera activé dès que les obligations s&apos;appliquent à votre secteur.
            En attendant, retrouvez ci-dessous la roadmap réglementaire et les fonctionnalités prévues.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-carbon-emerald" />
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Calendrier ESPR</h3>
        </div>
        <div className="p-5">
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-3.5 top-2 bottom-2 w-px bg-[var(--color-border)]" />
            <div className="space-y-6">
              {timeline.map((step, i) => (
                <div key={i} className="flex gap-4 relative">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                      step.done
                        ? "bg-[var(--color-success-bg)]"
                        : step.active
                          ? "bg-amber-50 border-2 border-amber-400"
                          : "bg-[var(--color-border)]"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
                    ) : step.active ? (
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-[var(--color-foreground-muted)]" />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-[var(--color-foreground-muted)]">
                        {step.date}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          step.done
                            ? "text-[var(--color-foreground)]"
                            : step.active
                              ? "text-amber-700"
                              : "text-[var(--color-foreground-muted)]"
                        }`}
                      >
                        {step.label}
                      </span>
                      {step.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                          En cours
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-foreground-muted)]">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fonctionnalités prévues */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <FileText className="w-4 h-4 text-carbon-emerald" />
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
            Fonctionnalités prévues dans CarbonCo
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className={`p-5 flex gap-3 ${i >= 2 ? "border-t border-[var(--color-border)]" : ""}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}/10`}>
                  <Icon className={`w-4 h-4 ${f.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-[var(--color-foreground)]">{f.label}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-foreground-muted)] font-semibold">
                      Prévu
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-foreground-muted)]">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secteurs couverts */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
            Secteurs prioritaires ESPR (pilotes 2026)
          </h3>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sectors.map((s, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 flex items-center gap-2 ${
                s.covered
                  ? "border-[var(--color-success-bg)] bg-[var(--color-success-bg)]"
                  : "border-[var(--color-border)] bg-[var(--color-background)]"
              }`}
            >
              {s.covered ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[var(--color-foreground-muted)] flex-shrink-0" />
              )}
              <span
                className={`text-xs font-medium ${
                  s.covered ? "text-[var(--color-success)]" : "text-[var(--color-foreground-muted)]"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
