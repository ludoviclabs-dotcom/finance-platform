/**
 * safe-redirect.ts — validation anti-open-redirect pour la destination `next`.
 *
 * Ne jamais faire confiance directement à `searchParams.next` : il est
 * contrôlé par quiconque compose l'URL de /login. `getSafeInternalRedirect`
 * n'autorise qu'un chemin interne (un seul "/" en tête) et retombe sur
 * `fallback` pour tout le reste (URL absolue, protocol-relative, schéma).
 */

const SAFE_BASE_ORIGIN = "http://internal.invalid";

export function getSafeInternalRedirect(
  value: string | null | undefined,
  fallback: string,
): string {
  if (typeof value !== "string" || value.length === 0) return fallback;

  // Filtre de premier niveau : uniquement un chemin absolu simple. Élimine
  // trivialement tout schéma ("javascript:", "https:"...) et tout
  // protocol-relative ("//evil.example") avant même de parser.
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  let parsed: URL;
  try {
    // Résolu contre une origine factice fixe : le parseur WHATWG normalise
    // lui-même les pièges usuels (backslash traité comme "/", tabs/retours à
    // la ligne retirés) — si la valeur parvient malgré tout à détourner
    // l'hôte ou le schéma, `parsed.origin` divergera de SAFE_BASE_ORIGIN.
    parsed = new URL(value, SAFE_BASE_ORIGIN);
  } catch {
    return fallback;
  }

  if (parsed.origin !== SAFE_BASE_ORIGIN || parsed.protocol !== "http:") {
    return fallback;
  }

  const rebuilt = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!rebuilt.startsWith("/") || rebuilt.startsWith("//")) return fallback;

  return rebuilt;
}
