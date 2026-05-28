import type { Metadata } from "next";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Connexion — CarbonCo",
  description:
    "Connectez-vous à votre espace CarbonCo pour piloter votre conformité ESG et CSRD.",
  alternates: { canonical: "https://carbonco.fr/login" },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginClient />;
}
