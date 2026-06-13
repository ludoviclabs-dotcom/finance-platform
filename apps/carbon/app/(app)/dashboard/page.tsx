"use client";

import dynamic from "next/dynamic";

import { ChainBadge } from "@/components/ui/chain-badge";
import { QualityPanel } from "@/components/ui/quality-panel";
import { Scope3Panel } from "@/components/ui/scope3-panel";

const DashboardPage = dynamic(
  () => import("@/components/pages/dashboard-page").then((m) => m.DashboardPage),
  { ssr: false }
);

export default function Page() {
  return (
    <>
      <div className="px-6 pt-4 space-y-4">
        <ChainBadge />
        <QualityPanel />
        <Scope3Panel />
      </div>
      <DashboardPage />
    </>
  );
}
