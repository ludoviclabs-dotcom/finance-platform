"use client";

import dynamic from "next/dynamic";

const ESRSPage = dynamic(
  () => import("@/components/pages/esrs-page").then((m) => m.ESRSPage),
  { ssr: false }
);

export default function Page() {
  return <ESRSPage />;
}
