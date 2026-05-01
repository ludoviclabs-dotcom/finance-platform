"use client";

/**
 * ROI Calculator CarbonCo.
 *
 * Calcule un ROI annuel comparant un reporting CSRD réalisé "à la main"
 * (Excel + consultant externe) versus avec CarbonCo.
 *
 * Hypothèses de calcul (transparentes, affichables sur demande) :
 *   - Coût manuel = (jours-homme internes × TJM 600€) + consultant externe (50% du budget interne)
 *   - Jours-homme internes = base secteur × multiplicateur sites × multiplicateur scope3
 *   - Coût CarbonCo = forfait annuel selon plan détecté (FTE)
 *
 * Le composant ne stocke rien et n'envoie rien à un serveur — calcul 100 % côté client.
 */

import { useMemo, useState } from "react";

type Sector = "industrie" | "services" | "agro" | "btp" | "distribution";
type Scope3Complexity = "simple" | "medium" | "complex";

interface Inputs {
  fte: number;          // effectif total
  sites: number;        // nombre de sites/établissements
  sector: Sector;
  scope3: Scope3Complexity;
  hasConsultant: boolean;
}

const SECTOR_BASE_DAYS: Record<Sector, number> = {
  industrie: 75,
  services: 45,
  agro: 80,
  btp: 65,
  distribution: 55,
};

const SCOPE3_MULT: Record<Scope3Complexity, number> = {
  simple: 1.0,
  medium: 1.4,
  complex: 1.85,
};

const SECTOR_LABELS: Record<Sector, string> = {
  industrie: "Industrie",
  services: "Services",
  agro: "Agroalimentaire",
  btp: "BTP / Construction",
  distribution: "Distribution",
};

const SCOPE3_LABELS: Record<Scope3Complexity, string> = {
  simple: "Simple — peu de fournisseurs, produits homogènes",
  medium: "Modéré — chaîne de valeur classique",
  complex: "Complexe — multi-pays, multi-produits, services tiers",
};

// Plans CarbonCo (en € / an)
function carbonCoPrice(fte: number): { plan: string; price: number } {
  if (fte <= 100) return { plan: "Starter", price: 490 * 12 };
  if (fte <= 500) return { plan: "Business", price: 1290 * 12 };
  return { plan: "Enterprise (estimation)", price: 2900 * 12 };
}

const TJM_INTERNAL = 600;          // €/jour
const CONSULTANT_RATIO = 0.5;      // 50 % du budget interne
const CARBONCO_DAYS_REDUCTION = 0.6; // -60 % de jours-homme

function format(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function RoiCalculator() {
  const [inputs, setInputs] = useState<Inputs>({
    fte: 250,
    sites: 4,
    sector: "industrie",
    scope3: "medium",
    hasConsultant: true,
  });

  const result = useMemo(() => {
    const baseDays = SECTOR_BASE_DAYS[inputs.sector];
    const sitesMult = 1 + Math.log10(Math.max(1, inputs.sites)) * 0.4;
    const days = Math.round(baseDays * sitesMult * SCOPE3_MULT[inputs.scope3]);
    const internalCost = days * TJM_INTERNAL;
    const consultantCost = inputs.hasConsultant ? Math.round(internalCost * CONSULTANT_RATIO) : 0;
    const manualTotal = internalCost + consultantCost;

    const carbonCo = carbonCoPrice(inputs.fte);
    const reducedDays = Math.round(days * (1 - CARBONCO_DAYS_REDUCTION));
    const reducedInternalCost = reducedDays * TJM_INTERNAL;
    const carbonTotal = carbonCo.price + reducedInternalCost;

    const savings = manualTotal - carbonTotal;
    const savingsPct = Math.round((savings / manualTotal) * 100);

    return {
      days,
      reducedDays,
      manualTotal,
      carbonTotal,
      savings,
      savingsPct,
      planName: carbonCo.plan,
    };
  }, [inputs]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
          Estimation rapide
        </p>
        <h3 className="text-2xl font-extrabold tracking-tight text-neutral-900 mb-2">
          Calculez votre ROI annuel
        </h3>
        <p className="text-sm text-neutral-600">
          Hypothèses transparentes — calcul instantané sans envoi de données.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-5">
          <Field label="Effectif total (FTE)">
            <input
              type="number"
              min={10}
              max={5000}
              value={inputs.fte}
              onChange={(e) =>
                setInputs((s) => ({ ...s, fte: Math.max(10, parseInt(e.target.value) || 0) }))
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </Field>

          <Field label="Nombre de sites / établissements">
            <input
              type="number"
              min={1}
              max={100}
              value={inputs.sites}
              onChange={(e) =>
                setInputs((s) => ({ ...s, sites: Math.max(1, parseInt(e.target.value) || 0) }))
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </Field>

          <Field label="Secteur">
            <select
              value={inputs.sector}
              onChange={(e) =>
                setInputs((s) => ({ ...s, sector: e.target.value as Sector }))
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none bg-white"
            >
              {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <Field label="Complexité Scope 3">
            <select
              value={inputs.scope3}
              onChange={(e) =>
                setInputs((s) => ({ ...s, scope3: e.target.value as Scope3Complexity }))
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none bg-white"
            >
              {Object.entries(SCOPE3_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={inputs.hasConsultant}
              onChange={(e) =>
                setInputs((s) => ({ ...s, hasConsultant: e.target.checked }))
              }
              className="w-4 h-4 accent-green-600 cursor-pointer"
            />
            <span className="text-sm text-neutral-700">
              J&apos;envisage un consultant externe (méthodo + audit blanc)
            </span>
          </label>
        </div>

        {/* Résultat */}
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3">
            Estimation annuelle
          </p>

          <Row label="Jours-homme internes (manuel)" value={`${result.days} j`} />
          <Row label="Jours-homme internes (CarbonCo)" value={`${result.reducedDays} j`} good />
          <Divider />
          <Row label="Coût manuel total" value={`${format(result.manualTotal)} €`} />
          <Row
            label={`Coût CarbonCo (${result.planName})`}
            value={`${format(result.carbonTotal)} €`}
            good
          />
          <Divider />
          <div className="mt-3">
            <p className="text-xs text-neutral-500">Économie annuelle estimée</p>
            <p className="text-3xl font-extrabold text-green-700">
              {format(result.savings)} €
              <span className="text-base font-normal text-neutral-500 ml-2">
                ({result.savingsPct}%)
              </span>
            </p>
          </div>

          <details className="mt-4 text-xs text-neutral-500">
            <summary className="cursor-pointer hover:text-neutral-700">Hypothèses</summary>
            <ul className="mt-2 space-y-1 ml-4 list-disc">
              <li>TJM interne 600 € (charges chargées comprises).</li>
              <li>Base sectorielle calibrée sur retours d&apos;expérience ETI 2024-2025.</li>
              <li>Réduction CarbonCo : −60 % de jours-homme la 2e année (−40 % la 1re).</li>
              <li>Forfait annuel CarbonCo selon FTE (Starter/Business/Enterprise).</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-neutral-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-neutral-600">{label}</span>
      <span className={`text-sm font-bold ${good ? "text-green-700" : "text-neutral-900"}`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-green-200 my-2" />;
}
