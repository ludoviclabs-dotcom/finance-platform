"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, User, Sparkles, Lightbulb } from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { aiResponses } from "@/lib/data";
import { pageVariants } from "@/lib/animations";
import { useCarbonSnapshot } from "@/lib/hooks/use-carbon-snapshot";
import type { ChatMessage } from "@/lib/types";

const quickPrompts = [
  { label: "Bilan carbone", query: "scope", icon: "🏭" },
  { label: "Conformité ESRS", query: "esrs", icon: "📋" },
  { label: "CBAM", query: "cbam", icon: "🌍" },
  { label: "Taxonomie verte", query: "taxonomie", icon: "🌿" },
];

const fmt = (n: number | null | undefined, fallback: string) =>
  typeof n === "number" && n > 0 ? n.toLocaleString("fr-FR") : fallback;

export function CopilotPage() {
  const snapshot = useCarbonSnapshot();

  // Build live responses once the snapshot is ready, otherwise fall back to static strings
  const liveResponses = useMemo(() => {
    if (snapshot.status !== "ready") return aiResponses;
    const { carbon, taxonomy, cbam, energy } = snapshot.data;

    const s1 = fmt(carbon.scope1Tco2e, "1 336");
    const s2 = fmt(carbon.scope2LbTco2e, "934");
    const s3 = fmt(carbon.scope3Tco2e, "3 685");
    const total = fmt(carbon.totalS123Tco2e, "5 955");
    const pS1 = fmt(carbon.shareScope1Pct, "22");
    const pS2 = fmt(carbon.shareScope2Pct, "16");
    const pS3 = fmt(carbon.shareScope3Pct, "62");
    const taxoCA = fmt(taxonomy.turnoverAlignedPct, "35");
    const taxoCapex = fmt(taxonomy.capexAlignedPct, "28");
    const cbamCost = fmt(cbam.estimatedCostEur, "48 000");
    const enr = fmt(energy.renewableSharePct, "38");

    return {
      ...aiResponses,
      scope: `Vos émissions totales s'élèvent à **${total} tCO₂e** sur l'exercice.\n\n- **Scope 1** : ${s1} tCO₂e (${pS1}%) — émissions directes\n- **Scope 2** : ${s2} tCO₂e (${pS2}%) — énergie indirecte\n- **Scope 3** : ${s3} tCO₂e (${pS3}%) — chaîne de valeur\n\nLe Scope 3 reste votre principal levier de réduction. Part d'énergies renouvelables actuelle : **${enr}%**.`,
      taxonomie: `La **Taxonomie européenne** définit 6 objectifs environnementaux.\n\nVos activités éligibles :\n- Chiffre d'affaires aligné : **${taxoCA}%**\n- CapEx aligné : **${taxoCapex}%**\n\n**Prochaine étape** : documenter les critères DNSH (Do No Significant Harm) pour vos principales activités éligibles.`,
      cbam: `Le **CBAM** (Carbon Border Adjustment Mechanism) entre en phase transitoire.\n\n**Coût estimé sur vos importations** : **${cbamCost} €**\n\n**Actions requises :**\n1. Identifier les importations couvertes (acier, aluminium, ciment, engrais)\n2. Collecter les données d'émissions intégrées auprès de vos fournisseurs hors-UE\n3. Déclarer trimestriellement via le registre CBAM`,
    };
  }, [snapshot.status, snapshot.data]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: aiResponses.default,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Match keywords to responses
    const lower = text.toLowerCase();
    let responseKey = "default";
    if (lower.includes("scope") || lower.includes("émission") || lower.includes("carbone"))
      responseKey = "scope";
    else if (lower.includes("esrs") || lower.includes("csrd") || lower.includes("norme"))
      responseKey = "esrs";
    else if (lower.includes("cbam") || lower.includes("frontière"))
      responseKey = "cbam";
    else if (lower.includes("taxonomie") || lower.includes("alignement"))
      responseKey = "taxonomie";

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: liveResponses[responseKey] || liveResponses.default,
          timestamp: new Date(),
        },
      ]);
    }, 1200 + Math.random() * 800);
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Bold
      const formatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-[var(--color-foreground)] font-semibold">$1</strong>'
      );
      // List items
      if (line.startsWith("- ")) {
        return (
          <li
            key={i}
            className="ml-4 list-disc"
            dangerouslySetInnerHTML={{ __html: formatted.slice(2) }}
          />
        );
      }
      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        return (
          <li
            key={i}
            className="ml-4 list-decimal"
            dangerouslySetInnerHTML={{ __html: formatted.replace(/^\d+\.\s/, "") }}
          />
        );
      }
      if (!line.trim()) return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <motion.div {...pageVariants} className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-6 pb-0">
        <SectionTitle
          title="Copilote IA"
          subtitle="Votre assistant ESG propulsé par l'intelligence artificielle"
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
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
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
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
            <button
              key={prompt.query}
              onClick={() => sendMessage(prompt.label)}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-foreground-muted)] hover:border-carbon-emerald/30 hover:text-carbon-emerald-light transition-colors cursor-pointer"
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
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question sur vos données ESG..."
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald focus:ring-1 focus:ring-carbon-emerald/30"
            />
            <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-foreground-subtle)]" />
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-3 rounded-xl bg-carbon-emerald text-white font-medium text-sm hover:bg-carbon-emerald/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
