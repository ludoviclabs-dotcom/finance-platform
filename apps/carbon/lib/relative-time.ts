/**
 * Horodatage relatif en français (« il y a 5 min », « hier »…) pour les flux
 * d'activité et de notifications. `null` si la date est illisible — jamais
 * « Invalid Date ».
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTimeFr(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE_MS) return "à l'instant";
  if (elapsed < HOUR_MS) return `il y a ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `il y a ${Math.floor(elapsed / HOUR_MS)} h`;
  if (elapsed < 2 * DAY_MS) return "hier";
  if (elapsed < 7 * DAY_MS) return `il y a ${Math.floor(elapsed / DAY_MS)} j`;
  return date.toLocaleDateString("fr-FR");
}
