"use client";

/**
 * ClaimCheckLive — Client Component (Sprint 4)
 * Demo live AG-005 GreenClaimChecker. Input claim + juridiction, output verdict
 * avec regulation cite, risk class, reformulation qualifiee.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Leaf,
  Loader2,
  RefreshCcw,
  Scale,
  Send,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";

type ClaimCheckResult = {
  decision: "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
  risk_class: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detected_wording_type: "ABSOLUTE" | "QUALIFIED" | "COMPARATIVE";
  matched_claim_pattern: string | null;
  evidence_found: boolean;
  evidence_status: "VALID" | "STALE" | "UNVERIFIED" | "MISSING" | "NONE";
  matched_claim_id: string | null;
  regulation_citations: string[];
  jurisdiction_verdict: string;
  feedback: string[];
  qualified_rewrite: string | null;
};

type ApiResponse = {
  result?: ClaimCheckResult;
  meta?: { mode: "gateway" | "fallback"; latencyMs: number };
  error?: string;
};

const JURIS = [
  { code: "EU", label: "🇪🇺 Union Europeenne", hint: "Green Claims Directive 2024" },
  { code: "FR", label: "🇫🇷 France", hint: "Loi Climat 2023" },
  { code: "UK", label: "🇬🇧 Royaume-Uni", hint: "CMA Green Claims Code" },
  { code: "US", label: "🇺🇸 Etats-Unis", hint: "FTC Green Guides" },
  { code: "CH", label: "🇨🇭 Suisse", hint: "LCD Art. 3" },
] as const;

const PRESETS = [
  {
    id: "sustainable",
    label: "Vague — 'sustainable'",
    text: "Notre nouvelle collection est entierement eco-responsable et durable.",
  },
  {
    id: "carbon",
    label: "Interdit FR — 'carbon neutral'",
    text: "Empreinte carbone neutre sur cette collection de parfums.",
  },
  {
    id: "qualified",
    label: "Qualifie — or recycle",
    text: "Or certifie 80% recycle selon l'audit LBMA 2026.",
  },
] as const;

function decisionStyle(d: ClaimCheckResult["decision"]) {
  switch (d) {
    case "PASS":
      return { border: "border-emerald-400/40", bg: "bg-emerald-400/10", text: "text-emerald-200", Icon: CheckCircle2, label: "PASS" };
    case "PASS_WITH_REVIEW":
      return { border: "border-amber-400/40", bg: "bg-amber-400/10", text: "text-amber-200", Icon: AlertCircle, label: "PASS / REVIEW" };
    case "BLOCK":
      return { border: "border-rose-400/40", bg: "bg-rose-400/10", text: "text-rose-200", Icon: XCircle, label: "BLOCK" };
  }
}

function riskColor(r: ClaimCheckResult["risk_class"]) {
  switch (r) {
    case "LOW":
      return "bg-emerald-400/15 text-emerald-200 border-emerald-400/30";
    case "MEDIUM":
      return "bg-amber-400/15 text-amber-200 border-amber-400/30";
    case "HIGH":
      return "bg-orange-400/15 text-orange-200 border-orange-400/30";
    case "CRITICAL":
      return "bg-rose-400/15 text-rose-200 border-rose-400/30";
  }
}

export function ClaimCheckLive() {
  const [claim, setClaim] = useState("");
  const [juri, setJuri] = useState<(typeof JURIS)[number]["code"]>("EU");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimCheckResult | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);

  const canSubmit = claim.trim().length >= 8 && claim.length <= 500 && !loading;

  const loadPreset = useCallback((p: (typeof PRESETS)[number]) => {
    setClaim(p.text);
    setResult(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setClaim("");
    setResult(null);
    setError(null);
    setMeta(null);
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/demo/claim-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim, juridiction: juri }),
      });
      if (res.status === 429) {
        setError("Trop de requetes — patientez une minute.");
        return;
      }
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.error) {
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      if (!data.result) {
        setError("Reponse vide.");
        return;
      }
      setResult(data.result);
      setMeta(data.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, claim, juri]);

  const decCfg = result ? decisionStyle(result.decision) : null;

  return (
    <div className="rounded-[28px] border border-rose-400/20 bg-gradient-to-br from-rose-500/[0.06] via-white/[0.02] to-white/[0.01] p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-400/15">
          <Leaf className="h-4 w-4 text-rose-200" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-200">
            Demo live · GreenClaimChecker
          </p>
          <h3 className="font-display text-2xl font-bold text-white">
            Verifiez un claim RSE contre 5 juridictions
          </h3>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            L&apos;agent matche votre affirmation contre la claim library (17 patterns), la matrice
            juridictionnelle et le registre evidence. Regulation citee, risk class, rewrite qualifie.
          </p>
        </div>
      </div>

      {/* Jurisdiction selector */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-white/50">Juridiction cible :</p>
        <div className="flex flex-wrap gap-2">
          {JURIS.map((j) => (
            <button
              key={j.code}
              onClick={() => setJuri(j.code)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                juri === j.code
                  ? "border-rose-400/50 bg-rose-400/10 text-rose-100"
                  : "border-white/15 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white/80"
              }`}
              title={j.hint}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/45">Exemples :</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPreset(p)}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/70 transition-colors hover:border-rose-400/40 hover:bg-rose-400/10"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value.slice(0, 500))}
          placeholder="Ex : Notre collection est fabriquee avec 80% de matieres recyclees."
          className="min-h-[100px] w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white placeholder:text-white/30 focus:border-rose-400/50 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
          maxLength={500}
        />
        <div className="pointer-events-none absolute bottom-3 right-4 text-[11px] font-mono text-white/35">
          {claim.length} / 500
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verification en cours...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Verifier le claim
            </>
          )}
        </button>
        {(claim || result || error) && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-white/30"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Effacer
          </button>
        )}
        {meta?.mode === "fallback" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-200">
            <Sparkles className="h-3 w-3" />
            Mode demo
          </span>
        )}
        {meta?.mode === "gateway" && (
          <span className="text-[10px] text-white/35">claude-sonnet-4.6 · {meta.latencyMs}ms</span>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3 text-sm text-rose-200"
          >
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && decCfg && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-8 space-y-4"
          >
            {/* Decision banner */}
            <div className={`rounded-[24px] border p-6 ${decCfg.border} ${decCfg.bg}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${decCfg.bg}`}>
                    <decCfg.Icon className={`h-6 w-6 ${decCfg.text}`} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${decCfg.text}`}>
                      Decision {juri}
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-white">{decCfg.label}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${riskColor(result.risk_class)}`}>
                    Risk {result.risk_class}
                  </span>
                  <span className="inline-flex rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold text-white/65">
                    {result.detected_wording_type}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm italic text-white/80">
                <Scale className="mr-1.5 inline h-3.5 w-3.5 text-white/50" />
                {result.jurisdiction_verdict}
              </p>
            </div>

            {/* Evidence + citations */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  Evidence
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/50">Trouvee :</span>
                    <span className={result.evidence_found ? "text-emerald-200" : "text-rose-200"}>
                      {result.evidence_found ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/50">Statut :</span>
                    <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-xs text-white/80">
                      {result.evidence_status}
                    </span>
                  </div>
                  {result.matched_claim_id ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white/50">Match registre :</span>
                      <span className="rounded-md bg-violet-400/10 px-2 py-0.5 font-mono text-xs text-violet-200">
                        {result.matched_claim_id}
                      </span>
                    </div>
                  ) : null}
                  {result.matched_claim_pattern ? (
                    <p className="text-xs text-white/55">
                      Pattern library : <span className="font-mono text-white/70">{result.matched_claim_pattern}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  Regulations citees
                </p>
                <ul className="mt-3 space-y-1.5">
                  {result.regulation_citations.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Feedback + rewrite */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">Feedback</p>
                <ul className="mt-3 space-y-2">
                  {result.feedback.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {result.qualified_rewrite ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                    <Wand2 className="mr-1 inline h-3 w-3" />
                    Reformulation qualifiee
                  </p>
                  <p className="mt-3 text-sm italic leading-relaxed text-white/80">
                    &ldquo;{result.qualified_rewrite}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-start justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-emerald-300" />
                  <p className="text-sm text-emerald-100">
                    Claim conforme — aucune reformulation necessaire pour {juri}.
                  </p>
                </div>
              )}
            </div>

            {/* Hook conversion si BLOCK */}
            {result.decision === "BLOCK" && (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-400/[0.06] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-base font-bold text-white">
                      Ce claim ne passerait pas la gate CLAIM.
                    </p>
                    <p className="mt-1 text-sm text-white/65">
                      Audit gratuit de vos claims en cours — on traite vos 5 derniers communiques RSE.
                    </p>
                  </div>
                  <Link
                    href="/contact?subject=claim-check-audit"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-rose-100"
                  >
                    Parler conformite
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
