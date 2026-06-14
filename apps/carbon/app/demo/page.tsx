"use client";

// Route /demo — page d'entrée de la démo cinématique Carbon&Co.
// Elle se contente de monter le composant racine DemoExperience, qui possède
// l'horloge de la timeline et orchestre toute la scène.
import { DemoExperience } from "@/components/demo/demo-experience";

export default function DemoPage() {
  return <DemoExperience />;
}
