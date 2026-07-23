"use client";

import dynamic from "next/dynamic";

const DashboardPage = dynamic(
  () => import("@/components/pages/dashboard-page").then((m) => m.DashboardPage),
  { ssr: false }
);

// ChainBadge / QualityPanel / Scope3Panel sont désormais rendus DANS
// DashboardPage, à leur place dans la séquence du cockpit (cf. maquette) :
// chaîne → EFRAG → trajectoire → scopes → analytics → preuve & qualité →
// ESRS → Scope 3 → NEURAL. Les remonter ici plaçait deux panneaux souvent
// vides (score audit, Scope 3 non évalué) AVANT la trajectoire net-zéro.
export default function Page() {
  return <DashboardPage />;
}
