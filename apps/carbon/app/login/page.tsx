import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Connexion — CarbonCo",
  description:
    "Connectez-vous à votre espace CarbonCo pour piloter votre conformité ESG et CSRD.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  // useSearchParams() (lecture de `next`) exige une limite Suspense — sans
  // fallback visuel : le formulaire est déjà rendu SSR, seule la lecture du
  // paramètre next est différée de quelques millisecondes à l'hydratation.
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
