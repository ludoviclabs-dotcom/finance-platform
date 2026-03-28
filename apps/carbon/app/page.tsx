"use client";

import { useState, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import type { Page } from "@/lib/types";
import { LandingPage } from "@/components/pages/landing-page";
import { LoginScreen } from "@/components/pages/login-screen";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SkeletonCard, SkeletonChart, SkeletonRow } from "@/components/ui/skeleton";
import { KeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { OfflineBanner } from "@/components/ui/offline-banner";

// Lazy load heavy pages (Recharts bundles are large)
const DashboardPage = lazy(() =>
  import("@/components/pages/dashboard-page").then((m) => ({ default: m.DashboardPage }))
);
const ScopesPage = lazy(() =>
  import("@/components/pages/scopes-page").then((m) => ({ default: m.ScopesPage }))
);
const ESRSPage = lazy(() =>
  import("@/components/pages/esrs-page").then((m) => ({ default: m.ESRSPage }))
);
const CopilotPage = lazy(() =>
  import("@/components/pages/copilot-page").then((m) => ({ default: m.CopilotPage }))
);
const ReportsPage = lazy(() =>
  import("@/components/pages/reports-page").then((m) => ({ default: m.ReportsPage }))
);
const PricingPage = lazy(() =>
  import("@/components/pages/pricing-page").then((m) => ({ default: m.PricingPage }))
);

type AppScreen = "landing" | "login" | "app";

const pageConfig: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: "Tableau de bord", subtitle: "Vue d'ensemble ESG" },
  scopes: { title: "Scopes 1-2-3", subtitle: "Analyse GHG Protocol" },
  esrs: { title: "ESRS / CSRD", subtitle: "Conformité réglementaire" },
  copilot: { title: "Copilote IA", subtitle: "Assistant ESG intelligent" },
  reports: { title: "Rapports", subtitle: "Exports & documents" },
  pricing: { title: "Offres", subtitle: "Plans & tarification" },
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

export default function CarbonApp() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavigate = (page: string) => setCurrentPage(page as Page);

  if (screen === "landing") {
    return <LandingPage onEnterApp={() => setScreen("login")} />;
  }

  if (screen === "login") {
    return <LoginScreen onLogin={() => setScreen("app")} />;
  }

  const config = pageConfig[currentPage];

  return (
    <div id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <OfflineBanner />
      <KeyboardShortcuts onNavigate={handleNavigate} />
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className="transition-[margin] duration-300"
        style={{ marginLeft: sidebarCollapsed ? 72 : 256 }}
      >
        <Header title={config.title} subtitle={config.subtitle} />

        <main className="overflow-y-auto" style={{ height: "calc(100vh - 4rem)" }}>
          <Suspense fallback={<PageSkeleton />}>
            <AnimatePresence mode="wait">
              {currentPage === "dashboard" && <DashboardPage key="dashboard" />}
              {currentPage === "scopes" && <ScopesPage key="scopes" />}
              {currentPage === "esrs" && <ESRSPage key="esrs" />}
              {currentPage === "copilot" && <CopilotPage key="copilot" />}
              {currentPage === "reports" && <ReportsPage key="reports" />}
              {currentPage === "pricing" && <PricingPage key="pricing" />}
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
