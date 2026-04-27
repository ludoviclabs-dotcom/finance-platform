"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Leaf, ArrowRight, RotateCcw, Mail } from "lucide-react";

const MODELS = [
  { id: "sonnet", label: "Claude Sonnet 4.6", co2PerMillionTokens: 0.42, description: "Modèle principal NEURAL" },
  { id: "opus", label: "Claude Opus 4", co2PerMillionTokens: 1.85, description: "Pour cas d'usage complexes" },
  { id: "haiku", label: "Claude Haiku 4", co2PerMillionTokens: 0.12, description: "Modèle léger pour tâches simples" },
  { id: "gpt", label: "GPT-5 (fallback)", co2PerMillionTokens: 0.55, description: "Fallback documenté" },
];

const REGIONS = [
  { id: "eu-fr", label: "France (mix EDF nucléaire/renouvelable)", multiplier: 0.45 },
  { id: "eu-de", label: "Allemagne (mix charbon décroissant)", multiplier: 1.85 },
  { id: "eu-nordic", label: "Nordique (Suède/Norvège · majoritairement renouvelable)", multiplier: 0.15 },
  { id: "us", label: "USA (moyenne fédérale)", multiplier: 1.45 },
  { id: "global", label: "Global (moyenne pondérée)", multiplier: 1.0 },
];

const TOKENS_PER_DECISION = 2200; // ~2200 tokens par décision agent typique

interface Inputs {
  callsPerMonth: number;
  modelId: string;
  regionId: string;
  withSamplingMode: boolean;
}

const ETP_KM_CAR = 0.171; // kgCO2e/km voiture moyenne EU 2026
const ETP_KM_FLIGHT = 0.245; // kgCO2e/km vol court courrier

function computeFootprint(inputs: Inputs) {
  const model = MODELS.find((m) => m.id === inputs.modelId) || MODELS[0];
  const region = REGIONS.find((r) => r.id === inputs.regionId) || REGIONS[0];
  const tokensTotal = inputs.callsPerMonth * TOKENS_PER_DECISION;
  const baseCo2 = (tokensTotal / 1_000_000) * model.co2PerMillionTokens;
  const co2KgPerMonth = baseCo2 * region.multiplier * (inputs.withSamplingMode ? 0.7 : 1);

  const kmCarEq = co2KgPerMonth / ETP_KM_CAR;
  const kmFlightEq = co2KgPerMonth / ETP_KM_FLIGHT;
  const co2KgPerYear = co2KgPerMonth * 12;

  return {
    co2KgPerMonth: Math.round(co2KgPerMonth * 100) / 100,
    co2KgPerYear: Math.round(co2KgPerYear * 100) / 100,
    kmCarEq: Math.round(kmCarEq),
    kmFlightEq: Math.round(kmFlightEq),
    tokensTotal,
    model,
    region,
  };
}

