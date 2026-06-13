"use client";

import dynamic from "next/dynamic";

import { ChainBadge } from "@/components/ui/chain-badge";

const DashboardPage = dynamic(
  () => import("@/components/pages/dashboard-page").then((m) => m.DashboardPage),
  { ssr: false }
);

export default function Page() {
  return (
    <>
      <div className="px-6 pt-4">
        <ChainBadge />
      </div>
      <DashboardPage />
    </>
  );
}
