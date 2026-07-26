"use client";

/**
 * AuthenticatedBoundary — garde d'authentification PARTAGÉE par toutes les
 * surfaces authentifiées.
 *
 * ## Pourquoi ce composant existe
 *
 * Jusqu'à la refonte des routes hydriques, il n'y avait qu'un seul groupe
 * authentifié (`app/(app)`), et sa garde vivait directement dans son layout.
 * `/water/cockpit` et `/water/decision` sortent désormais du dashboard général
 * et ont leur propre shell : deux layouts authentifiés coexistent.
 *
 * Recopier la garde dans le second aurait produit exactement le défaut que les
 * pages hydriques documentaient déjà en commentaire — « une garde locale
 * supplémentaire divergerait tôt ou tard de celle du groupe, et c'est la
 * divergence qui produit les pages accessibles par accident ». La garde est
 * donc extraite ici, une fois, et les deux shells la consomment.
 *
 * ## Ce que la garde rend structurellement impossible
 *
 * `children` est une FONCTION, pas un `ReactNode`. Elle n'est appelée qu'après
 * que la session a été hydratée ET reconnue authentifiée. Un shell ne peut
 * donc pas oublier son propre `if (!authenticated) return null` : il n'en a
 * pas besoin, et il n'a aucun moyen de rendre quoi que ce soit sans passer par
 * ici.
 *
 * Corollaire à respecter : **aucun hook dans le callback**. Il s'exécute
 * pendant le rendu de ce composant et de façon conditionnelle — un hook y
 * serait appelé de manière conditionnelle. Le chrome de chaque surface vit
 * dans son propre composant (`DashboardShell`, `WaterShell`), qui porte ses
 * hooks normalement.
 *
 * ## Un seul `useAuth()` par arbre
 *
 * `lib/hooks/auth-context.tsx` rappelle qu'il ne doit y avoir qu'un seul
 * `useAuth()` monté à la fois — deux cycles d'hydratation concurrents se
 * marchent dessus. C'est respecté : `(app)/layout.tsx` et le shell Water sont
 * des layouts FRÈRES, jamais imbriqués, donc jamais montés ensemble.
 *
 * Les contextes réellement transverses à toute surface authentifiée (état
 * d'auth en lecture seule, mode audit, dialogue de confirmation) et la
 * bannière hors-ligne sont posés ici, pas dans les shells : ils ne dépendent
 * d'aucun chrome et une surface qui les oublierait planterait à l'usage.
 */

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { OfflineBanner } from "@/components/ui/offline-banner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { AuthProvider } from "@/lib/hooks/auth-context";
import { AuditModeProvider } from "@/lib/hooks/use-audit-mode";
import { useAuth, type AuthState } from "@/lib/hooks/use-auth";

/** Session garantie authentifiée, telle que reçue par un shell. */
export interface AuthenticatedSession {
  auth: Extract<AuthState, { status: "authenticated" }>;
  logout: () => void;
}

export function AuthenticatedBoundary({
  children,
}: {
  children: (session: AuthenticatedSession) => ReactNode;
}) {
  const { auth, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";

  useEffect(() => {
    if (ready && auth.status !== "authenticated") {
      // Conserve la destination complète (chemin + query string) pour y
      // revenir après connexion — window.location.search est lu ici (effet
      // client-only) plutôt que useSearchParams() pour éviter d'exiger une
      // limite Suspense sur les layouts qui montent cette garde.
      const search = typeof window !== "undefined" ? window.location.search : "";
      const destination = `${pathname}${search}`;
      router.replace(`/login?next=${encodeURIComponent(destination)}`);
    }
  }, [ready, auth.status, pathname, router]);

  if (!ready || auth.status !== "authenticated") return null;

  return (
    <AuditModeProvider>
      <ConfirmDialogProvider>
        <AuthProvider value={auth}>
          <OfflineBanner />
          {children({ auth, logout })}
        </AuthProvider>
      </ConfirmDialogProvider>
    </AuditModeProvider>
  );
}
