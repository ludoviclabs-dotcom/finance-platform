"use client";

import dynamic from "next/dynamic";

import { ChainBadge } from "@/components/ui/chain-badge";
import { QualityPanel } from "@/components/ui/quality-panel";

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
      </div>
      <DashboardPage />
    </>
  );
}
