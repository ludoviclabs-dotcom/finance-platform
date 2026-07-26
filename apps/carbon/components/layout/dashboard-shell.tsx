"use client";

/**
 * DashboardShell — chrome du dashboard général (barre latérale, en-tête,
 * raccourcis clavier, tour d'accueil).
 *
 * Extrait de `app/(app)/layout.tsx` lors de la sortie des surfaces hydriques
 * du dashboard général : le layout ne garde plus que le montage de la garde
 * (`AuthenticatedBoundary`) et le choix du chrome. La garde et le chrome
 * étaient jusque-là mêlés dans un seul composant, ce qui rendait impossible de
 * réutiliser la première sans emporter le second.
 *
 * Ce composant n'est monté que par la garde, donc uniquement sur une session
 * authentifiée : il reçoit `auth` déjà réduit au cas `authenticated` et n'a
 * aucune décision d'accès à prendre.
 *
 * `KeyboardShortcuts` et `OnboardingTour` restent ici et NON dans la garde :
 * les raccourcis ⌘1 à ⌘6 pointent vers des routes du dashboard, et le tour
 * d'accueil décrit ce dashboard. Les poser sur toute surface authentifiée
 * promettrait une navigation que la surface n'a pas.
 */

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { KeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { OnboardingTour } from "@/components/ui/onboarding-tour";
import { SkeletonCard, SkeletonChart, SkeletonRow } from "@/components/ui/skeleton";
import type { AuthenticatedSession } from "@/components/layout/authenticated-boundary";

/*
  Les entrées `/water` et `/water/decision` ont quitté cette table : les deux
  cockpits hydriques vivent désormais sous le shell Water dédié, qui porte ses
  propres titres. Les laisser ici aurait maintenu deux sources de vérité pour
  un même en-tête.
*/
const pageConfig: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":   { title: "Tableau de bord",  subtitle: "Vue d'ensemble ESG" },
  "/scopes":      { title: "Scopes 1-2-3",     subtitle: "Analyse GHG Protocol" },
  "/vsme":        { title: "VSME",             subtitle: "Standard volontaire PME — EFRAG" },
  "/vsme/completude": { title: "Complétude VSME", subtitle: "Mapping & datapoints EFRAG" },
  "/vsme/wizard": { title: "VSME — Wizard",     subtitle: "Parcours en 10 étapes" },
  "/beges":       { title: "BEGES",             subtitle: "Bilan GES réglementaire France (v5)" },
  "/fec":         { title: "Import FEC",         subtitle: "Screening Scope 3 monétaire" },
  "/consolidation": { title: "Périmètre & groupe", subtitle: "Consolidation multi-entités" },
  "/baselines":   { title: "Année de référence",  subtitle: "Baseline & recalcul" },
  "/actions":     { title: "Leviers de réduction", subtitle: "MACC & plan de transition" },
  "/imports":     { title: "Imports fichiers",    subtitle: "AWS · GCP · Qonto" },
  "/diff":        { title: "Multi-exercices",     subtitle: "Diff & réponses questionnaires" },
  "/esrs":        { title: "ESRS / CSRD",      subtitle: "Conformité réglementaire" },
  "/materialite": { title: "Double matérialité", subtitle: "Impacts × Risques × Opportunités" },
  "/proof-twin":  { title: "ProofTwin",         subtitle: "Chaîne de preuve carbone vérifiable" },
  "/datapoints":  { title: "Datapoints CSRD",   subtitle: "Extraction LLM-RAG · ESRS Set 2" },
  "/revue":       { title: "Inbox de validation", subtitle: "Workflow proposé → validé → figé" },
  "/qc":          { title: "Contrôles qualité", subtitle: "Intégrité + drill-down" },
  "/social":      { title: "Social",           subtitle: "Effectifs, diversité, sécurité" },
  "/dpp":         { title: "DPP produits",     subtitle: "Digital Product Passport" },
  "/finance":     { title: "Finance / DPP",    subtitle: "SFDR, benchmark, taxonomie" },
  "/copilot":     { title: "Copilote IA",      subtitle: "Assistant ESG intelligent" },
  "/reports":     { title: "Rapports",         subtitle: "Exports & documents" },
  "/pricing":     { title: "Offres",           subtitle: "Plans & tarification" },
  "/securite":    { title: "Sécurité",         subtitle: "Double authentification (2FA)" },
  "/crma":        { title: "Matières critiques", subtitle: "CRMA · aimants permanents · Article 24" },
  "/nature":      { title: "Nature & biodiversité", subtitle: "TNFD LEAP · risques & opportunités" },
  "/iro":         { title: "Registre IRO", subtitle: "Impacts, risques, opportunités · double matérialité" },
  "/resources":   { title: "Ressources stratégiques", subtitle: "Dépendances industrielles · concentration · risque ≠ confiance" },
  "/resources/exposures":   { title: "Expositions ressources", subtitle: "Ponts achats · énergie · eau · nomenclature" },
  "/resources/assessments": { title: "Assessments ressources", subtitle: "Runs immuables · CarbonCo Resource Exposure Score" },
  "/resources/methodology": { title: "Méthodologie ressources", subtitle: "CC-RESOURCE-EXPOSURE · méthode CarbonCo non officielle" },
};

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonChart height={280} />
        <SkeletonChart height={280} />
      </div>
      <div className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}

export function DashboardShell({
  auth,
  logout,
  children,
}: AuthenticatedSession & { children: ReactNode }) {
  const pathname = usePathname() ?? "/dashboard";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ferme le drawer mobile quand la route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const config = pageConfig[pathname] ?? { title: "CarbonCo", subtitle: "" };
  const desktopMargin = sidebarCollapsed ? 72 : 256;

  return (
    <div id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <KeyboardShortcuts />
      <OnboardingTour />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={logout}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className="transition-[margin] duration-300 lg:[margin-left:var(--sidebar-w)]"
        style={{ ["--sidebar-w" as string]: `${desktopMargin}px` }}
      >
        <Header
          title={config.title}
          subtitle={config.subtitle}
          onLogout={logout}
          userEmail={auth.email}
          demoHint={undefined}
          onMobileMenuClick={() => setMobileOpen(true)}
        />

        <main className="overflow-y-auto" style={{ height: "calc(100vh - 4rem)" }}>
          <Suspense fallback={<PageSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
