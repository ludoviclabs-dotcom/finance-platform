"use client";

/**
 * app/water/(authenticated)/layout.tsx — shell authentifié du domaine
 * hydrique.
 *
 * ## Pourquoi un groupe de routes plutôt qu'un dossier
 *
 * `(authenticated)` est un groupe : il n'apparaît pas dans l'URL. Les deux
 * pages qu'il contient répondent donc sur `/water/cockpit` et
 * `/water/decision`, tandis que `app/water/page.tsx`, son VOISIN et non son
 * enfant, sert la vitrine publique `/water` sans passer par ce layout.
 *
 * C'est la seule disposition qui laisse une même racine d'URL porter une
 * surface publique et deux surfaces authentifiées sans qu'aucun layout
 * n'enveloppe l'autre.
 *
 * ## L'authentification n'est pas réécrite ici
 *
 * `AuthenticatedBoundary` est la garde du groupe `(app)`, extraite et
 * partagée. Ce layout ne décide de rien en matière d'accès : il choisit un
 * chrome, et c'est tout. Aucune règle de session, aucune redirection, aucun
 * seuil ne sont dupliqués.
 */

import { AuthenticatedBoundary } from "@/components/layout/authenticated-boundary";

import { WaterShell } from "./water-shell";

export default function WaterAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedBoundary>
      {({ auth, logout }) => (
        <WaterShell auth={auth} logout={logout}>
          {children}
        </WaterShell>
      )}
    </AuthenticatedBoundary>
  );
}
