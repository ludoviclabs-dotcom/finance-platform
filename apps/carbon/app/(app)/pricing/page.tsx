"use client";

import dynamic from "next/dynamic";

const PricingPage = dynamic(
  () => import("@/components/pages/pricing-page").then((m) => m.PricingPage),
  { ssr: false }
);

export default function Page() {
  return <PricingPage />;
}
