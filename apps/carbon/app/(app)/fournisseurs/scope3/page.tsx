"use client";

/**
 * /fournisseurs/scope3 — Moteur Scope 3 catégorie 1 : achats (PR-05B, BETA).
 *
 * Ce que la vue montre, dans cet ordre délibéré :
 *   1. la COUVERTURE (ce qui est calculé et ce qui ne l'est PAS) ;
 *   2. la répartition par MÉTHODE de la hiérarchie ;
 *   3. les lignes NON RÉSOLUES, jamais reléguées ;
 *   4. les HOTSPOTS, avec leur part non résolue ;
 *   5. la SÉLECTION humaine d'un hotspot, puis la campagne fournisseur ;
 *   6. le drill-down complet d'une ligne jusqu'à la preuve ;
 *   7. l'Evidence Pack.
 *
 * Un total n'est JAMAIS affiché seul : la couverture et le nombre de lignes non
 * résolues l'accompagnent partout. C'est la traduction visuelle de « aucun
 * fallback silencieux » — le chiffre ne doit pas pouvoir se lire comme exhaustif
 * s'il ne l'est pas.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Target,
} from "lucide-react";

import {
  type AnalyticalEnvelope,
  type CalculationRun,
  type CalculationTrace as TraceData,
  type CoverageData,
  type Hotspot,
  type HotspotType,
  type LineResult,
  approveRun,
  calculateScope3,
  createCampaignFromHotspot,
  downloadEvidencePack,
  fetchCalculationTrace,
  fetchHotspots,
  fetchPurchaseImports,
  fetchRunCoverage,
  fetchRunLines,
  fetchRuns,
  selectHotspot,
} from "@/lib/api/procurement";
import { CalculationTrace } from "@/components/procurement/calculation-trace";
import { ConfidenceBadge, MethodBadge } from "@/components/procurement/method-badge";

const HOTSPOT_TABS: { key: HotspotType; label: string }[] = [
  { key: "supplier", label: "Fournisseurs" },
  { key: "supplier_product", label: "Produits" },
  { key: "category", label: "Catégories" },
  { key: "country", label: "Pays" },
];

function fmtT(v: number | null): string {
  if (v == null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v)} tCO₂e`;
}

function fmtPct(v: number | null): string {
  return v == null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
}

function fmtEur(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

// ---------------------------------------------------------------------------
// Couverture — le total n'apparaît jamais sans son taux de couverture
// ---------------------------------------------------------------------------

function CoveragePanel({ envelope }: { envelope: AnalyticalEnvelope<CoverageData> }) {
  const { data, meta } = envelope;
  const partial = data.unresolved_count > 0;

  return (
    <section className="space-y-4" aria-labelledby="coverage-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="coverage-title" className="text-lg font-semibold text-[var(--color-foreground)]">
          Couverture du calcul
        </h2>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-foreground-muted)]">
          {meta.method.code} v{meta.method.version}
        </span>
        <ConfidenceBadge
          confidence={meta.quality.confidence === null ? null : meta.quality.confidence / 100}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-foreground-muted)]">Total calculé</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-foreground)]">
            {fmtT(data.total_tco2e)}
          </p>
          {partial && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              Total partiel — {data.unresolved_count} ligne(s) non résolue(s)
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-foreground-muted)]">Lignes couvertes</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-foreground)]">
            {fmtPct(data.coverage_lines_pct)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-foreground-subtle)]">
            {data.resolved_count} / {data.line_count}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-foreground-muted)]">Dépense couverte</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-foreground)]">
            {fmtPct(data.coverage_spend_pct)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-foreground-subtle)]">
            {fmtEur(data.unresolved_spend_amount)} non résolus
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-foreground-muted)]">Donnée primaire</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-foreground)]">
            {fmtPct(data.primary_data_share_pct)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-foreground-subtle)]">
            rangs 1-2 (fournisseur)
          </p>
        </div>
      </div>

      {meta.quality.warnings.length > 0 && (
        <ul
          className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-900/10"
          aria-label="Avertissements du run"
        >
          {meta.quality.warnings.map((w, i) => (
            <li key={i} className="flex gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
          Répartition par méthode
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-foreground-muted)]">
                <th className="py-2 pr-4 font-semibold">Méthode</th>
                <th className="py-2 pr-4 font-semibold">Lignes</th>
                <th className="py-2 pr-4 font-semibold">Part des lignes</th>
                <th className="py-2 pr-4 font-semibold">Émissions</th>
                <th className="py-2 pr-4 font-semibold">Part des émissions</th>
              </tr>
            </thead>
            <tbody>
              {data.methods.map((m) => (
                <tr key={m.calculation_method} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4">
                    <MethodBadge method={m.calculation_method} />
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--color-foreground)]">
                    {m.line_count}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--color-foreground-muted)]">
                    {fmtPct(m.share_of_lines_pct)}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--color-foreground)]">
                    {m.calculation_method === "unresolved" ? (
                      <span className="text-[var(--color-foreground-muted)]">non calculé</span>
                    ) : (
                      fmtT(m.result_tco2e)
                    )}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--color-foreground-muted)]">
                    {m.calculation_method === "unresolved" ? "—" : fmtPct(m.share_of_emissions_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hotspots + sélection humaine + campagne
// ---------------------------------------------------------------------------

function HotspotsPanel({ runId }: { runId: number }) {
  const [tab, setTab] = useState<HotspotType>("supplier");
  const [items, setItems] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaignFor, setCampaignFor] = useState<Hotspot | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchHotspots(runId, tab)
      .then((env) => setItems(env.data.items))
      .catch(() => setError("Chargement des hotspots impossible."))
      .finally(() => setLoading(false));
  }, [runId, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(h: Hotspot, status: "selected" | "dismissed") {
    setBusy(h.hotspot_key);
    setError(null);
    try {
      await selectHotspot({
        run_id: runId,
        hotspot_type: h.hotspot_type,
        hotspot_key: h.hotspot_key,
        hotspot_label: h.hotspot_label,
        selection_status: status,
      });
      load();
    } catch {
      setError("Enregistrement de la sélection impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="hotspots-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hotspots-title" className="text-lg font-semibold text-[var(--color-foreground)]">
          Hotspots
        </h2>
        <div className="flex gap-1" role="tablist" aria-label="Dimension des hotspots">
          {HOTSPOT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.key
                  ? "bg-carbon-emerald text-white"
                  : "border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-[var(--color-foreground-muted)]">
        La détection classe les contributeurs ; elle ne décide rien. Retenir ou écarter un hotspot
        est un geste humain, et seul un hotspot retenu peut donner lieu à une campagne.
      </p>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/10 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[var(--color-foreground-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-foreground-muted)]">
          Aucun hotspot sur cette dimension.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((h) => (
            <li
              key={h.hotspot_key}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              data-testid={`hotspot-${h.hotspot_key}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-foreground)]">
                    <span className="mr-2 text-xs text-[var(--color-foreground-subtle)]">
                      #{h.rank_position}
                    </span>
                    {h.hotspot_label}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
                    {fmtT(h.contribution_tco2e)} · {fmtPct(h.contribution_pct)} du total ·{" "}
                    {fmtEur(h.spend_amount)} · {h.line_count} ligne(s)
                  </p>
                  {h.unresolved_line_count > 0 && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      ⚠ {h.unresolved_line_count} ligne(s) non résolue(s) —{" "}
                      {fmtEur(h.unresolved_spend_amount)} de dépense non calculée sur ce poste.
                    </p>
                  )}
                  {h.dominant_method && (
                    <div className="mt-2">
                      <MethodBadge method={h.dominant_method} />
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {h.selection_status && (
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-foreground-muted)]">
                      {h.selection_status === "selected"
                        ? "retenu"
                        : h.selection_status === "dismissed"
                          ? "écarté"
                          : "campagne créée"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => decide(h, "selected")}
                    disabled={busy === h.hotspot_key}
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                  >
                    Retenir
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(h, "dismissed")}
                    disabled={busy === h.hotspot_key}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
                  >
                    Écarter
                  </button>
                  {h.hotspot_type === "supplier" &&
                    h.selection_status === "selected" &&
                    h.selection_id !== null && (
                      <button
                        type="button"
                        onClick={() => setCampaignFor(h)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-carbon-emerald px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Target className="h-3.5 w-3.5" aria-hidden />
                        Lancer une campagne
                      </button>
                    )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {campaignFor && campaignFor.selection_id !== null && (
        <CampaignModal
          hotspot={campaignFor}
          selectionId={campaignFor.selection_id}
          onClose={() => setCampaignFor(null)}
          onDone={() => {
            setCampaignFor(null);
            load();
          }}
        />
      )}
    </section>
  );
}

function CampaignModal({
  hotspot,
  selectionId,
  onClose,
  onDone,
}: {
  hotspot: Hotspot;
  selectionId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(`Collecte — ${hotspot.hotspot_label}`);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await createCampaignFromHotspot(selectionId, {
        campaign_name: name,
        deadline: deadline || null,
      });
      onDone();
    } catch {
      setError("Création de la campagne impossible.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3
          id="campaign-modal-title"
          className="text-base font-semibold text-[var(--color-foreground)]"
        >
          Campagne fournisseur depuis un hotspot
        </h3>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Une invitation tokenisée sera envoyée à « {hotspot.hotspot_label} ». Sa réponse passera
          par le gate de revue habituel avant d&apos;alimenter un calcul.
        </p>

        <label className="mt-4 block text-xs font-semibold text-[var(--color-foreground-muted)]">
          Nom de la campagne
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-[var(--color-foreground-muted)]">
          Date limite (optionnelle)
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
          />
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground-muted)]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className="rounded-lg bg-carbon-emerald px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Création…" : "Créer la campagne"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lignes + drill-down
// ---------------------------------------------------------------------------

function LinesPanel({ runId }: { runId: number }) {
  const [lines, setLines] = useState<LineResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const [trace, setTrace] = useState<AnalyticalEnvelope<TraceData> | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchRunLines(runId, onlyUnresolved ? "unresolved" : undefined)
      .then(setLines)
      .finally(() => setLoading(false));
  }, [runId, onlyUnresolved]);

  function openTrace(lineId: number) {
    setTraceLoading(true);
    fetchCalculationTrace(runId, lineId)
      .then(setTrace)
      .finally(() => setTraceLoading(false));
  }

  return (
    <section className="space-y-4" aria-labelledby="lines-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lines-title" className="text-lg font-semibold text-[var(--color-foreground)]">
          Lignes calculées
        </h2>
        <label className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
          <input
            type="checkbox"
            checked={onlyUnresolved}
            onChange={(e) => setOnlyUnresolved(e.target.checked)}
          />
          Afficher uniquement les lignes non résolues
        </label>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[var(--color-foreground-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-[var(--color-foreground-muted)]">Aucune ligne.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-foreground-muted)]">
                <th className="py-2 pr-4 font-semibold">Ligne</th>
                <th className="py-2 pr-4 font-semibold">Méthode</th>
                <th className="py-2 pr-4 font-semibold">Facteur</th>
                <th className="py-2 pr-4 font-semibold">Résultat</th>
                <th className="py-2 pr-4 font-semibold">Repli</th>
                <th className="py-2 pr-4 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-[var(--color-border)]"
                  data-testid={`line-result-${l.purchase_line_id}`}
                >
                  <td className="py-2 pr-4 tabular-nums text-[var(--color-foreground-muted)]">
                    #{l.purchase_line_id}
                  </td>
                  <td className="py-2 pr-4">
                    <MethodBadge method={l.calculation_method} />
                  </td>
                  <td className="py-2 pr-4 text-xs text-[var(--color-foreground-muted)]">
                    {l.factor_id ? (
                      <>
                        <span className="font-mono">{l.factor_id}</span>
                        {l.factor_version && (
                          <span className="ml-1 text-[var(--color-foreground-subtle)]">
                            ({l.factor_version})
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--color-foreground)]">
                    {l.result_tco2e === null ? (
                      <span className="text-[var(--color-foreground-muted)]">non calculé</span>
                    ) : (
                      fmtT(l.result_tco2e)
                    )}
                  </td>
                  <td className="max-w-xs py-2 pr-4 text-xs text-amber-700 dark:text-amber-300">
                    {l.fallback_reason ? (
                      <span title={l.fallback_reason} className="line-clamp-2">
                        {l.fallback_reason}
                      </span>
                    ) : (
                      <span className="text-[var(--color-foreground-subtle)]">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => openTrace(l.purchase_line_id)}
                      className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)]"
                    >
                      Trace
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(trace || traceLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Trace de calcul"
        >
          <div className="my-8 w-full max-w-3xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--color-foreground)]">
                Trace de calcul
              </h3>
              <button
                type="button"
                onClick={() => setTrace(null)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground-muted)]"
              >
                Fermer
              </button>
            </div>
            {traceLoading || !trace ? (
              <p className="flex items-center gap-2 text-sm text-[var(--color-foreground-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…
              </p>
            ) : (
              <CalculationTrace trace={trace.data} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Scope3Page() {
  const [runs, setRuns] = useState<CalculationRun[]>([]);
  const [activeRun, setActiveRun] = useState<CalculationRun | null>(null);
  const [coverage, setCoverage] = useState<AnalyticalEnvelope<CoverageData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRuns = useCallback(() => {
    setLoading(true);
    fetchRuns()
      .then((r) => {
        setRuns(r);
        setActiveRun((prev) => prev ?? r[0] ?? null);
      })
      .catch(() => setError("Chargement des runs impossible."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!activeRun) {
      setCoverage(null);
      return;
    }
    fetchRunCoverage(activeRun.id)
      .then(setCoverage)
      .catch(() => setError("Chargement de la couverture impossible."));
  }, [activeRun]);

  async function runCalculation() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const imports = await fetchPurchaseImports();
      const validated = imports.find((i) => i.status === "validated" || i.status === "emitted");
      if (!validated) {
        setError(
          "Aucun import validé : importez un fichier d'achats puis validez-le avant de calculer.",
        );
        return;
      }
      const run = await calculateScope3({ import_id: validated.id });
      setNotice(
        run.already_calculated
          ? "Entrées identiques à un run existant — celui-ci est réaffiché, aucun doublon créé."
          : "Run calculé.",
      );
      setActiveRun(run);
      loadRuns();
    } catch {
      setError("Le calcul a échoué.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!activeRun) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await approveRun(activeRun.id);
      setActiveRun(updated);
      setNotice("Run approuvé et scellé dans la chaîne de preuve.");
      loadRuns();
    } catch {
      setError("Approbation impossible (un run déjà approuvé ne l'est pas deux fois).");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPack() {
    if (!activeRun) return;
    setBusy(true);
    try {
      const blob = await downloadEvidencePack(activeRun.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carbonco-scope3-run-${activeRun.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Téléchargement de l'Evidence Pack impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-3">
        <Link
          href="/fournisseurs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Fournisseurs
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
              Scope 3 · Achats
              <span className="ml-2 rounded-full border border-amber-300 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase text-amber-700 dark:border-amber-500/40 dark:text-amber-300">
                Bêta
              </span>
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-foreground-muted)]">
              Catégorie 1 du GHG Protocol. Cinq méthodes sont essayées dans un ordre strict — PCF
              vérifiée, donnée fournisseur, facteur physique, facteur monétaire — et une ligne qui
              n&apos;en satisfait aucune reste <strong>non résolue</strong> plutôt que d&apos;être
              estimée au jugé.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runCalculation}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-carbon-emerald px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              Calculer
            </button>
            {activeRun && (
              <>
                <button
                  type="button"
                  onClick={approve}
                  disabled={busy || activeRun.status !== "calculated"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40 dark:border-emerald-500/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Approuver
                </button>
                <button
                  type="button"
                  onClick={downloadPack}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-foreground-muted)] disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Evidence Pack
                </button>
              </>
            )}
            <button
              type="button"
              onClick={loadRuns}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-foreground-muted)]"
              aria-label="Recharger les runs"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/10 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 text-sm text-[var(--color-foreground-muted)]">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[var(--color-foreground-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…
        </p>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-base font-semibold text-[var(--color-foreground)]">
            Aucun calcul encore lancé
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-foreground-muted)]">
            Importez un fichier d&apos;achats depuis{" "}
            <Link href="/fournisseurs/exposition" className="underline">
              Exposition achats
            </Link>
            , validez-le en revue, puis lancez le calcul. Rien n&apos;alimente le Scope 3 sans cette
            validation humaine.
          </p>
        </div>
      ) : (
        <>
          {runs.length > 1 && (
            <label className="block text-xs font-semibold text-[var(--color-foreground-muted)]">
              Run
              <select
                value={activeRun?.id ?? ""}
                onChange={(e) =>
                  setActiveRun(runs.find((r) => r.id === Number(e.target.value)) ?? null)
                }
                className="mt-1 block rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    #{r.id} — {new Date(r.calculated_at).toLocaleString("fr-FR")} ({r.status})
                  </option>
                ))}
              </select>
            </label>
          )}

          {coverage && <CoveragePanel envelope={coverage} />}
          {activeRun && <HotspotsPanel runId={activeRun.id} />}
          {activeRun && <LinesPanel runId={activeRun.id} />}
        </>
      )}
    </div>
  );
}
