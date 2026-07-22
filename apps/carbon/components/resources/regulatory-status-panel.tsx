/**
 * RegulatoryStatusPanel — statuts réglementaires VERSIONNÉS & non exclusifs
 * (Module 2, PR-M2C).
 *
 * Une ressource peut être critique CRMA ET dans le périmètre EUDR : on affiche
 * une LIGNE par régime, jamais deux booléens. Chaque ligne porte la référence
 * réglementaire (version), l'annexe/liste, le statut de listage, la certitude,
 * l'année de vérification, et l'indication « sourcé » — `confirmed` sans source
 * n'existe pas (garde backend). Aucune reformulation en note officielle UE.
 *
 * Purement présentationnel → testable au rendu serveur.
 */

import {
  CERTAINTY_LABEL,
  LISTING_STATUS_LABEL,
  REGIME_LABEL,
  type ResourceRegulatoryStatus,
} from "@/lib/api/resources";
import { EmptyNote } from "./section";

const CERTAINTY_TONE: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  probable: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  unresolved: "bg-[var(--color-muted)]/40 text-[var(--color-muted-foreground)] border-[var(--color-border)]",
};

function fmtYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "short" }).format(d);
}

export function RegulatoryStatusPanel({
  statuses,
}: {
  statuses: ResourceRegulatoryStatus[];
}) {
  if (statuses.length === 0) {
    return (
      <EmptyNote testId="regulations-empty">
        Aucun statut réglementaire renseigné pour cette ressource.
      </EmptyNote>
    );
  }
  return (
    <ul className="space-y-2" data-testid="regulatory-status">
      {statuses.map((s) => {
        const sourced = s.source_release_id != null;
        return (
          <li
            key={s.id}
            className="rounded-lg border border-[var(--color-border)] p-3"
            data-testid={`regulation-${s.regime}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--color-foreground)]">
                {REGIME_LABEL[s.regime]}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CERTAINTY_TONE[s.certainty]}`}
              >
                {CERTAINTY_LABEL[s.certainty]}
              </span>
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Statut
                </span>
                <p className="text-[var(--color-foreground)]">{LISTING_STATUS_LABEL[s.listing_status]}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Référence (version)
                </span>
                <p className="text-[var(--color-foreground)]">{s.regulation_ref ?? "—"}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Liste / annexe
                </span>
                <p className="text-[var(--color-foreground)]">{s.list_or_annex ?? "—"}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Vérifié (année)
                </span>
                <p className="text-[var(--color-foreground)]">{fmtYear(s.verified_on)}</p>
              </div>
            </div>

            {s.validity_note && (
              <p className="mt-1.5 text-xs text-[var(--color-foreground)]/80">{s.validity_note}</p>
            )}

            <p className="mt-1.5 text-[11px]">
              {sourced ? (
                <span className="text-emerald-600 dark:text-emerald-400" data-testid={`regulation-sourced-${s.regime}`}>
                  ● Sourcé (release #{s.source_release_id})
                </span>
              ) : (
                <span className="text-[var(--color-muted-foreground)]" data-testid={`regulation-unsourced-${s.regime}`}>
                  ○ Non sourcé — statut avoué, jamais présenté comme confirmé officiellement
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export default RegulatoryStatusPanel;
