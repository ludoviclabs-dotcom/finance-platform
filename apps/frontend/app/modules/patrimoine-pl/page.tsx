"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  TrendingUp,
  Shield,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Profession = "Médecin" | "Avocat" | "Expert-comptable" | "Architecte" | "Notaire";
type Statut = "BNC" | "SEL" | "SELARL";

interface FormData {
  // Step 0 — Identité
  profession: Profession;
  age: number;
  statut: Statut;
  // Step 1 — Revenus & charges
  honoraires: number;         // K€ bruts
  chargesDeductibles: number; // K€ charges pro réelles
  per: number;                // K€ versements PER annuels
  dividendes: number;         // K€ (SEL/SELARL uniquement)
  // Step 2 — Patrimoine
  valeurImmo: number;         // K€
  empruntImmo: number;        // K€ capital restant dû
  epargneFin: number;         // K€ livrets, PEA, CTO
  assuranceVie: number;       // K€ encours AV
}

interface Metrics {
  cs: number;              // K€ cotisations sociales BNC
  bnc: number;             // K€ BNC net (hon - chg - CS)
  revenuImposable: number; // K€ après PER
  ir: number;              // K€ impôt sur le revenu
  revenuNet: number;       // K€ revenu disponible
  economiePer: number;     // K€ économie fiscale PER
  // Comparatif statuts
  cs_bnc: number; ir_bnc: number; net_bnc: number;
  cs_sel: number; ir_sel: number; net_sel: number;
  // Retraite & patrimoine
  retraiteEstimee: number; // €/mois
  patrimoineNet: number;   // K€
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROFESSIONS: Profession[] = ["Médecin", "Avocat", "Expert-comptable", "Architecte", "Notaire"];
const STATUTS: Statut[] = ["BNC", "SEL", "SELARL"];

/** Taux cotisations sociales par profession (BNC) */
const CS_TAUX: Record<Profession, number> = {
  "Médecin":           0.247, // CARMF + URSSAF
  "Avocat":            0.237, // CNBF + URSSAF
  "Expert-comptable":  0.197, // CAVEC + URSSAF
  "Architecte":        0.197, // CIPAV + URSSAF
  "Notaire":           0.232, // CRPCEN + URSSAF
};

const CS_LABELS: Record<Profession, string> = {
  "Médecin":           "CARMF + URSSAF",
  "Avocat":            "CNBF + URSSAF",
  "Expert-comptable":  "CAVEC + URSSAF",
  "Architecte":        "CIPAV + URSSAF",
  "Notaire":           "CRPCEN + URSSAF",
};

/** Taux de remplacement retraite moyen par profession */
const TAUX_REMPLACEMENT: Record<Profession, number> = {
  "Médecin":           0.55,
  "Avocat":            0.50,
  "Expert-comptable":  0.45,
  "Architecte":        0.45,
  "Notaire":           0.52,
};

// Literals complets pour le scanner Tailwind
const BADGE_CLS: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  danger:  "bg-red-500/20 text-red-400 border border-red-500/30",
  info:    "bg-blue-500/20 text-blue-400 border border-blue-500/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtKE(ke: number): string {
  if (Math.abs(ke) >= 1000) return `${(ke / 1000).toFixed(2)} M€`;
  return `${ke.toFixed(1)} K€`;
}

function fmtPct(pct: number, dec = 1): string {
  return `${pct.toFixed(dec)} %`;
}

/** Barème IR 2024 (1 part, en euros) */
function calcIR(revenuEuros: number): number {
  const tranches = [
    { lim: 11_294,  taux: 0.00 },
    { lim: 28_797,  taux: 0.11 },
    { lim: 82_341,  taux: 0.30 },
    { lim: 177_106, taux: 0.41 },
    { lim: Infinity, taux: 0.45 },
  ];
  let ir = 0;
  let prev = 0;
  for (const { lim, taux } of tranches) {
    if (revenuEuros <= prev) break;
    const slice = Math.min(revenuEuros, lim) - prev;
    ir += slice * taux;
    prev = lim;
  }
  return Math.max(0, ir);
}

