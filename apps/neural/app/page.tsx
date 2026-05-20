import "./homepage.css";

import { Hero }                    from "@/components/homepage/hero";
import { SectionStats }            from "@/components/homepage/section-stats";
import { SectionProofConsole }     from "@/components/homepage/section-proof-console";
import { SectionAgentDemo }        from "@/components/homepage/section-agent-demo";
import { SectionCoverageExplorer } from "@/components/homepage/section-coverage-explorer";
import { SectionPricing }          from "@/components/homepage/section-pricing";
import { SectionLiveData }         from "@/components/homepage/section-live-data";
import { SectionCTA }              from "@/components/homepage/section-cta";

export default function HomePage() {
  return (
    <div>
      <Hero />
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
