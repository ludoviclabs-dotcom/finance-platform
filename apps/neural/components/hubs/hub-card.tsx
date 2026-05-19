import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StatusChip } from "@/components/site/status-badge";
import type { NavStatus } from "@/lib/navigation";

interface HubCardProps {
  href: string;
  title: string;
  description: string;
  status?: NavStatus;
  meta?: string;
}

export function HubCard({ href, title, description, status, meta }: HubCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[24px] border border-white/10 bg-white/[0.04] p-6 transition-all hover:-translate-y-1 hover:border-neural-violet/30 hover:bg-white/[0.06]"
    >
      <div className="flex items-center justify-between gap-3">
        {status ? <StatusChip status={status} /> : <span />}
        {meta ? <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">{meta}</span> : null}
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-white/65">{description}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 transition-colors group-hover:text-white">
        Découvrir
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
