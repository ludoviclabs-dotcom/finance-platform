"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ArrowRight } from "lucide-react";

export function RegulatoryAlertBanner() {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          role="alert"
          aria-live="polite"
          className="mx-6 mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] backdrop-blur-sm px-4 py-2.5 flex items-center gap-3"
        >
          <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          </div>
          <p className="flex-1 text-xs text-[var(--color-foreground-muted)] min-w-0">
            <span className="font-semibold text-amber-400">EFRAG 15/03/26</span>
            <span className="mx-1.5 text-[var(--color-border)]">—</span>
            <span>Nouvelles guidelines ESRS E1-6 · Scope 3 cat. 15 précisé.</span>
          </p>
          <button className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none">
            Voir l&apos;impact
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Fermer l'alerte réglementaire"
            className="flex-shrink-0 p-1 rounded text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
