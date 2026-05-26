"use client";

import { useId, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Send } from "lucide-react";

type ScenarioSummary = {
  id: string;
  agentSlug: string;
  agentName: string;
  label: string;
  verdict: "OK" | "WARN" | "KO";
};

type CheckResult = {
  scenario: {
    id: string;
    label: string;
    verdict: "OK" | "WARN" | "KO";
    summary: string;
    inputLine: string;
    metrics: Array<{ label: string; before: string; after: string }>;
  };
  agent: { id: string; name: string; owner: string; primaryRule: string } | null;
  rulesTriggered: Array<{
    ruleId: string;
    regle: string;
    niveau: string;
    sourceRef: string | null;
  }>;
  sourcesCited: Array<{
    sourceId: string;
    authority: string;
    domain: string;
    title: string;
  }>;
};

const VERDICT_STYLES: Record<
  "OK" | "WARN" | "KO",
  { border: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  OK: {
    border: "border-emerald-300/40",
    bg: "bg-emerald-300/15",
    text: "text-emerald-100",
    Icon: CheckCircle2,
  },
  WARN: {
    border: "border-amber-300/40",
    bg: "bg-amber-300/15",
    text: "text-amber-100",
    Icon: AlertTriangle,
  },
  KO: {
    border: "border-rose-300/40",
    bg: "bg-rose-300/15",
    text: "text-rose-100",
    Icon: XCircle,
  },
};

export function ExportRuleChecker({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const selectId = useId();
  const resultId = useId();
  const [selected, setSelected] = useState<string>(scenarios[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, { agentName: string; items: ScenarioSummary[] }>();
    for (const s of scenarios) {
      const entry = map.get(s.agentSlug) ?? { agentName: s.agentName, items: [] };
      entry.items.push(s);
      map.set(s.agentSlug, entry);
    }
    return [...map.values()];
  }, [scenarios]);

  async function audit() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/demo/aero-export-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: selected }),
      });
      const payload: unknown = await res.json();
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "Erreur inconnue.")
            : "Erreur inconnue.";
        throw new Error(message);
      }
      const data = payload as { result: CheckResult };
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  const verdict = result?.scenario.verdict;
  const verdictStyle = verdict ? VERDICT_STYLES[verdict] : null;
  const VerdictIcon = verdictStyle?.Icon ?? CheckCircle2;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200/80">
            Démo runtime · scénario-id only
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
            ExportRuleChecker — auditez un scénario aéro
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/62">
            Sélectionnez un scénario figé issu des workbooks synchronisés. L&apos;API
            <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-white/75">
              /api/demo/aero-export-check
            </code>
            répond avec le verdict, les règles déclenchées et les sources réglementaires citées
            — sans appel LLM ni texte libre côté serveur.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label
            htmlFor={selectId}
            className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55"
          >
            Scénario à auditer
          </label>
          <select
            id={selectId}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={loading}
            className="mt-2 w-full rounded-xl border border-white/15 bg-[#160c30] px-4 py-3 text-sm text-white focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300/30 disabled:opacity-50"
          >
            {grouped.map((group) => (
              <optgroup key={group.agentName} label={group.agentName}>
                {group.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.label} ({s.verdict})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={audit}
          disabled={loading || !selected}
          aria-disabled={loading || !selected}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0e0824] transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Auditer le scénario
            </>
          )}
        </button>
      </div>

      <div
        id={resultId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-6"
      >
        {error && (
          <div className="rounded-xl border border-rose-300/40 bg-rose-300/[0.08] p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        {result && verdictStyle && (
          <div className="grid gap-4">
            <div
              className={`rounded-2xl border ${verdictStyle.border} ${verdictStyle.bg} p-5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <VerdictIcon className={`h-6 w-6 ${verdictStyle.text}`} />
                  <div>
                    <p className="font-mono text-[11px] text-white/55">
                      {result.scenario.id}
                      {result.agent ? ` · ${result.agent.name}` : ""}
                    </p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {result.scenario.label}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${verdictStyle.border} ${verdictStyle.bg} ${verdictStyle.text}`}
                >
                  Verdict {result.scenario.verdict}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/72">
                {result.scenario.summary}
              </p>
              {result.scenario.metrics.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {result.scenario.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                    >
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                        {m.label}
                      </p>
                      <p className="mt-1 font-mono text-xs text-white/65">
                        <span className="text-rose-200/80">{m.before}</span>
                        <span className="px-1 text-white/30">→</span>
                        <span className="text-emerald-200">{m.after}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200/80">
                  Règles déclenchées ({result.rulesTriggered.length})
                </p>
                <ul className="mt-3 space-y-3">
                  {result.rulesTriggered.map((r) => (
                    <li
                      key={r.ruleId}
                      className="rounded-xl border border-white/[0.08] bg-[#160c30] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[11px] text-white/55">{r.ruleId}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            r.niveau === "BLOCK"
                              ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
                              : "border-amber-300/30 bg-amber-300/10 text-amber-100"
                          }`}
                        >
                          {r.niveau}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/70">{r.regle}</p>
                      {r.sourceRef && (
                        <p className="mt-2 font-mono text-[10px] text-white/40">
                          source : {r.sourceRef}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200/80">
                  Sources réglementaires citées ({result.sourcesCited.length})
                </p>
                <ul className="mt-3 space-y-3">
                  {result.sourcesCited.map((s) => (
                    <li
                      key={s.sourceId}
                      className="rounded-xl border border-white/[0.08] bg-[#160c30] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[11px] text-white/55">{s.sourceId}</p>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/55">
                          {s.authority} · {s.domain}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/70">{s.title}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {!error && !result && !loading && (
          <p className="text-sm text-white/45">
            Choisissez un scénario et cliquez sur « Auditer le scénario » pour voir
            le verdict déterministe et les preuves associées.
          </p>
        )}
      </div>
    </div>
  );
}
