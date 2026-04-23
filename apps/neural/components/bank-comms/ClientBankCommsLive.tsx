"use client";

/**
 * ClientBankCommsLive — AG-B004 ClientBankComms demo (Sprint 4).
 * Scenario-id only. Affiche gates (mentions, canal, ton, lisibilité) +
 * métriques chiffrées (chars vs. limite, Flesch FR score).
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
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
  PASS: { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: CheckCircle2 },
  PASS_WITH_REVIEW: { badge: "bg-amber-50 text-amber-800 ring-amber-200", icon: AlertTriangle },
  BLOCK: { badge: "bg-red-50 text-red-800 ring-red-200", icon: XCircle },
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

  const active = scenarios.find((s) => s.scenario_id === scenarioId);
  const CanalIcon = active ? CANAL_ICON[active.canal] : Mail;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-blue-600" />
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              AG-B004 · ClientBankComms
            </p>
            <h3 className="text-lg font-semibold">
              Communication client sensible
            </h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
          <PlayCircle className="h-3.5 w-3.5" />
          Démo · scénarios pré-chargés uniquement
        </span>
      </header>

      <p className="mt-3 text-sm text-neutral-600">
        4 gates : mentions légales obligatoires selon use_case, limite de
        caractères du canal (SMS ≤ 160, PUSH ≤ 80), ton non-promotionnel,
        lisibilité Flesch FR adaptée au segment.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Scénario client
          </span>
          <select
            value={scenarioId}
            onChange={(e) => {
              setScenarioId(e.target.value);
              setVerdict(null);
              setError(null);
            }}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          >
            {scenarios.map((s) => (
              <option key={s.scenario_id} value={s.scenario_id}>
                [{s.canal}] {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={loading || !scenarioId}
          className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Vérifier la communication
            </>
          )}
        </button>
      </div>

      {active ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-neutral-700">
            <CanalIcon className="h-3 w-3" />
            {active.canal}
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
            {active.use_case_id}
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
            {active.segment_id}
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
            Verdict attendu :{" "}
            <span className="font-semibold">{active.expected_verdict}</span>
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          {error}
        </div>
      ) : null}

      {verdict ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const s = DECISION[verdict.decision];
              const Icon = s.icon;
              return (
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${s.badge}`}
                >
                  <Icon className="h-4 w-4" />
                  {verdict.decision}
                </span>
              );
            })()}
            {meta ? (
              <span className="text-xs text-neutral-500">
                Mode {meta.mode} · {meta.latencyMs} ms
              </span>
            ) : null}
          </div>

          {/* Métriques */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1 font-medium text-neutral-900">
                  <Gauge className="h-4 w-4 text-neutral-600" />
                  Longueur
                </p>
                <span
                  className={
                    verdict.metrics.char_limit &&
                    verdict.metrics.char_count > verdict.metrics.char_limit
                      ? "font-mono text-xs text-red-700"
                      : "font-mono text-xs text-neutral-600"
                  }
                >
                  {verdict.metrics.char_count} chars
                  {verdict.metrics.char_limit
                    ? ` / ${verdict.metrics.char_limit}`
                    : " (pas de limite)"}
                </span>
              </div>
              {verdict.metrics.char_limit ? (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={
                      verdict.metrics.char_count > verdict.metrics.char_limit
                        ? "h-full bg-red-500"
                        : "h-full bg-emerald-500"
                    }
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

            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1 font-medium text-neutral-900">
                  <Gauge className="h-4 w-4 text-neutral-600" />
                  Lisibilité (Flesch FR)
                </p>
                <span className="font-mono text-xs text-neutral-600">
                  Score {verdict.metrics.reading_level_score} / seuil{" "}
                  {Math.max(0, 100 - verdict.metrics.reading_level_max)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={
                    verdict.metrics.reading_level_score >=
                    Math.max(0, 100 - verdict.metrics.reading_level_max)
                      ? "h-full bg-emerald-500"
                      : "h-full bg-amber-500"
                  }
                  style={{
                    width: `${Math.min(100, verdict.metrics.reading_level_score)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {verdict.metrics.missing_notices.length ? (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm">
              <p className="font-medium text-red-900">
                Mentions obligatoires manquantes
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {verdict.metrics.missing_notices.map((n) => (
                  <span
                    key={n}
                    className="rounded-full bg-red-100 px-2 py-0.5 font-mono text-xs text-red-900"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {verdict.metrics.absolute_terms.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
              <p className="font-medium text-amber-900">
                Termes absolus détectés
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {verdict.metrics.absolute_terms.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">Commentaire reviewer</p>
            <p className="mt-1 whitespace-pre-wrap">{verdict.reviewer_comment}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-neutral-900">
              Gates client ({verdict.gates.filter((g) => g.passed).length}/
              {verdict.gates.length} passent)
            </h4>
            <ul className="mt-2 space-y-2">
              {verdict.gates.map((g) => (
                <li
                  key={g.gate_id}
                  className={`rounded-lg border p-3 text-sm ${
                    g.passed
                      ? "border-emerald-200 bg-emerald-50/50"
                      : g.blocking
                        ? "border-red-200 bg-red-50/50"
                        : "border-amber-200 bg-amber-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-neutral-500">{g.gate_id}</p>
                      <p className="mt-0.5 font-medium text-neutral-900">{g.label}</p>
                    </div>
                    {g.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : g.blocking ? (
                      <ShieldAlert className="h-5 w-5 text-red-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  {g.reason ? (
                    <p className="mt-2 text-xs text-neutral-700">{g.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {verdict.points_to_validate.length ? (
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Points à valider</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {verdict.points_to_validate.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {verdict.suggested_rewrite ? (
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <FileText className="h-4 w-4" />
                Reformulation suggérée
              </h4>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800">
                {verdict.suggested_rewrite}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
