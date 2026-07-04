"use client";

/**
 * LoginClient — composant client gérant la logique d'authentification.
 *
 * Découpé du `page.tsx` (server component) pour permettre la déclaration des
 * metadata SEO côté serveur. Le `<LoginScreen>` est toujours rendu côté SSR :
 * plus de page blanche pendant l'hydratation du provider auth. Si l'utilisateur
 * est déjà authentifié, on redirige vers /dashboard via useEffect après
 * hydratation.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/pages/login-screen";
import { useAuth } from "@/lib/hooks/use-auth";

export function LoginClient() {
  const { auth, ready, login, verifyTotp } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && auth.status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [ready, auth.status, router]);

  return (
    <LoginScreen
      onLogin={async (email, password) => {
        const result = await login(email, password);
        if (result.ok) router.replace("/dashboard");
        return result;
      }}
      onVerifyTotp={async (preAuthToken, code) => {
        const result = await verifyTotp(preAuthToken, code);
        if (result.ok) router.replace("/dashboard");
        return result;
      }}
      onDemo={async () => {
        const result = await login("demo@carbonco.fr", "CarbonCo2024!");
        if (result.ok) router.replace("/dashboard");
        // Les identifiants démo existent dès que l'API a seedé les users (premier login).
        // Si l'erreur persiste, voir /login — les identifiants sont créés automatiquement.
      }}
    />
  );
}
