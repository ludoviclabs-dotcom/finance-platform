/**
 * AiActivityTrace — rendu de la surface de revue IA du cockpit (SSR pur).
 * Vérifie les 4 statuts déterministes, la trace fonctionnelle, l'exclusion de
 * preuves, et l'ABSENCE de chain-of-thought.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AiActivityTrace } from "@/components/demo/asterion/ai-activity-trace";

function render(): string {
  return renderToStaticMarkup(<AiActivityTrace />);
}

describe("AiActivityTrace", () => {
  it("affiche les 4 statuts de support déterministes (ReviewGate réel)", () => {
    const html = render();
    expect(html).toContain("Partiellement étayé");
    expect(html).toContain("Contredit par les preuves");
    expect(html).toContain("Non étayé");
    expect(html).toContain("Étayé");
    // Quatre claims => quatre pastilles de statut.
    const count = (html.match(/data-testid="review-gate-support-status"/g) ?? []).length;
    expect(count).toBe(4);
  });

  it("affiche la trace FONCTIONNELLE du pipeline (6 étapes) et l'exclusion de preuves", () => {
    const html = render();
    expect(html).toContain('data-testid="ai-activity-trace"');
    expect(html).toContain("Sélection des preuves");
    expect(html).toContain("Résolution des citations");
    expect(html).toContain("Attente de revue humaine");
    expect(html).toContain('data-testid="ai-trace-excluded"');
  });

  it("n'expose JAMAIS de raisonnement interne (pas de chain-of-thought)", () => {
    const html = render().toLowerCase();
    expect(html).not.toContain("chain-of-thought");
    expect(html).not.toContain("chain of thought");
    expect(html).not.toContain("raisonnement interne");
  });

  it("rend le formulaire de décision humaine (rien n'est publié automatiquement)", () => {
    const html = render();
    expect(html).toContain('data-testid="review-gate-decision-form"');
    expect(html).toContain("Décision humaine");
  });
});
