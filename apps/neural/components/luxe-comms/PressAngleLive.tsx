"use client";

/**
 * PressAngleLive — Client Component (Sprint 4)
 * Demo AG-002 : brief + media cible → angle + accroche + lede + structure + quote.
 */

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  Newspaper,
  Quote,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  XOctagon,
} from "lucide-react";

type PressAngleResult = {
  media_type: string;
  angle_editorial: string;
  format_target: string;
  length_words_target: number;
  headline: string;
  lede: string;
  key_points: string[];
  structure_outline: string[];
  ceo_quote: string | null;
  visuals_recommendation: string;
  embargo_recommendation: string;
  brand_compliance_check: string[];
  red_flags: string[];
};

type ApiResponse = {
  result?: PressAngleResult;
  meta?: { mode: "gateway" | "fallback"; latencyMs: number };
  error?: string;
};

const MEDIAS = [
  { type: "Lifestyle", tint: "rose", label: "Lifestyle", hint: "Vogue, Harper's Bazaar" },
  { type: "Business", tint: "sky", label: "Business", hint: "FT, Les Echos, BoF" },
  { type: "Trade", tint: "amber", label: "Trade", hint: "WWD, Jing Daily" },
  { type: "Digital", tint: "violet", label: "Digital", hint: "Vogue Business" },
  { type: "Magazine", tint: "emerald", label: "Magazine", hint: "T Magazine, AD" },
] as const;

const PRESETS = [
  {
    id: "jewelry",
    label: "Lancement joaillerie",
    brief: "Lancement d'une collection joaillerie pour les 100 ans de la maison — 12 pieces numerotees inspirees des archives de 1923, ciselees a la main a Paris.",
    media: "Lifestyle" as const,
  },
  {
    id: "results",
    label: "Resultats H1",
    brief: "Annonce des resultats H1 2026 : chiffre d'affaires en croissance avec contribution accrue de la maroquinerie et de la joaillerie. Maintien de la discipline prix.",
    media: "Business" as const,
  },
  {
    id: "esg",
    label: "Rapport ESG",
    brief: "Publication du rapport ESG 2025 : 80% d'or recycle certifie LBMA, reduction de 30% de la consommation d'eau, 240 artisans maroquiniers formes.",
    media: "Trade" as const,
  },
] as const;

const TINT_STYLE: Record<string, { border: string; bg: string; text: string; btn: string; btnHover: string; accent: string }> = {
  rose: { border: "border-rose-400/40", bg: "bg-rose-400/10", text: "text-rose-200", btn: "bg-rose-500", btnHover: "hover:bg-rose-400", accent: "border-rose-400/20" },
  sky: { border: "border-sky-400/40", bg: "bg-sky-400/10", text: "text-sky-200", btn: "bg-sky-500", btnHover: "hover:bg-sky-400", accent: "border-sky-400/20" },
  amber: { border: "border-amber-400/40", bg: "bg-amber-400/10", text: "text-amber-200", btn: "bg-amber-500", btnHover: "hover:bg-amber-400", accent: "border-amber-400/20" },
  violet: { border: "border-violet-400/40", bg: "bg-violet-400/10", text: "text-violet-200", btn: "bg-violet-500", btnHover: "hover:bg-violet-400", accent: "border-violet-400/20" },
  emerald: { border: "border-emerald-400/40", bg: "bg-emerald-400/10", text: "text-emerald-200", btn: "bg-emerald-500", btnHover: "hover:bg-emerald-400", accent: "border-emerald-400/20" },
};

