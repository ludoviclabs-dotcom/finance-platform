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
  const { auth, ready, login, loginDemo, verifyTotp } = useAuth();
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
        // Session démo sécurisée : aucun identifiant en clair dans le bundle.
        // Le backend (POST /auth/demo) provisionne le tenant Asterion et émet
        // un JWT court sans refresh cookie (auto-expiration).
        const result = await loginDemo();
        if (result.ok) router.replace("/dashboard");
      }}
    />
  );
}
