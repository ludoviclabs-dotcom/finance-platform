"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Command } from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], description: "Recherche globale", category: "Navigation" },
  { keys: ["⌘", "1"], description: "Tableau de bord", category: "Navigation" },
  { keys: ["⌘", "2"], description: "Scopes 1-2-3", category: "Navigation" },
  { keys: ["⌘", "3"], description: "ESRS / CSRD", category: "Navigation" },
  { keys: ["⌘", "4"], description: "Copilote IA", category: "Navigation" },
  { keys: ["⌘", "5"], description: "Rapports", category: "Navigation" },
  { keys: ["⌘", "6"], description: "Offres", category: "Navigation" },
  { keys: ["⌘", "E"], description: "Exporter le dashboard", category: "Actions" },
  { keys: ["⌘", "R"], description: "Actualiser les données", category: "Actions" },
  { keys: ["?"], description: "Afficher les raccourcis", category: "Aide" },
  { keys: ["Esc"], description: "Fermer les panneaux / modales", category: "Aide" },
];

const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

interface KeyboardShortcutsProps {
  onExport?: () => void;
  onRefresh?: () => void;
}

export function KeyboardShortcuts({ onExport, onRefresh }: KeyboardShortcutsProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const pageMap: Record<string, string> = {
      "1": "/dashboard",
      "2": "/scopes",
      "3": "/esrs",
      "4": "/copilot",
      "5": "/reports",
      "6": "/pricing",
    };

    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (e.key === "?" && !isMeta) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      if (!isMeta) return;

      if (pageMap[e.key]) {
        e.preventDefault();
        router.push(pageMap[e.key]);
        return;
      }

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        onExport?.();
        return;
      }

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        onRefresh?.();
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router, onExport, onRefresh]);

  return (
    <>
      {/* Floating hint button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Afficher les raccourcis clavier"
        className="fixed bottom-6 left-6 z-50 w-8 h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] flex items-center justify-center text-sm font-bold transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
      >
        ?
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Raccourcis clavier"
              className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-md pointer-events-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <Command className="w-4 h-4 text-carbon-emerald" aria-hidden="true" />
                    <span className="font-display font-semibold text-[var(--color-foreground)]">Raccourcis clavier</span>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Fermer"
                    className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60 rounded"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Shortcuts */}
                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                  {categories.map((cat) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wider mb-2">{cat}</p>
                      <div className="space-y-1">
                        {SHORTCUTS.filter((s) => s.category === cat).map((s, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5">
                            <span className="text-sm text-[var(--color-foreground)]">{s.description}</span>
                            <div className="flex items-center gap-1">
                              {s.keys.map((k, ki) => (
                                <kbd
                                  key={ki}
                                  className="px-1.5 py-0.5 rounded bg-[var(--color-background)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-foreground-muted)] min-w-[1.5rem] text-center"
                                >
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-background)]">
                  <p className="text-xs text-[var(--color-foreground-subtle)] text-center">Appuyez sur <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[10px]">?</kbd> ou <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[10px]">Esc</kbd> pour fermer</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