export function PressAngleLive() {
  const [brief, setBrief] = useState("");
  const [mediaType, setMediaType] = useState<(typeof MEDIAS)[number]["type"]>("Lifestyle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PressAngleResult | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const canSubmit = brief.trim().length >= 15 && brief.length <= 800 && !loading;

  const selectedTint = MEDIAS.find((m) => m.type === mediaType)?.tint ?? "violet";
  const tint = TINT_STYLE[selectedTint];

  const loadPreset = useCallback((p: (typeof PRESETS)[number]) => {
    setBrief(p.brief);
    setMediaType(p.media);
    setResult(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setBrief("");
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
      const res = await fetch("/api/demo/press-angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, mediaType }),
      });
      if (res.status === 429) {
        setError("Trop de requetes — patientez.");
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
  }, [canSubmit, brief, mediaType]);

  const copy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className={`rounded-[28px] border ${tint.accent} bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-white/[0.01] p-6 md:p-8`}>
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint.bg}`}>
          <Newspaper className={`h-4 w-4 ${tint.text}`} />
        </div>
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-[0.22em] ${tint.text}`}>
            Demo live · LuxePressAgent
          </p>
          <h3 className="font-display text-2xl font-bold text-white">
            Angle presse adapte — outlet par outlet
          </h3>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            Un meme brief → 7 angles differents selon l&apos;outlet (Vogue vs. FT).
            Accroche, lede, structure, quote CEO — conforme charte luxe.
          </p>
        </div>
      </div>

      {/* Media selector */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-white/50">Media cible :</p>
        <div className="flex flex-wrap gap-2">
          {MEDIAS.map((m) => {
            const t = TINT_STYLE[m.tint];
            const active = mediaType === m.type;
            return (
              <button
                key={m.type}
                onClick={() => setMediaType(m.type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? `${t.border} ${t.bg} ${t.text}` : "border-white/15 bg-white/[0.03] text-white/60 hover:border-white/30"
                }`}
                title={m.hint}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Presets */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/45">Exemples :</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPreset(p)}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/70 hover:border-violet-400/40 hover:bg-violet-400/10"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value.slice(0, 800))}
          placeholder="Ex : Nomination du nouveau Directeur Artistique, vision creative 2026-2030, focus haute couture et maroquinerie."
          className={`min-h-[120px] w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 ${tint.border.replace("border-", "focus:border-")} focus:ring-white/10`}
          maxLength={800}
        />
        <div className="pointer-events-none absolute bottom-3 right-4 text-[11px] font-mono text-white/35">
          {brief.length} / 800
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className={`inline-flex items-center gap-2 rounded-full ${tint.btn} ${tint.btnHover} px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generation en cours...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Generer l&apos;angle
            </>
          )}
        </button>
        {(brief || result) && (
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

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-8 space-y-4"
          >
            {/* Angle summary */}
            <div className={`rounded-[24px] border ${tint.border} ${tint.bg} p-6`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${tint.text}`}>
                Angle · {result.media_type}
              </p>
              <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-white">
                {result.angle_editorial}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-white/70">
                  {result.format_target}
                </span>
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-white/70">
                  ~{result.length_words_target} mots
                </span>
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-white/70">
                  Embargo {result.embargo_recommendation}
                </span>
              </div>
            </div>

            {/* Headline + lede */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  Accroche ({result.headline.length}/140)
                </p>
                <button
                  onClick={() => copy(result.headline, "headline")}
                  className="inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  {copied === "headline" ? "Copie" : "Copier"}
                </button>
              </div>
              <p className="font-display text-xl font-bold leading-tight text-white">{result.headline}</p>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">Lede</p>
                <button
                  onClick={() => copy(result.lede, "lede")}
                  className="inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  {copied === "lede" ? "Copie" : "Copier"}
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{result.lede}</p>
            </div>

            {/* Structure + key points */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  Structure ({result.structure_outline.length} paragraphes)
                </p>
                <ol className="mt-3 space-y-2">
                  {result.structure_outline.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/75">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] font-mono text-white/55">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  Points a inclure
                </p>
                <ul className="mt-3 space-y-2">
                  {result.key_points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tint.btn.replace("bg-", "bg-")}`} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CEO quote + visuals */}
            <div className="grid gap-4 lg:grid-cols-2">
              {result.ceo_quote ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.04] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                    <Quote className="mr-1 inline h-3 w-3" />
                    Quote CEO proposee
                  </p>
                  <p className="mt-3 text-sm italic leading-relaxed text-white/85">
                    &ldquo;{result.ceo_quote}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                    Pas de quote CEO
                  </p>
                  <p className="mt-3 text-sm text-white/55">
                    Ce media ne s&apos;attend pas a une citation executive pour ce format.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  Visuels recommandes
                </p>
                <p className="mt-3 text-sm text-white/80">{result.visuals_recommendation}</p>
              </div>
            </div>

            {/* Compliance check */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  <ShieldCheck className="mr-1 inline h-3 w-3" />
                  Charte respectee
                </p>
                <ul className="mt-3 space-y-1.5">
                  {result.brand_compliance_check.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
                  <XOctagon className="mr-1 inline h-3 w-3" />
                  Red flags a eviter
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.red_flags.map((r, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 font-mono text-xs text-rose-200"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
