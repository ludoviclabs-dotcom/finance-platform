"use client";

/**
 * /fournisseurs/exposition — Exposition achats (PR-05A, BETA).
 *
 * Socle d'exposition : import CSV d'achats IDEMPOTENT par contenu (sha256),
 * suivi des lignes, file de résolution des lignes non mappées, gate de revue.
 * AUCUN calcul Scope 3, hotspot ou score fournisseur ici (PR-05B) — la vue se
 * limite honnêtement à la couverture de mapping et à la dépense couverte.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";

import {
  type PurchaseImport,
  type PurchaseLine,
  createPurchaseImport,
  fetchImportLines,
  fetchPurchaseImports,
  fetchResolutionQueue,
  resolveImportMappings,
  resolvedShare,
  reviewImport,
} from "@/lib/api/procurement";

const MAPPING_TONE: Record<string, string> = {
  mapped: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  resolved: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300",
  unmapped: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  needs_review: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
};

const MAPPING_LABEL: Record<string, string> = {
  mapped: "Mappé",
  resolved: "Résolu",
  unmapped: "Non mappé",
  needs_review: "À vérifier",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  validated: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  emitted: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
};

function fmtEur(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

// ---------------------------------------------------------------------------
// Import CSV modal
// ---------------------------------------------------------------------------

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (imp: PurchaseImport) => void }) {
  const [filename, setFilename] = useState("achats.csv");
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const imp = await createPurchaseImport({ filename, csv_text: csvText });
      onDone(imp);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-2xl p-6">
        <h2 className="font-display text-lg font-bold text-[var(--color-foreground)] mb-1">
          Importer des achats (CSV)
        </h2>
        <p className="text-xs text-[var(--color-foreground-muted)] mb-4">
          Colonnes reconnues : fournisseur, produit, date, quantité, unité, montant, devise, catégorie,
          pays. L&apos;import est idempotent — rejouer le même fichier ne crée aucun doublon.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
              Nom du fichier
            </label>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)]"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
              Contenu CSV
            </label>
            <textarea
              required
              rows={8}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-mono text-[var(--color-foreground)]"
              placeholder={"supplier_code,product_code,date,quantity,unit,amount,currency\nSUP1,PRD-100,2026-01-15,10,kg,1500,EUR"}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-foreground-muted)]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !csvText.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-carbon-emerald text-white text-sm font-semibold disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import detail (lines + resolution queue + review gate)
// ---------------------------------------------------------------------------

function ImportDetail({ imp, onChanged }: { imp: PurchaseImport; onChanged: () => void }) {
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [queue, setQueue] = useState<PurchaseLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | "review" | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchImportLines(imp.id), fetchResolutionQueue(imp.id)])
      .then(([l, q]) => {
        setLines(l);
        setQueue(q);
      })
      .finally(() => setLoading(false));
  }, [imp.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function markResolved(lineId: number) {
    setBusy(lineId);
    try {
      await resolveImportMappings(imp.id, [{ line_id: lineId, mapping_status: "resolved" }]);
      load();
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function review(accept: boolean) {
    setBusy("review");
    try {
      await reviewImport(imp.id, accept);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  const spendCovered = lines.reduce((acc, l) => acc + (l.spend_amount ?? 0), 0);
  const pctResolved = resolvedShare(imp, lines);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Lignes" value={`${imp.row_count}`} />
        <Kpi label="Dépense couverte" value={fmtEur(spendCovered)} />
        <Kpi label="Résolu" value={`${pctResolved}%`} />
        <Kpi label="File de résolution" value={`${queue.length}`} tone={queue.length ? "warn" : "ok"} />
      </div>

      {imp.status === "pending" && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="flex-1 text-sm text-[var(--color-foreground-muted)]">
            Import en attente de revue — rien n&apos;alimente le calcul avant validation humaine.
          </p>
          <button
            type="button"
            onClick={() => review(true)}
            disabled={busy === "review"}
            className="px-3 py-1.5 rounded-lg bg-carbon-emerald text-white text-xs font-semibold disabled:opacity-50"
          >
            Valider
          </button>
          <button
            type="button"
            onClick={() => review(false)}
            disabled={busy === "review"}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-foreground-muted)]"
          >
            Rejeter
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-carbon-emerald" />
        </div>
      ) : (
        <>
          {queue.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-[var(--color-foreground)] mb-2">
                File de résolution ({queue.length})
              </h3>
              <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {queue.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="flex-1 truncate text-[var(--color-foreground)]">
                      {l.product_external_code || l.supplier_external_code || "(ligne sans code)"}
                    </span>
                    <span className="text-xs text-[var(--color-foreground-muted)]">{fmtEur(l.spend_amount)}</span>
                    <button
                      type="button"
                      onClick={() => markResolved(l.id)}
                      disabled={busy === l.id}
                      className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-xs text-carbon-emerald disabled:opacity-50"
                    >
                      {busy === l.id ? "…" : "Marquer résolu"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-bold text-[var(--color-foreground)] mb-2">
              Lignes d&apos;achat ({lines.length})
            </h3>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--color-foreground-muted)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-2 font-semibold">Produit</th>
                    <th className="px-4 py-2 font-semibold">Fournisseur</th>
                    <th className="px-4 py-2 font-semibold text-right">Montant</th>
                    <th className="px-4 py-2 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-2 text-[var(--color-foreground)]">{l.product_external_code || "—"}</td>
                      <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{l.supplier_external_code || "—"}</td>
                      <td className="px-4 py-2 text-right text-[var(--color-foreground)]">{fmtEur(l.spend_amount)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${MAPPING_TONE[l.mapping_status]}`}>
                          {MAPPING_LABEL[l.mapping_status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const valueCls =
    tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-foreground)]";
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)] mb-1">
        {label}
      </div>
      <div className={`font-display text-2xl font-extrabold ${valueCls}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExpositionAchatsPage() {
  const [imports, setImports] = useState<PurchaseImport[]>([]);
  const [selected, setSelected] = useState<PurchaseImport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPurchaseImports()
      .then((data) => {
        setImports(data);
        setSelected((prev) => (prev ? data.find((i) => i.id === prev.id) ?? null : null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={(imp) => {
            load();
            setSelected(imp);
          }}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
              Exposition achats
            </h1>
            <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] font-bold uppercase px-2 py-0.5">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Achats → fournisseurs → produits, imports idempotents et file de résolution. Calcul Scope 3 à
            venir (PR-05B).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/fournisseurs"
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-foreground-muted)]"
          >
            <ArrowLeft className="w-4 h-4" /> Fournisseurs
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-foreground-muted)]"
            aria-label="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold"
          >
            <FileUp className="w-4 h-4" /> Importer un CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {loading && imports.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
        </div>
      )}

      {!loading && imports.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <FileUp className="w-10 h-10 mx-auto text-[var(--color-foreground-muted)] mb-3" />
          <h3 className="font-display text-base font-bold text-[var(--color-foreground)] mb-1">
            Aucun import d&apos;achats
          </h3>
          <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
            Importez un fichier d&apos;achats pour construire votre exposition fournisseurs.
          </p>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold"
          >
            <FileUp className="w-4 h-4" /> Importer un CSV
          </button>
        </div>
      )}

      {imports.length > 0 && (
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-2">
            {imports.map((imp) => (
              <button
                type="button"
                key={imp.id}
                onClick={() => setSelected(imp)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selected?.id === imp.id
                    ? "border-carbon-emerald bg-[var(--color-bg)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--color-foreground)] truncate">
                    {imp.filename}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[imp.status]}`}>
                    {imp.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-foreground-muted)]">
                  <span>{imp.row_count} lignes</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> {imp.accepted_count} ok
                  </span>
                  {imp.rejected_count > 0 && <span>{imp.rejected_count} à vérifier</span>}
                </div>
              </button>
            ))}
          </div>

          <div>
            {selected ? (
              <ImportDetail imp={selected} onChanged={load} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-foreground-muted)]">
                Sélectionnez un import pour voir ses lignes et sa file de résolution.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
