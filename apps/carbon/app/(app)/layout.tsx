"use client";

/**
 * app/(app)/layout.tsx — groupe authentifié du dashboard général.
 *
 * Ce layout ne contient plus ni la garde d'authentification ni le chrome : la
 * première vit dans `AuthenticatedBoundary` (partagée avec le shell Water
 * dédié), le second dans `DashboardShell`. La séparation est ce qui a permis
 * de sortir `/water/cockpit` et `/water/decision` du dashboard sans réécrire
 * une seconde logique d'accès.
 */

import { AuthenticatedBoundary } from "@/components/layout/authenticated-boundary";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthenticatedBoundary>
      {({ auth, logout }) => (
        <DashboardShell auth={auth} logout={logout}>
          {children}
        </DashboardShell>
      )}
    </AuthenticatedBoundary>
  );
}
