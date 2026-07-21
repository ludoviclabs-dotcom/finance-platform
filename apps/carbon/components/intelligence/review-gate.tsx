"use client";

/**
 * ReviewGate — rend un run de revue / explication IA (PR-11) sous contrôle
 * humain STRICT.
 *
 * Principes non négociables (repris du reste du module Intelligence) :
 *   1. RIEN n'est publié automatiquement. Aucun bouton « publier ». La seule
 *      sortie est une DÉCISION humaine (accept/reject/modify) avec une
 *      justification OBLIGATOIRE (POST /ai/review/runs/{id}/decision).
 *   2. Chaque « claim » IA porte son label de sortie (DRAFT / SUGGESTION /
 *      REVIEW_REQUIRED) et son statut de support vis-à-vis des preuves — un
 *      claim `unsupported`/`contradicted` est signalé visuellement.
 *   3. Les citations sont NUMÉROTÉES ([1], [2]…) et ouvrent la preuve
 *      (SourceDrawer, réutilisé). Fraîcheur (StalenessWarning), licence
 *      (LicenseWarning) et sensibilité sont rendues telles que l'API les donne.
 *   4. Le texte IA passe TOUJOURS par SafeMarkdown (aucun HTML brut).
 *   5. Les états non nominaux (429 rate-limit, 503 fournisseur indisponible /
 *      schéma pas prêt) ont un rendu dédié, jamais une erreur brute.
 *
 * Composant contrôlé : le parent (fiche IRO, panneau Scope 2) fournit le
 * résultat, l'état de chargement, l'erreur typée et `onRegenerate`. La soumission
 * de décision est gérée en interne (self-contained), réutilisable pour les deux
 * cas d'usage (UC-1 IRO, UC-2 explication de calcul).
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Cpu,
  FileSearch,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { dataStatusToBadge } from "@/components/ui/data-status-badge";
import { SourceDrawer, type SourceProvenance } from "./source-drawer";
import { LicenseWarning } from "./license-warning";
import { StalenessWarning } from "./staleness-warning";
import {
  submitReviewDecision,
  ReviewApiError,
  type CitationResponse,
  type ClaimResponse,
  type ReviewDecisionKind,
  type ReviewDecisionResponse,
  type ReviewFeedback,
  type ReviewOutputLabel,
  type ReviewRunResponse,
  type ReviewSensitivity,
  type ReviewSupportStatus,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Vocabulaire de présentation (aucune logique métier ici)
// ---------------------------------------------------------------------------

const OUTPUT_LABEL: Record<ReviewOutputLabel, { text: string; cls: string }> = {
  DRAFT: {
    text: "Brouillon",
    cls: "bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)] border-[var(--color-border)]",
  },
  SUGGESTION: {
    text: "Suggestion IA",
    cls: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",
  },
  REVIEW_REQUIRED: {
    text: "Revue requise",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/40",
  },
};

const SUPPORT_STATUS: Record<
  ReviewSupportStatus,
  { text: string; cls: string; strong: boolean }
> = {
  supported: {
    text: "Étayé",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    strong: false,
  },
  partially_supported: {
    text: "Partiellement étayé",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
    strong: false,
  },
  contradicted: {
    text: "Contredit par les preuves",
    cls: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/40",
    strong: true,
  },
  unsupported: {
    text: "Non étayé",
    cls: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/40",
    strong: true,
  },
};

const SENSITIVITY_LABEL: Record<ReviewSensitivity, string> = {
  public: "Public",
  internal: "Interne",
  confidential: "Confidentiel",
  restricted: "Restreint",
};

const RESOURCE_LABEL: Record<CitationResponse["resource_type"], string> = {
  source: "Source",
  release: "Release",
  artifact: "Artefact",
  observation: "Observation",
  claim_link: "Lien de preuve",
  calc_result: "Résultat de calcul",
};

const RUN_STATUS_LABEL: Record<ReviewRunResponse["run"]["status"], string> = {
  pending: "En cours",
  succeeded: "Réussi",
  failed: "Échec",
  blocked_license: "Bloqué (licence)",
  refused: "Refusé",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
}

function locatorText(loc: CitationResponse["locator"]): string | null {
  if (!loc) return null;
  const parts: string[] = [];
  if (loc.page_reference) parts.push(`p. ${loc.page_reference}`);
  if (loc.table_reference) parts.push(`tab. ${loc.table_reference}`);
  if (loc.cell_reference) parts.push(`cell. ${loc.cell_reference}`);
  if (loc.excerpt) parts.push(`« ${loc.excerpt} »`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Mappe une citation vers la provenance attendue par SourceDrawer (réutilisé). */
