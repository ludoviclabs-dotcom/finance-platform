"use client";

import dynamic from "next/dynamic";

const ReportsPage = dynamic(
  () => import("@/components/pages/reports-page").then((m) => m.ReportsPage),
  { ssr: false }
);

export default function Page() {
  return <ReportsPage />;
}
