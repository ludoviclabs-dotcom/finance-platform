"use client";

import dynamic from "next/dynamic";

const CopilotPage = dynamic(
  () => import("@/components/pages/copilot-page").then((m) => m.CopilotPage),
  { ssr: false }
);

export default function Page() {
  return <CopilotPage />;
}
