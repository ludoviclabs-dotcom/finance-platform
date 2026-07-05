"use client";

import { useRouter } from "next/navigation";
import { LandingPage, type MaterialsStats } from "@/components/pages/landing-page";

/**
 * Enveloppe client de la homepage. La page serveur (app/page.tsx) charge les
 * chiffres réels du module Matières critiques au build et les passe ici —
 * seuls 4 nombres traversent la frontière serveur→client, jamais le dataset.
 */
export function HomeClient({ materialsStats }: { materialsStats: MaterialsStats }) {
  const router = useRouter();
  return <LandingPage onEnterApp={() => router.push("/login")} materialsStats={materialsStats} />;
}
