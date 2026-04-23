"use client";

/**
 * EsgBankCommsLive — dark theme refit.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
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
  PASS: {
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    icon: CheckCircle2,
  },
  PASS_WITH_REVIEW: {
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    icon: AlertTriangle,
  },
  BLOCK: {
    badge: "border-red-400/30 bg-red-400/10 text-red-200",
    icon: XCircle,
  },
};

const RISK: Record<Verdict["risk_class"], string> = {
  LOW: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  MEDIUM: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  HIGH: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  CRITICAL: "border-red-400/40 bg-red-400/15 text-red-100",
};

export function EsgBankCommsLive() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [meta, setMeta] = useState<{ mode: string; latencyMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  async function downloadPack() {
    if (!scenarioId) return;
    setExporting(true);
    try {
      const res = await fetch("/api/demo/esg-bank-comms/export", {
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
        `neural-esgbank-${scenarioId}.md`;
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

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
            <Leaf className="h-5 w-5 text-emerald-200" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
              AG-B003 · ESGBankComms
            </p>
            <h3 className="text-lg font-semibold text-white">
              Contrôle claim ESG banque
            </h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-200">
          <PlayCircle className="h-3 w-3" />
          Scénarios figés · pas de texte libre
        </span>
      </header>

      <p className="mt-4 text-sm leading-relaxed text-white/65">
        Cadre : SFDR, Taxonomie UE, EU Green Claims Directive 2024, Loi Climat
        2023, EBA GL 2022/09. Gates : wording absolu interdit, preuve ACTIVE,
        verdict juridiction FR/EU, match library.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Scénario ESG
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
                [{s.jurisdiction}] {s.label}
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
              Vérifier le claim
            </>
          )}
        </button>
      </div>

      {active ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Claim analysé ({active.jurisdiction})
          </p>
          <p className="mt-1 italic text-white/75">
            &laquo;&nbsp;{active.claim_text}&nbsp;&raquo;
          </p>
          <p className="mt-2 text-[11px] text-white/50">
            Verdict attendu :{" "}
            <span className="font-semibold text-white">{active.expected_verdict}</span>
          </p>
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
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${RISK[verdict.risk_class]}`}
            >
              <ShieldAlert className="h-3 w-3" />
              Risque {verdict.risk_class}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              <Scale className="h-3 w-3" />
              {verdict.jurisdiction_verdict}
            </span>
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
                  Pack ESG (.md + hash)
                </>
              )}
            </button>
          </div>

          {verdict.matched_patterns.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
              <p className="font-semibold text-white">Patterns library détectés</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {verdict.matched_patterns.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {verdict.evidence_summary ? (
            <div
              className={`rounded-2xl border p-4 text-sm ${
                verdict.evidence_summary.status === "ACTIVE"
                  ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                  : "border-amber-400/25 bg-amber-400/[0.06]"
              }`}
            >
              <p className="font-semibold text-white">Preuve associée</p>
              <p className="mt-1.5 text-white/75">
                <span className="font-mono text-xs text-white/50">
                  {verdict.evidence_summary.evidence_id ?? "—"}
                </span>{" "}
                · status <span className="font-semibold">{verdict.evidence_summary.status}</span>
                {verdict.evidence_summary.valeur
                  ? ` · ${verdict.evidence_summary.valeur}`
                  : ""}
                {verdict.evidence_summary.expiry_date
                  ? ` · expiry ${verdict.evidence_summary.expiry_date}`
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/75">
            <p className="font-semibold text-white">Commentaire reviewer</p>
            <p className="mt-1.5 whitespace-pre-wrap">{verdict.reviewer_comment}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-200">
              Gates ESG — {verdict.gates.filter((g) => g.passed).length}/
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

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-white">
              <Sparkles className="h-4 w-4 text-violet-300" />
              Régulations citées
            </p>
            <ul className="mt-2 list-disc pl-5 text-white/75">
              {verdict.regulation_citations.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          {verdict.qualified_rewrite ? (
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-violet-200">
                <FileText className="h-3.5 w-3.5" />
                Reformulation qualifiée
              </p>
              <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-white/80">
                {verdict.qualified_rewrite}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
