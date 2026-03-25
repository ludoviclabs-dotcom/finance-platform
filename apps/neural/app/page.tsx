import { Hero } from "@/components/sections/hero";
import { StatsBanner } from "@/components/sections/stats-banner";
import { ProblemSolution } from "@/components/sections/problem-solution";
import { BranchesGrid } from "@/components/sections/branches-grid";
import { SectorsGrid } from "@/components/sections/sectors-grid";
import { SectorBranchMatrix } from "@/components/interactive/sector-branch-matrix";
import { PricingPreview } from "@/components/sections/pricing-preview";
import { Testimonials } from "@/components/sections/testimonials";
import { BlogPreview } from "@/components/sections/blog-preview";
import { FAQAccordion } from "@/components/sections/faq-accordion";
import { CTASection } from "@/components/sections/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBanner />
      <ProblemSolution />
      <BranchesGrid />
      <SectorsGrid />
      <SectorBranchMatrix />
      <PricingPreview />
      <Testimonials />
      <BlogPreview />
      <FAQAccordion />
      <CTASection />
    </>
  );
}
