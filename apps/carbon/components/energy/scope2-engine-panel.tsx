"use client";

/* ════════════════════════════════════════════════════════════════════════════
   Moteur de calcul Scope 2 dual — location-based ET market-based (PR-06B, BETA)

   Règle d'affichage non négociable : les DEUX totaux sont TOUJOURS côte à côte,
   jamais l'un masquant l'autre, jamais un onglet qui en cacherait un. Le GHG
   Protocol Scope 2 Guidance impose la double comptabilisation ; l'interface la
   rend visuellement inévitable.

   Ce panneau affiche aussi ce que la plupart des outils cachent :
     - la TRACE de calcul (quel facteur, à quel niveau de hiérarchie, pourquoi) ;
     - la part NON COUVERTE par un instrument contractuel ;
     - les facteurs MANQUANTS (un run incomplet le dit et n'est pas approuvable) ;
     - les warnings méthodologiques.
   ════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Download,
  FileWarning,
  Gauge,
  ListTree,
  Sparkles,
  Zap,
} from "lucide-react";

import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { ReviewGate } from "@/components/intelligence/review-gate";
import { reviewScope2Run, type ReviewRunResponse } from "@/lib/api";
import {
  downloadScope2EvidencePack,
  fetchScope2Run,
  fetchScope2Runs,
  type Scope2ResultData,
  type Scope2RunEnvelope,
  type Scope2TraceLine,
} from "@/lib/api/energy";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "empty" }
  | { status: "ready"; envelope: Scope2RunEnvelope };

/** Libellé lisible d'un niveau de hiérarchie de facteur. La clé technique reste
 *  affichée en exposant pour que la trace soit vérifiable sans ambiguïté. */
const LEVEL_LABEL: Record<string, string> = {
  subnational_grid: "Réseau sous-national",
  national_grid: "Réseau national",
  documented_regional: "Régional documenté",
  contractual_instrument: "Instrument contractuel",
  supplier_factor_sourced: "Facteur fournisseur (sourcé)",
  supplier_factor: "Facteur fournisseur",
  residual_mix_sourced: "Mix résiduel (sourcé)",
  residual_mix: "Mix résiduel",
  documented_fallback: "Repli documenté",
};

const SEGMENT_LABEL: Record<string, string> = {
  total: "Total",
  covered: "Couvert",
  uncovered: "Non couvert",
};

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function QualityChip({ quality }: { quality: string }) {
  const verified = quality === "verified";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
        verified
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {verified ? "Vérifié" : "Estimé"}
    </span>
  );
}

