import {
  getProofBadgeShort,
  getProofLabel,
  type UnifiedStatusKind,
} from "@/lib/proof-status";

const TONE_CLASSES: Record<UnifiedStatusKind, string> = {
  client_ready: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  export_audit: "bg-emerald-400/15 text-emerald-200 border-emerald-400/25",
  public_demo: "bg-violet-400/15 text-violet-200 border-violet-400/25",
  runtime_parsed: "bg-sky-400/15 text-sky-200 border-sky-400/25",
  excel_created: "bg-amber-400/15 text-amber-200 border-amber-400/25",
  planned: "bg-white/[0.06] text-white/55 border-white/10",
  unknown: "bg-white/[0.04] text-white/40 border-white/8",
};

interface ProofBadgeProps {
  status: UnifiedStatusKind;
  /** Variant compact (Live/Démo/Prépa) pour nav, listes denses, hover. */
  variant?: "short" | "long";
  className?: string;
}

/**
 * Badge proof unifié — remplace les badges ad-hoc dispersés en consommant
 * `lib/proof-status.ts`. Encapsule la dérivation displayStatus → label/tone
 * pour éviter le hardcoding de tokens visuels dans les pages.
 */
export function ProofBadge({ status, variant = "long", className = "" }: ProofBadgeProps) {
  const label = variant === "short" ? getProofBadgeShort(status) : getProofLabel(status);
  const toneClass = TONE_CLASSES[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClass} ${className}`}
    >
      {label}
    </span>
  );
}
