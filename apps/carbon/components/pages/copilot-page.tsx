"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, User, Sparkles, Lightbulb, AlertTriangle } from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { pageVariants } from "@/lib/animations";
import { useCarbonSnapshot } from "@/lib/hooks/use-carbon-snapshot";
import { useVsmeSnapshot } from "@/lib/hooks/use-vsme-snapshot";
import { useEsgSnapshot } from "@/lib/hooks/use-esg-snapshot";
import { useFinanceSnapshot } from "@/lib/hooks/use-finance-snapshot";

const quickPrompts = [
  { label: "Bilan carbone Scope 1, 2 et 3", icon: "🏭" },
  { label: "Conformité ESRS / CSRD", icon: "📋" },
  { label: "Coût CBAM estimé", icon: "🌍" },
  { label: "Alignement Taxonomie UE", icon: "🌿" },
  { label: "Enjeux matériels prioritaires", icon: "⚖️" },
  { label: "Plan SBTi et trajectoire 1,5°C", icon: "📉" },
];

export function CopilotPage() {
  const carbonSnap = useCarbonSnapshot();
  const vsmeSnap = useVsmeSnapshot();
  const esgSnap = useEsgSnapshot();
  const financeSnap = useFinanceSnapshot();

  const snapshots = useMemo(
    () => ({
      carbon: carbonSnap.status === "ready" ? carbonSnap.data : null,
      vsme: vsmeSnap.status === "ready" ? vsmeSnap.data : null,
      esg: esgSnap.status === "ready" ? esgSnap.data : null,
      finance: financeSnap.status === "ready" ? financeSnap.data : null,
    }),
    [carbonSnap, vsmeSnap, esgSnap, financeSnap],
  );

  const readyCount =
    (snapshots.carbon ? 1 : 0) +
    (snapshots.vsme ? 1 : 0) +
    (snapshots.esg ? 1 : 0) +
    (snapshots.finance ? 1 : 0);

  const anyLoading =
    carbonSnap.status === "loading" ||
    vsmeSnap.status === "loading" ||
    esgSnap.status === "loading" ||
    financeSnap.status === "loading";

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/copilot",
        body: () => ({ snapshots }),
      }),
    [snapshots],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
  });

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

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      const formatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-[var(--color-foreground)] font-semibold">$1</strong>',
      );
      if (line.startsWith("- ")) {
        return (
          <li
            key={i}
            className="ml-4 list-disc"
            dangerouslySetInnerHTML={{ __html: formatted.slice(2) }}
          />
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <li
            key={i}
            className="ml-4 list-decimal"
            dangerouslySetInnerHTML={{ __html: formatted.replace(/^\d+\.\s/, "") }}
          />
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3
            key={i}
            className="font-display font-bold text-[var(--color-foreground)] mt-2 mb-1"
            dangerouslySetInnerHTML={{ __html: formatted.slice(3) }}
          />
        );
      }
      if (!line.trim()) return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

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
              readyCount === 4
                ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                : readyCount > 0
                  ? "bg-amber-50 text-amber-600"
                  : "bg-[var(--color-border)] text-[var(--color-foreground-muted)]"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {readyCount}/4 snapshots chargés
          </span>
          {anyLoading && (
            <span className="text-[var(--color-foreground-muted)]">
              Chargement des données…
            </span>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-carbon-emerald/20 flex items-center justify-center flex-shrink-0 text-carbon-emerald">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)]">
              Bonjour 👋 je suis votre copilote ESG. Posez-moi une question sur vos
              scopes carbone, votre matérialité ESRS, vos indicateurs VSME, votre
              alignement Taxonomie UE, ou n&apos;importe quel sujet CSRD — je
              répondrai en m&apos;appuyant uniquement sur vos données réelles.
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "assistant"
                    ? "bg-carbon-emerald/20 text-carbon-emerald"
                    : "bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)]"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)]"
                    : "bg-carbon-emerald text-white"
                }`}
              >
                {msg.parts.map((part, i) =>
                  part.type === "text" ? (
                    msg.role === "assistant" ? (
                      <div key={i}>{renderMarkdown(part.text)}</div>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 items-center"
          >
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
          <span className="text-xs text-[var(--color-foreground-subtle)]">
            Suggestions rapides
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => handleSend(prompt.label)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-foreground-muted)] hover:border-carbon-emerald/30 hover:text-carbon-emerald-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prompt.icon} {prompt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2"
        >
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question sur vos données ESG…"
              disabled={busy}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald focus:ring-1 focus:ring-carbon-emerald/30 disabled:opacity-60"
            />
            <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-foreground-subtle)]" />
          </div>
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              title="Arrêter la génération"
              className="px-4 py-3 rounded-xl bg-[var(--color-danger)] text-white font-medium text-sm hover:opacity-90 transition-colors cursor-pointer"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              title="Envoyer"
              className="px-4 py-3 rounded-xl bg-carbon-emerald text-white font-medium text-sm hover:bg-carbon-emerald/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </motion.div>
  );
}
