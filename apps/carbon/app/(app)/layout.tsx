"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SkeletonCard, SkeletonChart, SkeletonRow } from "@/components/ui/skeleton";
import { KeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { useAuth } from "@/lib/hooks/use-auth";

const pageConfig: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":   { title: "Tableau de bord",  subtitle: "Vue d'ensemble ESG" },
  "/scopes":      { title: "Scopes 1-2-3",     subtitle: "Analyse GHG Protocol" },
  "/vsme":        { title: "VSME",             subtitle: "Standard volontaire PME — EFRAG" },
  "/esrs":        { title: "ESRS / CSRD",      subtitle: "Conformité réglementaire" },
  "/materialite": { title: "Double matérialité", subtitle: "Impacts × Risques × Opportunités" },
  "/social":      { title: "Social",           subtitle: "Effectifs, diversité, sécurité" },
  "/dpp":         { title: "DPP produits",     subtitle: "Digital Product Passport" },
  "/finance":     { title: "Finance / DPP",    subtitle: "SFDR, benchmark, taxonomie" },
  "/copilot":     { title: "Copilote IA",      subtitle: "Assistant ESG intelligent" },
  "/reports":     { title: "Rapports",         subtitle: "Exports & documents" },
  "/pricing":     { title: "Offres",           subtitle: "Plans & tarification" },
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { auth, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (ready && auth.status !== "authenticated") {
      router.replace("/login");
    }
  }, [ready, auth.status, router]);

  // Ferme le drawer mobile quand la route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!ready || auth.status !== "authenticated") return null;

  const config = pageConfig[pathname] ?? { title: "CarbonCo", subtitle: "" };
  const desktopMargin = sidebarCollapsed ? 72 : 256;

  return (
    <div id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <OfflineBanner />
      <KeyboardShortcuts />
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
          userEmail={auth.status === "authenticated" ? auth.email : undefined}
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
