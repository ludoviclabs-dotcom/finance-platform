"use client";

/**
 * DemoNarration — texte de narration avec crossfade doux (180–240 ms).
 * Respecte prefers-reduced-motion (bascule instantanée, état final visible).
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function DemoNarration({ stepId, text }: { stepId: string; text: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={stepId}
        data-testid="demo-narration"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
        transition={{ duration: reduce ? 0 : 0.22, ease: "easeOut" }}
        className="text-base leading-relaxed text-white/80 sm:text-lg"
      >
        {text}
      </motion.p>
    </AnimatePresence>
  );
}
