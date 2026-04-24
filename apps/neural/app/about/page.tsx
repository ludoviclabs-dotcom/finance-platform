import type { Metadata } from "next";

import { AboutContent } from "@/components/about/about-content";

import "./about.css";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "NEURAL est un framework multi-secteurs pour agents métier. Manifeste, trajectoire, console de preuves et périmètre — sans extrapoler au-delà du visible.",
};

export default function AboutPage() {
  return <AboutContent />;
}
