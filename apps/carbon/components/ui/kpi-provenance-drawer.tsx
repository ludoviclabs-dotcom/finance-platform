"use client";

/**
 * KpiProvenanceDrawer — side panel affichant le trail de provenance d'un KPI.
 *
 * Cible de perf : ouverture < 300ms (la réquête /facts/{code}/trail doit répondre < 500ms,
 * mais l'animation d'entrée ne dépend pas de la réponse — skeleton pendant le fetch).
 *
 * Props :
 *   - open : booléen contrôlé
 *   - onClose : callback de fermeture
 *   - code : fact_code ADEME (ex: "CC.GES.SCOPE1")
 *   - label : libellé affiché en header (ex: "Scope 1 — Direct")
 *   - unit : unité affichée (ex: "tCO₂e")
 */

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Copy, FileSpreadsheet, History, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useKpiProvenance } from "@/lib/hooks/use-kpi-provenance";
import {
  deleteEvidence,
  fetchEvidence,
  uploadEvidence,
  type EvidenceItem,
  type FactEvent,
} from "@/lib/api";

interface KpiProvenanceDrawerProps {
  open: boolean;
  onClose: () => void;
  code: string;
  label: string;
  unit?: string;
}

export function KpiProvenanceDrawer({
  open,
  onClose,
  code,
  label,
  unit,
}: KpiProvenanceDrawerProps) {
  // Ne fetch que quand le drawer est ouvert
  const { trail, loading, error, durationMs } = useKpiProvenance(code, {
    limit: 20,
    enabled: open,
  });

  // ESC pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            data-testid="provenance-backdrop"
          />
          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl z-50 flex flex-col"
            role="dialog"
            aria-labelledby="provenance-drawer-title"
            data-testid="provenance-drawer"
          >
            <header className="flex items-start justify-between gap-3 p-5 border-b border-[var(--color-border)]">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-foreground-subtle)]">
                  <History className="w-3.5 h-3.5" aria-hidden />
                  Provenance
                </div>
                <h2
                  id="provenance-drawer-title"
                  className="mt-1 text-lg font-display font-semibold text-[var(--color-foreground)]"
                >
                  {label}
                </h2>
                <p className="text-xs text-[var(--color-foreground-muted)] mt-1 font-mono">
                  {code}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-md text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)]"
                aria-label="Fermer le panneau provenance"
                data-testid="provenance-close"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {loading && <DrawerLoading />}
              {error && <DrawerError message={error} />}
              {!loading && !error && trail && trail.events.length === 0 && (
                <DrawerEmpty code={code} />
              )}
              {!loading && !error && trail && trail.events.length > 0 && (
                <EventTimeline events={trail.events} unit={unit} />
              )}

              {/* Pièces justificatives (T2.1) — attacher / lister / révoquer. */}
              <EvidenceSection code={code} />
            </div>

            {trail && trail.events.length > 0 && (
              <footer className="border-t border-[var(--color-border)] px-5 py-3 flex items-center justify-between text-xs text-[var(--color-foreground-muted)]">
                <span>
                  {trail.total} event{trail.total > 1 ? "s" : ""} au total
                </span>
                {durationMs !== null && (
                  <span
                    className={
                      durationMs < 300
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-warning)]"
                    }
                    data-testid="provenance-duration"
                  >
                    {durationMs.toFixed(0)}ms
                  </span>
                )}
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DrawerLoading() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-muted)] py-10 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
      Chargement du trail de provenance…
    </div>
  );
}

function DrawerError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-4">
      <p className="text-sm font-medium text-[var(--color-danger)]">
        Impossible de récupérer le trail
      </p>
      <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{message}</p>
    </div>
  );
}

function DrawerEmpty({ code }: { code: string }) {
  return (
    <div className="text-center py-10">
      <FileSpreadsheet
        className="w-10 h-10 mx-auto text-[var(--color-foreground-subtle)] mb-3"
        aria-hidden
      />
      <p className="text-sm text-[var(--color-foreground-muted)]">
        Aucun event de provenance pour <span className="font-mono">{code}</span>.
      </p>
      <p className="text-xs text-[var(--color-foreground-subtle)] mt-2">
        Effectuez un ingest Excel pour générer la chaîne de provenance.
      </p>
    </div>
  );
}

