"use client";

import { motion } from "framer-motion";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
}

export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="mb-6"
    >
      <h2 className="text-2xl font-display font-bold text-[var(--color-foreground)]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">{subtitle}</p>
      )}
    </motion.div>
  );
}
