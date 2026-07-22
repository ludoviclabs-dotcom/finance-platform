"use client";

/**
 * ResourcesDemoClient — monte le shell de démonstration paramétré sur le parcours
 * « Dépendances industrielles étendues » (MODULE 2, PR-M2D). Séquence SŒUR : le
 * tour Asterion Motion existant reste intact (`/demo/asterion-motion`).
 *
 * `renderStepBody` étant une fonction, ce wrapper doit rester côté client
 * (la page serveur ne peut pas passer de prop fonction à un composant client).
 */

import { DemoShell } from "../demo-shell";
import { ASTERION_RESOURCES_TOUR } from "@/lib/demo/asterion-resources-tour";
import { renderResourceBeat } from "./resource-beat";

export function ResourcesDemoClient() {
  return (
    <DemoShell
      tour={ASTERION_RESOURCES_TOUR}
      renderStepBody={renderResourceBeat}
      testId="demo-asterion-resources"
      eyebrow="CarbonCo · Module 2 · Démonstration"
      title="Asterion Motion — dépendances industrielles étendues"
    />
  );
}

export default ResourcesDemoClient;
