import "./homepage.css";

import { HeroUnified }          from "@/components/homepage/hero-unified";
import { SectionStats }         from "@/components/homepage/section-stats";
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
import { SectionCTA }           from "@/components/homepage/section-cta";

export default function HomePage() {
  return (
    <div>
      <HeroUnified />
      <SectionStats />
      <SectionAgentDemo />
      <SectionProblem />
      <SectionOrchestration />
      <SectionBranches />
      <SectionSectors />
      <SectionMatrix />
      <SectionPricing />
      <SectionLiveData />
      <SectionCTA />
    </div>
  );
}
