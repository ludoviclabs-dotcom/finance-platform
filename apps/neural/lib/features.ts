/**
 * Feature flags publics — contrôlés via env NEXT_PUBLIC_FEATURE_*
 *
 * Défaut = false (sûr : on masque par défaut tant que la preuve n'est pas là).
 *
 * Usage côté page :
 *   import { isFeatureOn } from "@/lib/features";
 *   import { notFound } from "next/navigation";
 *   export default function Page() {
 *     if (!isFeatureOn("marketplace")) notFound();
 *     // ...
 *   }
 *
 * Activation en local :
 *   NEXT_PUBLIC_FEATURE_MARKETPLACE=1 pnpm --filter neural dev
 */
export type FeatureFlag =
  | "marketplace"
  | "forfaits"
  | "resources"
  | "rhLuxe"
  | "neuralV2";

const readFlag = (key: string): boolean =>
  process.env[key] === "1" || process.env[key] === "true";

export const features: Record<FeatureFlag, boolean> = {
  marketplace: readFlag("NEXT_PUBLIC_FEATURE_MARKETPLACE"),
  forfaits:    readFlag("NEXT_PUBLIC_FEATURE_FORFAITS"),
  resources:   readFlag("NEXT_PUBLIC_FEATURE_RESOURCES"),
  rhLuxe:      readFlag("NEXT_PUBLIC_FEATURE_RH_LUXE"),
  // PR 1 refonte V2 : bascule navbar/footer V1 → V2 et homepage refondue.
  // Reste off par défaut tout au long des PR 1-5 pour rollback express ;
  // activé par défaut en PR 6 (retrait du flag).
  neuralV2:    readFlag("NEXT_PUBLIC_NEURAL_V2"),
};

export const isFeatureOn = (flag: FeatureFlag): boolean => features[flag];
