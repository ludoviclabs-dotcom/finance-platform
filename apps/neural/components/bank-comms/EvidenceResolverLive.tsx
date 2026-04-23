"use client";

/**
 * EvidenceResolverLive — AG-B006 BankEvidenceGuard demo (Sprint 6).
 *
 * Démonstration du résolveur déterministe. L'utilisateur choisit :
 *   - communication_type (dropdown)
 *   - jurisdiction (FR/EU)
 *   - subjects (multi-pick parmi EVIDENCE_SUBJECTS)
 *   - freshness_policy
 *
 * L'API retourne un EvidencePackage (top sources + score + reasons + verdict).
 * Pas de LLM : 100% déterministe.
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  PlayCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type ResolvedSource = {
  source_id: string;
  autorite: string;
  titre: string;
  url: string | null;
  juridiction: string;
  status: string;
  review_date: string | null;
  score: number;
  subject_match: number;
  freshness_label: "FRESH" | "STALE_WARNING" | "STALE";
  age_days: number | null;
  match_reasons: string[];
};

type EvidencePackage = {
  query: {
    communication_type: string;
    jurisdiction: string;
    subjects: string[];
    freshness_policy: string;
    top_k: number;
  };
  policy: { policy_id: string; max_age_days: number; stale_warning_days: number };
  sources: ResolvedSource[];
  rejection_reasons: Array<{ source_id: string; reason: string }>;
  blockers: string[];
  warnings: string[];
  verdict: "READY" | "PARTIAL" | "BLOCKED";
  summary: string;
};

const COMM_TYPES = [
  "FINANCIAL_RESULTS",
  "GOVERNANCE",
  "SUPERVISION_NOTICE",
  "CRISIS_EXTERNAL",
  "ESG_CLAIM",
  "CLIENT_NOTICE",
];

const SUBJECTS = [
  { id: "financial_results", label: "Résultats financiers" },
  { id: "governance", label: "Gouvernance" },
  { id: "privileged_info", label: "Info privilégiée" },
  { id: "market_abuse", label: "Abus de marché (MAR)" },
  { id: "prudential_ratios", label: "Ratios prudentiels" },
  { id: "pillar3", label: "Pilier 3 CRR" },
  { id: "ifrs", label: "IFRS" },
  { id: "interim_reporting", label: "IAS 34 intermédiaire" },
  { id: "apm", label: "APM" },
  { id: "esg", label: "ESG" },
  { id: "sfdr", label: "SFDR" },
  { id: "taxonomy", label: "Taxonomie UE" },
  { id: "sustainability", label: "Sustainability" },
  { id: "crisis_external", label: "Crise externe" },
  { id: "supervision", label: "Supervision" },
  { id: "legal_base", label: "Base légale" },
  { id: "guidance", label: "Guidance" },
  { id: "issuer_communication", label: "Communication émetteur" },
];

const POLICIES = [
  { id: "FRESH-STRICT", label: "Strict (comms CRITICAL)" },
  { id: "FRESH-STANDARD", label: "Standard" },
  { id: "FRESH-CLIENT", label: "Client notice" },
];

const VERDICT_STYLE: Record<
  EvidencePackage["verdict"],
  { badge: string; icon: typeof CheckCircle2 }
> = {
  READY: { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: CheckCircle2 },
  PARTIAL: { badge: "bg-amber-50 text-amber-800 ring-amber-200", icon: AlertTriangle },
  BLOCKED: { badge: "bg-red-50 text-red-800 ring-red-200", icon: XCircle },
};

export function EvidenceResolverLive() {
  const [commType, setCommType] = useState("FINANCIAL_RESULTS");
  const [jurisdiction, setJurisdiction] = useState("FR");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    "financial_results",
    "prudential_ratios",
  ]);
  const [policy, setPolicy] = useState("FRESH-STRICT");
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<EvidencePackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleSubject(id: string) {
    setSelectedSubjects((curr) =>
      curr.includes(id) ? curr.filter((s) => s !== id) : [...curr, id],
    );
  }

  async function run() {
    setLoading(true);
    setError(null);
    setPkg(null);
    try {
      const res = await fetch("/api/internal/evidence-guard/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communication_type: commType,
          jurisdiction,
          subjects: selectedSubjects,
          freshness_policy: policy,
          top_k: 10,
        }),
      });
      const data = (await res.json()) as EvidencePackage & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erreur inconnue.");
        return;
      }
      setPkg(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-stone-700" />
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              AG-B006 · BankEvidenceGuard · service interne
            </p>
            <h3 className="text-lg font-semibold">Résolveur de sources admissibles</h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <PlayCircle className="h-3.5 w-3.5" />
          100% déterministe · sans LLM
        </span>
      </header>

      <p className="mt-3 text-sm text-neutral-600">
        Sélectionnez un type de communication + juridiction + subjects.
        Le résolveur filtre le registre fermé, applique la policy de
        fraîcheur, calcule un score et retourne le paquet de sources
        admissibles avec leurs raisons de match ou de rejet.
      </p>

      {/* Inputs */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Type de communication
          </span>
          <select
            value={commType}
            onChange={(e) => setCommType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          >
            {COMM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Juridiction
          </span>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          >
            <option value="FR">FR · France</option>
            <option value="EU">EU · Union Européenne</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Subjects (multi-sélection)
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUBJECTS.map((s) => {
              const on = selectedSubjects.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSubject(s.id)}
                  className={
                    on
                      ? "rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                      : "rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-400"
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Policy fraîcheur
          </span>
          <select
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          >
            {POLICIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Résolution…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Résoudre les sources
              </>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          {error}
        </div>
      ) : null}

      {/* Résultat */}
      {pkg ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const s = VERDICT_STYLE[pkg.verdict];
              const Icon = s.icon;
              return (
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${s.badge}`}
                >
                  <Icon className="h-4 w-4" />
                  {pkg.verdict}
                </span>
              );
            })()}
            <span className="text-xs text-neutral-600">
              Policy : <span className="font-mono">{pkg.policy.policy_id}</span> · max{" "}
              {pkg.policy.max_age_days}j · warning {pkg.policy.stale_warning_days}j
            </span>
          </div>

          <p className="text-sm text-neutral-700">{pkg.summary}</p>

          {pkg.blockers.length ? (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm">
              <p className="font-medium text-red-900">Blockers</p>
              <ul className="mt-1 list-disc pl-5 text-red-800">
                {pkg.blockers.map((b) => (
                  <li key={b} className="font-mono text-xs">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Sources admissibles */}
          {pkg.sources.length ? (
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">
                Sources admissibles ({pkg.sources.length})
              </h4>
              <ul className="mt-2 space-y-2">
                {pkg.sources.map((s) => (
                  <li
                    key={s.source_id}
                    className={`rounded-lg border p-3 text-sm ${
                      s.freshness_label === "FRESH"
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-neutral-500">
                          {s.source_id}
                        </p>
                        <p className="mt-0.5 font-semibold text-neutral-900">
                          {s.autorite} — {s.titre}
                        </p>
                        <p className="mt-1 text-xs text-neutral-600">
                          {s.juridiction} · review {s.review_date ?? "n/a"} (
                          {s.age_days ?? "?"}j) ·{" "}
                          <span
                            className={
                              s.freshness_label === "FRESH"
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }
                          >
                            {s.freshness_label}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-neutral-900">{s.score}</p>
                        <p className="text-[11px] text-neutral-500">
                          subject match {Math.round(s.subject_match * 100)}%
                        </p>
                      </div>
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-[11px] text-neutral-600">
                      {s.match_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Rejections (collapsible-ish) */}
          {pkg.rejection_reasons.length ? (
            <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-neutral-900">
                Sources écartées ({pkg.rejection_reasons.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-neutral-700">
                {pkg.rejection_reasons.map((r) => (
                  <li key={r.source_id} className="flex gap-2">
                    <span className="font-mono text-neutral-500">{r.source_id}</span>
                    <span>{r.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
