"use client";

/**
 * RegBankCommsLive — Client Component (Sprint 1 Banque / Comms)
 *
 * Démo live AG-B001 RegBankComms. Correctif #2 : AUCUN texte libre en entrée —
 * l'utilisateur sélectionne un scénario pré-chargé, le composant affiche le
 * draft figé, déclenche la vérification côté serveur et rend le verdict gate
 * par gate + la reformulation suggérée.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  Loader2,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Scenario = {
  scenario_id: string;
  label: string;
  communication_type: string;
  communication_subtype: string | null;
  expected_verdict: "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
};

type GateResult = {
  gate_id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  reason: string | null;
  offending_refs: string[];
};

type Verdict = {
  decision: "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
  blockers: string[];
  warnings: string[];
  gates: GateResult[];
  points_to_validate: string[];
  suggested_rewrite: string | null;
  reviewer_comment: string;
};

type ApiResponse = {
  result?: Verdict;
  meta?: { mode: "gateway" | "fallback"; latencyMs: number };
  error?: string;
  scenarios?: Scenario[];
};

const DECISION_STYLE: Record<
  Verdict["decision"],
  { badge: string; icon: typeof CheckCircle2; label: string }
> = {
  PASS: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: CheckCircle2,
    label: "Conforme",
  },
  PASS_WITH_REVIEW: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    icon: AlertTriangle,
    label: "À faire relire",
  },
  BLOCK: {
    badge: "bg-red-50 text-red-800 ring-red-200",
    icon: XCircle,
    label: "Bloqué",
  },
};

export function RegBankCommsLive() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [meta, setMeta] = useState<{ mode: string; latencyMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void fetch("/api/demo/reg-bank-comms")
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (data.scenarios?.length) {
          setScenarios(data.scenarios);
          setScenarioId(data.scenarios[0].scenario_id);
        }
      })
      .catch(() => {
        setError("Impossible de charger les scénarios.");
      });
  }, []);

  async function runCheck() {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);
    setVerdict(null);
    try {
      const res = await fetch("/api/demo/reg-bank-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const data = (await res.json()) as ApiResponse;
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
      const res = await fetch("/api/demo/reg-bank-comms/export", {
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
        `neural-regbank-${scenarioId}.md`;
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
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-stone-700" />
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              AG-B001 · RegBankComms
            </p>
            <h3 className="text-lg font-semibold">Vérification d'une communication bancaire</h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
          <PlayCircle className="h-3.5 w-3.5" />
          Démo · scénarios pré-chargés uniquement
        </span>
      </header>

      <p className="mt-3 text-sm text-neutral-600">
        Pour des raisons de sécurité (risque d'ingestion d'information privilégiée non
        publique), cette démo publique n'accepte aucun texte libre. Sélectionnez un
        scénario figé ci-dessous — les 5 couvrent chacun un gate de la stack MVP.
      </p>

      {/* Sélecteur scénario */}
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Scénario
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
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={runCheck}
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
              Lancer les gates
            </>
          )}
        </button>
      </div>

      {active ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-neutral-600">
            {active.communication_type}
            {active.communication_subtype ? ` · ${active.communication_subtype}` : ""}
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
            Verdict attendu : <span className="font-semibold">{active.expected_verdict}</span>
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          {error}
        </div>
      ) : null}

      {/* Verdict */}
      {verdict ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const s = DECISION_STYLE[verdict.decision];
              const Icon = s.icon;
              return (
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${s.badge}`}
                >
                  <Icon className="h-4 w-4" />
                  {s.label} — {verdict.decision}
                </span>
              );
            })()}
            {meta ? (
              <span className="text-xs text-neutral-500">
                Mode {meta.mode} · {meta.latencyMs} ms
              </span>
            ) : null}
            <button
              type="button"
              onClick={downloadPack}
              disabled={exporting}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Export…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Pack défendable (.md + hash)
                </>
              )}
            </button>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">Commentaire reviewer</p>
            <p className="mt-1 whitespace-pre-wrap">{verdict.reviewer_comment}</p>
          </div>

          {/* Gates */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-900">
              Gates déterministes ({verdict.gates.filter((g) => g.passed).length}/
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

          {/* Points à valider */}
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

          {/* Rewrite */}
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
