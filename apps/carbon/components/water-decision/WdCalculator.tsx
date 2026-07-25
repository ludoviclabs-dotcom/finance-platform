"use client";

/**
 * components/water-decision/WdCalculator.tsx — calculateur financier hydrique
 * en quatre étapes (Wave E-Interface, commit F2).
 *
 * ## Ce que ce composant ne fait pas
 *
 * - **Il ne calcule rien pendant la saisie.** Aucun `useEffect` n'observe le
 *   formulaire. `evaluateFinancialScenario` n'est appelé que dans le
 *   gestionnaire de soumission de l'étape de revue : un chiffre qui apparaît
 *   pendant qu'on tape se lit comme un résultat, alors qu'il porterait sur une
 *   saisie incomplète.
 * - **Il ne persiste rien.** Ni `localStorage`, ni `sessionStorage`, ni cookie,
 *   ni brouillon serveur. Le scénario vit le temps de la page.
 * - **Il ne propose aucune valeur.** Aucun champ n'a de valeur initiale, et
 *   aucun champ numérique n'a de `placeholder` : « 0,08 » sous un taux
 *   d'actualisation est un taux recommandé, quoi qu'en dise l'étiquette.
 * - **Il n'écrit aucune écriture comptable.** IAS 36, IAS 37 et IFRIC 21 sont
 *   rendus comme des questions à examiner, jamais comme des conclusions.
 *
 * ## Ce qu'il tient
 *
 * Le retour à l'étape précédente ne perd aucune saisie : l'état vit dans un
 * unique brouillon détenu par ce composant, les étapes ne font que le
 * découper. Les montants restent des chaînes décimales jusqu'au rendu.
 */

import { useCallback, useId, useRef, useState } from "react";

import {
  DecisionAuthError,
  DecisionSchemaNotReadyError,
  evaluateFinancialScenario,
  type WiFinancialScenarioResponse,
} from "@/lib/api/water-decision";
import { driverLabel } from "@/lib/water-intelligence/financial-engine";
import {
  ACCOUNTING_QUESTIONS,
  PROVENANCE_LABELS,
  QUANTITY_META,
  REVIEW_STEP_INDEX,
  STEPS,
  STEP_COUNT,
  buildReviewRows,
  buildReviewWarnings,
  clampStep,
  componentLabel,
  emptyScenarioDraft,
  firstStepWithError,
  quantityErrorKey,
  validateScenarioDraft,
  type FieldErrors,
  type QuantityDraft,
  type QuantityField,
  type ReviewRow,
  type ScenarioDraft,
} from "@/lib/water-decision/scenario-form";

/* ------------------------------------------------------------ État résultat */

export type WdResultState =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "done"; readonly response: WiFinancialScenarioResponse }
  | { readonly kind: "access_denied"; readonly status: number }
  | { readonly kind: "schema_unavailable" }
  | { readonly kind: "unexpected_error"; readonly message: string };

/* ---------------------------------------------------------------- Stepper */

/** Progression. `aria-current` porte l'étape active — pas seulement la couleur. */
export function WdStepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progression du calculateur" data-testid="wd-stepper">
      <p className="text-sm font-medium text-[var(--color-foreground)]">
        Étape {current + 1} sur {STEP_COUNT} — {STEPS[current].title}
      </p>
      <ol className="mt-2 flex flex-wrap gap-2" role="list">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step.id}>
              <span
                aria-current={active ? "step" : undefined}
                data-testid={`wd-step-marker-${step.id}`}
                className={[
                  "inline-block rounded-[var(--radius-full)] border px-3 py-1 text-xs",
                  active
                    ? "border-[var(--color-ring)] font-semibold text-[var(--color-foreground)]"
                    : "border-[var(--color-border)] text-[var(--color-foreground-muted)]",
                ].join(" ")}
              >
                {index + 1}. {step.title}
                {done && <span className="sr-only"> (étape déjà renseignée)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------ Champ texte */

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-[var(--color-danger-strong)]" data-testid={`wd-error-${id}`}>
      {message}
    </p>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  error,
  onChange,
  maxLength,
  multiline,
  testId,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (next: string) => void;
  maxLength?: number;
  multiline?: boolean;
  testId: string;
}) {
  const hintId = hint ? `${id}-aide` : undefined;
  const errorId = `${id}-erreur`;
  const describedBy = [hintId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs text-[var(--color-foreground-muted)]">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          id={id}
          data-testid={testId}
          value={value}
          rows={3}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-foreground)]"
        />
      ) : (
        <input
          id={id}
          data-testid={testId}
          type="text"
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-foreground)]"
        />
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/* ------------------------------------------------------- Champ « grandeur » */

