"use client";

/**
 * LoginClient — composant client gérant la logique d'authentification.
 *
 * Découpé du `page.tsx` (server component) pour permettre la déclaration des
 * metadata SEO côté serveur. Le `<LoginScreen>` est toujours rendu côté SSR :
 * plus de page blanche pendant l'hydratation du provider auth.
 *
 * Destination `next` : si l'utilisateur arrivait sur une route protégée
 * (ex. /resources) sans session, la garde `(app)/layout.tsx` l'a envoyé ici
 * avec `?next=<chemin encodé>`. On y revient après connexion — jamais de
 * confiance directe dans la valeur brute (getSafeInternalRedirect).
 */

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginScreen } from "@/components/pages/login-screen";
import { useAuth } from "@/lib/hooks/use-auth";
import { useDemoAccess } from "@/lib/hooks/use-demo-access";
import { getSafeInternalRedirect } from "@/lib/auth/safe-redirect";

const RESOURCES_DEMO_CONTEXT = {
  title: "Accéder aux Ressources stratégiques",
  description:
    "Ce cockpit utilise les données de votre organisation. Vous pouvez vous connecter ou ouvrir l'environnement fictif Asterion.",
  demoLabel: "Ouvrir le cockpit de démonstration",
};

export function LoginClient() {
  const { auth, ready, login, loginDemo, verifyTotp } = useAuth();
  const { loading: demoLoading, error: demoError, enterDemo } = useDemoAccess(auth, loginDemo);
  const router = useRouter();
  const searchParams = useSearchParams();

  const safeNext = useMemo(
    () => getSafeInternalRedirect(searchParams.get("next"), "/dashboard"),
    [searchParams],
  );
  const demoContext = safeNext.startsWith("/resources") ? RESOURCES_DEMO_CONTEXT : null;

  useEffect(() => {
    if (ready && auth.status === "authenticated") {
      router.replace(safeNext);
    }
  }, [ready, auth.status, router, safeNext]);

  return (
    <LoginScreen
      onLogin={async (email, password) => {
        const result = await login(email, password);
        if (result.ok) router.replace(safeNext);
        return result;
      }}
      onVerifyTotp={async (preAuthToken, code) => {
        const result = await verifyTotp(preAuthToken, code);
        if (result.ok) router.replace(safeNext);
        return result;
      }}
      onDemo={() => {
        // Session démo sécurisée : aucun identifiant en clair dans le bundle.
        // Le backend (POST /auth/demo) provisionne le tenant Asterion et émet
        // un JWT court sans refresh cookie (auto-expiration). enterDemo gère
        // loading/erreur et navigue vers `safeNext` (strict : jamais de faux
        // succès si l'appel échoue).
        void enterDemo(safeNext);
      }}
      demoLoading={demoLoading}
      demoError={demoError}
      demoContext={demoContext}
    />
  );
}
