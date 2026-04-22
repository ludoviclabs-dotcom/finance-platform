"use client";

/**
 * HeritageQuoteLive — Client Component (Sprint 4)
 * Demo AG-004 : query patrimoniale → fait + source + citation formatee.
 * Anti-hallucination : si pas de match, affiche clairement "non utilisable".
 */

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Archive,
  BookOpen,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  RefreshCcw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";

type HeritageQuoteResult = {
  fact: string;
  fact_id: string | null;
  year: number | null;
  source_id: string | null;
  source_title: string | null;
  source_type: "PRIMARY" | "SECONDARY" | "TERTIARY" | null;
  source_status: "ACTIVE" | "STALE" | "REJECTED" | null;
  citation_formatted: string;
  usable: boolean;
  narrative_block: string;
  alternative_source_ids: string[];
};

type ApiResponse = {
  result?: HeritageQuoteResult;
  meta?: { mode: "gateway" | "fallback"; latencyMs: number };
  error?: string;
};

const FORMATS = ["Maison-style", "Chicago", "APA", "Juridique"] as const;
type CitationFormat = (typeof FORMATS)[number];

const PRESETS = [
  { id: "origin", label: "Origine maison", text: "Quand la maison a-t-elle ete fondee ?" },
  { id: "galliera", label: "Musee Galliera", text: "Piece de la maison au Musee Galliera" },
  { id: "atelier", label: "Geste atelier", text: "Origine du geste de ciselure dans l'atelier" },
  { id: "retro", label: "Retrospective 1987", text: "Exposition retrospective Arts Deco 1987" },
  { id: "unknown", label: "Sans match", text: "Apparition au Met Gala de New York en 1975" },
] as const;

const TYPE_STYLE = {
  PRIMARY: { Icon: Archive, color: "text-emerald-300", bg: "bg-emerald-400/10" },
  SECONDARY: { Icon: BookOpen, color: "text-violet-200", bg: "bg-violet-400/10" },
  TERTIARY: { Icon: FileText, color: "text-amber-200", bg: "bg-amber-400/10" },
} as const;

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  STALE: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  REJECTED: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

export function HeritageQuoteLive() {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<CitationFormat>("Maison-style");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HeritageQuoteResult | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);

  const canSubmit = query.trim().length >= 5 && query.length <= 300 && !loading;

  const reset = useCallback(() => {
    setQuery("");
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
      const res = await fetch("/api/demo/heritage-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, format }),
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
  }, [canSubmit, query, format]);

  const typeCfg = result?.source_type ? TYPE_STYLE[result.source_type] : null;

  return (
    <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.06] via-white/[0.02] to-white/[0.01] p-6 md:p-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/15">
          <Landmark className="h-4 w-4 text-violet-200" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Demo live · HeritageComms
          </p>
          <h3 className="font-display text-2xl font-bold text-white">
            Sourcing patrimonial zero-hallucination
          </h3>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            L&apos;agent cherche un fait valide dans APPROVED_FACTS + HERITAGE_SOURCES.
            Si pas de match, il le dit clairement — jamais d&apos;invention.
          </p>
        </div>
      </div>

      {/* Format selector */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-white/50">Format de citation :</p>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                format === f
                  ? "border-violet-400/50 bg-violet-400/10 text-violet-100"
                  : "border-white/15 bg-white/[0.03] text-white/60 hover:border-white/30"
              }`}
            >
              {f}
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
            onClick={() => {
              setQuery(p.text);
              setResult(null);
              setError(null);
            }}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/70 hover:border-violet-400/40 hover:bg-violet-400/10"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 300))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) submit();
          }}
          placeholder="Ex : Quand le motif iconique a-t-il ete cree ?"
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
          maxLength={300}
        />
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono text-white/35">
          {query.length}/300
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Sourcer
            </>
          )}
        </button>
        {(query || result) && (
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
            {result.usable ? (
              <>
                {/* Usable : fact + source */}
                <div className="rounded-[24px] border border-emerald-400/25 bg-emerald-400/[0.05] p-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                      Fait sourcé · USABLE
                    </p>
                  </div>
                  <p className="mt-4 font-display text-xl font-bold leading-relaxed text-white">
                    {result.fact}
                  </p>
                  {result.year && (
                    <p className="mt-2 inline-flex rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-xs text-white/60">
                      {result.year}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Source info */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                      Source
                    </p>
                    {typeCfg && (
                      <div className="mt-3 flex items-start gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${typeCfg.bg}`}>
                          <typeCfg.Icon className={`h-4 w-4 ${typeCfg.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-white/45">{result.source_id}</p>
                          <p className="text-sm font-semibold text-white">{result.source_title}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${typeCfg.color}`}>
                              {result.source_type}
                            </span>
                            {result.source_status && (
                              <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[result.source_status]}`}>
                                {result.source_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Citation */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                      Citation · {format}
                    </p>
                    <p className="mt-3 rounded-xl border border-violet-400/15 bg-violet-400/[0.05] p-3 font-mono text-sm italic leading-relaxed text-violet-100">
                      {result.citation_formatted}
                    </p>
                  </div>
                </div>

                {/* Narrative block */}
                <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                    Bloc narratif reutilisable
                  </p>
                  <p className="mt-3 text-sm italic leading-relaxed text-white/85">
                    &ldquo;{result.narrative_block}&rdquo;
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Not usable : explicit */}
                <div className="rounded-[24px] border border-rose-400/25 bg-rose-400/[0.05] p-6">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-rose-300" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
                      Non utilisable · anti-hallucination
                    </p>
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-white/85">{result.narrative_block}</p>
                </div>

                {result.alternative_source_ids.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                      Sources proches dans le catalogue
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.alternative_source_ids.map((sid) => (
                        <span
                          key={sid}
                          className="rounded-md border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 font-mono text-[11px] text-violet-200"
                        >
                          {sid}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-white/50">
                      Ces sources pourraient enrichir la query si une reformulation est possible.
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