/**
 * Une grandeur = valeur + origine + base.
 *
 * `type="text"` avec `inputMode="decimal"` plutôt que `type="number"` : le
 * champ numérique natif normalise la saisie et interdit la virgule française,
 * là où la valeur doit rester la chaîne exacte que l'utilisateur a écrite.
 *
 * Aucun `placeholder` : un exemple chiffré serait lu comme une recommandation.
 */
export function WdQuantityField({
  field,
  draft,
  errors,
  idPrefix,
  onChange,
}: {
  field: QuantityField;
  draft: QuantityDraft;
  errors: FieldErrors;
  idPrefix: string;
  onChange: (next: QuantityDraft) => void;
}) {
  const meta = QUANTITY_META[field];
  const baseId = `${idPrefix}-${field}`;
  const valueError = errors[quantityErrorKey(field, "value")];
  const provenanceError = errors[quantityErrorKey(field, "provenance")];
  const basisError = errors[quantityErrorKey(field, "basis")];
  const descId = `${baseId}-desc`;
  const valueErrorId = `${baseId}-valeur-erreur`;
  const provenanceErrorId = `${baseId}-origine-erreur`;

  return (
    <fieldset
      className="min-w-0 rounded-[var(--radius)] border border-[var(--color-border)] p-3"
      data-testid={`wd-quantity-${field}`}
    >
      <legend className="px-1 text-sm font-medium text-[var(--color-foreground)]">
        {meta.label} <span className="font-normal text-[var(--color-foreground-muted)]">({meta.unitLabel})</span>
        {/* Le mot porte l'information ; la teinte rouge ne faisait que la
            répéter, et à 3,03:1 sur la surface sombre elle la répétait mal. */}
        {meta.required ? (
          <span className="font-semibold text-[var(--color-foreground)]"> — obligatoire</span>
        ) : (
          <span className="text-[var(--color-foreground-muted)]"> — facultatif</span>
        )}
      </legend>

      <p id={descId} className="text-xs leading-relaxed text-[var(--color-foreground-muted)]">
        {meta.description}
      </p>

      <label
        htmlFor={`${baseId}-valeur`}
        className="mt-2 block text-xs font-medium text-[var(--color-foreground)]"
      >
        Valeur ({meta.unitLabel})
      </label>
      <input
        id={`${baseId}-valeur`}
        type="text"
        inputMode="decimal"
        value={draft.value}
        aria-invalid={valueError ? true : undefined}
        aria-describedby={[descId, valueError ? valueErrorId : undefined]
          .filter(Boolean)
          .join(" ")}
        onChange={(e) => onChange({ ...draft, value: e.target.value })}
        className="mt-1 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-foreground)]"
      />
      <FieldError id={valueErrorId} message={valueError} />

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-[var(--color-foreground)]">
          Origine de la valeur
        </legend>
        {(["observed", "assumption"] as const).map((provenance) => (
          <label
            key={provenance}
            htmlFor={`${baseId}-${provenance}`}
            className="mt-1 flex items-start gap-2 text-xs text-[var(--color-foreground-muted)]"
          >
            <input
              id={`${baseId}-${provenance}`}
              type="radio"
              name={`${baseId}-origine`}
              value={provenance}
              checked={draft.provenance === provenance}
              aria-describedby={provenanceError ? provenanceErrorId : undefined}
              onChange={() => onChange({ ...draft, provenance })}
              className="mt-0.5"
            />
            <span>{PROVENANCE_LABELS[provenance]}</span>
          </label>
        ))}
        <FieldError id={provenanceErrorId} message={provenanceError} />
      </fieldset>

      <TextField
        id={`${baseId}-base`}
        testId={`wd-basis-${field}`}
        label="Base de la valeur"
        hint="Sur quoi repose ce chiffre — le moteur l’exige et le renvoie tel quel."
        value={draft.basis}
        error={basisError}
        maxLength={500}
        onChange={(basis) => onChange({ ...draft, basis })}
      />
    </fieldset>
  );
}

