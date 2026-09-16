/**
 * Normalisation de l'URL de base de l'API FastAPI (apps/api).
 *
 * La valeur de `NEXT_PUBLIC_API_BASE_URL` configurée en production se termine
 * par un retour à la ligne (« \n » collé avec la valeur). Concaténée telle
 * quelle, elle donne des URL du type `https://api…\n/health`, et un « / »
 * final produirait `…//health`. On retire donc les blancs de bord puis les
 * « / » finaux ; une valeur vide équivaut à une variable absente (`null`).
 *
 * Module sans dépendance : partagé par le client navigateur (lib/api.ts) et
 * par les Route Handlers serveur (cron quotidien).
 */
export function normalizeApiBaseUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
}