export function Scope2EnginePanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [traceOpen, setTraceOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchScope2Runs({ limit: 1 }, ac.signal)
      .then(async (list) => {
        if (list.items.length === 0) {
          setState({ status: "empty" });
          return;
        }
        const envelope = await fetchScope2Run(list.items[0].id, ac.signal);
        setState({ status: "ready", envelope });
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setState({ status: "error", error: err instanceof Error ? err.message : "Erreur inconnue" });
      });
    return () => ac.abort();
  }, []);

  const runId = state.status === "ready" ? state.envelope.data.run_id : null;

  const handleDownload = useCallback(async () => {
    if (runId === null) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadScope2EvidencePack(runId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `carbonco-scope2-run-${runId}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Téléchargement impossible");
    } finally {
      setDownloading(false);
    }
  }, [runId]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/60 p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold leading-tight">
              Moteur de calcul Scope 2 dual
              <FeatureStatusBadge status="beta" size="sm" />
            </h2>
            <p className="text-xs text-neutral-500">
              Totaux location-based et market-based calculés côte à côte, avec la trace du facteur retenu.
            </p>
          </div>
        </div>
        {state.status === "ready" && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {downloading ? "Génération…" : "Evidence Pack"}
          </button>
        )}
      </div>

      {state.status === "loading" && (
        <div className="animate-pulse space-y-3">
          <div className="h-28 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
        </div>
      )}

      {state.status === "empty" && (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-3 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40">
          Aucun calcul Scope 2 enregistré. Lancez un run depuis l&apos;API
          (<code className="font-mono">POST /energy/scope2/calculate</code>) après avoir importé des
          activités énergie et déclaré vos facteurs.
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <p className="text-xs">
            <strong>Moteur Scope 2 indisponible</strong> — l&apos;API requiert une session
            authentifiée et une base de données active.
            <span className="block opacity-60">({state.error})</span>
          </p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <Scope2RunView
            envelope={state.envelope}
            traceOpen={traceOpen}
            onToggleTrace={() => setTraceOpen((v) => !v)}
            downloadError={downloadError}
          />
          {runId !== null && <Scope2AiExplanation runId={runId} />}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Explication IA (PR-11) — même ReviewGate que la fiche IRO (UC-2). N'altère
// aucun KPI : c'est une lecture assistée, décision humaine, rien de publié.
// ---------------------------------------------------------------------------

function Scope2AiExplanation({ runId }: { runId: number }) {
  const [result, setResult] = useState<ReviewRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [started, setStarted] = useState(false);

  const run = useCallback(async () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      const res = await reviewScope2Run(runId);
      setResult(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  if (!started) {
    return (
      <div className="mt-5">
        <button
          type="button"
          onClick={run}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          data-testid="scope2-run-ai-explanation"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Explication IA
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <ReviewGate
        result={result}
        loading={loading}
        error={error}
        onRegenerate={run}
        title="Explication IA du run Scope 2"
      />
    </div>
  );
}

function Scope2RunView({
  envelope,
  traceOpen,
  onToggleTrace,
  downloadError,
}: {
  envelope: Scope2RunEnvelope;
  traceOpen: boolean;
  onToggleTrace: () => void;
  downloadError: string | null;
}) {
  const data: Scope2ResultData = envelope.data;
  const { meta } = envelope;
  const warnings = meta.quality.warnings ?? [];
  const lbLines = data.trace.filter((l) => l.basis === "location");
  const mbLines = data.trace.filter((l) => l.basis === "market");

  return (
    <div className="space-y-5">
      {/* Identité du run : méthode versionnée + statut + empreinte */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <span>
          Run <strong className="tabular-nums">#{data.run_id}</strong>
        </span>
        <span>
          {data.period_start} → {data.period_end} · zone {data.geography_code}
        </span>
        <span>
          Méthode <code className="font-mono">{meta.method.code} {meta.method.version}</code>
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 font-medium ${
            data.status === "approved"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
          }`}
        >
          {data.status === "approved" ? "Approuvé" : "Brouillon"}
        </span>
        <span className="font-mono opacity-60">
          empreinte {data.input_fingerprint.slice(0, 12)}…
        </span>
      </div>

      {/* Un brouillon ne remplace aucun KPI : le dire explicitement. */}
      {data.status !== "approved" && (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60">
          Ce run est un <strong>brouillon</strong> : il ne remplace pas les KPI Scope 2 publiés.
          Les chiffres officiels ne changent qu&apos;à l&apos;approbation d&apos;un run complet.
        </p>
      )}

      {/* ── LES DEUX TOTAUX, CÔTE À CÔTE, TOUJOURS ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <TotalCard
          title="Location-based (LB)"
          subtitle="Facteur moyen du réseau"
          tone="emerald"
          tco2e={data.location_based_tco2e}
          footnote={`${fmt(data.total_consumption_mwh)} MWh consommés — les instruments contractuels n'ont aucun effet sur cette base.`}
          lines={lbLines}
        />
        <TotalCard
          title="Market-based (MB)"
          subtitle="Instruments, fournisseur, mix résiduel"
          tone="cyan"
          tco2e={data.market_based_tco2e}
          footnote={`${fmt(data.contractual_coverage_mwh)} MWh couverts (${fmt(data.contractual_coverage_pct)} %) · ${fmt(data.uncovered_mwh)} MWh non couverts${data.residual_mix_used ? " — mix résiduel utilisé" : ""}.`}
          lines={mbLines}
        />
      </div>

      {/* Qualité : confiance, couverture, complétude */}
      <div className="grid gap-2 sm:grid-cols-3">
        <StatChip
          icon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
          label="Confiance"
          value={meta.quality.confidence === null ? "—" : `${meta.quality.confidence} / 100`}
        />
        <StatChip
          icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
          label="Couverture du calcul"
          value={meta.quality.coverage_pct === null ? "—" : `${fmt(meta.quality.coverage_pct)} %`}
        />
        <StatChip
          icon={<Award className="h-3.5 w-3.5" aria-hidden />}
          label="Statut de la donnée"
          value={meta.status === "verified" ? "Vérifié" : "Estimé"}
        />
      </div>

      {/* Facteurs manquants — un run incomplet le dit, il ne complète jamais à zéro */}
      {data.missing_factors.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-rose-800 dark:text-rose-300">
            <FileWarning className="h-4 w-4" aria-hidden />
            {data.missing_factors.length} facteur(s) manquant(s) — run incomplet
          </h3>
          <p className="mb-2 text-[11px] text-rose-700 dark:text-rose-300/80">
            Les quantités concernées sont <strong>exclues des totaux</strong>, jamais remplacées par
            zéro. Ce run ne peut pas être approuvé en l&apos;état.
          </p>
          <ul className="space-y-1 text-[11px] text-rose-700 dark:text-rose-300/80">
            {data.missing_factors.slice(0, 5).map((m, i) => (
              <li key={`${m.energy_activity_id}-${m.basis}-${i}`}>
                <span className="font-mono">
                  {m.basis === "location" ? "LB" : "MB"} · activité {m.energy_activity_id}
                </span>{" "}
                — {m.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings méthodologiques */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {warnings.length} avertissement(s)
          </h3>
          <ul className="space-y-1 text-[11px] text-amber-800 dark:text-amber-300/80">
            {warnings.slice(0, 8).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {downloadError && (
        <p className="text-[11px] text-rose-600">Evidence Pack : {downloadError}</p>
      )}

      {/* ── Trace de calcul ── */}
      <div>
        <button
          type="button"
          onClick={onToggleTrace}
          aria-expanded={traceOpen}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
        >
          <ListTree className="h-4 w-4" aria-hidden />
          Trace de calcul ({data.trace.length} ligne{data.trace.length > 1 ? "s" : ""})
        </button>
        {traceOpen && (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Trace de calcul Scope 2 : facteur retenu, niveau de hiérarchie et raison, pour
                chaque activité et chaque base.
              </caption>
              <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-400 dark:bg-neutral-900/60">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Base</th>
                  <th scope="col" className="px-3 py-2 font-medium">Segment</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Énergie</th>
                  <th scope="col" className="px-3 py-2 font-medium">Facteur retenu</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">tCO2e</th>
                  <th scope="col" className="px-3 py-2 font-medium">Qualité</th>
                </tr>
              </thead>
              <tbody>
                {data.trace.map((line, i) => (
                  <TraceRow key={line.id ?? i} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bandeau méthodologique : les interdits, écrits noir sur blanc */}
      <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60">
        <strong>Garanties méthodologiques.</strong> Une moyenne de réseau nationale n&apos;est
        jamais présentée comme market-based. Une estimation n&apos;est jamais étiquetée
        « vérifiée ». Un proxy fournisseur n&apos;est jamais présenté comme facteur contractuel
        vérifié. Aucun facteur n&apos;est choisi silencieusement : chaque ligne de la trace porte
        son niveau de hiérarchie et sa raison.
      </p>
    </div>
  );
}

function TraceRow({ line }: { line: Scope2TraceLine }) {
  const isFallback = line.factor_basis === "documented_fallback";
  return (
    <tr className="border-t border-neutral-100 align-top dark:border-neutral-800">
      <td className="px-3 py-2">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            line.basis === "location"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-cyan-100 text-cyan-700"
          }`}
        >
          {line.basis === "location" ? "LB" : "MB"}
        </span>
      </td>
      <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">
        {SEGMENT_LABEL[line.segment] ?? line.segment}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(line.activity_mwh)} MWh</td>
      <td className="px-3 py-2">
        <div className="font-medium">
          {LEVEL_LABEL[line.selection_level] ?? line.selection_level}
          {isFallback && (
            <span className="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Repli
            </span>
          )}
        </div>
        <div className="text-[11px] text-neutral-500">{line.selection_reason}</div>
        {line.fallback_reason && (
          <div className="mt-0.5 text-[11px] text-amber-700">Motif : {line.fallback_reason}</div>
        )}
        {line.ef_code && (
          <div className="text-[11px] font-mono text-neutral-400">
            {line.ef_code} · {line.ef_version} ·{" "}
            {fmt(line.factor_kgco2e_per_mwh, 3)} kgCO2e/MWh
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(line.result_tco2e, 3)}</td>
      <td className="px-3 py-2">
        <QualityChip quality={line.data_quality} />
      </td>
    </tr>
  );
}

function TotalCard({
  title,
  subtitle,
  tone,
  tco2e,
  footnote,
  lines,
}: {
  title: string;
  subtitle: string;
  tone: "emerald" | "cyan";
  tco2e: number;
  footnote: string;
  lines: Scope2TraceLine[];
}) {
  const palette =
    tone === "emerald"
      ? {
          border: "border-emerald-200 dark:border-emerald-900/40",
          bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
          title: "text-emerald-800 dark:text-emerald-300",
          chip: "bg-emerald-100 text-emerald-700",
        }
      : {
          border: "border-cyan-200 dark:border-cyan-900/40",
          bg: "bg-cyan-50/40 dark:bg-cyan-950/20",
          title: "text-cyan-800 dark:text-cyan-300",
          chip: "bg-cyan-100 text-cyan-700",
        };

  return (
    <div className={`rounded-xl border p-4 ${palette.border} ${palette.bg}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${palette.title}`}>{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${palette.chip}`}>
          {subtitle}
        </span>
      </div>
      <p className="font-display text-3xl font-bold tabular-nums">
        {fmt(tco2e, 2)}
        <span className="ml-1 text-sm font-medium text-neutral-500">tCO2e</span>
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">{footnote}</p>
      <p className="mt-2 text-[11px] text-neutral-400">
        {lines.length} ligne{lines.length > 1 ? "s" : ""} de trace
      </p>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