export function CarbonCalculator() {
  const [inputs, setInputs] = useState<Inputs>({
    callsPerMonth: 5000,
    modelId: "sonnet",
    regionId: "eu-fr",
    withSamplingMode: false,
  });
  const [showResult, setShowResult] = useState(false);

  const result = useMemo(() => computeFootprint(inputs), [inputs]);

  if (showResult) {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-cyan-500/[0.06] p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <Leaf className="h-3 w-3" />
                Empreinte estimée
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                {result.co2KgPerMonth} kg CO2e/mois
              </h2>
              <p className="mt-2 text-sm uppercase tracking-[0.18em] text-white/55">
                {Math.round(result.co2KgPerYear)} kg CO2e/an · {result.model.label} · {result.region.label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowResult(false)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.10]"
            >
              <RotateCcw className="h-3 w-3" /> Refaire
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Équivalent voiture
            </p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white">
              {result.kmCarEq.toLocaleString("fr-FR")} km/mois
            </p>
            <p className="mt-2 text-xs text-white/55">
              Voiture moyenne EU 2026 — 0.171 kg CO2e/km
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Équivalent vol court-courrier
            </p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white">
              {result.kmFlightEq.toLocaleString("fr-FR")} km/mois
            </p>
            <p className="mt-2 text-xs text-white/55">
              Vol court-courrier EU — 0.245 kg CO2e/km
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">Détail calcul</p>
          <div className="mt-4 space-y-2 text-sm text-white/70">
            <div className="flex justify-between"><span>Décisions agent / mois</span><span className="font-mono tabular-nums">{inputs.callsPerMonth.toLocaleString("fr-FR")}</span></div>
            <div className="flex justify-between"><span>Tokens total / mois (~2200/décision)</span><span className="font-mono tabular-nums">{result.tokensTotal.toLocaleString("fr-FR")}</span></div>
            <div className="flex justify-between"><span>Émission base modèle</span><span className="font-mono tabular-nums">{result.model.co2PerMillionTokens} kg CO2e/M tokens</span></div>
            <div className="flex justify-between"><span>Multiplicateur région</span><span className="font-mono tabular-nums">×{result.region.multiplier}</span></div>
            {inputs.withSamplingMode && (
              <div className="flex justify-between text-emerald-300"><span>Mode sampling actif</span><span className="font-mono tabular-nums">×0.7</span></div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">
            Hypothèses utilisées
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-white/65">
            <li>• Émissions par modèle : estimées via benchmarks publics 2025-2026 (ML Commons, AI Energy Score)</li>
            <li>• Multiplicateur région : intensité carbone du mix électrique (RTE 2026 pour FR, ENTSO-E pour EU)</li>
            <li>• Mode sampling NEURAL : −30% via cache prompts + déduplication décisions identiques</li>
            <li>• Estimation conservative — empreinte réelle peut varier ±25% selon trafic et heure</li>
          </ul>
        </div>

        <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-emerald-300">
                <Mail className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.18em]">Empreinte par agent</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-white">
                Empreinte détaillée par agent NEURAL
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Rapport personnalisé : empreinte par agent de votre stack, comparaison vs
                développement alternatif, pistes d&apos;optimisation (sampling, modèle léger,
                région).
              </p>
            </div>
            <Link
              href="/contact?source=carbon-calculator"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
            >
              Recevoir le rapport
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-10 space-y-6">
        {/* Calls slider */}
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Décisions agent / mois
            </p>
            <p className="font-display text-4xl font-bold tabular-nums text-white">
              {inputs.callsPerMonth.toLocaleString("fr-FR")}
            </p>
          </div>
          <input
            type="range"
            min={500}
            max={500000}
            step={500}
            value={inputs.callsPerMonth}
            onChange={(e) => setInputs((p) => ({ ...p, callsPerMonth: Number(e.target.value) }))}
            className="mt-4 w-full accent-emerald-400"
          />
          <div className="mt-1 flex justify-between text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>500</span>
            <span>500 000</span>
          </div>
        </div>

        {/* Model select */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Modèle utilisé</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {MODELS.map((m) => {
              const selected = inputs.modelId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setInputs((p) => ({ ...p, modelId: m.id }))}
                  className={`text-left rounded-2xl border p-3 transition-all ${
                    selected
                      ? "border-violet-400/50 bg-violet-400/[0.10]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <p className={`text-sm font-semibold ${selected ? "text-white" : "text-white/85"}`}>
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/50">{m.description}</p>
                  <p className="mt-1 font-mono text-[10px] text-emerald-300">
                    {m.co2PerMillionTokens} kg CO2e / M tokens
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Region select */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Région d&apos;hébergement</p>
          <div className="mt-3 space-y-2">
            {REGIONS.map((r) => {
              const selected = inputs.regionId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setInputs((p) => ({ ...p, regionId: r.id }))}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${
                    selected
                      ? "border-emerald-400/50 bg-emerald-400/[0.08]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${selected ? "font-semibold text-white" : "text-white/85"}`}>
                      {r.label}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-300/80">×{r.multiplier}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sampling toggle */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <input
            type="checkbox"
            checked={inputs.withSamplingMode}
            onChange={(e) => setInputs((p) => ({ ...p, withSamplingMode: e.target.checked }))}
            className="mt-1 h-4 w-4 accent-emerald-400"
          />
          <div>
            <p className="text-sm font-semibold text-white">Mode sampling NEURAL activé</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">
              Cache prompts + déduplication des décisions identiques (−30% appels typiquement).
            </p>
          </div>
        </label>

        <button
          type="button"
          onClick={() => setShowResult(true)}
          className="w-full rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
        >
          Calculer l&apos;empreinte
        </button>
      </div>
    </div>
  );
}
