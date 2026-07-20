"use client";

/**
 * IroCandidateButton — bouton d'action explicite qui promeut un signal de
 * domaine (screening eau, évaluation nature, événement CRMA…) en IRO
 * candidat (PR-10).
 *
 * Annoncé depuis Wave 2 (`WAVE_4_INTERFACE_CONTRACTS.md` §12), jamais créé
 * avant cette PR. UN SEUL geste humain explicite — jamais un déclenchement
 * automatique : cliquer révèle un petit formulaire (titre pré-rempli,
 * type IRO, enjeu ESRS optionnel) ; valider appelle `POST /iro/iros` avec
 * `origin_domain`/`origin_reference` déjà renseignés. Le nouvel IRO est
 * TOUJOURS créé `status: 'candidate'` — jamais une décision de matérialité.
 *
 * Volontairement DÉCOUPLÉ du geste de signal du domaine d'origine (ex.
 * `flagScreeningForIro`, PR-08) : ce composant n'appelle et ne modifie
 * jamais les tables/services d'un autre domaine, il ne fait qu'appeler
 * `POST /iro/iros` — un domaine qui n'a pas encore ce bouton câblé continue
 * de fonctionner seul (additif, jamais bloquant).
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

import {
  createIro,
  IRO_TYPE_LABEL,
  type Iro,
  type IroType,
  type OriginDomain,
} from "@/lib/api/iro";

interface IroCandidateButtonProps {
  originDomain: OriginDomain;
  originReference: string;
  suggestedTitle: string;
  suggestedTopicCode?: string;
  defaultIroType?: IroType;
  onCreated?: (iro: Iro) => void;
  className?: string;
}

export function IroCandidateButton({
  originDomain,
  originReference,
  suggestedTitle,
  suggestedTopicCode = "",
  defaultIroType = "risk",
  onCreated,
  className = "",
}: IroCandidateButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(suggestedTitle);
  const [iroType, setIroType] = useState<IroType>(defaultIroType);
  const [topicCode, setTopicCode] = useState(suggestedTopicCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  if (createdId !== null) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 ${className}`}
        data-testid="iro-candidate-created"
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        IRO candidat #{createdId} créé
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] ${className}`}
        data-testid="iro-candidate-open"
        title="Promouvoir ce signal en IRO candidat — un geste humain explicite, jamais automatique."
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        Promouvoir en IRO candidat
      </button>
    );
  }

  const submit = async () => {
    if (!title.trim()) {
      setError("Le titre est requis.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const iro = await createIro({
        title: title.trim(),
        iro_type: iroType,
        topic_code: topicCode.trim() || null,
        origin_domain: originDomain,
        origin_reference: originReference,
      });
      setCreatedId(iro.id);
      onCreated?.(iro);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`inline-flex flex-col gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs ${className}`}
      data-testid="iro-candidate-form"
    >
      <p className="font-medium text-[var(--color-foreground)]">
        Promouvoir en IRO candidat
      </p>
      <p className="text-[var(--color-muted-foreground)]">
        Crée un IRO au statut « candidat » — jamais une décision de
        matérialité. L&apos;évaluation et la décision restent des étapes
        séparées, sur la fiche IRO.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[var(--color-muted-foreground)]">Titre</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[var(--color-foreground)]"
          data-testid="iro-candidate-title"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[var(--color-muted-foreground)]">Type</span>
        <select
          value={iroType}
          onChange={(e) => setIroType(e.target.value as IroType)}
          className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[var(--color-foreground)]"
          data-testid="iro-candidate-type"
        >
          {(Object.keys(IRO_TYPE_LABEL) as IroType[]).map((t) => (
            <option key={t} value={t}>
              {IRO_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[var(--color-muted-foreground)]">
          Enjeu ESRS (optionnel, ex. WR-1)
        </span>
        <input
          value={topicCode}
          onChange={(e) => setTopicCode(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[var(--color-foreground)]"
          data-testid="iro-candidate-topic"
        />
      </label>
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded bg-carbon-emerald px-3 py-1 font-medium text-white disabled:opacity-50"
          data-testid="iro-candidate-submit"
        >
          {submitting ? "Création…" : "Créer le candidat"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          data-testid="iro-candidate-cancel"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
