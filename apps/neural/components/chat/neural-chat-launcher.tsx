"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Bot, Sparkles, AlertTriangle } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Quels secteurs NEURAL adresse-t-il aujourd'hui ?",
  "Comment NEURAL gère l'AI Act ?",
  "Quelle est la différence vs Tray.ai ?",
  "Quels agents sont en runtime live ?",
];

export function NeuralChatLauncher() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;
    setError(null);
    const userMessage: ChatMessage = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Append empty assistant message that we'll fill via streaming
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || `Erreur HTTP ${res.status}`;
        setError(msg);
        setMessages((m) => m.slice(0, -1)); // remove empty assistant
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Streaming non disponible.");
        setMessages((m) => m.slice(0, -1));
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE format : "data: {...}\n\n"
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.startsWith("data: ") ? part.slice(6) : part;
          if (!line || line === "[DONE]") continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.text) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + parsed.text };
                }
                return copy;
              });
            }
            if (parsed.error) {
              setError(parsed.error);
            }
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (s: string) => {
    sendMessage(s);
  };

  const handleReset = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      {/* Floating button */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le chat NEURAL"
          className="fixed bottom-6 right-6 z-[60] inline-flex items-center gap-2 rounded-full bg-neural-violet px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-neural-violet/40 transition-all hover:scale-105 hover:bg-neural-violet-dark"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Discuter avec NEURAL</span>
          <span className="sm:hidden">Chat</span>
        </button>
      ) : null}

      {/* Modal/Drawer */}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-end p-4 sm:items-end sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative flex h-[600px] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-white/10 bg-neural-midnight shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-violet-500/[0.10] to-emerald-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/[0.15]">
                  <Bot className="h-4 w-4 text-violet-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Agent NEURAL</p>
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    Live · Claude Sonnet 4.6
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
                  >
                    Effacer
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le chat"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Disclaimer banner */}
            <div className="flex items-start gap-2 border-b border-amber-400/15 bg-amber-400/[0.04] px-4 py-2">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
              <p className="text-[10px] leading-relaxed text-amber-100/75">
                Réponses générées par IA. Vérifiez les engagements importants via /trust.
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/[0.10]">
                    <Sparkles className="h-5 w-5 text-violet-200" />
                  </div>
                  <div>
                    <p className="font-display text-base font-bold text-white">
                      Comment puis-je aider ?
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                      Questions sur NEURAL, les agents, la conformité, les comparatifs...
                    </p>
                  </div>
                  <div className="w-full space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSuggestion(s)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs leading-relaxed text-white/75 transition-all hover:border-white/25 hover:bg-white/[0.06]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/[0.10]">
                          <Bot className="h-3.5 w-3.5 text-violet-200" />
                        </div>
                      ) : null}
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-neural-violet text-white"
                            : "border border-white/10 bg-white/[0.04] text-white/85"
                        }`}
                      >
                        {msg.content || (
                          <span className="inline-flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:300ms]" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Error */}
            {error ? (
              <div className="border-t border-amber-400/20 bg-amber-400/[0.06] px-4 py-2">
                <p className="text-[11px] text-amber-100/85">{error}</p>
              </div>
            ) : null}

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-white/[0.04] p-2 transition-colors focus-within:border-violet-400/50">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Posez une question..."
                  rows={1}
                  disabled={streaming}
                  className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50"
                  style={{ maxHeight: "100px" }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neural-violet text-white shadow-md shadow-neural-violet/30 transition-all hover:bg-neural-violet-dark disabled:opacity-40 disabled:hover:bg-neural-violet"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/30">
                Entrée pour envoyer · Maj+Entrée pour saut de ligne · Esc pour fermer
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
