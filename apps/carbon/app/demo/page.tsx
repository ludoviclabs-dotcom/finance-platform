"use client";

// Route /demo — page d'entrée de la démo cinématique Carbon&Co.
// Elle se contente de monter le composant racine DemoExperience, qui possède
// l'horloge de la timeline et orchestre toute la scène (non modifié).
import { DemoExperience } from "@/components/demo/demo-experience";
// Entrée publique additive vers le cockpit guidé /demo/asterion-motion —
// rendue en overlay, sans toucher au moteur cinématique.
import { GuidedDemoLink } from "@/components/demo/guided-demo-link";

export default function DemoPage() {
  return (
    <>
      <DemoExperience />
      <GuidedDemoLink />
    </>
  );
}
