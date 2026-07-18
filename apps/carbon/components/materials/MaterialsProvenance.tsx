"use client";

/**
 * MaterialsProvenance — bandeau de provenance + drawer pour /materials (PR-04).
 *
 * S'AJOUTE à la page publique sans rien retirer : la provenance est dérivée du
 * snapshot LOCAL (toujours disponible, aucun appel API), donc le fallback
 * statique reste intact même API coupée. Le drawer expose la source
 * (CARBONCO_DEMO_SNAPSHOT), la release datée, le statut « Estimé » et l'état de
 * péremption. Le vrai registre de preuve (noyau) se pilote depuis la page
 * interne Source Admin (authentifiée) — ici on ne fait qu'afficher la
 * provenance, honnêtement étiquetée.
 *
 * `isStale`/`ageDays` sont calculés CÔTÉ SERVEUR (page prérendue) et passés en
 * props — jamais recalculés côté client, pour éviter tout écart d'hydratation.
 */

import { useState } from "react";
import { SourceDrawer } from "@/components/intelligence/source-drawer";
import { dataStatusToBadge } from "@/components/ui/data-status-badge";

// Miroir de snapshot_migration.DEMO_SOURCE_CODE côté backend.
const DEMO_SOURCE_CODE = "CARBONCO_DEMO_SNAPSHOT";

interface Props {
  snapshotDate: string;
  isStale: boolean;
  ageDays: number;
  attribution?: string;
}

export default function MaterialsProvenance({ snapshotDate, isStale, ageDays, attribution }: Props) {
  const [open, setOpen] = useState(false);
  const badgeStatus = dataStatusToBadge("estimated", isStale);

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs"
      data-testid="materials-provenance"
    >
      <p className="text-zinc-400">
        <span className="text-zinc-500">Source :</span>{" "}
        <span className="font-mono text-zinc-300">{DEMO_SOURCE_CODE}</span>
        <span className="text-zinc-600"> · </span>
        release <span className="text-zinc-300">{snapshotDate}</span>
        <span className="text-zinc-600"> · </span>
        <span className={isStale ? "text-zinc-400" : "text-amber-300"}>{isStale ? "Périmé" : "Estimé"}</span>
      </p>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 font-semibold text-zinc-300 hover:border-emerald-500/50 hover:text-white transition"
        data-testid="materials-provenance-open"
      >
        Provenance
      </button>

      <SourceDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Matières premières critiques UE"
        code={DEMO_SOURCE_CODE}
        publisher="Carbon&Co (snapshot de démonstration)"
        releaseKey={snapshotDate}
        badgeStatus={badgeStatus}
        badgeLabel={isStale ? "Périmé" : "Estimé"}
        isStale={isStale}
        ageDays={ageDays}
        lastReleaseAt={snapshotDate}
        attribution={
          attribution ??
          "Snapshot compilé à partir de repères publics (USGS, Commission Européenne CRMA/RMIS, LME, Trading Economics). Valeurs estimées, non normatives."
        }
        license={{
          ok: true,
          allowDisplay: true,
          allowDerivedUse: true,
          reasons: [],
          warnings: [],
        }}
      />
    </div>
  );
}