function citationToProvenance(c: CitationResponse): SourceProvenance {
  const idRef = c.internal_id ?? c.source_id ?? c.release_id ?? c.artifact_id ?? c.id;
  return {
    title: `${RESOURCE_LABEL[c.resource_type]} #${idRef}`,
    code: `${c.resource_type}:${idRef}`,
    releaseKey: c.release_id != null ? `release #${c.release_id}` : null,
    badgeStatus: dataStatusToBadge(c.data_status ?? "estimated", c.stale),
    badgeLabel: c.data_status ? undefined : "Non qualifié",
    isStale: c.stale,
    attribution: locatorText(c.locator),
    license: { ok: c.license_ok },
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReviewGateProps {
  /** Résultat du run (null tant qu'il n'y a pas eu de génération). */
  result: ReviewRunResponse | null;
  loading?: boolean;
  /** Erreur typée (ReviewApiError) ou générique. */
  error?: unknown;
  /** Relance la génération (POST review). */
  onRegenerate?: () => void;
  /** Notifie le parent qu'une décision a été enregistrée. */
  onDecision?: (decision: ReviewDecisionResponse) => void;
  title?: string;
  className?: string;
}

export function ReviewGate({
  result,
  loading = false,
  error,
  onRegenerate,
  onDecision,
  title = "Revue IA",
  className = "",
}: ReviewGateProps) {
  const [openCitation, setOpenCitation] = useState<CitationResponse | null>(null);

  // Numérotation globale des citations ([1], [2]…) dans l'ordre des claims.
  // Le décalage de départ de chaque claim = nombre de citations des claims
  // précédents (calcul pur, sans mutation d'un compteur post-render).
  const claimsNumbered = useMemo<ClaimsNumbered>(() => {
    const claims = result?.claims ?? [];
    return claims.map((claim, i) => {
      const start = claims
        .slice(0, i)
        .reduce((sum, prev) => sum + prev.citations.length, 0);
      return {
        claim,
        cites: claim.citations.map((c, j) => ({ n: start + j + 1, c })),
      };
    });
  }, [result]);

  return (
    <section
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 ${className}`}
      aria-label={title}
      data-testid="review-gate"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-carbon-emerald/10 text-carbon-emerald">
            <FileSearch className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="font-display text-base font-bold text-[var(--color-foreground)]">
            {title}
          </h3>
        </div>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
            data-testid="review-gate-regenerate"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Régénérer
          </button>
        )}
      </header>

      {loading && <ReviewLoading />}

      {!loading && error != null && (
        <ReviewErrorState error={error} onRetry={onRegenerate} />
      )}

      {!loading && error == null && !result && (
        <p className="text-sm text-[var(--color-foreground-muted)]" data-testid="review-gate-empty">
          Aucune revue générée pour l&apos;instant. Lancez une revue pour obtenir une
          analyse ancrée sur vos preuves.
        </p>
      )}

      {!loading && error == null && result && (
        <ReviewResult
          result={result}
          claimsNumbered={claimsNumbered}
          onOpenCitation={setOpenCitation}
          onDecision={onDecision}
        />
      )}

      <SourceDrawer
        open={openCitation != null}
        onClose={() => setOpenCitation(null)}
        {...(openCitation
          ? citationToProvenance(openCitation)
          : { title: "", code: "", badgeStatus: "ESTIMATED" as const, isStale: false })}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sous-vues
// ---------------------------------------------------------------------------

function ReviewLoading() {
  return (
    <div className="animate-pulse space-y-3" data-testid="review-gate-loading" aria-live="polite">
      <div className="h-4 w-1/3 rounded bg-[var(--color-surface-raised)]" />
      <div className="h-20 rounded-xl bg-[var(--color-surface-raised)]" />
      <div className="h-16 rounded-xl bg-[var(--color-surface-raised)]" />
    </div>
  );
}

function ReviewErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  // Rate-limit (429) — état dédié.
  if (error instanceof ReviewApiError && error.kind === "rate_limited") {
    return (
      <div
        role="status"
        data-testid="review-gate-rate-limited"
        className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300"
      >
        <p className="flex items-center gap-1.5 font-semibold">
          <Clock className="h-4 w-4" aria-hidden />
          Limite de débit atteinte
        </p>
        <p className="mt-1 text-xs">
          Trop de revues demandées en peu de temps.
          {error.retryAfterSeconds != null
            ? ` Réessayez dans ${error.retryAfterSeconds} s.`
            : " Réessayez dans quelques instants."}
        </p>
      </div>
    );
  }

  // Fournisseur indisponible / schéma pas prêt (503) — état dédié.
  if (error instanceof ReviewApiError && error.kind === "unavailable") {
    return (
      <div
        role="status"
        data-testid="review-gate-unavailable"
        className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-3 text-sm text-sky-700 dark:text-sky-300"
      >
        <p className="flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          {error.schemaNotReady
            ? "Initialisation du schéma en cours"
            : "Fournisseur IA indisponible"}
        </p>
        <p className="mt-1 text-xs">
          {error.schemaNotReady
            ? "La migration nécessaire n'est pas encore appliquée sur cet environnement."
            : "Le service de revue IA est momentanément indisponible. Réessayez plus tard."}
        </p>
        {onRetry && !error.schemaNotReady && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 px-2.5 py-1 text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Réessayer
          </button>
        )}
      </div>
    );
  }

  const message =
    error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
  return (
    <div
      role="alert"
      data-testid="review-gate-error"
      className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-300"
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        Revue indisponible
      </p>
      <p className="mt-1 text-xs">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Réessayer
        </button>
      )}
    </div>
  );
}

type ClaimsNumbered = {
  claim: ClaimResponse;
  cites: { n: number; c: CitationResponse }[];
}[];

function ReviewResult({
  result,
  claimsNumbered,
  onOpenCitation,
  onDecision,
}: {
  result: ReviewRunResponse;
  claimsNumbered: ClaimsNumbered;
  onOpenCitation: (c: CitationResponse) => void;
  onDecision?: (d: ReviewDecisionResponse) => void;
}) {
  const { run } = result;
  const blocked = run.status === "refused" || run.status === "blocked_license";

  return (
    <div className="space-y-4">
      <RunHeader result={result} />

      {blocked ? (
        <div
          role="status"
          data-testid="review-gate-blocked"
          className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-300"
        >
          <Ban className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              {run.status === "blocked_license"
                ? "Revue bloquée pour raison de licence"
                : "Revue refusée"}
            </p>
            <p className="mt-1 text-xs">
              {run.error_code
                ? `Code : ${run.error_code}.`
                : "Aucune sortie n'a été produite."}{" "}
              Aucun claim n&apos;est présenté.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="review-gate-claims">
          {claimsNumbered.length === 0 ? (
            <p className="text-sm text-[var(--color-foreground-muted)]">
              Aucun claim produit par ce run.
            </p>
          ) : (
            claimsNumbered.map(({ claim, cites }) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                cites={cites}
                onOpenCitation={onOpenCitation}
              />
            ))
          )}
        </div>
      )}

      {/* Décision humaine — jamais de publication automatique. */}
      <DecisionForm runId={run.id} onDecision={onDecision} />
    </div>
  );
}

function RunHeader({ result }: { result: ReviewRunResponse }) {
  const { run } = result;
  const cost = run.cost_estimate;
  const hasTokens = run.tokens_input != null || run.tokens_output != null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-foreground-muted)]">
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5" aria-hidden />
          Modèle <strong className="text-[var(--color-foreground)]">{run.model}</strong>
          {run.model_version ? ` (${run.model_version})` : ""}
        </span>
        <span>· {fmtDate(run.created_at)}</span>
        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5">
          {RUN_STATUS_LABEL[run.status] ?? run.status}
        </span>
        {(hasTokens || cost != null) && (
          <span data-testid="review-gate-cost">
            {hasTokens
              ? `· ${run.tokens_input ?? "—"} → ${run.tokens_output ?? "—"} tokens`
              : ""}
            {cost != null
              ? ` · ≈ ${cost.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} $`
              : ""}
          </span>
        )}
      </div>

      {/* Indicateurs de garde : schéma / citations / licence. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <GateChip ok={result.schema_valid} okText="Schéma valide" koText="Schéma invalide" />
        <GateChip
          ok={result.citation_resolved}
          okText="Citations résolues"
          koText="Citations non résolues"
        />
        <GateChip ok={result.license_allowed} okText="Licence OK" koText="Licence bloquée" />
      </div>

      {!result.license_allowed && (
        <LicenseWarning
          licenseOk={false}
          reasons={["La licence d'au moins une source ne permet pas cet usage."]}
        />
      )}
    </div>
  );
}

function GateChip({ ok, okText, koText }: { ok: boolean; okText: string; koText: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          : "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
      {ok ? okText : koText}
    </span>
  );
}

function ClaimCard({
  claim,
  cites,
  onOpenCitation,
}: {
  claim: ClaimResponse;
  cites: { n: number; c: CitationResponse }[];
  onOpenCitation: (c: CitationResponse) => void;
}) {
  const label = OUTPUT_LABEL[claim.output_label];
  const support = SUPPORT_STATUS[claim.support_status];
  const anyStale = cites.some((x) => x.c.stale);

  return (
    <article
      className={`rounded-xl border p-3 ${
        support.strong
          ? "border-rose-500/40 bg-rose-500/5"
          : "border-[var(--color-border)] bg-[var(--color-background)]"
      }`}
      data-testid="review-gate-claim"
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${label.cls}`}
          data-testid="review-gate-output-label"
        >
          {label.text}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${support.cls}`}
          data-testid="review-gate-support-status"
        >
          {support.strong && <AlertTriangle className="h-3 w-3" aria-hidden />}
          {support.text}
        </span>
      </div>

      {/* Le texte IA passe toujours par SafeMarkdown. */}
      <SafeMarkdown>{claim.claim_text}</SafeMarkdown>

      {support.strong && (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">
          {claim.support_status === "contradicted"
            ? "Cet énoncé est contredit par les preuves citées — ne pas retenir sans vérification humaine."
            : "Cet énoncé n'est étayé par aucune preuve — à vérifier avant tout usage."}
        </p>
      )}

      {cites.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="review-gate-citations">
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-foreground-subtle)]">
            Preuves
          </span>
          {cites.map(({ n, c }) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenCitation(c)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-foreground)] transition hover:border-carbon-emerald/40 hover:text-carbon-emerald"
              aria-label={`Ouvrir la preuve ${n} : ${RESOURCE_LABEL[c.resource_type]}`}
              data-testid="review-gate-citation"
            >
              <span className="font-mono">[{n}]</span>
              <span className="text-[var(--color-foreground-muted)]">
                {RESOURCE_LABEL[c.resource_type]}
              </span>
              {c.sensitivity && c.sensitivity !== "public" && (
                <span className="rounded bg-[var(--color-surface-raised)] px-1 text-[9px] text-[var(--color-foreground-subtle)]">
                  {SENSITIVITY_LABEL[c.sensitivity]}
                </span>
              )}
              {!c.license_ok && (
                <span className="text-rose-500" title="Licence bloquée" aria-hidden>
                  ⚠
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {anyStale && (
        <StalenessWarning
          isStale
          ageDays={null}
          className="mt-2"
        />
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Décision humaine — accept / reject / modify + feedback
// ---------------------------------------------------------------------------

const DECISION_OPTIONS: { value: ReviewDecisionKind; label: string }[] = [
  { value: "accept", label: "Accepter" },
  { value: "reject", label: "Rejeter" },
  { value: "modify", label: "Modifier" },
];

const FEEDBACK_OPTIONS: { value: ReviewFeedback; label: string }[] = [
  { value: "useful", label: "Utile" },
  { value: "not_useful", label: "Peu utile" },
  { value: "incorrect", label: "Incorrect" },
];

function DecisionForm({
  runId,
  onDecision,
}: {
  runId: number;
  onDecision?: (d: ReviewDecisionResponse) => void;
}) {
  const [decision, setDecision] = useState<ReviewDecisionKind>("accept");
  const [justification, setJustification] = useState("");
  const [feedback, setFeedback] = useState<ReviewFeedback | "">("");
  const [modifiedOutput, setModifiedOutput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ReviewDecisionResponse | null>(null);

  const justificationEmpty = justification.trim().length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (justificationEmpty) {
      setError("La justification est obligatoire.");
      return;
    }

    let modified: Record<string, unknown> | undefined;
    if (decision === "modify" && modifiedOutput.trim()) {
      try {
        const parsed = JSON.parse(modifiedOutput);
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setError("La sortie corrigée doit être un objet JSON.");
          return;
        }
        modified = parsed as Record<string, unknown>;
      } catch {
        setError("Sortie corrigée : JSON invalide.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await submitReviewDecision(runId, {
        decision,
        justification: justification.trim(),
        modified_output: modified,
        feedback: feedback || undefined,
      });
      setSaved(res);
      onDecision?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <div
        role="status"
        data-testid="review-gate-decision-saved"
        className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"
      >
        <p className="flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Décision enregistrée
        </p>
        <p className="mt-1 text-xs">
          {DECISION_OPTIONS.find((o) => o.value === saved.decision)?.label} · {fmtDate(saved.created_at)}
        </p>
        <button
          type="button"
          onClick={() => {
            setSaved(null);
            setJustification("");
            setModifiedOutput("");
            setFeedback("");
          }}
          className="mt-2 text-xs font-medium text-[var(--color-foreground-muted)] underline"
        >
          Nouvelle décision
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3"
      data-testid="review-gate-decision-form"
    >
      <p className="text-xs font-semibold text-[var(--color-foreground)]">
        Décision humaine (obligatoire — rien n&apos;est publié automatiquement)
      </p>

      <fieldset className="flex flex-wrap gap-3 text-xs" aria-label="Type de décision">
        {DECISION_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`decision-${runId}`}
              checked={decision === o.value}
              onChange={() => setDecision(o.value)}
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--color-foreground-muted)]">
          Justification (obligatoire)
        </span>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          required
          rows={2}
          aria-required="true"
          className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-[var(--color-foreground)]"
          data-testid="review-gate-justification"
        />
      </label>

      {decision === "modify" && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-foreground-muted)]">
            Sortie corrigée (objet JSON, optionnel)
          </span>
          <textarea
            value={modifiedOutput}
            onChange={(e) => setModifiedOutput(e.target.value)}
            rows={3}
            placeholder='{"claim_text": "…"}'
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 font-mono text-[var(--color-foreground)]"
            data-testid="review-gate-modified-output"
          />
        </label>
      )}

      <fieldset className="flex flex-wrap items-center gap-3 text-xs" aria-label="Retour qualité">
        <span className="text-[var(--color-foreground-muted)]">Retour :</span>
        {FEEDBACK_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`feedback-${runId}`}
              checked={feedback === o.value}
              onChange={() => setFeedback(o.value)}
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-300" role="alert" data-testid="review-gate-decision-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || justificationEmpty}
        className="rounded-lg bg-carbon-emerald px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        data-testid="review-gate-decision-submit"
      >
        {submitting ? "Enregistrement…" : "Enregistrer la décision"}
      </button>
    </form>
  );
}

export default ReviewGate;
