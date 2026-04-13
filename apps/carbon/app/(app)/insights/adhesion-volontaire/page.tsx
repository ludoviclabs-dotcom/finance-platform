"use client";

import dynamic from "next/dynamic";

const AdhesionVolontairePage = dynamic(
  () =>
    import("@/components/pages/adhesion-volontaire-page").then(
      (m) => m.AdhesionVolontairePage
    ),
  { ssr: false }
);

export default function Page() {
  return <AdhesionVolontairePage />;
}
