/**
 * CertBadges — grille des certifications (obtenues, en cours, roadmap, by-design).
 */

import Link from "next/link";
import { Award, ArrowRight } from "lucide-react";

import certifications from "@/content/trust/certifications.json";

const STATUS_CLASSES: Record<string, string> = {
  active: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  "in-progress": "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
  roadmap: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
  "by-design": "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
};

export function CertBadges() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {certifications.items.map((cert) => {
        const cls = STATUS_CLASSES[cert.status] || STATUS_CLASSES["roadmap"];
        return (
          <Link
            key={cert.id}
            href={cert.evidenceUrl}
            className="group flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] no-underline"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${cls}`}
              >
                <Award className="h-4 w-4" aria-hidden="true" />
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${cls}`}
              >
                {cert.statusLabel}
              </span>
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-white">
                {cert.label}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/40">
                {cert.fullName}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-white/60">{cert.description}</p>
            <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-violet-200 opacity-70 group-hover:opacity-100">
              <span>Détails</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
