/**
 * Échéance de renouvellement BEGES — seule échéance réglementaire affichée
 * dans l'en-tête et le tableau de bord.
 *
 * Elle provient exclusivement de GET /beges/filings (`next_due_at`, calculée
 * par l'API à partir du dernier dépôt déclaré). Sans date connue, aucun
 * indicateur n'est affiché. Aucun compte à rebours CSRD générique : depuis la
 * directive Omnibus I, l'entrée dans le champ CSRD dépend de la taille de
 * l'entreprise, une échéance commune serait trompeuse.
 */

import type { BegesFilingsResponse } from "@/lib/api";

export type DeadlineLevel = "info" | "warn" | "alert";

export interface BegesDeadline {
  /** Jours restants (négatif : échéance dépassée). */
  days: number;
  /** Date d'échéance lisible (fr-FR). */
  dueDateLabel: string;
  level: DeadlineLevel;
  /** Texte court pour une pastille (« BEGES · 42 j »). */
  chipText: string;
  /** Libellé complet (infobulle, liste d'échéances). */
  title: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function describeBegesDeadline(
  resp: Pick<BegesFilingsResponse, "status" | "next_due_at" | "days_until_due"> | null | undefined,
  now: Date = new Date(),
): BegesDeadline | null {
  if (!resp?.next_due_at) return null;
  const due = new Date(resp.next_due_at);
  if (Number.isNaN(due.getTime())) return null;

  const days =
    typeof resp.days_until_due === "number" && Number.isFinite(resp.days_until_due)
      ? Math.round(resp.days_until_due)
      : Math.ceil((due.getTime() - now.getTime()) / DAY_MS);

  const level: DeadlineLevel =
    resp.status === "en_retard" || days < 0
      ? "alert"
      : resp.status === "echeance_proche"
        ? "warn"
        : "info";

  const dueDateLabel = due.toLocaleDateString("fr-FR");
  return {
    days,
    dueDateLabel,
    level,
    chipText: days < 0 ? "BEGES · échéance dépassée" : `BEGES · ${days} j`,
    title:
      days < 0
        ? `Renouvellement du bilan GES réglementaire : échéance dépassée depuis le ${dueDateLabel}`
        : `Renouvellement du bilan GES réglementaire : échéance le ${dueDateLabel}`,
  };
}
