"use client";

/**
 * VoiceGuardLiveScorer — Client Component (Sprint 3)
 *
 * La pepite conversion : textarea + bouton "Scorer", POST /api/demo/voice-score,
 * affichage anime du verdict (score counter, decision, hard-fail highlight,
 * feedback en bullets, suggestion rewrite).
 *
 * UX :
 *   - textarea 500 chars max avec compteur live
 *   - 3 exemples pre-remplis (Clean / Hard-fail / Claim RSE sans preuve)
 *   - Bouton "Scorer" devient "Analyse en cours..." pendant POST
 *   - Resultat anime :
 *       * counter 0 → score (800ms ease-out)
 *       * decision badge colore (APPROVE vert / REWORK ambre / REJECT rouge)
 *       * liste hard-fail + forbidden highlightees
 *       * feedback bullet points
 *       * bouton "Rewrite" si suggestion disponible
 *   - Hook conversion : si decision = REJECT, CTA "Discuter avec un expert"
 *
 * Rate limit handle : si 429, message + compte a rebours.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";

// ─── Types (shape contract avec /api/demo/voice-score) ──────────────────────

type VoiceScoreResult = {
  score: number;
  decision: "APPROVE" | "REWORK" | "REJECT";
  hard_fail_count: number;
  hard_fail_detected: string[];
  forbidden_detected: string[];
  preferred_detected: string[];
  score_breakdown: {
    tone: number;
    forbidden: number;
    preferred_missing: number;
    structure: number;
    identity: number;
    claim: number;
  };
  feedback: string[];
  rewrite_suggestion: string | null;
};

type ApiResponse = {
  result?: VoiceScoreResult;
  meta?: { mode: "gateway" | "fallback"; latencyMs: number; model?: string };
  error?: string;
};

// ─── Presets ────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: "clean",
    label: "Conforme — savoir-faire",
    text:
      "L'atelier parisien devoile une piece ciselee a la main, inspiree des archives de 1923. Un geste artisanal transmis de generation en generation.",
  },
  {
    id: "hardfail",
    label: "Hard-fail — superlatif + concurrent",
    text:
      "Notre nouvelle collection est le meilleur bijou du monde, unique au monde, largement superieure aux autres maisons.",
  },
  {
    id: "rse",
    label: "Claim RSE sans preuve",
    text:
      "Maison engagee : notre collection est entierement eco-responsable et durable, avec un impact carbone neutre demontre.",
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function decisionClass(d: VoiceScoreResult["decision"]) {
  switch (d) {
    case "APPROVE":
      return { border: "border-emerald-400/40", bg: "bg-emerald-400/10", text: "text-emerald-200", label: "APPROVE", Icon: CheckCircle2 };
    case "REWORK":
      return { border: "border-amber-400/40", bg: "bg-amber-400/10", text: "text-amber-200", label: "REWORK", Icon: AlertCircle };
    case "REJECT":
      return { border: "border-rose-400/40", bg: "bg-rose-400/10", text: "text-rose-200", label: "REJECT", Icon: XCircle };
  }
}

function scoreRingColor(score: number): string {
  if (score >= 75) return "text-emerald-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

/** Anime un compteur de `from` a `to` en `duration` ms. Hook reutilisable. */
function useAnimatedCount(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const startVal = 0;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(startVal + (target - startVal) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

// ─── Composant ──────────────────────────────────────────────────────────────

export function VoiceGuardLiveScorer() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"FR" | "EN">("FR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);
  const [result, setResult] = useState<VoiceScoreResult | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = text.length;
  const canSubmit = charCount >= 10 && charCount <= 2000 && !loading;

  const animatedScore = useAnimatedCount(result?.score ?? 0, 900);

  const loadPreset = useCallback((preset: (typeof PRESETS)[number]) => {
    setText(preset.text);
    setResult(null);
    setError(null);
    textareaRef.current?.focus();
  }, []);

  const reset = useCallback(() => {
    setText("");
    setResult(null);
    setError(null);
    setMeta(null);
    textareaRef.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMeta(null);
    try {
      const res = await fetch("/api/demo/voice-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (res.status === 429) {
        setError("Trop de requetes — patientez une minute avant de relancer.");
        setRateLimitReset(Date.now() + 60_000);
        return;
      }
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.error) {
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      if (!data.result) {
        setError("Reponse vide — reessayez.");
        return;
      }
      setResult(data.result);
      setMeta(data.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, text, lang]);

  const decisionCfg = result ? decisionClass(result.decision) : null;

  // Highlight le texte avec les mots forbidden/preferred detectes
  const highlightedText = useMemo(() => {
    if (!result) return null;
    const allMatches: Array<{ term: string; kind: "forbidden" | "preferred" }> = [
      ...result.hard_fail_detected.map((t) => ({ term: t, kind: "forbidden" as const })),
      ...result.forbidden_detected
        .filter((t) => !result.hard_fail_detected.includes(t))
        .map((t) => ({ term: t, kind: "forbidden" as const })),
      ...result.preferred_detected.map((t) => ({ term: t, kind: "preferred" as const })),
    ];
    if (allMatches.length === 0) return text;

    // Split text en tokens autour des matches (case-insensitive)
    let remaining = text;
    const parts: Array<{ text: string; kind?: "forbidden" | "preferred" }> = [];
    while (remaining.length > 0) {
      let earliest: { idx: number; match: (typeof allMatches)[number] } | null = null;
      for (const m of allMatches) {
        const idx = remaining.toLowerCase().indexOf(m.term.toLowerCase());
        if (idx === -1) continue;
        if (!earliest || idx < earliest.idx) earliest = { idx, match: m };
      }
      if (!earliest) {
        parts.push({ text: remaining });
        break;
      }
      if (earliest.idx > 0) parts.push({ text: remaining.slice(0, earliest.idx) });
      parts.push({
        text: remaining.slice(earliest.idx, earliest.idx + earliest.match.term.length),
        kind: earliest.match.kind,
      });
      remaining = remaining.slice(earliest.idx + earliest.match.term.length);
    }
    return parts;
  }, [result, text]);

  return (
    <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.02] to-white/[0.01] p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/15">
              <ShieldCheck className="h-4 w-4 text-violet-200" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
                Demo live · MaisonVoiceGuard
              </p>
              <h3 className="font-display text-2xl font-bold text-white">
                Scorez votre texte en {"< "}3 secondes
              </h3>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm text-white/60">
            Collez un communique, un post, une invitation. L&apos;agent applique la charte runtime :
            15 regles, 17 hard-fail, 25 termes normes. Aucun stockage.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <span className={`rounded-full border px-2 py-0.5 ${lang === "FR" ? "border-violet-400/40 bg-violet-400/10 text-violet-200" : "border-white/15 text-white/50"}`}>
            <button onClick={() => setLang("FR")}>FR</button>
          </span>
          <span className={`rounded-full border px-2 py-0.5 ${lang === "EN" ? "border-violet-400/40 bg-violet-400/10 text-violet-200" : "border-white/15 text-white/50"}`}>
            <button onClick={() => setLang("EN")}>EN</button>
          </span>
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-xs text-white/45">Exemples :</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPreset(p)}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/70 transition-colors hover:border-violet-400/40 hover:bg-violet-400/10 hover:text-violet-100"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Textarea + counter */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          placeholder="Ex : L'atelier devoile une piece ciselee a la main, inspiree des archives de 1923..."
          className="min-h-[140px] w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
          maxLength={2000}
        />
        <div className="pointer-events-none absolute bottom-3 right-4 text-[11px] font-mono text-white/35">
          {charCount} / 2000
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Scorer le texte
            </>
          )}
        </button>
        {(text || result || error) && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Effacer
          </button>
        )}
        {meta?.mode === "fallback" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-200">
            <Sparkles className="h-3 w-3" />
            Mode demo (gateway off)
          </span>
        )}
        {meta?.mode === "gateway" && meta.latencyMs && (
          <span className="text-[10px] text-white/35">
            {meta.model} · {meta.latencyMs}ms
          </span>
        )}
      </div>

      {/* Errors */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3 text-sm text-rose-200"
          >
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {error}
            {rateLimitReset ? <RateLimitCountdown target={rateLimitReset} /> : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && decisionCfg && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8"
          >
            {/* Score ring + decision */}
            <div className="grid gap-5 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center rounded-[24px] border border-white/10 bg-black/30 p-6">
                <ScoreRing score={animatedScore} color={scoreRingColor(result.score)} />
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  Score global
                </p>
                <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${decisionCfg.border} ${decisionCfg.bg} ${decisionCfg.text}`}>
                  <decisionCfg.Icon className="h-3.5 w-3.5" />
                  {decisionCfg.label}
                </div>
              </div>

              <div className="space-y-4">
                {/* Highlighted text */}
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                    Votre texte, avec detections surlignees
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">
                    {typeof highlightedText === "string"
                      ? highlightedText
                      : highlightedText?.map((p, i) =>
                          p.kind === "forbidden" ? (
                            <span
                              key={i}
                              className="rounded bg-rose-400/20 px-1 font-semibold text-rose-200 underline decoration-rose-400/50 decoration-wavy"
                            >
                              {p.text}
                            </span>
                          ) : p.kind === "preferred" ? (
                            <span
                              key={i}
                              className="rounded bg-emerald-400/15 px-1 font-medium text-emerald-200"
                            >
                              {p.text}
                            </span>
                          ) : (
                            <span key={i}>{p.text}</span>
                          )
                        )}
                  </p>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {(Object.entries(result.score_breakdown) as Array<[keyof typeof result.score_breakdown, number]>).map(
                    ([key, val]) => (
                      <div
                        key={key}
                        className={`rounded-xl border p-2 text-center ${
                          val > 0
                            ? "border-rose-400/25 bg-rose-400/[0.05]"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <p className="text-[10px] uppercase text-white/45">{key.replace("_", " ")}</p>
                        <p
                          className={`mt-0.5 font-display text-base font-bold ${
                            val > 0 ? "text-rose-200" : "text-white/40"
                          }`}
                        >
                          −{val}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Feedback + rewrite */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  Feedback ({result.feedback.length})
                </p>
                <ul className="mt-3 space-y-2">
                  {result.feedback.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {result.rewrite_suggestion ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                    <Wand2 className="mr-1 inline h-3 w-3" />
                    Suggestion de reecriture
                  </p>
                  <p className="mt-3 text-sm italic leading-relaxed text-white/80">
                    &ldquo;{result.rewrite_suggestion}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-start justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-emerald-300" />
                  <p className="text-sm text-emerald-100">
                    Aucune reecriture necessaire — texte conforme a la charte.
                  </p>
                </div>
              )}
            </div>

            {/* Hook conversion si REJECT */}
            {result.decision === "REJECT" && (
              <div className="mt-5 rounded-2xl border border-violet-400/30 bg-violet-400/[0.05] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-base font-bold text-white">
                      Ce texte ne passerait pas la gate brand.
                    </p>
                    <p className="mt-1 text-sm text-white/65">
                      Discutez avec nous — on audit vos 3 derniers communiques sans engagement.
                    </p>
                  </div>
                  <Link
                    href="/contact?subject=voice-score-audit"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-violet-100"
                  >
                    Parler a un expert
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

// ─── ScoreRing SVG ──────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={R} stroke="currentColor" strokeWidth="6" className="text-white/8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={R}
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className={color}
          fill="none"
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display text-3xl font-bold ${color}`}>{score}</span>
      </div>
    </div>
  );
}

// ─── Rate limit countdown ───────────────────────────────────────────────────

function RateLimitCountdown({ target }: { target: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((target - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (remaining === 0) return null;
  return <span className="ml-2 font-mono text-xs text-rose-100/70">({remaining}s)</span>;
}