function compute(f: FormData): Metrics {
  // Conversion K€ → €
  const honEur = f.honoraires * 1000;
  const chgEur = f.chargesDeductibles * 1000;
  const perEur = f.per * 1000;

  // ── BNC / statut libéral ──────────────────────────────────
  const taux   = CS_TAUX[f.profession];
  const bncBrut = honEur - chgEur;
  const csEur   = bncBrut * taux;
  const bncEur  = bncBrut - csEur;

  const revImposable = Math.max(0, bncEur - perEur);
  const irEur        = calcIR(revImposable);
  const irSansPer    = calcIR(bncEur);
  const economiePer  = irSansPer - irEur;
  const revNetEur    = bncEur - irEur - perEur;

  // ── Comparatif BNC ────────────────────────────────────────
  const cs_bnc  = csEur;
  const ir_bnc  = irEur;
  const net_bnc = revNetEur;

  // ── Comparatif SEL / SELARL ───────────────────────────────
  // Rémunération dirigeant assimilé salarié = 50 % honoraires
  const salaireSel  = honEur * 0.50;
  const csSalSel    = salaireSel * 0.23; // charges salariales ≈ 23 %
  const csPatSel    = salaireSel * 0.42; // charges patronales ≈ 42 %
  const cs_sel      = csSalSel + csPatSel;
  const beneficeSel = Math.max(0, honEur - salaireSel - chgEur - csPatSel);
  const isSel       = beneficeSel * 0.25;
  const dividSel    = (beneficeSel - isSel) * 0.60; // 60 % distribués
  const pfuDivid    = dividSel * 0.30;              // PFU 30 %
  const revImpSel   = salaireSel * 0.90;            // abattement frais pro 10 %
  const ir_sel      = calcIR(revImpSel) + pfuDivid;
  const net_sel     = salaireSel - csSalSel - calcIR(revImpSel) + dividSel * 0.70;

  // ── Retraite ──────────────────────────────────────────────
  const txRempl        = TAUX_REMPLACEMENT[f.profession];
  const retraiteEstimee = (revNetEur * txRempl) / 12; // €/mois

  // ── Patrimoine ────────────────────────────────────────────
  const patrimoineNet =
    (f.valeurImmo - f.empruntImmo) + f.epargneFin + f.assuranceVie;

  return {
    cs: csEur / 1000,
    bnc: bncEur / 1000,
    revenuImposable: revImposable / 1000,
    ir: irEur / 1000,
    revenuNet: revNetEur / 1000,
    economiePer: economiePer / 1000,
    cs_bnc: cs_bnc / 1000,
    ir_bnc: ir_bnc / 1000,
    net_bnc: net_bnc / 1000,
    cs_sel: cs_sel / 1000,
    ir_sel: ir_sel / 1000,
    net_sel: net_sel / 1000,
    retraiteEstimee,
    patrimoineNet,
  };
}

type BadgeResult = { cls: string; label: string };

function irBadge(ir: number, bnc: number): BadgeResult {
  const eff = bnc > 0 ? ir / bnc : 0;
  if (eff < 0.20) return { cls: BADGE_CLS.success, label: `TME ${fmtPct(eff * 100)}` };
  if (eff < 0.30) return { cls: BADGE_CLS.warning, label: `TME ${fmtPct(eff * 100)}` };
  return { cls: BADGE_CLS.danger, label: `TME ${fmtPct(eff * 100)}` };
}

function perBadge(eco: number): BadgeResult {
  if (eco >= 4) return { cls: BADGE_CLS.success, label: `Économie ${fmtKE(eco)}` };
  if (eco >= 1) return { cls: BADGE_CLS.warning, label: `Économie ${fmtKE(eco)}` };
  return { cls: BADGE_CLS.info, label: "PER peu optimisé" };
}

