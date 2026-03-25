"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  TrendingUp,
  Calculator,
  ArrowRight,
  Check,
} from "lucide-react";
import Link from "next/link";

type Sector =
  | "transport"
  | "luxe"
  | "aeronautique"
  | "saas"
  | "banque"
  | "assurance";

type Branch =
  | "si"
  | "rh"
  | "marketing"
  | "communication"
  | "comptabilite"
  | "finance"
  | "supply-chain";

const SECTORS: Record<Sector, { label: string; emoji: string; multiplier: number }> = {
  transport:    { label: "Transport",    emoji: "\u{1F686}", multiplier: 1.0 },
  luxe:         { label: "Luxe",         emoji: "\u{1F45C}", multiplier: 1.15 },
  aeronautique: { label: "Aéronautique", emoji: "\u{2708}\u{FE0F}", multiplier: 1.3 },
  saas:         { label: "SaaS",         emoji: "\u{1F4BB}", multiplier: 0.75 },
  banque:       { label: "Banque",       emoji: "\u{1F3E6}", multiplier: 1.35 },
  assurance:    { label: "Assurance",    emoji: "\u{1F6E1}\u{FE0F}", multiplier: 1.25 },
};

const BRANCHES: Record<Branch, { label: string; basePrice: number }> = {
  si:             { label: "Systèmes d'Information", basePrice: 35000 },
  rh:             { label: "Ressources Humaines",    basePrice: 28000 },
  marketing:      { label: "Marketing",              basePrice: 25000 },
  communication:  { label: "Communication",          basePrice: 22000 },
  comptabilite:   { label: "Comptabilité",           basePrice: 32000 },
  finance:        { label: "Finance",                basePrice: 38000 },
  "supply-chain": { label: "Supply Chain",           basePrice: 30000 },
};

const FORFAITS = [
  { id: "starter",    name: "Starter" },
  { id: "business",   name: "Business" },
  { id: "enterprise", name: "Enterprise" },
  { id: "premium",    name: "Premium" },
];

