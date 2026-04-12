"use client";

import dynamic from "next/dynamic";

const DashboardPage = dynamic(
  () => import("@/components/pages/dashboard-page").then((m) => m.DashboardPage),
  { ssr: false }
);

export default function Page() {
  return <DashboardPage />;
}
