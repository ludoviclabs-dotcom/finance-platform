"use client";

/**
 * IroCandidateButton — geste HUMAIN de promotion d'un signal (eau, nature,
 * CRMA, énergie…) en candidat IRO (PR-10/PR-11).
 *
 * Invariants :
 *   1. Un candidat, jamais une décision. La création passe par
 *      `createIro` (POST /iro/iros), qui produit TOUJOURS un IRO
 *      `status: 'candidate'`. Il n'existe AUCUN endpoint « create_candidate » —
 *      ne jamais en appeler un.
 *   2. Confirmation explicite avant création (deux étapes inline, sans
 *      dépendance à un provider global) : promouvoir un signal est un acte
 *      humain, jamais automatique.
 *
 * Présentationnel + auto-suffisant : on lui passe le contexte du signal, il
 * gère la confirmation, l'appel et les états (idle / confirm / creating / done /
 * error). `onCreated` remonte l'IRO créé au parent.
 */

import { useState } from "react";
import { CheckCircle2, Plus, Sparkles } from "lucide-react";

import { createIro, SchemaNotReadyError, type Iro, type IroType, type OriginDomain } from "@/lib/api/iro";

export interface IroCandidateButtonProps {
  /** Titre du candidat IRO (résumé du signal promu). */
  title: string;
  iroType: IroType;
  /** Domaine d'origine du signal (par défaut : « manual »). */
  originDomain?: OriginDomain;
  /** Référence traçable du signal d'origine (ex. code observation, id run). */
  originReference?: string | null;
  description?: string | null;
  topicCode?: string | null;
  onCreated?: (iro: Iro) => void;
  className?: string;
  label?: string;
}

type State =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "creating" }
  | { kind: "done"; iro: Iro }
  | { kind: "error"; message: string };

export function IroCandidateButton({
  title,
  iroType,
  originDomain = "manual",
  originReference = null,
  description = null,
  topicCode = null,
  onCreated,
  className = "",
  label = "Promouvoir en candidat IRO",
}: IroCandidateButtonProps) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const create = async () => {
    setState({ kind: "creating" });
    try {
      const iro = await createIro({
        title,
        iro_type: iroType,
        origin_domain: originDomain,
        origin_reference: originReference,
        description,
        topic_code: topicCode,
      });
      setState({ kind: "done", iro });
      onCreated?.(iro);
    } catch (e) {
      const message =
        e instanceof SchemaNotReadyError
          ? "Registre IRO indisponible : schéma non initialisé."
          : e instanceof Error
            ? e.message
            : "Création impossible.";
      setState({ kind: "error", message });
    }
  };

  if (state.kind === "done") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 ${className}`}
        role="status"
        data-testid="iro-candidate-done"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Candidat IRO créé (#{state.iro.id})
      </span>
    );
  }

  if (state.kind === "confirm") {
    return (
      <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`} data-testid="iro-candidate-confirm">
        <span className="text-xs text-[var(--color-foreground-muted)]">
          Promouvoir « {title} » en candidat IRO ?
        </span>
        <button
          type="button"
          onClick={create}
          className="rounded-lg bg-carbon-emerald px-2.5 py-1 text-xs font-semibold text-white"
          data-testid="iro-candidate-confirm-yes"
        >
          Confirmer
        </button>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground-muted)]"
        >
          Annuler
        </button>
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setState({ kind: "confirm" })}
        disabled={state.kind === "creating"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] transition hover:border-carbon-emerald/40 hover:text-carbon-emerald disabled:opacity-50"
        aria-label={label}
        data-testid="iro-candidate-button"
      >
        {state.kind === "creating" ? (
          <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden />
        ) : (
          <Plus className="h-3.5 w-3.5" aria-hidden />
        )}
        {state.kind === "creating" ? "Création…" : label}
      </button>
      {state.kind === "error" && (
        <span className="text-xs text-rose-600 dark:text-rose-300" role="alert" data-testid="iro-candidate-error">
          {state.message}
        </span>
      )}
    </span>
  );
}

export default IroCandidateButton;
