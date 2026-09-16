"use client";

/**
 * LoginClient — composant client gérant la logique d'authentification.
 *
 * Découpé du `page.tsx` (server component) pour permettre la déclaration des
 * metadata SEO côté serveur. Le `<LoginScreen>` est toujours rendu côté SSR :
 * plus de page blanche pendant l'hydratation du provider auth.
 *
 * `safeNext` est reçu en prop, déjà validé côté serveur par `page.tsx`
 * (getSafeInternalRedirect) — ce composant n'appelle JAMAIS useSearchParams()
 * lui-même : ce hook opterait son sous-arbre en rendu client (CSR bailout)
 * et exigerait une limite Suspense renvoyant un fallback vide dans le HTML
 * initial, ce qui casserait le rendu SSR du formulaire de connexion.
 *
 * Session de démonstration active (cookie cc_demo_session) : AUCUNE
 * redirection automatique. Rediriger vers `safeNext` (/dashboard par défaut)
 * renvoyait sur /demo via le proxy — boucle sans issue (M-16). On affiche à la
 * place un bandeau « Quitter la démo » qui efface le cookie côté serveur, puis
 * le formulaire de connexion habituel.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/pages/login-screen";
import { useAuth } from "@/lib/hooks/use-auth";
import { useDemoAccess } from "@/lib/hooks/use-demo-access";

const RESOURCES_DEMO_CONTEXT = {
  title: "Accéder aux Ressources stratégiques",
  description:
    "Ce cockpit utilise les données de votre organisation. Vous pouvez vous connecter ou ouvrir l'environnement fictif Asterion.",
  demoLabel: "Ouvrir le cockpit de démonstration",
};

interface LoginClientProps {
  safeNext: string;
}

export function LoginClient({ safeNext }: LoginClientProps) {
  const { auth, ready, login, loginDemo, exitDemo, verifyTotp } = useAuth();
  const { loading: demoLoading, error: demoError, enterDemo } = useDemoAccess(auth, loginDemo);
  const router = useRouter();
  const [exitingDemo, setExitingDemo] = useState(false);
  const [exitDemoError, setExitDemoError] = useState<string | null>(null);

  const demoContext = safeNext.startsWith("/resources") ? RESOURCES_DEMO_CONTEXT : null;
  const inDemoSession = ready && auth.status === "authenticated" && auth.isDemo;

  useEffect(() => {
    if (ready && auth.status === "authenticated" && !auth.isDemo) {
      router.replace(safeNext);
    }
  }, [ready, auth, router, safeNext]);

  const handleExitDemo = async () => {
    setExitingDemo(true);
    setExitDemoError(null);
    const result = await exitDemo();
    setExitingDemo(false);
    if (!result.ok) {
      setExitDemoError("error" in result ? result.error : "Impossible de quitter la démonstration.");
    }
  };

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
        // Session démo sécurisée : aucun identifiant ni JWT en clair dans le
        // bundle. Le Route Handler same-origin pose un cookie HttpOnly puis
        // ouvre uniquement la surface publique `/demo`.
        void enterDemo("/demo");
      }}
      demoLoading={demoLoading}
      demoError={demoError}
      demoContext={demoContext}
      demoSession={
        inDemoSession
          ? {
              onExit: () => void handleExitDemo(),
              onResume: () => router.push("/demo"),
              exiting: exitingDemo,
              error: exitDemoError,
            }
          : null
      }
    />
  );
}
