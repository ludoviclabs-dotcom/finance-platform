"use client";

import { useRouter } from "next/navigation";
import { LandingPage, type MaterialsStats } from "@/components/pages/landing-page";

/**
 * Enveloppe client de la homepage. La page serveur (app/page.tsx) charge les
 * chiffres réels du module Matières critiques et le compte de datapoints du
 * référentiel ESRS au build, et les passe ici — seuls quelques nombres
 * traversent la frontière serveur→client, jamais les datasets.
 */
export function HomeClient({
  materialsStats,
  esrsDatapointCount,
}: {
  materialsStats: MaterialsStats;
  esrsDatapointCount: number;
}) {
  const router = useRouter();
  return (
    <LandingPage
      onEnterApp={() => router.push("/login")}
      materialsStats={materialsStats}
      esrsDatapointCount={esrsDatapointCount}
    />
  );
}
