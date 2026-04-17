"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Leaf, Loader2, AlertTriangle, Building2 } from "lucide-react";
import {
  type PublicQuestionnaireContext,
  type SupplierAnswerCreate,
  fetchQuestionnaire,
  submitQuestionnaire,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// No auth required — public page
// ---------------------------------------------------------------------------

interface Props {
  params: { token: string };
}

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "expired" }
  | { kind: "already_answered" }
  | { kind: "form"; ctx: PublicQuestionnaireContext }
  | { kind: "success" };

export default function QuestionnairePage({ params }: Props) {
  const { token } = params;
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [form, setForm] = useState<SupplierAnswerCreate>({
    has_sbti: false,
    has_iso14001: false,
    has_iso50001: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestionnaire(token)
      .then((ctx) => {
        if (ctx.already_answered) {
          setState({ kind: "already_answered" });
        } else {
          setState({ kind: "form", ctx });
        }
      })
      .catch((err: Error) => {
        if (err.message.includes("410") || err.message.includes("expiré")) {
          setState({ kind: "expired" });
        } else {
          setState({ kind: "error", message: err.message });
        }
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await submitQuestionnaire(token, form);
      setState({ kind: "success" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  }

  function setField(k: keyof SupplierAnswerCreate, v: unknown) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (state.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error / Expired / Already answered
  // ---------------------------------------------------------------------------
  if (state.kind === "expired") {
    return (
      <PublicShell title="Lien expiré">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="font-display text-xl font-bold text-[var(--color-foreground)] mb-2">
            Ce lien a expiré
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            Contactez votre donneur d&apos;ordre pour obtenir un nouveau lien.
          </p>
        </div>
      </PublicShell>
    );
  }

  if (state.kind === "already_answered") {
    return (
      <PublicShell title="Questionnaire déjà rempli">
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 mx-auto text-carbon-emerald mb-4" />
          <h2 className="font-display text-xl font-bold text-[var(--color-foreground)] mb-2">
            Questionnaire déjà soumis
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            Votre réponse a déjà été enregistrée. Merci pour votre participation.
          </p>
        </div>
      </PublicShell>
    );
  }

  if (state.kind === "error") {
    return (
      <PublicShell title="Erreur">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 mx-auto text-[var(--color-danger)] mb-4" />
          <h2 className="font-display text-xl font-bold text-[var(--color-foreground)] mb-2">
            Lien invalide
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)]">{state.message}</p>
        </div>
      </PublicShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------
  if (state.kind === "success") {
    return (
      <PublicShell title="Merci">
        <div className="text-center py-8">
          <CheckCircle className="w-14 h-14 mx-auto text-carbon-emerald mb-4" />
          <h2 className="font-display text-2xl font-bold text-[var(--color-foreground)] mb-3">
            Réponse enregistrée
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)] max-w-sm mx-auto">
            Merci pour votre participation. Vos données GES ont été transmises et contribuent
            au bilan carbone Scope 3 de votre donneur d&apos;ordre.
          </p>
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300">
            <Leaf className="w-4 h-4 inline mr-1" />
            Vous contribuez à la transparence carbone de la chaîne de valeur.
          </div>
        </div>
      </PublicShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------
  const { ctx } = state;

  return (
    <PublicShell title="Questionnaire Fournisseur">
      {/* Context banner */}
      <div className="mb-6 p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-carbon-emerald flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              {ctx.company_name} vous invite à remplir ce questionnaire
            </p>
            {ctx.campaign && (
              <p className="text-xs text-[var(--color-foreground-muted)]">
                Campagne : {ctx.campaign}
              </p>
            )}
            <p className="text-xs text-carbon-emerald mt-0.5">
              Pour : <strong>{ctx.supplier_name}</strong>
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" data-testid="questionnaire-form">
        {/* GHG Data */}
        <section>
          <h3 className="font-display text-base font-bold text-[var(--color-foreground)] mb-3">
            Données GES (tCO₂e)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "ghg_total_tco2e", label: "Total GES" },
              { key: "ghg_scope1", label: "Scope 1" },
              { key: "ghg_scope2", label: "Scope 2" },
              { key: "ghg_scope3", label: "Scope 3" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                  value={(form[key as keyof SupplierAnswerCreate] as number | undefined) ?? ""}
                  onChange={(e) => setField(key as keyof SupplierAnswerCreate, e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="tCO₂e"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section>
          <h3 className="font-display text-base font-bold text-[var(--color-foreground)] mb-3">
            Méthodologie et période
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                Méthodologie
              </label>
              <select
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={form.methodology ?? ""}
                onChange={(e) => setField("methodology", e.target.value || undefined)}
              >
                <option value="">Choisir</option>
                <option value="GHG Protocol">GHG Protocol</option>
                <option value="Bilan Carbone ADEME">Bilan Carbone® ADEME</option>
                <option value="ISO 14064">ISO 14064</option>
                <option value="Autres">Autres</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                Année de reporting
              </label>
              <input
                type="number"
                min={2015}
                max={2030}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={form.reporting_year ?? ""}
                onChange={(e) => setField("reporting_year", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="2025"
              />
            </div>
          </div>
        </section>

        {/* Certifications */}
        <section>
          <h3 className="font-display text-base font-bold text-[var(--color-foreground)] mb-3">
            Certifications & engagements
          </h3>
          <div className="space-y-2">
            {[
              { key: "has_sbti", label: "Objectifs SBTi validés (Science Based Targets)" },
              { key: "has_iso14001", label: "Certifié ISO 14001 (management environnemental)" },
              { key: "has_iso50001", label: "Certifié ISO 50001 (management de l'énergie)" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(form[key as keyof SupplierAnswerCreate] as boolean) ?? false}
                  onChange={(e) => setField(key as keyof SupplierAnswerCreate, e.target.checked)}
                  className="w-4 h-4 rounded text-carbon-emerald"
                />
                <span className="text-sm text-[var(--color-foreground)]">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Narrative */}
        <section>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Commentaires additionnels (optionnel)
          </label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald resize-none"
            value={form.narrative ?? ""}
            onChange={(e) => setField("narrative", e.target.value || undefined)}
            placeholder="Décrivez votre stratégie de réduction des émissions, vos projets en cours..."
          />
        </section>

        {formError && (
          <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3 rounded-lg">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          data-testid="submit-questionnaire"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-carbon-emerald text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
          ) : (
            <><Leaf className="w-4 h-4" /> Soumettre mes données</>
          )}
        </button>

        <p className="text-[10px] text-center text-[var(--color-foreground-muted)]">
          Vos données sont transmises de manière sécurisée et uniquement à {ctx.company_name}.
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès et de rectification.
        </p>
      </form>
    </PublicShell>
  );
}

// ---------------------------------------------------------------------------
// Shell component (public layout without sidebar)
// ---------------------------------------------------------------------------

function PublicShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Logo / branding */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-carbon-emerald flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-[var(--color-foreground)]">
            CarbonCo
          </span>
          <span className="text-xs text-[var(--color-foreground-muted)] ml-1">
            · Questionnaire fournisseur
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm p-6">
          <h1 className="font-display text-xl font-bold text-[var(--color-foreground)] mb-4">
            {title}
          </h1>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--color-foreground-muted)]">
          Propulsé par{" "}
          <a href="https://carbon-snowy-nine.vercel.app" className="text-carbon-emerald hover:underline">
            CarbonCo
          </a>{" "}
          — Plateforme de reporting ESG & Bilan Carbone
        </p>
      </div>
    </div>
  );
}
