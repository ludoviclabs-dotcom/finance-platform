/**
 * ResourceDataStatus — pastille de qualité d'une donnée ressource.
 *
 * Réutilise `DataStatusBadge` + le mapping `dataStatusToBadge` de
 * `components/ui/data-status-badge` (source unique de vérité du vocabulaire
 * VERIFIED/ESTIMATED/MANUAL/STALE). N'ajoute qu'une chose : le libellé « Inféré »
 * pour `inferred`, que le mapping range sous ESTIMATED sans le nommer.
 */

import { DataStatusBadge, dataStatusToBadge } from "@/components/ui/data-status-badge";
import type { BackendDataStatus } from "@/lib/api/resources";

export function ResourceDataStatus({
  status,
  isStale = false,
  size = "xs",
  className,
}: {
  status: BackendDataStatus;
  isStale?: boolean;
  size?: "xs" | "sm";
  className?: string;
}) {
  const badge = dataStatusToBadge(status, isStale);
  // `inferred` n'a pas de badge dédié : on porte le libellé explicite côté appelant.
  const label = !isStale && status === "inferred" ? "Inféré" : undefined;
  return <DataStatusBadge status={badge} label={label} size={size} className={className} />;
}

export default ResourceDataStatus;
