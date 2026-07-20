"use client";

/**
 * Registre IRO — Impact, Risque ou Opportunité (PR-10, BETA).
 *
 * Consomme `/iro/iros`. Liste filtrable par statut/type/domaine d'origine.
 * Cross-lien depuis la page `/materialite` (la matrice 2D reste l'outil de
 * visualisation/tri ; ce registre est la couche détaillée, évidencée,
 * dessous). Création manuelle possible ici ; la promotion depuis un écran de
 * domaine (eau, nature, CRMA) passe par `IroCandidateButton`.
 *
 * États loading / schema_not_ready / error / ready explicites — motif
 * `/water`, `/nature` (PR-08/PR-09).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import {
  IRO_STATUS_LABEL,
  IRO_STATUS_TONE,
  IRO_TYPE_LABEL,
  ORIGIN_DOMAIN_LABEL,
  SchemaNotReadyError,
  createIro,
  fetchIros,
  type Iro,
  type IroStatus,
  type IroType,
  type OriginDomain,
} from "@/lib/api/iro";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

const STATUS_OPTIONS: IroStatus[] = ["candidate", "under_assessment", "assessed", "decided", "archived"];
const TYPE_OPTIONS: IroType[] = ["impact", "risk", "opportunity"];
const ORIGIN_OPTIONS: OriginDomain[] = ["water", "nature", "crma", "energy", "manual"];

export default function IroRegistryPage() {
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Iro[]>([]);
  const [statusFilter, setStatusFilter] = useState<IroStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<IroType | "">("");
  const [originFilter, setOriginFilter] = useState<OriginDomain | "">("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState("loading");
      setError(null);
      try {
        const res = await fetchIros(
          {
            status: statusFilter || undefined,
            iro_type: typeFilter || undefined,
            origin_domain: originFilter || undefined,
          },
          signal,
        );
        setItems(res.items);
        setState("ready");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof SchemaNotReadyError) {
          setState("schema_not_ready");
          return;
        }
        setError((e as Error).message);
        setState("error");
      }
    },
    [statusFilter, typeFilter, originFilter],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            Registre IRO
          </h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Impacts, risques et opportunités — granulaires, évidencés, reliés
          aux signaux des autres modules (matières critiques, eau, nature,
          énergie). Chaque IRO porte deux dimensions d&apos;évaluation
          strictement séparées (matérialité d&apos;impact, matérialité
          financière) — jamais un score combiné. Voir aussi la{" "}
          <Link href="/materialite" className="underline">
            matrice de double matérialité
          </Link>
          , outil de visualisation et de tri, sur laquelle ce registre
          s&apos;appuie sans la remplacer.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted-foreground)]">Statut</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IroStatus | "")}
            className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-foreground)]"
            data-testid="iro-filter-status"
          >
            <option value="">Tous</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {IRO_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted-foreground)]">Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as IroType | "")}
            className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-foreground)]"
            data-testid="iro-filter-type"
          >
            <option value="">Tous</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {IRO_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted-foreground)]">Origine</span>
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as OriginDomain | "")}
            className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-foreground)]"
            data-testid="iro-filter-origin"
          >
            <option value="">Toutes</option>
            {ORIGIN_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {ORIGIN_DOMAIN_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 rounded bg-carbon-emerald px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          data-testid="iro-create-toggle"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Nouvel IRO
        </button>
      </div>

      {showCreate && (
        <CreateIroForm
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {state === "loading" && (
        <p data-testid="iro-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement du registre IRO…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="iro-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>
            La migration de base de données du registre IRO (040) n&apos;est
            pas encore appliquée sur cet environnement. Le module
            s&apos;activera automatiquement dès qu&apos;elle le sera — aucune
            donnée n&apos;est perdue.
          </p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="iro-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Registre IRO indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && (
        items.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="iro-empty">
            Aucun IRO pour ces filtres. Créez-en un manuellement, ou promouvez
            un signal depuis un écran de domaine (screening eau, évaluation
            nature…) via « Promouvoir en IRO candidat ».
          </p>
        ) : (
          <div className="overflow-x-auto" data-testid="iro-list">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  <th className="py-2 pr-3">Titre</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Enjeu</th>
                  <th className="py-2 pr-3">Origine</th>
                  <th className="py-2 pr-3">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {items.map((iro) => (
                  <tr key={iro.id} className="border-b border-[var(--color-border)]/60">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/iro/${iro.id}`}
                        className="font-medium text-[var(--color-foreground)] underline-offset-2 hover:underline"
                        data-testid={`iro-link-${iro.id}`}
                      >
                        {iro.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-[var(--color-foreground)]">{IRO_TYPE_LABEL[iro.iro_type]}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${IRO_STATUS_TONE[iro.status]}`}
                      >
                        {IRO_STATUS_LABEL[iro.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                      {iro.topic_code ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-[var(--color-foreground)]">
                      {ORIGIN_DOMAIN_LABEL[iro.origin_domain] ?? iro.origin_domain}
                    </td>
                    <td className="py-2 pr-3 text-xs text-[var(--color-muted-foreground)]">
                      {new Date(iro.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function CreateIroForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [iroType, setIroType] = useState<IroType>("risk");
  const [topicCode, setTopicCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError("Le titre est requis.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createIro({
        title: title.trim(), iro_type: iroType, topic_code: topicCode.trim() || null,
        origin_domain: "manual",
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="mb-4 flex flex-wrap items-end gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      data-testid="iro-create-form"
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--color-muted-foreground)]">Titre</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-foreground)]"
          data-testid="iro-create-title"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--color-muted-foreground)]">Type</span>
        <select
          value={iroType}
          onChange={(e) => setIroType(e.target.value as IroType)}
          className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-foreground)]"
          data-testid="iro-create-type"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {IRO_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--color-muted-foreground)]">Enjeu ESRS (optionnel)</span>
        <input
          value={topicCode}
          onChange={(e) => setTopicCode(e.target.value)}
          placeholder="ex. WR-1"
          className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-foreground)]"
          data-testid="iro-create-topic"
        />
      </label>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded bg-carbon-emerald px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        data-testid="iro-create-submit"
      >
        {submitting ? "Création…" : "Créer"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        Annuler
      </button>
    </div>
  );
}
