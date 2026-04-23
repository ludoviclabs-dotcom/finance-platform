"use client";

/**
 * EvidenceResolverLive — dark theme refit.
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
  READY: {
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    icon: CheckCircle2,
  },
  PARTIAL: {
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    icon: AlertTriangle,
  },
  BLOCKED: { badge: "border-red-400/30 bg-red-400/10 text-red-200", icon: XCircle },
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
            <Database className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-white/50">
              AG-B006 · BankEvidenceGuard · service interne
            </p>
            <h3 className="text-lg font-semibold text-white">
              Résolveur de sources admissibles
            </h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
          <PlayCircle className="h-3 w-3" />
          100 % déterministe · sans LLM
        </span>
      </header>

      <p className="mt-4 text-sm leading-relaxed text-white/65">
        Filtre le registre fermé par type de communication + juridiction +
        subjects, applique la policy de fraîcheur, scorer les sources avec
        raisons de match et raisons de rejet.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Type de communication
          </span>
          <select
            value={commType}
            onChange={(e) => setCommType(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
          >
            {COMM_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#0A1628]">
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Juridiction
          </span>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
          >
            <option value="FR" className="bg-[#0A1628]">
              FR · France
            </option>
            <option value="EU" className="bg-[#0A1628]">
              EU · Union Européenne
            </option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
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
                      ? "rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#0A1628]"
                      : "rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Policy fraîcheur
          </span>
          <select
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
          >
            {POLICIES.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#0A1628]">
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {pkg ? (
        <section className="mt-8 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const s = VERDICT_STYLE[pkg.verdict];
              const Icon = s.icon;
              return (
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${s.badge}`}
                >
                  <Icon className="h-4 w-4" />
                  {pkg.verdict}
                </span>
              );
            })()}
            <span className="text-[11px] text-white/60">
              Policy <span className="font-mono">{pkg.policy.policy_id}</span> · max{" "}
              {pkg.policy.max_age_days}j · warning {pkg.policy.stale_warning_days}j
            </span>
          </div>

          <p className="text-sm text-white/75">{pkg.summary}</p>

          {pkg.blockers.length ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.08] p-3 text-sm">
              <p className="font-semibold text-red-100">Blockers</p>
              <ul className="mt-1 list-disc pl-5 text-red-200">
                {pkg.blockers.map((b) => (
                  <li key={b} className="font-mono text-xs">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pkg.sources.length ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-200">
                Sources admissibles ({pkg.sources.length})
              </p>
              <ul className="mt-3 space-y-2">
                {pkg.sources.map((s) => (
                  <li
                    key={s.source_id}
                    className={`rounded-2xl border p-4 ${
                      s.freshness_label === "FRESH"
                        ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                        : "border-amber-400/25 bg-amber-400/[0.06]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] text-white/50">
                          {s.source_id}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-white">
                          {s.autorite} — {s.titre}
                        </p>
                        <p className="mt-1 text-[11px] text-white/60">
                          {s.juridiction} · review {s.review_date ?? "n/a"} (
                          {s.age_days ?? "?"}j) ·{" "}
                          <span
                            className={
                              s.freshness_label === "FRESH"
                                ? "text-emerald-200"
                                : "text-amber-200"
                            }
                          >
                            {s.freshness_label}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-bold text-white">
                          {s.score}
                        </p>
                        <p className="text-[10px] text-white/50">
                          subject match {Math.round(s.subject_match * 100)} %
                        </p>
                      </div>
                    </div>
                    <ul className="mt-3 list-disc pl-5 text-[11px] text-white/55">
                      {s.match_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pkg.rejection_reasons.length ? (
            <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-white">
                Sources écartées ({pkg.rejection_reasons.length})
              </summary>
              <ul className="mt-2 space-y-1 text-[11px] text-white/65">
                {pkg.rejection_reasons.map((r) => (
                  <li key={r.source_id} className="flex gap-2">
                    <span className="font-mono text-white/45">{r.source_id}</span>
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
