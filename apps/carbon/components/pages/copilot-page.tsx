"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, User, Sparkles, Lightbulb, AlertTriangle,
  ChevronRight, ChevronDown, Database, Activity, RefreshCw,
} from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { pageVariants } from "@/lib/animations";
import { fetchCopilotTools, getAuthToken, type CopilotToolsBundle } from "@/lib/api";

const quickPrompts = [
  { label: "Bilan carbone Scope 1, 2 et 3", icon: "🏭" },
  { label: "Conformité ESRS / CSRD", icon: "📋" },
  { label: "Coût CBAM estimé", icon: "🌍" },
  { label: "Alignement Taxonomie UE", icon: "🌿" },
  { label: "Enjeux matériels prioritaires", icon: "⚖️" },
  { label: "Plan SBTi et trajectoire 1,5°C", icon: "📉" },
  { label: "Score VSME et complétude", icon: "📊" },
  { label: "Alertes actives", icon: "🔔" },
];

// ---------------------------------------------------------------------------
// Sources panel component
// ---------------------------------------------------------------------------

function SourcesPanel({ tools, loading, onRefresh }: {
  tools: CopilotToolsBundle | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!tools && !loading) return null;

  const domains = ["carbon", "vsme", "esg", "finance"] as const;
  const domainLabels: Record<string, string> = {
    carbon: "Carbone", vsme: "VSME", esg: "ESG", finance: "Finance",
  };

  const availableCount = tools
    ? domains.filter((d) => tools.dataHealth?.domains?.[d]?.available).length
    : 0;

  return (
    <div className="border-b border-[var(--color-border)] px-6 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer w-full"
        aria-expanded={open ? "true" : "false"}
        aria-label="Afficher le panel des sources de données"
      >
        <Database className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">
          Sources de données grounded
          {tools && (
            <span className={`ml-2 font-semibold ${availableCount === 4 ? "text-[var(--color-success)]" : availableCount > 0 ? "text-amber-500" : "text-[var(--color-foreground-subtle)]"}`}>
              {availableCount}/4 disponibles
            </span>
          )}
        </span>
        {loading && <Activity className="w-3.5 h-3.5 animate-pulse text-carbon-emerald" />}
        {!loading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="hover:text-carbon-emerald transition-colors cursor-pointer p-0.5 rounded"
            title="Actualiser les sources"
            aria-label="Actualiser les sources de données"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
        {open ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {open && tools && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 pb-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {domains.map((domain) => {
                const health = tools.dataHealth?.domains?.[domain];
                const available = health?.available ?? false;
                const stale = health?.stale ?? false;
                const label = domainLabels[domain];

                // KPI display
                let kpi = "—";
                if (domain === "carbon" && tools.carbon?.totalS123Tco2e != null) {
                  kpi = `${Math.round(tools.carbon.totalS123Tco2e).toLocaleString("fr-FR")} tCO₂e`;
                } else if (domain === "vsme" && tools.vsme?.scorePct != null) {
                  kpi = `${Math.round(tools.vsme.scorePct)}% complétude`;
                } else if (domain === "esg" && tools.esg?.scoreGlobal != null) {
                  kpi = `${Math.round(tools.esg.scoreGlobal)}/100`;
                } else if (domain === "finance" && tools.finance?.greenCapexPct != null) {
                  kpi = `${tools.finance.greenCapexPct?.toFixed(1)}% Green CapEx`;
                }

                return (
                  <div key={domain}
                    className={`p-2.5 rounded-lg border text-xs ${
                      available && !stale
                        ? "border-[var(--color-success)]/30 bg-[var(--color-success-bg)]"
                        : stale
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-[var(--color-border)] bg-[var(--color-background)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[var(--color-foreground)]">{label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        available && !stale ? "bg-[var(--color-success)]"
                          : stale ? "bg-amber-500"
                            : "bg-[var(--color-border-strong)]"
                      }`} />
                    </div>
                    <p className="text-[var(--color-foreground-muted)] truncate">{kpi}</p>
                    {stale && <p className="text-amber-600 text-[10px] mt-0.5">Données périmées</p>}
                    {!available && <p className="text-[var(--color-foreground-subtle)] text-[10px] mt-0.5">Non disponible</p>}
                  </div>
                );
              })}
            </div>
            {tools.alertStatus && tools.alertStatus.totalActive > 0 && (
              <p className="text-[10px] text-amber-600 pb-1">
                ⚠ {tools.alertStatus.totalActive} règle{tools.alertStatus.totalActive > 1 ? "s" : ""} d'alerte active{tools.alertStatus.totalActive > 1 ? "s" : ""}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main copilot component
// ---------------------------------------------------------------------------

export function CopilotPage() {
  const [tools, setTools] = useState<CopilotToolsBundle | null>(null);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);

  const loadTools = useCallback(async () => {
    setToolsLoading(true);
    setToolsError(null);
    try {
      const bundle = await fetchCopilotTools();
      setTools(bundle);
    } catch (e) {
      setToolsError(e instanceof Error ? e.message : "Erreur chargement sources");
    } finally {
      setToolsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/copilot",
        headers: () => {
          const token = getAuthToken();
          const h: Record<string, string> = {};
          if (token) h.Authorization = `Bearer ${token}`;
          return h;
        },
        body: () => ({ tools: tools ?? undefined }),
      }),
    [tools],
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const availableCount = tools
    ? (["carbon", "vsme", "esg", "finance"] as const).filter(
        (d) => tools.dataHealth?.domains?.[d]?.available,
      ).length
    : 0;


  return (
    <motion.div {...pageVariants} className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-6 pb-3">
        <SectionTitle
          title="Copilote IA"
          subtitle="Assistant ESG propulsé par Claude Sonnet 4.6, ancré sur vos données temps réel"
        />
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
              availableCount === 4
                ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                : availableCount > 0
                  ? "bg-amber-50 text-amber-600"
                  : "bg-[var(--color-border)] text-[var(--color-foreground-muted)]"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {toolsLoading ? "Chargement des sources…" : `${availableCount}/4 snapshots disponibles`}
          </span>
          {toolsError && (
            <span className="text-[var(--color-warning)] text-xs">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {toolsError}
            </span>
          )}
        </div>
      </div>

      {/* Sources panel */}
      <SourcesPanel tools={tools} loading={toolsLoading} onRefresh={loadTools} />

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-carbon-emerald/20 flex items-center justify-center flex-shrink-0 text-carbon-emerald">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)]">
              Bonjour 👋 je suis votre copilote ESG. Posez-moi une question sur vos scopes carbone,
              votre matérialité ESRS, vos indicateurs VSME, votre alignement Taxonomie UE ou n&apos;importe
              quel sujet CSRD — je répondrai uniquement sur la base de vos données réelles.
              {tools && availableCount === 0 && (
                <span className="block mt-2 text-amber-600 text-xs">
                  ⚠ Aucune donnée disponible — les réponses seront génériques.
                </span>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "assistant"
                  ? "bg-carbon-emerald/20 text-carbon-emerald"
                  : "bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)]"
              }`}>
                {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "assistant"
                  ? "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)]"
                  : "bg-carbon-emerald text-white"
              }`}>
                {msg.parts.map((part, i) =>
                  part.type === "text" ? (
                    msg.role === "assistant" ? (
                      <SafeMarkdown key={i}>{part.text}</SafeMarkdown>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  ) : null,
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {status === "submitted" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-full bg-carbon-emerald/20 flex items-center justify-center text-carbon-emerald">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex gap-1 px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <span className="w-2 h-2 rounded-full bg-carbon-emerald animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-carbon-emerald animate-pulse [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-carbon-emerald animate-pulse [animation-delay:300ms]" />
            </div>
          </motion.div>
        )}

        {error && (
          <div className="flex gap-2 items-center p-3 rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Erreur : {error.message}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-6 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-[var(--color-foreground-subtle)]" />
          <span className="text-xs text-[var(--color-foreground-subtle)]">Suggestions rapides</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickPrompts.map((prompt) => (
            <button key={prompt.label} type="button" onClick={() => handleSend(prompt.label)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-foreground-muted)] hover:border-carbon-emerald/30 hover:text-carbon-emerald-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {prompt.icon} {prompt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-2">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="flex gap-2">
          <div className="flex-1 relative">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question sur vos données ESG…"
              disabled={busy}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald focus:ring-1 focus:ring-carbon-emerald/30 disabled:opacity-60"
            />
            <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-foreground-subtle)]" />
          </div>
          {busy ? (
            <button type="button" onClick={() => stop()} title="Arrêter la génération"
              className="px-4 py-3 rounded-xl bg-[var(--color-danger)] text-white font-medium text-sm hover:opacity-90 transition-colors cursor-pointer">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} title="Envoyer"
              className="px-4 py-3 rounded-xl bg-carbon-emerald text-white font-medium text-sm hover:bg-carbon-emerald/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </motion.div>
  );
}
