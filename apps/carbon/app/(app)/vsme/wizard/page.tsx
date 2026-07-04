"use client";

/**
 * /vsme/wizard — Parcours « VSME en 10 étapes » (T3.4). Barre de progression
 * persistée (reprise possible), navigation Prev/Next/Save, génération du rapport
 * à la fin. Les valeurs saisies (clés = codes datapoints) sont émises en facts
 * chaînés au `complete`.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  completeWizard,
  downloadVsmeReport,
  fetchWizardProgress,
  saveWizardStep,
  type VsmeWizardSession,
} from "@/lib/api";

type Field = { code: string; label: string; unit?: string; kind?: "number" | "text" | "bool" };
type Step = { key: string; label: string; intro?: string; fields?: Field[]; final?: boolean };

const STEPS: Step[] = [
  { key: "periodisation", label: "Période de reporting", fields: [
    { code: "B1-5", label: "Exercice de reporting", kind: "number" },
    { code: "B1-7", label: "Périmètre de consolidation", kind: "text" },
  ] },
  { key: "import", label: "Import / énergie", fields: [
    { code: "B3-7", label: "Consommation d'énergie", unit: "MWh", kind: "number" },
    { code: "B3-8", label: "Part d'énergie renouvelable", unit: "%", kind: "number" },
  ] },
  { key: "materialite", label: "Matérialité allégée",
    intro: "Identifiez les enjeux matériels (climat, eau, social, gouvernance). Le détail complet se fait dans le module Matérialité ; cette étape pré-remplit le contexte." },
  { key: "profil", label: "Profil (B1)", fields: [
    { code: "B1-1", label: "Raison sociale", kind: "text" },
    { code: "B1-2", label: "Code secteur (NAF)", kind: "text" },
    { code: "B1-3", label: "Effectif", unit: "ETP", kind: "number" },
    { code: "B1-4", label: "Chiffre d'affaires net", unit: "EUR", kind: "number" },
  ] },
  { key: "environnement", label: "Environnement (B3-B7)", fields: [
    { code: "B3-1", label: "Scope 1", unit: "tCO2e", kind: "number" },
    { code: "B3-2", label: "Scope 2 (LB)", unit: "tCO2e", kind: "number" },
    { code: "B3-4", label: "Scope 3", unit: "tCO2e", kind: "number" },
    { code: "B6-1", label: "Consommation d'eau", unit: "m3", kind: "number" },
    { code: "B7-1", label: "Déchets générés", unit: "t", kind: "number" },
  ] },
  { key: "social", label: "Social (B8-B10)", fields: [
    { code: "B8-1", label: "Effectif total", unit: "pers.", kind: "number" },
    { code: "B8-2", label: "Part de CDI", unit: "%", kind: "number" },
    { code: "B9-1", label: "Taux d'accidents (LTIR)", kind: "number" },
    { code: "B10-2", label: "Écart de rémunération F/H", unit: "%", kind: "number" },
  ] },
  { key: "gouvernance", label: "Gouvernance (B11)", fields: [
    { code: "B11-1", label: "Politique anti-corruption", kind: "bool" },
    { code: "B11-3", label: "Dispositif d'alerte", kind: "bool" },
  ] },
  { key: "anomalies", label: "Revue des anomalies",
    intro: "Les valeurs manquantes ou incohérentes apparaîtront ici. Vous pouvez confirmer malgré un avertissement, puis poursuivre." },
  { key: "revue", label: "Revue finale" },
  { key: "rapport", label: "Génération du rapport", final: true },
];

export default function VsmeWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchWizardProgress(ctrl.signal)
      .then((s: VsmeWizardSession) => {
        setStep(s.step && s.step >= 1 ? s.step : 1);
        setState(s.state ?? {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => ctrl.abort();
  }, []);

  const cfg = STEPS[step - 1];
  const setField = (code: string, value: unknown) => setState((s) => ({ ...s, [code]: value }));

  const persist = useCallback(
    async (targetStep: number) => {
      setBusy(true);
      try {
        await saveWizardStep(targetStep, state);
        setStep(targetStep);
      } finally {
        setBusy(false);
      }
    },
    [state],
  );

  const onComplete = async () => {
    setBusy(true);
    try {
      await completeWizard();
      router.push("/vsme/completude");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className="p-8 text-sm text-neutral-400">Chargement du parcours…</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8" data-testid="vsme-wizard">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">VSME en 10 étapes</h1>
      <p className="text-sm text-neutral-500 mb-5">
        Étape {step}/{STEPS.length} — {cfg.label}
      </p>

      <div className="flex gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`h-1.5 flex-1 rounded-full ${i + 1 < step ? "bg-emerald-500" : i + 1 === step ? "bg-black" : "bg-neutral-200"}`}
            title={s.label}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 p-6 min-h-[220px]">
        <h2 className="text-lg font-bold mb-4">{cfg.label}</h2>

        {cfg.intro && <p className="text-sm text-neutral-600 mb-4">{cfg.intro}</p>}

        {cfg.fields && (
          <div className="space-y-3">
            {cfg.fields.map((f) => (
              <label key={f.code} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-neutral-700">
                  {f.label} {f.unit && <span className="text-neutral-400">({f.unit})</span>}
                </span>
                {f.kind === "bool" ? (
                  <select
                    value={String(state[f.code] ?? "")}
                    onChange={(e) => setField(f.code, e.target.value)}
                    className="px-2 py-1 rounded border border-neutral-200 w-40"
                    data-testid={`field-${f.code}`}
                  >
                    <option value="">—</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                ) : (
                  <input
                    type={f.kind === "number" ? "number" : "text"}
                    value={String(state[f.code] ?? "")}
                    onChange={(e) =>
                      setField(
                        f.code,
                        f.kind === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value,
                      )
                    }
                    className="px-2 py-1 rounded border border-neutral-200 w-40"
                    data-testid={`field-${f.code}`}
                  />
                )}
              </label>
            ))}
          </div>
        )}

        {cfg.key === "revue" && (
          <ul className="text-xs text-neutral-600 space-y-1">
            {Object.entries(state).map(([k, v]) => (
              <li key={k}>
                <span className="font-mono text-neutral-400">{k}</span> : {String(v)}
              </li>
            ))}
            {Object.keys(state).length === 0 && <li className="text-neutral-400">Aucune valeur saisie.</li>}
          </ul>
        )}

        {cfg.final && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Votre rapport VSME est prêt. Téléchargez-le (PDF + annexe Excel auditable),
              puis terminez pour enregistrer vos valeurs.
            </p>
            <button
              onClick={async () => {
                // Persiste l'état du wizard dans vsme_field_values AVANT de bâtir le
                // rapport (qui lit ces valeurs), sinon le ZIP omettrait les saisies.
                setBusy(true);
                try {
                  await completeWizard();
                  await downloadVsmeReport();
                } catch {
                  /* ignore */
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="px-4 py-2 rounded-full border border-neutral-300 text-sm font-semibold disabled:opacity-40"
              data-testid="wizard-download"
            >
              {busy ? "Préparation…" : "Télécharger le rapport VSME"}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => persist(Math.max(1, step - 1))}
          disabled={step === 1 || busy}
          className="px-4 py-2 text-sm text-neutral-500 disabled:opacity-30"
        >
          ← Précédent
        </button>
        {cfg.final ? (
          <button
            onClick={onComplete}
            disabled={busy}
            className="px-5 py-2 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-40"
            data-testid="wizard-complete"
          >
            {busy ? "…" : "Terminer"}
          </button>
        ) : (
          <button
            onClick={() => persist(Math.min(STEPS.length, step + 1))}
            disabled={busy}
            className="px-5 py-2 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-40"
            data-testid="wizard-next"
          >
            {busy ? "…" : "Suivant →"}
          </button>
        )}
      </div>
    </div>
  );
}
