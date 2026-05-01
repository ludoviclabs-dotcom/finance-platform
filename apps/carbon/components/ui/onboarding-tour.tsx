"use client";

/**
 * Tour guidé primo-utilisateur — overlay 5 étapes.
 *
 * - Auto-déclenché à la première visite (clé localStorage `carbonco-onboarding`).
 * - Étapes textuelles auto-suffisantes : pas de pointage DOM ni de scroll
 *   forcé, ce qui le rend robuste face aux changements de layout.
 * - Le composant n'a pas de dépendance au reste de l'app : tu l'importes,
 *   tu le poses dans le layout `(app)/layout.tsx` ou ailleurs, c'est tout.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "carbonco-onboarding";

interface Step {
  title: string;
  body: string;
  cta?: string;
}

const STEPS: readonly Step[] = [
  {
    title: "Bienvenue dans CarbonCo",
    body:
      "On va vous faire visiter en 5 étapes (≈ 60 secondes). Vous pouvez quitter à tout moment, votre progression sera sauvegardée.",
    cta: "Commencer la visite",
  },
  {
    title: "1. Importez vos données",
    body:
      "Glissez votre tableur Excel dans la zone d'upload. Chaque ligne reçoit automatiquement sa provenance (fichier, onglet, cellule).",
  },
  {
    title: "2. Vérifiez les calculs",
    body:
      "CarbonCo applique les facteurs ADEME, IPCC ou DEFRA. Le copilote IA propose des corrections sourcées ESRS si quelque chose paraît anormal.",
  },
  {
    title: "3. Audit trail",
    body:
      "Chaque écriture est signée SHA-256 et chaînée à la précédente. Votre commissaire aux comptes peut auditer ligne par ligne.",
  },
  {
    title: "4. Exportez le rapport",
    body:
      "PDF prêt OTI signé, ou export CSV/XLSX si vous préférez intégrer les chiffres à vos propres outils.",
  },
] as const;

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "done") setOpen(true);
    } catch {
      /* localStorage indisponible : on n'affiche pas pour ne pas spammer */
    }
  }, []);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      /* ignorer */
    }
    setOpen(false);
  }, []);

  if (!open) return null;
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-title"
      className="fixed inset-0 z-[180] flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-200 p-7">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-green-600">
            Visite guidée · {step + 1}/{STEPS.length}
          </span>
          <button
            type="button"
            aria-label="Fermer la visite"
            onClick={close}
            className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
          >
            ✕
          </button>
        </div>
        <h2 id="ob-title" className="font-extrabold text-xl text-neutral-900 mb-2">
          {current.title}
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed mb-6">{current.body}</p>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            className="text-sm text-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            ← Précédent
          </button>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-green-600" : "bg-neutral-300"}`}
              />
            ))}
          </div>
          {isLast ? (
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 cursor-pointer"
            >
              Terminer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 cursor-pointer"
            >
              {current.cta ?? "Suivant →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