/* ------------------------------------------------------------ Table de revue */

/** Toutes les hypothèses, unités comprises. Un champ vide dit qu'il est vide. */
export function WdReviewTable({ rows }: { rows: readonly ReviewRow[] }) {
  return (
    <div className="overflow-x-auto" data-testid="wd-review-table">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">
          Hypothèses saisies, leurs unités, leur origine humaine et leur base
        </caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-foreground-muted)]">
            <th scope="col" className="py-2 pr-3">Hypothèse</th>
            <th scope="col" className="py-2 pr-3">Valeur</th>
            <th scope="col" className="py-2 pr-3">Unité</th>
            <th scope="col" className="py-2 pr-3">Origine</th>
            <th scope="col" className="py-2 pr-3">Base</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field} className="border-b border-[var(--color-border)]/60 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--color-foreground)]">
                {row.label}
              </th>
              <td className="py-2 pr-3 font-mono text-[var(--color-foreground)]">{row.value}</td>
              <td className="py-2 pr-3 text-[var(--color-foreground-muted)]">{row.unitLabel}</td>
              <td className="py-2 pr-3 text-[var(--color-foreground-muted)]">{row.origin}</td>
              <td className="py-2 pr-3 text-[var(--color-foreground-muted)]">{row.basis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------ Résultat */

/**
 * Résultat.
 *
 * La valeur centrale n'est jamais rendue seule : ses bandes de sensibilité
 * l'accompagnent, comme le refus n°5 du contrat moteur l'exige. Un résultat
 * absent est affiché comme absent et motivé — jamais comme zéro.
 */
export function WdResultPanel({
  state,
  rows,
}: {
  state: WdResultState;
  rows: readonly ReviewRow[];
}) {
  return (
    <section
      aria-labelledby="wd-resultat-titre"
      aria-live="polite"
      aria-atomic="true"
      data-testid="wd-result"
      data-result-state={state.kind}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <h4 id="wd-resultat-titre" className="text-base font-semibold text-[var(--color-foreground)]">
        Résultat
      </h4>

      {state.kind === "idle" && (
        <p className="mt-2 text-sm text-[var(--color-foreground-muted)]">
          Aucun calcul n’a été demandé. Rien n’est calculé pendant la saisie&nbsp;: le moteur n’est
          appelé qu’au clic sur «&nbsp;Calculer&nbsp;».
        </p>
      )}

      {state.kind === "pending" && (
        <p className="mt-2 text-sm text-[var(--color-foreground-muted)]">Calcul en cours…</p>
      )}

      {state.kind === "access_denied" && (
        <p className="mt-2 text-sm text-[var(--color-warning-strong)]">
          {state.status === 401
            ? "Session expirée — reconnectez-vous avant de relancer le calcul."
            : "Ce compte n’est pas autorisé à évaluer un scénario."}
        </p>
      )}

      {state.kind === "schema_unavailable" && (
        <p className="mt-2 text-sm text-[var(--color-warning-strong)]">
          Schéma non disponible sur cet environnement&nbsp;: le moteur n’a pas pu être interrogé.
          Ce n’est pas un résultat nul.
        </p>
      )}

      {state.kind === "unexpected_error" && (
        <p className="mt-2 text-sm text-[var(--color-danger-strong)]">
          Erreur inattendue&nbsp;: {state.message}. Aucun résultat n’est affiché — une erreur n’est
          pas une absence de risque.
        </p>
      )}

      {state.kind === "done" && <WdResultBody response={state.response} rows={rows} />}
    </section>
  );
}

function WdResultBody({
  response,
  rows,
}: {
  response: WiFinancialScenarioResponse;
  rows: readonly ReviewRow[];
}) {
  if (response.is_absent) {
    return (
      <div className="mt-2" data-testid="wd-result-absent">
        <p className="text-sm font-semibold text-[var(--color-foreground)]">Résultat absent</p>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          {response.absence_reason ?? "Le moteur n’a pas motivé cette absence."} Une entrée absente
          rend un résultat absent, jamais zéro.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--color-foreground-muted)]">
          Valeur actuelle du scénario «&nbsp;{response.label}&nbsp;» à l’horizon {response.horizon_year}
        </p>
        <p
          className="font-mono text-2xl font-semibold text-[var(--color-foreground)]"
          data-testid="wd-result-central"
        >
          {response.present_value ?? "Donnée absente"}
        </p>
        <p className="text-xs text-[var(--color-foreground-muted)]" data-testid="wd-result-weighted">
          {response.probability_weighted === null
            ? "Aucune pondération par probabilité — aucune probabilité n’a été fournie."
            : `Pondéré par la probabilité fournie : ${response.probability_weighted}`}
        </p>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-[var(--color-foreground)]">
          Sensibilités — la valeur centrale ne se lit pas seule
        </h5>
        {response.sensitivities.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Le moteur n’a renvoyé aucune bande de sensibilité.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm" data-testid="wd-sensitivities">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-foreground-muted)]">
                  <th scope="col" className="py-2 pr-3">Inducteur</th>
                  <th scope="col" className="py-2 pr-3">Variation</th>
                  <th scope="col" className="py-2 pr-3">Bas</th>
                  <th scope="col" className="py-2 pr-3">Central</th>
                  <th scope="col" className="py-2 pr-3">Haut</th>
                </tr>
              </thead>
              <tbody>
                {response.sensitivities.map((band) => (
                  <tr key={band.driver} className="border-b border-[var(--color-border)]/60">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--color-foreground)]">
                      {driverLabel(band.driver)}
                    </th>
                    <td className="py-2 pr-3 font-mono text-[var(--color-foreground-muted)]">
                      {band.variation_pct}
                    </td>
                    <td className="py-2 pr-3 font-mono">{band.low ?? "n. d."}</td>
                    <td className="py-2 pr-3 font-mono">{band.base ?? "n. d."}</td>
                    <td className="py-2 pr-3 font-mono">{band.high ?? "n. d."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h5 className="text-sm font-semibold text-[var(--color-foreground)]">Composantes</h5>
        <ul className="mt-1 space-y-1 text-sm">
          {Object.entries(response.components).map(([key, component]) => (
            <li key={key} className="text-[var(--color-foreground-muted)]">
              <span className="text-[var(--color-foreground)]">{componentLabel(key)}</span>
              {" : "}
              <span className="font-mono">{component.value ?? "Donnée absente"}</span>{" "}
              <span className="text-xs">
                ({component.unit} · {component.provenance} · {component.basis})
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Les hypothèses restent SOUS le résultat : un chiffre séparé de ses
          hypothèses circule tout seul, et c'est ainsi qu'il devient un fait. */}
      <div>
        <h5 className="text-sm font-semibold text-[var(--color-foreground)]">
          Hypothèses de ce résultat
        </h5>
        <div className="mt-2">
          <WdReviewTable rows={rows} />
        </div>
      </div>

      {response.signals.length > 0 && (
        <div>
          <h5 className="text-sm font-semibold text-[var(--color-foreground)]">
            Signaux déclarés (repris tels quels)
          </h5>
          <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-foreground-muted)]">
            {response.signals.map((signal, index) => (
              <li key={`${signal}-${index}`}>{signal}</li>
            ))}
          </ul>
        </div>
      )}

      <WdAccountingQuestions />
    </div>
  );
}

/** IAS 36, IAS 37, IFRIC 21 — des questions, jamais des conclusions. */
export function WdAccountingQuestions() {
  return (
    <div data-testid="wd-accounting-questions">
      <h5 className="text-sm font-semibold text-[var(--color-foreground)]">
        Questions comptables à examiner
      </h5>
      <p className="mt-1 text-xs text-[var(--color-foreground-muted)]">
        Le moteur signale des questions&nbsp;; il ne tranche rien et n’écrit aucune écriture
        comptable. Chaque point ci-dessous relève d’un acte humain.
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--color-foreground-muted)]">
        {ACCOUNTING_QUESTIONS.map((signal) => (
          <li key={signal.reference}>
            <span className="font-mono text-xs text-[var(--color-foreground)]">
              {signal.reference}
            </span>{" "}
            — {signal.question}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------- Composant hôte */

export function WdScenarioCalculator() {
  const idPrefix = useId();
  const [draft, setDraft] = useState<ScenarioDraft>(() => emptyScenarioDraft());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<WdResultState>({ kind: "idle" });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const goTo = useCallback((next: number) => {
    setStep(clampStep(next));
    // Le focus suit l'étape : sans cela, la navigation au clavier repart du haut
    // du document à chaque changement.
    headingRef.current?.focus();
  }, []);

  const setQuantity = useCallback((field: QuantityField, next: QuantityDraft) => {
    setDraft((current) => ({
      ...current,
      quantities: { ...current.quantities, [field]: next },
    }));
  }, []);

  const reset = useCallback(() => {
    setDraft(emptyScenarioDraft());
    setErrors({});
    setResult({ kind: "idle" });
    setStep(0);
  }, []);

  /** Seul point d'appel du moteur. Rien ici n'est déclenché par la frappe. */
  const submit = useCallback(async () => {
    const { errors: found, request } = validateScenarioDraft(draft);
    setErrors(found);
    if (!request) {
      // Ramène la saisie là où se trouvent les champs fautifs : le récapitulatif
      // est lu sur la revue, mais rien ne s'y corrige.
      setStep(firstStepWithError(found));
      setResult({ kind: "idle" });
      return;
    }
    setResult({ kind: "pending" });
    try {
      const response = await evaluateFinancialScenario(request);
      setResult({ kind: "done", response });
    } catch (error) {
      if (error instanceof DecisionAuthError) {
        setResult({ kind: "access_denied", status: error.status });
        return;
      }
      if (error instanceof DecisionSchemaNotReadyError) {
        setResult({ kind: "schema_unavailable" });
        return;
      }
      setResult({ kind: "unexpected_error", message: (error as Error).message });
    }
  }, [draft]);

  const definition = STEPS[step];
  const rows = buildReviewRows(draft);
  const warnings = buildReviewWarnings(draft);
  const errorList = Object.entries(errors);

  return (
    <section aria-labelledby="wd-calculateur-titre" data-testid="wd-calculator">
      <h3
        id="wd-calculateur-titre"
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-[var(--color-foreground)]"
      >
        Calculateur de scénario financier
      </h3>
      <p className="mt-1 max-w-[62ch] text-sm text-[var(--color-foreground-muted)]">
        Formulaire vierge&nbsp;: aucune valeur, aucun taux et aucune probabilité ne sont proposés.
        Rien n’est enregistré, et le calcul ne part qu’au clic.
      </p>

      <div className="mt-4">
        <WdStepper current={step} />
      </div>

      {/* Erreurs annoncées aux technologies d'assistance dès qu'elles changent. */}
      <div aria-live="assertive" aria-atomic="true" data-testid="wd-error-summary">
        {errorList.length > 0 && (
          <div
            role="group"
            aria-labelledby="wd-erreurs-titre"
            className="mt-4 rounded-[var(--radius)] border border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] p-3"
          >
            <p id="wd-erreurs-titre" className="text-sm font-semibold text-[var(--color-danger-strong)]">
              {errorList.length} point(s) à corriger avant de calculer
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs text-[var(--color-danger-strong)]">
              {errorList.map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="min-w-0"
        >
          <fieldset className="min-w-0">
            <legend className="text-base font-semibold text-[var(--color-foreground)]">
              {definition.title}
            </legend>
            <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">{definition.purpose}</p>

            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {definition.quantities.map((field) => (
                <WdQuantityField
                  key={field}
                  field={field}
                  draft={draft.quantities[field]}
                  errors={errors}
                  idPrefix={idPrefix}
                  onChange={(next) => setQuantity(field, next)}
                />
              ))}
            </div>

            {definition.id === "adaptation" && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  id={`${idPrefix}-scenario-code`}
                  testId="wd-scenario-code"
                  label="Code du scénario"
                  hint="Identifiant court choisi par vous."
                  value={draft.scenario_code}
                  error={errors.scenario_code}
                  maxLength={64}
                  onChange={(scenario_code) => setDraft((c) => ({ ...c, scenario_code }))}
                />
                <TextField
                  id={`${idPrefix}-label`}
                  testId="wd-label"
                  label="Intitulé du scénario"
                  value={draft.label}
                  error={errors.label}
                  maxLength={200}
                  onChange={(label) => setDraft((c) => ({ ...c, label }))}
                />
                <TextField
                  id={`${idPrefix}-base-year`}
                  testId="wd-base-year"
                  label="Année de référence"
                  hint="Quatre chiffres."
                  value={draft.base_year}
                  error={errors.base_year}
                  maxLength={4}
                  onChange={(base_year) => setDraft((c) => ({ ...c, base_year }))}
                />
                <TextField
                  id={`${idPrefix}-horizon-year`}
                  testId="wd-horizon-year"
                  label="Horizon"
                  hint="Quatre chiffres, au plus tôt l’année de référence."
                  value={draft.horizon_year}
                  error={errors.horizon_year}
                  maxLength={4}
                  onChange={(horizon_year) => setDraft((c) => ({ ...c, horizon_year }))}
                />
                <TextField
                  id={`${idPrefix}-variation`}
                  testId="wd-variation"
                  label="Amplitude de sensibilité (%)"
                  hint="Amplitude que vous retenez — aucune n’est suggérée."
                  value={draft.sensitivity_variation_pct}
                  error={errors.sensitivity_variation_pct}
                  maxLength={16}
                  onChange={(sensitivity_variation_pct) =>
                    setDraft((c) => ({ ...c, sensitivity_variation_pct }))
                  }
                />
                <TextField
                  id={`${idPrefix}-signals`}
                  testId="wd-signals"
                  label="Signaux qualitatifs (facultatif)"
                  hint="Un signal par ligne, 20 au maximum. Vide = aucun signal déclaré."
                  value={draft.signals}
                  error={errors.signals}
                  multiline
                  onChange={(signals) => setDraft((c) => ({ ...c, signals }))}
                />
              </div>
            )}

            {definition.id === "revue" && (
              <div className="mt-3 space-y-4">
                <WdReviewTable rows={rows} />

                <div data-testid="wd-review-warnings">
                  <h5 className="text-sm font-semibold text-[var(--color-foreground)]">
                    Avertissements
                  </h5>
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-foreground-muted)]">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>

                <WdAccountingQuestions />
              </div>
            )}
          </fieldset>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-foreground)] transition-colors duration-150 disabled:opacity-50 motion-reduce:transition-none"
              data-testid="wd-prev"
            >
              Étape précédente
            </button>

            {step < REVIEW_STEP_INDEX ? (
              <button
                type="button"
                onClick={() => goTo(step + 1)}
                className="rounded-[var(--radius)] border border-[var(--color-ring)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] transition-colors duration-150 motion-reduce:transition-none"
                data-testid="wd-next"
              >
                Étape suivante
              </button>
            ) : (
              <button
                type="submit"
                className="rounded-[var(--radius)] border border-[var(--color-ring)] bg-[var(--color-success-bg)] px-3 py-2 text-sm font-semibold text-[var(--color-success-strong)] transition-colors duration-150 motion-reduce:transition-none"
                data-testid="wd-submit"
              >
                Calculer
              </button>
            )}

            <button
              type="button"
              onClick={reset}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-foreground)] transition-colors duration-150 motion-reduce:transition-none"
              data-testid="wd-reset"
            >
              Réinitialiser
            </button>
          </div>
        </form>

        {/*
          Résumé collant sur GRAND écran seulement (`lg:sticky`). Sur téléphone
          il reste dans le flux : un bloc collant sur un écran court mangerait
          la moitié de la surface de saisie.
        */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" data-testid="wd-summary">
          <WdResultPanel state={result} rows={rows} />
        </aside>
      </div>
    </section>
  );
}
