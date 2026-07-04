/**
 * URL canonique du site et email de contact (T0.6 du PLAN_ACTION_CARBONCO).
 *
 * La prod vit aujourd'hui sur *.vercel.app (aucun domaine personnalisé acheté —
 * décision D3). On résout l'URL depuis l'environnement pour rester indépendant
 * de cette décision : définir NEXT_PUBLIC_SITE_URL sur Vercel.
 */

/** URL de base du site, sans slash final. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  // Repli : déploiement réel actuel (tant que D3 n'est pas actée).
  return "https://carbon-snowy-nine.vercel.app";
}

/** Email de contact public (projet non commercialisé — D2). */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ludoviclabs@gmail.com";
