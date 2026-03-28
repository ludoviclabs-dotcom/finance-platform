"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { SplashScreen } from "@/components/splash/splash-screen";
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
  const [showSplash, setShowSplash] = useState(true);

  const handleEnter = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && <SplashScreen key="splash" onEnter={handleEnter} />}
      </AnimatePresence>

      <div
        style={{
          // Prevent scroll while splash is visible
          overflow: showSplash ? "hidden" : undefined,
          height: showSplash ? "100vh" : undefined,
        }}
      >
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
      </div>
    </>
  );
}
