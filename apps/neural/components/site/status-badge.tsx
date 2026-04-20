import {
  PROOF_LEVEL_LABELS,
  PUBLIC_STATUS_LABELS,
  type ProofLevel,
  type PublicStatus,
} from "@/lib/public-catalog";

const statusClasses: Record<PublicStatus, string> = {
  live: "border-emerald-400/25 bg-emerald-400/[0.12] text-emerald-300",
  demo: "border-violet-400/25 bg-violet-400/[0.12] text-violet-200",
  planned: "border-amber-400/25 bg-amber-400/[0.12] text-amber-200",
};

const proofClasses: Record<ProofLevel, string> = {
  runtime_data: "border-white/10 bg-white/[0.06] text-white/70",
  ui_demo: "border-white/10 bg-white/[0.06] text-white/70",
  content_only: "border-white/10 bg-white/[0.06] text-white/60",
};

export function StatusBadge({
  status,
  proofLevel,
  className = "",
}: {
  status: PublicStatus;
  proofLevel?: ProofLevel;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${statusClasses[status]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {PUBLIC_STATUS_LABELS[status]}
      </span>
      {proofLevel ? (
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${proofClasses[proofLevel]}`}
        >
          {PROOF_LEVEL_LABELS[proofLevel]}
        </span>
      ) : null}
    </div>
  );
}
