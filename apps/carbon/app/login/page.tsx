import type { Metadata } from "next";
import { LoginClient } from "./login-client";
import { getSafeInternalRedirect } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Connexion — CarbonCo",
  description:
    "Connectez-vous à votre espace CarbonCo pour piloter votre conformité ESG et CSRD.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

/**
 * `next` est lu et validé ICI, côté Server Component — jamais via
 * useSearchParams() dans LoginClient. useSearchParams() opterait tout le
 * sous-arbre client en rendu différé (CSR bailout) : sous Suspense, la
 * limite renvoie son fallback dans le HTML initial jusqu'à l'hydratation,
 * ce qui aurait envoyé une page /login VIDE (fallback={null}) tant que le
 * JS n'a pas chargé — contraire au contrat SSR historique de cette page.
 * En lisant `searchParams` ici (Server Component, aucun Client Boundary),
 * le formulaire complet fait partie du premier rendu, sans limite Suspense.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  // Un `next` répété dans l'URL (?next=a&next=b) arrive en tableau — on ne
  // fait jamais confiance à une forme ambiguë, seule une chaîne est acceptée.
  const rawNext = typeof params.next === "string" ? params.next : null;
  const safeNext = getSafeInternalRedirect(rawNext, "/dashboard");

  return <LoginClient safeNext={safeNext} />;
}
