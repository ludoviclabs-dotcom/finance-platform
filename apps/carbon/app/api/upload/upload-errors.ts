/**
 * Traduction des échecs de stockage Vercel Blob en messages présentables.
 *
 * Le détail technique (« Vercel Blob: No token found… », store suspendu…)
 * part dans les logs serveur, jamais dans la réponse envoyée au navigateur.
 * Module séparé de `route.ts`, qui ne peut exporter que les champs de route.
 */

import {
  BlobAccessError,
  BlobContentTypeNotAllowedError,
  BlobFileTooLargeError,
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
} from "@vercel/blob";

export const STORAGE_NOT_CONFIGURED_MESSAGE =
  "Le stockage des fichiers est indisponible pour le moment. Réessayez plus tard ou contactez le support.";

const STORAGE_BUSY_MESSAGE =
  "Service de stockage momentanément indisponible. Réessayez dans quelques instants.";

export function describeBlobUploadError(err: unknown): string {
  if (
    err instanceof BlobAccessError ||
    err instanceof BlobStoreNotFoundError ||
    err instanceof BlobStoreSuspendedError
  ) {
    return STORAGE_NOT_CONFIGURED_MESSAGE;
  }
  if (
    err instanceof BlobServiceNotAvailable ||
    err instanceof BlobServiceRateLimited ||
    err instanceof BlobRequestAbortedError
  ) {
    return STORAGE_BUSY_MESSAGE;
  }
  if (err instanceof BlobFileTooLargeError) {
    return "Fichier trop volumineux pour le stockage (10 Mo maximum).";
  }
  if (err instanceof BlobContentTypeNotAllowedError) {
    return "Type de fichier refusé par le stockage.";
  }
  // Jeton absent (« No token found ») et erreurs non typées : configuration
  // côté serveur, rien que l'utilisateur puisse corriger lui-même.
  if (err instanceof Error && /no token found/i.test(err.message)) {
    return STORAGE_NOT_CONFIGURED_MESSAGE;
  }
  return "Échec de l'enregistrement du fichier. Réessayez dans quelques instants.";
}
