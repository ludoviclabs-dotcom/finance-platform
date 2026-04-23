"use client";

/**
 * ClientBankCommsLive — dark theme refit.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  Loader2,
  Mail,
  MessageSquare,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";

type Scenario = {
  scenario_id: string;
  label: string;
  use_case_id: string;
  segment_id: string;
  canal: "EMAIL" | "SMS" | "APP" | "PUSH" | "MAIL";
  expected_verdict: "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
};

type Gate = {
  gate_id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  reason: string | null;
};

type Verdict = {
  decision: "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
  blockers: string[];
  warnings: string[];
  gates: Gate[];
  metrics: {
    char_count: number;
    char_limit: number | null;
    reading_level_score: number;
    reading_level_max: number;
    missing_notices: string[];
    absolute_terms: string[];
  };
  points_to_validate: string[];
  suggested_rewrite: string | null;
  reviewer_comment: string;
};

type Api = {
  result?: Verdict;
  meta?: { mode: "gateway" | "fallback"; latencyMs: number };
  error?: string;
  scenarios?: Scenario[];
};

const DECISION: Record<Verdict["decision"], { badge: string; icon: typeof CheckCircle2 }> = {
  PASS: {
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    icon: CheckCircle2,
  },
  PASS_WITH_REVIEW: {
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    icon: AlertTriangle,
  },
  BLOCK: { badge: "border-red-400/30 bg-red-400/10 text-red-200", icon: XCircle },
};

const CANAL_ICON: Record<Scenario["canal"], typeof Mail> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  APP: Smartphone,
  PUSH: Smartphone,
  MAIL: Mail,
};

export function ClientBankCommsLive() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [meta, setMeta] = useState<{ mode: string; latencyMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void fetch("/api/demo/client-bank-comms")
      .then((r) => r.json())
      .then((data: Api) => {
        if (data.scenarios?.length) {
          setScenarios(data.scenarios);
          setScenarioId(data.scenarios[0].scenario_id);
        }
      })
      .catch(() => setError("Impossible de charger les scénarios."));
  }, []);

  async function run() {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);
    setVerdict(null);
    try {
      const res = await fetch("/api/demo/client-bank-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const data = (await res.json()) as Api;
      if (!res.ok || !data.result) {
        setError(data.error ?? "Erreur inconnue.");
        return;
      }
      setVerdict(data.result);
      setMeta(data.meta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPack() {
    if (!scenarioId) return;
    setExporting(true);
    try {
      const res = await fetch("/api/demo/client-bank-comms/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Échec de l'export.");
        return;
      }
      const blob = await res.blob();
      const filename =
        res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `neural-clientbank-${scenarioId}.md`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur export.");
    } finally {
      setExporting(false);
    }
  }

  const active = scenarios.find((s) => s.scenario_id === scenarioId);
  const CanalIcon = active ? CANAL_ICON[active.canal] : Mail;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-400/10">
            <Mail className="h-5 w-5 text-blue-200" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
              AG-B004 · ClientBankComms
            </p>
            <h3 className="text-lg font-semibold text-white">
              Communication client sensible
            </h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-200">
          <PlayCircle className="h-3 w-3" />
          Scénarios figés · pas de texte libre
        </span>
      </header>

      <p className="mt-4 text-sm leading-relaxed text-white/65">
        4 gates : mentions légales obligatoires selon use_case, limite de
        caractères du canal (SMS ≤ 160, PUSH ≤ 80), ton non promotionnel,
        lisibilité Flesch FR par segment.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Scénario client
          </span>
          <select
            value={scenarioId}
            onChange={(e) => {
              setScenarioId(e.target.value);
              setVerdict(null);
              setError(null);
            }}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
          >
            {scenarios.map((s) => (
              <option
                key={s.scenario_id}
                value={s.scenario_id}
                className="bg-[#0A1628]"
              >
                [{s.canal}] {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={loading || !scenarioId}
          className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Vérifier
            </>
          )}
        </button>
      </div>

      {active ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-white/70">
            <CanalIcon className="h-3 w-3" />
            {active.canal}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/60">
            {active.use_case_id}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/60">
            {active.segment_id}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/60">
            Attendu :{" "}
            <span className="font-semibold text-white">{active.expected_verdict}</span>
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {verdict ? (
        <section className="mt-8 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const s = DECISION[verdict.decision];
              const Icon = s.icon;
              return (
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${s.badge}`}
                >
                  <Icon className="h-4 w-4" />
                  {verdict.decision}
                </span>
              );
            })()}
            {meta ? (
              <span className="text-[11px] text-white/50">
                Mode {meta.mode} · {meta.latencyMs} ms
              </span>
            ) : null}
            <button
              type="button"
              onClick={downloadPack}
              disabled={exporting}
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Export…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Pack client (.md + hash)
                </>
              )}
            </button>
          </div>

          {/* Métriques */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Gauge className="h-4 w-4 text-white/60" />
                  Longueur
                </p>
                <span
                  className={`font-mono text-[11px] ${
                    verdict.metrics.char_limit &&
                    verdict.metrics.char_count > verdict.metrics.char_limit
                      ? "text-red-300"
                      : "text-white/60"
                  }`}
                >
                  {verdict.metrics.char_count} chars
                  {verdict.metrics.char_limit
                    ? ` / ${verdict.metrics.char_limit}`
                    : " (pas de limite)"}
                </span>
              </div>
              {verdict.metrics.char_limit ? (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full ${
                      verdict.metrics.char_count > verdict.metrics.char_limit
                        ? "bg-red-400"
                        : "bg-emerald-400"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (verdict.metrics.char_count / verdict.metrics.char_limit) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Gauge className="h-4 w-4 text-white/60" />
                  Flesch FR
                </p>
                <span className="font-mono text-[11px] text-white/60">
                  Score {verdict.metrics.reading_level_score} / seuil{" "}
                  {Math.max(0, 100 - verdict.metrics.reading_level_max)}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full ${
                    verdict.metrics.reading_level_score >=
                    Math.max(0, 100 - verdict.metrics.reading_level_max)
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                  style={{
                    width: `${Math.min(100, verdict.metrics.reading_level_score)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {verdict.metrics.missing_notices.length ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.08] p-4 text-sm">
              <p className="font-semibold text-red-100">
                Mentions légales manquantes
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {verdict.metrics.missing_notices.map((n) => (
                  <span
                    key={n}
                    className="rounded-full border border-red-400/30 bg-red-400/15 px-2.5 py-1 font-mono text-[11px] text-red-100"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {verdict.metrics.absolute_terms.length ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-4 text-sm">
              <p className="font-semibold text-amber-100">Termes absolus détectés</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {verdict.metrics.absolute_terms.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-1 text-[11px] text-amber-100"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/75">
            <p className="font-semibold text-white">Commentaire reviewer</p>
            <p className="mt-1.5 whitespace-pre-wrap">{verdict.reviewer_comment}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-200">
              Gates client — {verdict.gates.filter((g) => g.passed).length}/
              {verdict.gates.length} PASS
            </p>
            <ul className="mt-3 space-y-2">
              {verdict.gates.map((g) => (
                <li
                  key={g.gate_id}
                  className={`rounded-xl border p-3 ${
                    g.passed
                      ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                      : g.blocking
                        ? "border-red-400/25 bg-red-400/[0.06]"
                        : "border-amber-400/25 bg-amber-400/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] text-white/50">
                        {g.gate_id}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {g.label}
                      </p>
                    </div>
                    {g.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    ) : g.blocking ? (
                      <ShieldAlert className="h-5 w-5 text-red-300" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-300" />
                    )}
                  </div>
                  {g.reason ? (
                    <p className="mt-2 text-xs text-white/60">{g.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {verdict.points_to_validate.length ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-200">
                Points à valider
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/75">
                {verdict.points_to_validate.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {verdict.suggested_rewrite ? (
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-violet-200">
                <FileText className="h-3.5 w-3.5" />
                Reformulation suggérée
              </p>
              <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-white/80">
                {verdict.suggested_rewrite}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
