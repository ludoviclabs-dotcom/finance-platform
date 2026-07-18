/**
 * StalenessWarning — signale une release potentiellement périmée (PR-04).
 *
 * `isStale` est DÉRIVÉ côté serveur (freshness_service, seuil STALE_AFTER_DAYS)
 * ou côté client — jamais un statut backend. Rendu discret quand la donnée est
 * fraîche, visible quand elle est ancienne.
 */

interface Props {
  isStale: boolean;
  ageDays: number | null;
  lastReleaseAt?: string | null;
  className?: string;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

export function StalenessWarning({ isStale, ageDays, lastReleaseAt, className = "" }: Props) {
  const formatted = formatDate(lastReleaseAt);
  const ageLabel = ageDays == null ? "aucune release" : `il y a ${ageDays} j`;

  if (isStale) {
    return (
      <div
        className={`rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300 ${className}`}
        role="status"
        data-testid="staleness-warning-stale"
      >
        <span className="font-semibold">Snapshot potentiellement périmé</span> — dernière release{" "}
        {formatted ? `du ${formatted}` : "inconnue"} ({ageLabel}). La valeur peut ne plus refléter la réalité.
      </div>
    );
  }

  return (
    <span className={`text-[11px] text-zinc-500 ${className}`} data-testid="staleness-warning-fresh">
      Dernière release {formatted ? `du ${formatted}` : "—"} ({ageLabel}).
    </span>
  );
}

export default StalenessWarning;
