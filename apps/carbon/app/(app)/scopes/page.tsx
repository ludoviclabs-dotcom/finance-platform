"use client";

import dynamic from "next/dynamic";

const ScopesPage = dynamic(
  () => import("@/components/pages/scopes-page").then((m) => m.ScopesPage),
  { ssr: false }
);

export default function Page() {
  return <ScopesPage />;
}