function statutBadge(net_bnc: number, net_sel: number): BadgeResult {
  const diff = net_sel - net_bnc;
  if (diff >  10) return { cls: BADGE_CLS.success, label: "SEL + avantageux" };
  if (diff < -5)  return { cls: BADGE_CLS.warning, label: "BNC + avantageux" };
  return { cls: BADGE_CLS.info, label: "Écart faible" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Identité", "Revenus & charges", "Patrimoine"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8 flex-wrap">
      {STEP_LABELS.map((label, i) => {
        const active = i === step;
        const done   = i < step;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                active ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                done   ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                          "bg-white/5 text-zinc-500 border border-white/10"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  active ? "bg-purple-500 text-white" :
                  done   ? "bg-emerald-500 text-white" :
                            "bg-white/10 text-zinc-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px w-6 ${done ? "bg-emerald-500/50" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  label, value, onChange, unit = "K€", min = 0, max = 10000, step = 1, help,
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min?: number; max?: number; step?: number; help?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-300">{label}</label>
      {help && <p className="text-xs text-zinc-500">{help}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
        />
        <span className="text-xs text-zinc-500 w-8">{unit}</span>
      </div>
    </div>
  );
}

function ResultCard({
  label, value, sub, badge,
}: {
  label: string; value: string; sub?: string; badge?: BadgeResult;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-2">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      {badge && (
        <span className={`self-start px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

// ─── Valeurs par défaut ───────────────────────────────────────────────────────
// Médecin 45 ans, BNC, 200 K€ honoraires, 30 K€ charges, 10 K€ PER
// → CS ≈ 42 K€, IR ≈ 32.6 K€, économie PER ≈ 4.1 K€, net ≈ 85.4 K€
// → Retraite estimée ≈ 3 900 €/mois, patrimoine net ≈ 330 K€

const DEFAULTS: FormData = {
  profession:         "Médecin",
  age:                45,
  statut:             "BNC",
  honoraires:         200,
  chargesDeductibles: 30,
  per:                10,
  dividendes:         0,
  valeurImmo:         400,
  empruntImmo:        200,
  epargneFin:         80,
  assuranceVie:       50,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatrimoinePLPage() {
  const [step, setStep]             = useState(0);
  const [form, setForm]             = useState<FormData>(DEFAULTS);
  const [showResults, setShowResults] = useState(false);

  const update  = (patch: Partial<FormData>) => setForm(prev => ({ ...prev, ...patch }));
  const metrics = compute(form);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Navigation ── */}
      <div className="border-b border-white/10 px-6 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>
      </div>

      {/* ── Hero éditorial ── */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-6">
          Module 8 sur 8
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Patrimoine Professions Libérales
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mb-10">
          Optimisation fiscale IR 2024, comparatif statuts BNC / SEL / SELARL,
          et projection retraite CARMF / CNBF / CIPAV selon votre profession libérale.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            {
              Icon: Calculator,
              title: "Optimisation fiscale",
              desc:  "Barème IR 2024 par tranches, déductions PER, cotisations CARMF, CNBF, CAVEC, CIPAV et URSSAF selon la profession.",
            },
            {
              Icon: TrendingUp,
              title: "Comparatif statuts",
              desc:  "Simulation BNC vs SEL vs SELARL : charges sociales salariales & patronales, IS 25 %, PFU dividendes 30 %, revenu net dirigeant.",
            },
            {
              Icon: Shield,
              title: "Projection retraite",
              desc:  "Estimation de la pension par caisse de retraite, taux de remplacement moyen par profession et stratégie PER / assurance-vie.",
            },
          ].map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition-colors"
            >
              <Icon className="w-5 h-5 text-purple-400 mb-3" />
              <h3 className="font-semibold text-sm mb-2">{title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Indicateurs clés */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-6">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-4">
            Indicateurs clés simulés
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "IR estimé (barème 2024)", value: "Progressif 0 → 45 %" },
              { label: "Cotisations sociales",    value: "CARMF / CNBF / CIPAV" },
              { label: "Économie fiscale PER",    value: "Déduction revenu imposable" },
              { label: "Retraite estimée",        value: "Taux de remplacement profession" },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="text-sm font-medium text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Wizard ── */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="bg-white/3 border border-white/10 rounded-2xl p-8">
          <StepIndicator step={step} />

          {/* ── Étape 0 : Identité ── */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-6">Profil professionnel</h2>

              {/* Profession */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-300">Profession</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PROFESSIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => update({ profession: p })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        form.profession === p
                          ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/8"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <FormField
                label="Âge"
                value={form.age}
                onChange={v => update({ age: v })}
                unit="ans"
                min={25}
                max={70}
                step={1}
              />

              {/* Statut */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-300">Statut d&apos;exercice</label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUTS.map(s => (
                    <button
                      key={s}
                      onClick={() => update({ statut: s })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        form.statut === s
                          ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/8"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aperçu caisse */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-3">Paramètres de la profession</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Caisse de retraite</span>
                    <span className="text-white font-medium">{CS_LABELS[form.profession]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Taux cotisations sociales</span>
                    <span className="text-purple-400 font-bold">{fmtPct(CS_TAUX[form.profession] * 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Taux de remplacement retraite (estimé)</span>
                    <span className="text-zinc-300">{fmtPct(TAUX_REMPLACEMENT[form.profession] * 100)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Étape 1 : Revenus & charges ── */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-6">Revenus et charges</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  label="Honoraires bruts"
                  value={form.honoraires}
                  onChange={v => update({ honoraires: v })}
                  help="Chiffre d'affaires annuel brut"
                />
                <FormField
                  label="Charges déductibles"
                  value={form.chargesDeductibles}
                  onChange={v => update({ chargesDeductibles: v })}
                  help="Frais professionnels réels (loyer, personnel, assurances…)"
                />
                <FormField
                  label="Versements PER annuels"
                  value={form.per}
                  onChange={v => update({ per: v })}
                  help="Déductibles du revenu imposable (plafond 10 % revenus prof.)"
                />
                {form.statut !== "BNC" && (
                  <FormField
                    label="Dividendes reçus"
                    value={form.dividendes}
                    onChange={v => update({ dividendes: v })}
                    help="Dividendes distribués par la société (PFU 30 %)"
                  />
                )}
              </div>

              {/* Aperçu live */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wide">
                  Aperçu fiscal en temps réel
                </p>
                <div className="space-y-2">
                  {[
                    { label: `Cotisations sociales (${CS_LABELS[form.profession]})`, value: fmtKE(metrics.cs) },
                    { label: "BNC net de charges & cotisations",                     value: fmtKE(metrics.bnc) },
                    { label: "Revenu imposable après PER",                           value: fmtKE(metrics.revenuImposable) },
                    { label: "IR estimé (barème 2024)",                              value: fmtKE(metrics.ir) },
                    { label: "Économie fiscale PER",                                 value: fmtKE(metrics.economiePer) },
                    { label: "Revenu net disponible",                                value: fmtKE(metrics.revenuNet) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{label}</span>
                      <span className="font-medium text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Étape 2 : Patrimoine ── */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-6">Patrimoine</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  label="Immobilier — valeur de marché"
                  value={form.valeurImmo}
                  onChange={v => update({ valeurImmo: v })}
                  help="Résidence principale + investissements locatifs"
                />
                <FormField
                  label="Emprunts immobiliers"
                  value={form.empruntImmo}
                  onChange={v => update({ empruntImmo: v })}
                  help="Capital restant dû (ensemble des prêts)"
                />
                <FormField
                  label="Épargne financière"
                  value={form.epargneFin}
                  onChange={v => update({ epargneFin: v })}
                  help="Livrets réglementés, PEA, compte-titres"
                />
                <FormField
                  label="Assurance-vie"
                  value={form.assuranceVie}
                  onChange={v => update({ assuranceVie: v })}
                  help="Encours total des contrats AV"
                />
              </div>

              {/* Aperçu bilan */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wide">
                  Bilan patrimonial estimé
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Immobilier net (valeur − emprunts)", value: fmtKE(form.valeurImmo - form.empruntImmo) },
                    { label: "Épargne financière + AV",            value: fmtKE(form.epargneFin + form.assuranceVie) },
                    { label: "PER — capital constitué (estimé)",   value: fmtKE(form.per * 5) },
                    { label: "Patrimoine net total",               value: fmtKE(metrics.patrimoineNet) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{label}</span>
                      <span className="font-medium text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Navigation wizard ── */}
          <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-purple-500/20 border border-purple-500/50 text-purple-300 hover:bg-purple-500/30 transition-all"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowResults(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-all"
              >
                <Play className="w-4 h-4" />
                Lancer l&apos;analyse
              </button>
            )}
          </div>
        </div>

        {/* ── Résultats ── */}
        {showResults && (
          <div className="mt-10 space-y-6">
            <h2 className="text-2xl font-bold">Résultats de l&apos;analyse</h2>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ResultCard
                label="IR estimé (barème 2024)"
                value={fmtKE(metrics.ir)}
                sub={`TME ${fmtPct(metrics.bnc > 0 ? (metrics.ir / metrics.bnc) * 100 : 0)}`}
                badge={irBadge(metrics.ir, metrics.bnc)}
              />
              <ResultCard
                label="Économie fiscale PER"
                value={fmtKE(metrics.economiePer)}
                sub={`Sur ${fmtKE(form.per)} versés / an`}
                badge={perBadge(metrics.economiePer)}
              />
              <ResultCard
                label="Revenu net estimé"
                value={fmtKE(metrics.revenuNet)}
                sub="Après IR, CS et versements PER"
              />
            </div>

            {/* Comparatif statuts */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Comparatif BNC / SEL / SELARL</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-zinc-500 pb-3 font-medium">Indicateur</th>
                      <th className="text-right text-zinc-500 pb-3 font-medium">BNC</th>
                      <th className="text-right text-zinc-500 pb-3 font-medium">SEL / SELARL</th>
                      <th className="text-right text-zinc-500 pb-3 font-medium">Écart SEL − BNC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { label: "Charges sociales",      bnc: metrics.cs_bnc,  sel: metrics.cs_sel,  net: false },
                      { label: "Impôt sur le revenu",   bnc: metrics.ir_bnc,  sel: metrics.ir_sel,  net: false },
                      { label: "Revenu net dirigeant",  bnc: metrics.net_bnc, sel: metrics.net_sel, net: true  },
                    ].map(({ label, bnc, sel, net: isNet }) => {
                      const diff = sel - bnc;
                      const pos  = isNet ? diff > 0 : diff < 0;
                      const diffCls = diff === 0 ? "text-zinc-400" : pos ? "text-emerald-400" : "text-red-400";
                      return (
                        <tr key={label}>
                          <td className="py-3 text-zinc-300">{label}</td>
                          <td className="py-3 text-right text-white font-medium">{fmtKE(bnc)}</td>
                          <td className="py-3 text-right text-white font-medium">{fmtKE(sel)}</td>
                          <td className={`py-3 text-right font-medium ${diffCls}`}>
                            {diff >= 0 ? "+" : ""}{fmtKE(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Recommandation (rémunération dirigeant SEL fixée à 50 % des honoraires, IS 25 %, PFU 30 %)
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statutBadge(metrics.net_bnc, metrics.net_sel).cls}`}>
                  {statutBadge(metrics.net_bnc, metrics.net_sel).label}
                </span>
              </div>
            </div>

            {/* Retraite & Patrimoine */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Retraite */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Projection retraite</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Caisse de retraite</span>
                    <span className="text-white">{CS_LABELS[form.profession]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Cotisations sociales annuelles</span>
                    <span className="text-white">{fmtKE(metrics.cs)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Taux de remplacement estimé</span>
                    <span className="text-white">{fmtPct(TAUX_REMPLACEMENT[form.profession] * 100)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-white/10">
                    <span className="text-zinc-300 font-medium text-sm">Pension mensuelle estimée</span>
                    <span className="text-2xl font-bold text-purple-400">
                      {Math.round(metrics.retraiteEstimee).toLocaleString("fr-FR")} €/mois
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                  Estimation basée sur le revenu net actuel et le taux de remplacement moyen
                  observé pour la profession (hors rente PER).
                </p>
              </div>

              {/* Patrimoine */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Bilan patrimonial</h3>
                <div className="space-y-3">
                  {[
                    { label: "Immobilier brut",       value: fmtKE(form.valeurImmo) },
                    { label: "− Emprunts en cours",   value: `− ${fmtKE(form.empruntImmo)}` },
                    { label: "Épargne financière",    value: fmtKE(form.epargneFin) },
                    { label: "Assurance-vie",         value: fmtKE(form.assuranceVie) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{label}</span>
                      <span className="text-white">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-white/10">
                    <span className="text-zinc-300 font-medium text-sm">Patrimoine net total</span>
                    <span className="text-2xl font-bold text-purple-400">{fmtKE(metrics.patrimoineNet)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interprétation */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="font-semibold mb-3">Interprétation & recommandations</h3>
              <div className="space-y-2 text-sm text-zinc-400 leading-relaxed">
                <p>
                  En tant que <strong className="text-white">{form.profession}</strong> ({form.age} ans,{" "}
                  statut <strong className="text-white">{form.statut}</strong>), vos cotisations{" "}
                  {CS_LABELS[form.profession]} représentent{" "}
                  <strong className="text-white">{fmtPct(CS_TAUX[form.profession] * 100)}</strong> de votre BNC net
                  de charges, soit <strong className="text-white">{fmtKE(metrics.cs)}</strong> annuels.
                </p>
                <p>
                  Vos versements PER de <strong className="text-white">{fmtKE(form.per)}</strong> génèrent
                  une économie fiscale estimée à{" "}
                  <strong className="text-white">{fmtKE(metrics.economiePer)}</strong> en réduisant
                  votre revenu imposable à la tranche marginale d&apos;imposition (déductibilité plafonnée
                  à 10 % des revenus professionnels, dans la limite de 8 × PASS).
                </p>
                <p>
                  La structure SEL / SELARL permet de dissocier rémunération et dividendes (PFU 30 %).
                  Elle devient avantageuse à partir d&apos;honoraires élevés (&gt; 150 K€ selon le profil),
                  permettant de capitaliser les bénéfices à l&apos;IS (25 %) avant distribution.
                  En dessous, le BNC reste généralement plus simple et compétitif.
                </p>
                <p>
                  Votre patrimoine net de{" "}
                  <strong className="text-white">{fmtKE(metrics.patrimoineNet)}</strong> peut être
                  optimisé via l&apos;assurance-vie (exonération partielle des plus-values après 8 ans,
                  avantage successoral) et le PER (sortie en rente défiscalisée ou en capital à la retraite,
                  avec abattement de 10 % sur la rente).
                </p>
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => { setForm(DEFAULTS); setStep(0); setShowResults(false); }}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-4"
            >
              Réinitialiser la simulation
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
