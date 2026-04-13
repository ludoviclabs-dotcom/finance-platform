"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { staggerItem } from "@/lib/animations";
import { fetchAiContext } from "@/lib/api";
import type { AiContextResponse, MappingHorizon, MappingPersona, MappingSegment } from "@/lib/api";

interface AiVariantPanelProps {
  segment: MappingSegment;
  persona: MappingPersona;
  horizon: MappingHorizon;
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const formatted = line.replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="text-[var(--color-foreground)] font-semibold">$1</strong>',
    );
    if (line.startsWith("- ")) {
      return (
        <li
          key={i}
          className="ml-4 list-disc text-sm text-[var(--color-foreground-muted)]"
          dangerouslySetInnerHTML={{ __html: formatted.slice(2) }}
        />
      );
    }
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      return (
        <p
          key={i}
          className="font-semibold text-[var(--color-foreground)] leading-snug"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return (
      <p
        key={i}
        className="text-sm text-[var(--color-foreground-muted)]"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  });
}

export function AiVariantPanel({ segment, persona, horizon }: AiVariantPanelProps) {
  const [open, setOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AiContextResponse | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Reset when filters change
  useEffect(() => {
    setAiContext(null);
    setContextError(null);
    setGenerated(false);
    abortRef.current?.abort();
  }, [segment, persona, horizon]);

  const loadContext = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setContextLoading(true);
    setContextError(null);
    try {
      const ctx = await fetchAiContext({ segment, persona, horizon }, ctrl.signal);
      setAiContext(ctx);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setContextError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setContextLoading(false);
    }
  }, [segment, persona, horizon]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/value-mapping-variant",
        body: () => ({ aiContext }),
      }),
    [aiContext],
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const streaming = status === "submitted" || status === "streaming";

  const lastAssistantText = useMemo(() => {
    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    if (assistantMsgs.length === 0) return null;
    const last = assistantMsgs[assistantMsgs.length - 1];
    const textPart = last.parts?.find((p) => p.type === "text");
    return textPart && "text" in textPart ? (textPart.text as string) : null;
  }, [messages]);

  const handleGenerate = async () => {
    if (!aiContext) return;
    setGenerated(true);
    sendMessage({ text: "Génère une variante reformulée de ce message." });
  };

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && !aiContext && !contextLoading) {
      await loadContext();
    }
  };

  const handleRegenerate = () => {
    if (!aiContext) return;
    sendMessage({ text: "Génère une nouvelle variante différente de la précédente." });
  };

  return (
    <motion.div variants={staggerItem}>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {/* Header / toggle */}
        <button
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-raised)] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-sm font-semibold text-[var(--color-foreground)]">
              Variante IA — Reformulation du message exécutif
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
            <span>Grounded · sans hallucination</span>
            {open ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4 border-t border-[var(--color-border)]">
                {/* Loading context */}
                {contextLoading && (
                  <div className="flex items-center gap-2 pt-4 text-sm text-[var(--color-foreground-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement du contexte…
                  </div>
                )}

                {/* Context error */}
                {contextError && (
                  <div className="pt-4 text-sm text-red-400">
                    Erreur : {contextError}
                  </div>
                )}

                {/* Context loaded — show allowed facts + CTA */}
                {aiContext && !generated && (
                  <div className="pt-4 space-y-4">
                    {/* Allowed facts summary */}
                    {aiContext.allowedFacts.length > 0 && (
                      <div className="text-xs text-[var(--color-foreground-muted)] space-y-1">
                        <p className="font-medium text-[var(--color-foreground)]">
                          Faits autorisés pour ce profil :
                        </p>
                        <ul className="space-y-0.5">
                          {aiContext.allowedFacts.map((f) => (
                            <li key={f.id} className="flex gap-1.5">
                              <span className="text-[var(--color-primary)] shrink-0">·</span>
                              <span>
                                <span className="font-medium">{f.label}</span> — {f.magnitude}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={streaming}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      <Sparkles className="w-4 h-4" />
                      Générer la variante
                    </button>
                  </div>
                )}

                {/* Streaming / result */}
                {generated && (
                  <div className="pt-4 space-y-3">
                    {streaming && (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Génération en cours…
                      </div>
                    )}

                    {lastAssistantText && (
                      <div className="rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] p-4 space-y-1">
                        {renderMarkdown(lastAssistantText)}
                      </div>
                    )}

                    {!streaming && lastAssistantText && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="flex items-center gap-1.5 text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Nouvelle variante
                        </button>
                        <span className="text-xs text-[var(--color-foreground-muted)] opacity-50">
                          · Grounded — seuls les chiffres vérifiés ont été utilisés
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
