"use client";

import dynamic from "next/dynamic";

const DatapointsPage = dynamic(
  () => import("@/components/pages/datapoints-page").then((m) => m.DatapointsPage),
  { ssr: false },
);

export default function Page() {
  return <DatapointsPage />;
}
