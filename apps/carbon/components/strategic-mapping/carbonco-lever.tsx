"use client";

import { motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, LineChart, FileText, Bot, BookOpen, ClipboardList } from "lucide-react";
import Link from "next/link";
import { staggerItem } from "@/lib/animations";
import type { CarbonCoLever } from "@/lib/api";

interface Props {
  levers: CarbonCoLever[];
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  "/dashboard": <LayoutDashboard className="w-4 h-4" />,
  "/finance": <LineChart className="w-4 h-4" />,
  "/reports": <FileText className="w-4 h-4" />,
  "/copilot": <Bot className="w-4 h-4" />,
  "/esrs": <BookOpen className="w-4 h-4" />,
  "/audit": <ClipboardList className="w-4 h-4" />,
};

export function CarbonCoLeverPanel({ levers }: Props) {
  return (
    <motion.div variants={staggerItem} className="space-y-4">
      <div className="rounded-xl border border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent p-6">
        <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-1">
          Comment Carbon & Co active ces bénéfices
        </h2>
        <p className="text-sm text-[var(--color-foreground-muted)] mb-6">
          La plateforme ne produit pas le discours — elle produit les données qui le rendent crédible et opposable.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {levers.map((lever) => (
            <LeverCard key={lever.id} lever={lever} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function LeverCard({ lever }: { lever: CarbonCoLever }) {
  const icon = lever.moduleRef ? (MODULE_ICONS[lever.moduleRef] ?? <ArrowRight className="w-4 h-4" />) : null;

  const content = (
    <div className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2 hover:border-[var(--color-primary)]/40 transition-colors h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide">
          {lever.benefit}
        </span>
        {icon && (
          <div className="p-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] opacity-70 group-hover:opacity-100 transition-opacity">
            {icon}
          </div>
        )}
      </div>
      <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed">{lever.capability}</p>
      {lever.moduleRef && (
        <div className="flex items-center gap-1 text-xs text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity pt-1">
          <span>Accéder au module</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  if (lever.moduleRef) {
    return (
      <Link href={lever.moduleRef} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}
