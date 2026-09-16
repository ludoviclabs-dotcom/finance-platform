/**
 * Outils du tick cron quotidien (hors `route.ts`, qui ne doit exporter que les
 * champs reconnus par Next : GET, runtime, dynamic…).
 */

import { createHash, timingSafeEqual } from "node:crypto";

import { normalizeApiBaseUrl } from "@/lib/api-base-url";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Contrôle d'accès du cron, calqué sur le modèle officiel Vercel :
 * `if (!cronSecret || authHeader !== \`Bearer ${cronSecret}\`) → 401`.
 *
 * - Sans CRON_SECRET (ou secret vide), TOUT appel est refusé : il n'existe
 *   plus de repli sur l'en-tête `x-vercel-cron`, qu'un client quelconque peut
 *   poser lui-même.
 * - Comparaison à temps constant : les deux valeurs sont d'abord hachées
 *   (SHA-256), ce qui donne deux tampons de même longueur pour
 *   `timingSafeEqual` sans révéler la longueur du secret.
 * - Le secret est débarrassé de ses blancs de bord (valeur collée avec un
 *   « \n ») ; l'API Headers retire déjà ceux de l'en-tête reçu.
 */
export function isAuthorizedCronRequest(
  authHeader: string | null,
  cronSecret: string | undefined,
): boolean {
  const secret = cronSecret?.trim();
  if (!secret || !authHeader) return false;
  return timingSafeEqual(digest(authHeader), digest(`Bearer ${secret}`));
}

/**
 * URL de l'API pour les appels serveur du cron : `NEXT_PUBLIC_API_BASE_URL`
 * (variable réellement configurée en production) puis `API_BASE_URL`,
 * normalisées (blancs et « / » finaux retirés). `null` si aucune n'est définie.
 */
export function resolveCronApiBaseUrl(env: {
  NEXT_PUBLIC_API_BASE_URL?: string;
  API_BASE_URL?: string;
}): string | null {
  return normalizeApiBaseUrl(env.NEXT_PUBLIC_API_BASE_URL) ?? normalizeApiBaseUrl(env.API_BASE_URL);
}