export function PriceSimulator() {
  const [sector, setSector] = useState<Sector | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<number>(50);
  const [step, setStep] = useState(1);

  const toggleBranch = (branch: Branch) => {
    setBranches((prev) =>
      prev.includes(branch)
        ? prev.filter((b) => b !== branch)
        : [...prev, branch]
    );
  };

  const estimation = useMemo(() => {
    if (!sector || branches.length === 0) return null;

    const sectorMult = SECTORS[sector].multiplier;
    const branchesSetup = branches.reduce(
      (sum, b) => sum + BRANCHES[b].basePrice * sectorMult,
      0
    );

    const branchDiscount =
      branches.length >= 5 ? 0.8 : branches.length >= 3 ? 0.9 : 1;

    const setup = Math.round(branchesSetup * branchDiscount);

    const baseMonthly =
      users <= 50 ? 1290 : users <= 250 ? 9500 : users <= 1000 ? 45000 : 110000;
    const branchSurcharge = branches.length * 800;
    const monthly = Math.round((baseMonthly + branchSurcharge) * sectorMult);

    const hoursSavedPerUser = branches.length * 3.5;
    const annualSaving = users * hoursSavedPerUser * 48 * 65;
    const annualCost = setup + monthly * 12;
    const roi = Math.round(((annualSaving - annualCost) / annualCost) * 100);

    const forfait =
      users <= 50
        ? "starter"
        : users <= 500
          ? "business"
          : users <= 5000
            ? "enterprise"
            : "premium";

    return {
      setup,
      monthly,
      annual: monthly * 12 + setup,
      saving: Math.round(annualSaving),
      roi: Math.max(roi, 0),
      forfait,
      hoursSaved: Math.round(users * hoursSavedPerUser * 48),
    };
  }, [sector, branches, users]);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Progress Bar */}
      <div className="mb-12 flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                step >= s
                  ? "bg-neural-violet text-white"
                  : "bg-surface-raised text-foreground-subtle"
              }`}
            >
              {step > s ? <Check className="h-5 w-5" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`h-0.5 w-12 transition-all sm:w-20 ${
                  step > s ? "bg-neural-violet" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Sector */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="text-center"
          >
            <Building2 className="mx-auto h-12 w-12 text-neural-violet" />
            <h2 className="mt-4 font-display text-2xl font-bold">
              Dans quel secteur opérez-vous ?
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {(Object.entries(SECTORS) as [Sector, (typeof SECTORS)[Sector]][]).map(
                ([key, { label, emoji }]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSector(key);
                      setStep(2);
                    }}
                    className={`group rounded-xl border-2 p-6 text-left transition-all hover:border-neural-violet hover:shadow-lg ${
                      sector === key
                        ? "border-neural-violet bg-neural-violet/5"
                        : "border-border"
                    }`}
                  >
                    <span className="text-3xl">{emoji}</span>
                    <p className="mt-2 font-semibold">{label}</p>
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 2: Branches */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="text-center"
          >
            <TrendingUp className="mx-auto h-12 w-12 text-neural-violet" />
            <h2 className="mt-4 font-display text-2xl font-bold">
              Quelles branches souhaitez-vous transformer ?
            </h2>
            <p className="mt-2 text-foreground-muted">
              Sélectionnez au moins une branche
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(Object.entries(BRANCHES) as [Branch, (typeof BRANCHES)[Branch]][]).map(
                ([key, { label }]) => (
                  <button
                    key={key}
                    onClick={() => toggleBranch(key)}
                    className={`rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                      branches.includes(key)
                        ? "border-neural-violet bg-neural-violet/10 text-neural-violet"
                        : "border-border hover:border-neural-violet/50"
                    }`}
                  >
                    {branches.includes(key) && (
                      <Check className="mx-auto mb-1 h-4 w-4" />
                    )}
                    {label}
                  </button>
                )
              )}
            </div>
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-surface-raised"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={branches.length === 0}
                className="inline-flex items-center rounded-lg bg-neural-violet px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neural-violet-dark disabled:opacity-50"
              >
                Suivant <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Users */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="text-center"
          >
            <Users className="mx-auto h-12 w-12 text-neural-violet" />
            <h2 className="mt-4 font-display text-2xl font-bold">
              Combien d&apos;utilisateurs ?
            </h2>
            <div className="mx-auto mt-8 max-w-md">
              <input
                type="range"
                min="5"
                max="5000"
                step="5"
                value={users}
                onChange={(e) => setUsers(Number(e.target.value))}
                className="w-full accent-neural-violet"
              />
              <div className="mt-4 flex items-center justify-center gap-4">
                <input
                  type="number"
                  min="1"
                  max="50000"
                  value={users}
                  onChange={(e) =>
                    setUsers(Math.max(1, Number(e.target.value)))
                  }
                  className="w-32 rounded-lg border-2 border-border bg-surface p-3 text-center font-display text-2xl font-bold focus:border-neural-violet focus:outline-none"
                />
                <span className="text-lg text-foreground-muted">utilisateurs</span>
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-surface-raised"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center rounded-lg bg-neural-violet px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neural-violet-dark"
              >
                Voir mon estimation <Calculator className="ml-2 h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Results */}
        {step === 4 && estimation && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h2 className="font-display text-2xl font-bold">
              Votre estimation personnalisée
            </h2>
            <p className="mt-2 text-foreground-muted">
              {SECTORS[sector!].emoji} {SECTORS[sector!].label} ·{" "}
              {branches.length} branche(s) · {users} utilisateurs
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="card p-6">
                <p className="data-label">Setup (one-time)</p>
                <p className="mt-1 tabnum text-2xl font-bold text-neural-violet">
                  {estimation.setup.toLocaleString("fr-FR")} &euro;
                </p>
              </div>
              <div className="card p-6">
                <p className="data-label">Mensuel</p>
                <p className="mt-1 tabnum text-2xl font-bold text-neural-violet">
                  {estimation.monthly.toLocaleString("fr-FR")} &euro;
                </p>
              </div>
              <div className="card p-6">
                <p className="data-label">Économie annuelle</p>
                <p className="mt-1 tabnum text-2xl font-bold text-success">
                  {estimation.saving.toLocaleString("fr-FR")} &euro;
                </p>
              </div>
              <div className="card p-6">
                <p className="data-label">ROI estimé (an 1)</p>
                <p className="mt-1 tabnum text-2xl font-bold text-success">
                  {estimation.roi}%
                </p>
              </div>
            </div>

            {/* Recommended Forfait */}
            <div className="mt-8 rounded-2xl border-2 border-neural-violet bg-neural-violet/5 p-8">
              <p className="data-label text-neural-violet">
                Forfait recommandé
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {FORFAITS.find((f) => f.id === estimation.forfait)?.name}
              </p>
              <p className="mt-2 text-foreground-muted">
                ~{estimation.hoursSaved.toLocaleString("fr-FR")} heures
                économisées par an
              </p>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center rounded-xl bg-neural-violet px-8 py-3 font-semibold text-white transition-colors hover:bg-neural-violet-dark"
              >
                Demander un devis détaillé
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <button
                onClick={() => {
                  setStep(1);
                  setSector(null);
                  setBranches([]);
                  setUsers(50);
                }}
                className="rounded-xl border border-border px-8 py-3 font-semibold transition-colors hover:bg-surface-raised"
              >
                Recommencer
              </button>
            </div>

            <p className="mt-6 text-xs text-foreground-subtle">
              * Estimation indicative basée sur les moyennes sectorielles.
              Un devis précis sera établi après un audit initial.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
