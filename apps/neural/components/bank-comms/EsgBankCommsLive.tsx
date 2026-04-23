"use client";

/**
 * EsgBankCommsLive — AG-B003 ESGBankComms demo (Sprint 3).
 * Scenario-id only. Affiche verdict + risk class + evidence + jurisdiction
 * verdict + regulation citations + qualified rewrite.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Leaf,
  Loader2,
  PlayCircle,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

type Scenario = {
  scenario_id: string;
  label: string;
  jurisdiction: "FR" | "EU";
  expected_verdict: "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
  claim_text: string;
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
  risk_class: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  blockers: string[];
  warnings: string[];
  gates: Gate[];
  matched_patterns: string[];
  evidence_summary: {
    evidence_id: string | null;
    status: string;
    valeur: string | null;
    expiry_date: string | null;
  } | null;
  jurisdiction_verdict: string;
  regulation_citations: string[];
  qualified_rewrite: string | null;
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

const RISK: Record<Verdict["risk_class"], string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-900",
  CRITICAL: "bg-red-100 text-red-900",
};

export function EsgBankCommsLive() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [meta, setMeta] = useState<{ mode: string; latencyMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/demo/esg-bank-comms")
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
      const res = await fetch("/api/demo/esg-bank-comms", {
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

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Leaf className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              AG-B003 · ESGBankComms
            </p>
            <h3 className="text-lg font-semibold">Conformité claim ESG banque</h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
          <PlayCircle className="h-3.5 w-3.5" />
          Démo · scénarios pré-chargés uniquement
        </span>
      </header>

      <p className="mt-3 text-sm text-neutral-600">
        4 gates ESG : formulation absolue interdite, preuve ACTIVE requise,
        verdict juridiction (FR/EU), match pattern library. Cadre : SFDR,
        taxonomie UE, Loi Climat 2023, EU Green Claims Directive 2024, EBA GL
        2022/09.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Scénario ESG
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
                [{s.jurisdiction}] {s.label}
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
              Vérifier le claim
            </>
          )}
        </button>
      </div>

      {active ? (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm">
          <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            Claim analysé ({active.jurisdiction})
          </p>
          <p className="mt-1 italic text-neutral-800">&laquo;&nbsp;{active.claim_text}&nbsp;&raquo;</p>
          <p className="mt-2 text-xs text-neutral-500">
            Verdict attendu :{" "}
            <span className="font-semibold">{active.expected_verdict}</span>
          </p>
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
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${RISK[verdict.risk_class]}`}
            >
              <ShieldAlert className="h-3 w-3" />
              Risque {verdict.risk_class}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
              <Scale className="h-3 w-3" />
              {verdict.jurisdiction_verdict}
            </span>
            {meta ? (
              <span className="text-xs text-neutral-500">
                Mode {meta.mode} · {meta.latencyMs} ms
              </span>
            ) : null}
          </div>

          {verdict.matched_patterns.length ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <p className="font-medium text-neutral-900">Patterns library détectés</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {verdict.matched_patterns.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-200"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {verdict.evidence_summary ? (
            <div
              className={`rounded-lg border p-3 text-sm ${
                verdict.evidence_summary.status === "ACTIVE"
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-amber-200 bg-amber-50/50"
              }`}
            >
              <p className="font-medium text-neutral-900">Preuve associée</p>
              <p className="mt-1 text-neutral-700">
                <span className="font-mono text-xs">
                  {verdict.evidence_summary.evidence_id ?? "—"}
                </span>{" "}
                · status {verdict.evidence_summary.status}
                {verdict.evidence_summary.valeur
                  ? ` · ${verdict.evidence_summary.valeur}`
                  : ""}
                {verdict.evidence_summary.expiry_date
                  ? ` · expiry ${verdict.evidence_summary.expiry_date}`
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">Commentaire reviewer</p>
            <p className="mt-1 whitespace-pre-wrap">{verdict.reviewer_comment}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-neutral-900">
              Gates ESG ({verdict.gates.filter((g) => g.passed).length}/
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

          <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-neutral-900">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Régulations citées
            </p>
            <ul className="mt-2 list-disc pl-5 text-neutral-700">
              {verdict.regulation_citations.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          {verdict.qualified_rewrite ? (
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <FileText className="h-4 w-4" />
                Reformulation qualifiée
              </h4>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800">
                {verdict.qualified_rewrite}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
