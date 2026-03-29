"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, X, Eye, Clock } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const DURATION = 15000; // 15 secondes

export function AIDraftNotification() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const { toast } = useToast();

  // Apparaît après 4 secondes (simulation d'une action IA en arrière-plan)
  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(show);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        setVisible(false);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [visible]);

  const handleConsult = () => {
    setVisible(false);
    toast("Ouverture du rapport E1 pré-rédigé par NEURAL...", "success");
  };

  const handleDismiss = () => {
    setVisible(false);
    toast("Notification ignorée. Retrouvez le brouillon dans Rapports.", "info", 3000);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.95 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          role="status"
          aria-live="polite"
          aria-label="Rapport IA pré-rédigé disponible"
          className="fixed bottom-20 right-6 z-[60] w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden pointer-events-auto"
        >
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            {/* Icon */}
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-purple-500" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-[var(--color-foreground)]">NEURAL a pré-rédigé votre rapport E1</span>
              </div>
              <p className="text-xs text-[var(--color-foreground-muted)] leading-relaxed mb-1">
                87% des sections sont prêtes. Estimation : 45 min de révision.
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-600 font-semibold">
                <span>✦</span> Généré par IA — à valider
              </span>
            </div>

            <button
              onClick={handleDismiss}
              aria-label="Fermer la notification"
              className="flex-shrink-0 text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              onClick={handleConsult}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Consulter
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer focus-visible:outline-none"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Plus tard
            </button>
          </div>

          {/* Progress bar auto-dismiss */}
          <div className="h-1 bg-[var(--color-background)]">
            <div
              className="h-full bg-purple-500 transition-none"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
