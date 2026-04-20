import { Database, FileCheck2, ShieldCheck } from "lucide-react";

import { type ProofLevel, type PublicStatus } from "@/lib/public-catalog";
import { StatusBadge } from "@/components/site/status-badge";

export function EvidenceCard({
  title,
  dataUsed,
  deliverable,
  status,
  proofLevel,
}: {
  title: string;
  dataUsed: string;
  deliverable: string;
  status: PublicStatus;
  proofLevel: ProofLevel;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
      <StatusBadge status={status} proofLevel={proofLevel} />
      <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
        {title}
      </h3>
      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
            <Database className="h-4 w-4" />
            Donnees utilisees
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{dataUsed}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
            <FileCheck2 className="h-4 w-4" />
            Livrable genere
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{deliverable}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-200">
            <ShieldCheck className="h-4 w-4" />
            Niveau de preuve
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            La page affiche uniquement le niveau de preuve disponible aujourd&apos;hui pour cette brique.
          </p>
        </div>
      </div>
    </div>
  );
}
