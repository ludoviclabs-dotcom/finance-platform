import { notFound } from "next/navigation";

import { isFeatureOn } from "@/lib/features";

/**
 * Gate serveur pour /secteurs/luxe/rh.
 *
 * Sprint P0 (19 avril 2026) — la section RH Luxe tombe sous l'AI Act Annexe III § 4
 * (recrutement, évaluation, promotion, répartition de tâches). Elle est masquée
 * publiquement tant que la conformité n'est pas documentée.
 *
 * Réactivation : NEXT_PUBLIC_FEATURE_RH_LUXE=1 + contenu de docs/AI-ACT.md à jour.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  if (!isFeatureOn("rhLuxe")) notFound();
  return <>{children}</>;
}
