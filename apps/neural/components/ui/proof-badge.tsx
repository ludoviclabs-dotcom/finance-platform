import {
  getProofBadgeShort,
  getProofLabel,
  type UnifiedStatusKind,
} from "@/lib/proof-status";

/**
 * Palette alignée sur la surface preuve canonique (`app/proof/page.tsx`) :
 * un dégradé de maturité slate → cyan → violet → amber → emerald. Migrer un
 * badge ad-hoc vers ce composant ne produit donc aucune régression visuelle.
 */
const TONE_CLASSES: Record<UnifiedStatusKind, string> = {
  client_ready: "border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-200",
  export_audit: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
  public_demo: "border-violet-400/25 bg-violet-400/[0.10] text-violet-200",
  runtime_parsed: "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
  excel_created: "border-slate-400/25 bg-slate-400/[0.08] text-slate-200",
  planned: "border-white/10 bg-white/[0.06] text-white/55",
  unknown: "border-white/8 bg-white/[0.04] text-white/40",
};

interface ProofBadgeProps {
  status: UnifiedStatusKind;
  /** Variant compact (Excel/Runtime/Démo/Export/Prêt client) pour listes denses. */
  variant?: "short" | "long";
  className?: string;
}

/**
 * Badge proof unifié — remplace les badges ad-hoc qui dupliquaient une map
 * statut → tokens visuels. Consomme `lib/proof-status.ts` (label) et la
 * palette ci-dessus (couleur).
 */
export function ProofBadge({ status, variant = "long", className = "" }: ProofBadgeProps) {
  const label = variant === "short" ? getProofBadgeShort(status) : getProofLabel(status);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASSES[status]} ${className}`}
    >
      {label}
    </span>
  );
}
