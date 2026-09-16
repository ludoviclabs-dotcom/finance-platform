"use client";

/**
 * ROI Calculator CarbonCo.
 *
 * Calcule un ROI annuel comparant un reporting CSRD réalisé "à la main"
 * (Excel + consultant externe) versus avec CarbonCo. Le calcul et les
 * hypothèses affichées vivent dans ./roi-model (fonctions pures, testées) :
 *   - Coût manuel = (jours-homme internes × TJM) + consultant externe éventuel
 *   - Jours-homme internes = base secteur × multiplicateur sites × multiplicateur scope3
 *   - Coût CarbonCo = forfait annuel selon l'effectif + jours-homme restants × TJM
 * Un écart négatif est présenté comme un surcoût, jamais comme une économie.
 *
 * Le composant ne stocke rien et n'envoie rien à un serveur — calcul 100 % côté client.
 *
 * Accessibilité :
 *   - Chaque champ a un htmlFor explicite via useId (labels associés sans nesting).
 *   - Les champs numériques annoncent leurs bornes et leur erreur de saisie
 *     (aria-describedby / aria-invalid).
 *   - Le bloc résultat est annoncé via aria-live="polite" pour les lecteurs d'écran
 *     lors d'un changement de valeur.
 */

import { useId, useMemo, useState } from "react";

import {
  clampInteger,
  commitIntegerInput,
  computeRoi,
  describeRoi,
  formatEuros,
  formatInteger,
  FTE_BOUNDS,
  parseIntegerInput,
  roiAssumptions,
  SCOPE3_LABELS,
  SECTOR_LABELS,
  SITES_BOUNDS,
  type IntegerBounds,
  type RoiInputs,
  type RoiTone,
  type Scope3Complexity,
  type Sector,
} from "./roi-model";

const TONE_STYLES: Record<RoiTone, { box: string; kicker: string; amount: string; divider: string }> = {
  positive: {
    box: "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200",
    kicker: "text-green-700",
    amount: "text-green-700",
    divider: "bg-green-200",
  },
  warning: {
    box: "bg-amber-50 border-amber-200",
    kicker: "text-amber-800",
    amount: "text-amber-800",
    divider: "bg-amber-200",
  },
  neutral: {
    box: "bg-neutral-50 border-neutral-200",
    kicker: "text-neutral-600",
    amount: "text-neutral-900",
    divider: "bg-neutral-200",
  },
};

const ASSUMPTIONS = roiAssumptions();

export function RoiCalculator() {
  const [inputs, setInputs] = useState<RoiInputs>({
    fte: 250,
    sites: 4,
    sector: "industrie",
    scope3: "medium",
    hasConsultant: true,
  });

  const result = useMemo(() => computeRoi(inputs), [inputs]);
  const summary = describeRoi(result);
  const tone = TONE_STYLES[summary.tone];

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
          <IntegerField
            label="Effectif total (ETP)"
            value={inputs.fte}
            bounds={FTE_BOUNDS}
            onCommit={(fte) => setInputs((s) => ({ ...s, fte }))}
          />

          <IntegerField
            label="Nombre de sites / établissements"
            value={inputs.sites}
            bounds={SITES_BOUNDS}
            onCommit={(sites) => setInputs((s) => ({ ...s, sites }))}
          />

          <Field label="Secteur">
            {(id) => (
              <select
                id={id}
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
            )}
          </Field>

          <Field label="Complexité Scope 3">
            {(id) => (
              <select
                id={id}
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
            )}
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

        {/* Résultat — annoncé via aria-live aux lecteurs d'écran lors du recalcul */}
        <div
          className={`rounded-xl border p-5 ${tone.box}`}
          role="region"
          aria-label="Estimation ROI annuelle"
          aria-live="polite"
          data-testid="roi-result"
          data-outcome={result.outcome}
        >
          <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${tone.kicker}`}>
            Estimation annuelle
          </p>

          <Row label="Jours-homme internes (manuel)" value={`${result.days} j`} />
          {/* Aucun vert dans un bloc de surcoût : le signal « favorable » ne
              doit pas contredire la conclusion affichée dessous. */}
          <Row
            label="Jours-homme internes (CarbonCo)"
            value={`${result.reducedDays} j`}
            good={result.outcome === "saving"}
          />
          <Divider className={tone.divider} />
          <Row label="Coût manuel total" value={formatEuros(result.manualTotal)} />
          <Row
            label={`Coût CarbonCo (${result.planName})`}
            value={formatEuros(result.carbonTotal)}
            good={result.outcome === "saving"}
          />
          <Divider className={tone.divider} />
          <div className="mt-3">
            <p className="text-xs text-neutral-600">{summary.label}</p>
            <p className={`text-3xl font-extrabold ${tone.amount}`} data-testid="roi-amount">
              {summary.amount}
            </p>
            <p className="text-sm text-neutral-600">{summary.detail}</p>
            {summary.note && (
              <p className="mt-2 text-xs leading-relaxed text-amber-900">{summary.note}</p>
            )}
          </div>

          <details className="mt-4 text-xs text-neutral-600">
            <summary className="cursor-pointer hover:text-neutral-800">Hypothèses</summary>
            <ul className="mt-2 space-y-1 ml-4 list-disc">
              {ASSUMPTIONS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="block">
      <label htmlFor={id} className="block text-sm font-semibold text-neutral-700 mb-1.5">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/**
 * Champ entier à état texte contrôlé (QA m-04) : un champ vidé reste vide
 * (plus de « 10 » réinjecté qui transformait la saisie « 500 » en 10500),
 * « 1e3 » est signalé au lieu d'être lu 1, et la valeur est bornée à la
 * sortie du champ. Le calcul suit la saisie dès qu'elle est un entier valide.
 */
function IntegerField({
  label,
  value,
  bounds,
  onCommit,
}: {
  label: string;
  value: number;
  bounds: IntegerBounds;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [text, setText] = useState(() => formatInteger(value));
  const invalid = parseIntegerInput(text).kind === "invalid";

  return (
    <div className="block">
      <label htmlFor={id} className="block text-sm font-semibold text-neutral-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const parsed = parseIntegerInput(next);
          if (parsed.kind === "ok") onCommit(clampInteger(parsed.value, bounds));
        }}
        onBlur={() => {
          const committed = commitIntegerInput(text, bounds, value);
          setText(formatInteger(committed));
          if (committed !== value) onCommit(committed);
        }}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
          invalid ? "border-amber-600 focus:border-amber-700" : "border-neutral-300 focus:border-green-500"
        }`}
      />
      <p id={hintId} className={`mt-1 text-xs ${invalid ? "text-amber-800" : "text-neutral-500"}`}>
        {invalid
          ? "Chiffres uniquement (ex. 250) — la dernière valeur valide est conservée."
          : `Entre ${formatInteger(bounds.min)} et ${formatInteger(bounds.max)}.`}
      </p>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-neutral-600">{label}</span>
      <span className={`text-sm font-bold whitespace-nowrap ${good ? "text-green-700" : "text-neutral-900"}`}>
        {value}
      </span>
    </div>
  );
}

function Divider({ className }: { className: string }) {
  return <div className={`h-px my-2 ${className}`} />;
}
