/**
 * ClaimStatusTiles — Server Component
 * 4 tuiles VALID / STALE / UNVERIFIED / MISSING calculees live depuis
 * le catalogue claims. Exposees sur la landing pour prouver la discipline anti-greenwashing.
 */
import { CheckCircle2, Clock3, AlertTriangle, XCircle } from "lucide-react";

import {
  CLAIMS_REGISTRY,
  countClaimsByStatus,
  type ClaimStatus,
} from "@/lib/data/luxe-comms-catalog";

const CONFIG: Record<
  ClaimStatus,
  {
    label: string;
    Icon: typeof CheckCircle2;
    tint: string;
    border: string;
    bg: string;
    accent: string;
    hint: string;
  }
> = {
  VALID: {
    label: "Claims VALID",
    Icon: CheckCircle2,
    tint: "text-emerald-300",
    border: "border-emerald-400/20",
    bg: "bg-emerald-400/[0.04]",
    accent: "bg-emerald-400/10",
    hint: "Preuve active + non expiree",
  },
  STALE: {
    label: "Claims STALE",
    Icon: Clock3,
    tint: "text-amber-300",
    border: "border-amber-400/20",
    bg: "bg-amber-400/[0.04]",
    accent: "bg-amber-400/10",
    hint: "Preuve expiree, a revalider",
  },
  UNVERIFIED: {
    label: "Claims UNVERIFIED",
    Icon: AlertTriangle,
    tint: "text-orange-300",
    border: "border-orange-400/20",
    bg: "bg-orange-400/[0.04]",
    accent: "bg-orange-400/10",
    hint: "Flag manuel, review ouverte",
  },
  MISSING: {
    label: "Claims MISSING",
    Icon: XCircle,
    tint: "text-rose-300",
    border: "border-rose-400/20",
    bg: "bg-rose-400/[0.04]",
    accent: "bg-rose-400/10",
    hint: "Aucune preuve — BLOCK",
  },
};

const ORDER: ClaimStatus[] = ["VALID", "UNVERIFIED", "STALE", "MISSING"];

export function ClaimStatusTiles() {
  const counts = countClaimsByStatus();
  const total = CLAIMS_REGISTRY.length;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-xl font-bold text-white">
          Registre claims — {total} entrees
        </h3>
        <p className="text-xs text-white/45">
          Statut recalcule a chaque visite a partir de l&apos;evidence_expiry
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((s) => {
          const cfg = CONFIG[s];
          const n = counts[s] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div
              key={s}
              className={`rounded-[24px] border ${cfg.border} ${cfg.bg} p-5`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${cfg.accent}`}>
                <cfg.Icon className={`h-4 w-4 ${cfg.tint}`} />
              </div>
              <p className="mt-4 font-display text-3xl font-bold tracking-tight text-white">
                {n}
              </p>
              <p className={`mt-1 text-sm ${cfg.tint}`}>{cfg.label}</p>
              <p className="mt-2 text-xs text-white/45">{cfg.hint}</p>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full ${cfg.accent}`}
                  style={{ width: `${pct}%` }}
                  aria-label={`${pct}% du total`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