function EventTimeline({
  events,
  unit,
}: {
  events: FactEvent[];
  unit?: string;
}) {
  return (
    <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-6">
      {events.map((event, idx) => {
        const isLatest = idx === 0;
        return (
          <li
            key={event.id}
            className="pl-5 relative"
            data-testid={`provenance-event-${event.id}`}
          >
            <span
              className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${
                isLatest
                  ? "bg-[var(--color-success)] border-[var(--color-success)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)]"
              }`}
              aria-hidden
            />
            <header className="flex items-baseline gap-2">
              <time className="text-xs font-mono text-[var(--color-foreground-muted)]">
                {formatDate(event.computed_at)}
              </time>
              {isLatest && (
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-success)] font-medium">
                  Dernière valeur
                </span>
              )}
            </header>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-display font-semibold text-[var(--color-foreground)]">
                {event.value === null
                  ? "—"
                  : event.value.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}
              </span>
              <span className="text-xs text-[var(--color-foreground-muted)]">
                {unit ?? event.unit}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
              <FileSpreadsheet className="w-3 h-3" aria-hidden />
              <span className="font-mono truncate">{event.source_path}</span>
            </div>
            <div className="mt-2">
              <HashBadge hash={event.hash_self} label="hash_self" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function HashBadge({ hash, label }: { hash: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const short = hash.slice(0, 10) + "…" + hash.slice(-4);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silencieux : utilisateur verra simplement pas de confirmation
    }
  };

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-[var(--color-surface-muted)] hover:bg-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-foreground-muted)] transition-colors"
      aria-label={`Copier ${label} (${hash})`}
      data-testid="provenance-hash-copy"
    >
      {copied ? (
        <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" aria-hidden />
      ) : (
        <Copy className="w-3 h-3" aria-hidden />
      )}
      <span>{label}</span>
      <span className="text-[var(--color-foreground-subtle)]">{short}</span>
    </button>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

const EVIDENCE_ACCEPT = ".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

/**
 * EvidenceSection — pièces justificatives d'un datapoint (T2.1). Permet à
 * l'utilisateur d'ATTACHER une pièce (PDF/PNG/JPG, 5 Mo max), de lister les
 * pièces actives et de les révoquer. Chaque action = un event chaîné côté API
 * (le SHA-256 de la pièce est scellé dans la chaîne de preuve).
 */
function EvidenceSection({ code }: { code: string }) {
  const [items, setItems] = useState<EvidenceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    setError(null);
    fetchEvidence(code)
      .then((list) => {
        setItems(list);
        setUnavailable(false);
      })
      .catch(() => {
        setItems([]);
        setUnavailable(true);
      });
  }, [code]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_EVIDENCE_BYTES) {
      setError("Fichier trop volumineux (5 Mo max).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadEvidence(code, file);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (sha256: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteEvidence(code, sha256);
      reload();
    } catch {
      setError("Échec de la révocation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 border-t border-[var(--color-border)] pt-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-foreground-subtle)]">
          <Paperclip className="w-3.5 h-3.5" aria-hidden />
          Pièces justificatives
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || unavailable}
          data-testid="evidence-attach"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="w-3.5 h-3.5" aria-hidden />
          )}
          Joindre
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={EVIDENCE_ACCEPT}
          className="hidden"
          onChange={onPick}
        />
      </div>

      {error && (
        <p className="mb-2 text-xs text-[var(--color-danger)]">{error}</p>
      )}

      {unavailable ? (
        <p className="text-xs text-[var(--color-foreground-subtle)]">
          Pièces indisponibles (connexion au backend requise).
        </p>
      ) : items && items.length === 0 ? (
        <p className="text-xs text-[var(--color-foreground-subtle)]">
          Aucune pièce. Joignez une facture ou un justificatif (PDF, PNG, JPG — 5 Mo max) :
          chaque pièce est scellée par son hash dans la chaîne de preuve.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="evidence-list">
          {(items ?? []).map((it) => (
            <li
              key={it.sha256}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-[var(--color-foreground-muted)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--color-foreground)]">
                  {it.filename}
                </p>
                <p className="font-mono text-[10px] text-[var(--color-foreground-subtle)]">
                  {formatBytes(it.size)} · {it.sha256.slice(0, 10)}…
                  {it.uploaded_at ? ` · ${formatDate(it.uploaded_at)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(it.sha256)}
                disabled={busy}
                aria-label={`Révoquer la pièce ${it.filename}`}
                className="p-1.5 rounded-md text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface)] disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
