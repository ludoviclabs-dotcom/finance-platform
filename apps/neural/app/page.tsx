import "./homepage.css";

import { HeroUnified }          from "@/components/homepage/hero-unified";
import { SectionStats }         from "@/components/homepage/section-stats";
import { SectionProofConsole }  from "@/components/homepage/section-proof-console";
import { SectionAgentDemo }     from "@/components/homepage/section-agent-demo";
import { SectionProblem }       from "@/components/homepage/section-problem";
import { SectionOrchestration } from "@/components/homepage/section-orchestration";
import { SectionBranches }      from "@/components/homepage/section-branches";
import { SectionSectors }       from "@/components/homepage/section-sectors";
import { SectionMatrix }        from "@/components/homepage/section-matrix";
import { SectionPricing }       from "@/components/homepage/section-pricing";
// Sprint P0 — SectionTestimonials retirée du rendu tant qu'aucun témoignage
// client vérifiable n'est disponible (cf. docs/AI-ACT.md et PLAN.md §Incohérences).
// Le composant reste disponible dans components/homepage/ pour réactivation future.
import { SectionLiveData }      from "@/components/homepage/section-live-data";
import { SectionResources }     from "@/components/homepage/section-resources";
import { SectionCTA }           from "@/components/homepage/section-cta";

import { HeroV2 }                  from "@/components/homepage/v2/hero-v2";
import { SectionCoverageExplorer } from "@/components/homepage/v2/section-coverage-explorer";
import { isFeatureOn } from "@/lib/features";

export default function HomePage() {
  // Refonte V2 (PR 2) : feature flag `neuralV2` (off par défaut).
  // V1 = 13 sections — comportement de production jusqu'à PR 6.
  // V2 = 8 sections — fusionne Stats+ProofConsole en un Proof Snapshot,
  //      remplace Branches+Matrix par CoverageExplorer (unique, lu depuis
  //      agents-registry), retire Problem, Orchestration, Sectors, Resources
  //      (couvertes par CoverageExplorer et la nav V2).
  if (isFeatureOn("neuralV2")) {
    return (
      <div>
        <HeroV2 />
        <SectionStats />
        <SectionProofConsole />
        <SectionAgentDemo />
        <SectionCoverageExplorer />
        <SectionPricing />
        <SectionLiveData />
        <SectionCTA />
      </div>
    );
  }

  return (
    <div>
      <HeroUnified />
      <SectionStats />
      <SectionProofConsole />
      <SectionAgentDemo />
      <SectionProblem />
      <SectionOrchestration />
      <SectionBranches />
      <SectionSectors />
      <SectionMatrix />
      <SectionPricing />
      <SectionLiveData />
      <SectionResources />
      <SectionCTA />
    </div>
  );
}
