/**
 * M-07 — /alerts : sur le plan Hobby, Vercel déclenche le cron quotidien à un
 * moment quelconque de l'heure planifiée (06:00–06:59 UTC). La page ne doit
 * plus promettre « chaque jour à 06:00 UTC », et un échec d'évaluation
 * manuelle ne doit plus s'afficher comme « Aucune alerte ».
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../app/(app)/alerts/page.tsx"), "utf-8");

describe("AlertsPage — planification affichée", () => {
  it("annonce une fenêtre d'une heure et l'évaluation manuelle", () => {
    const text = source.replace(/\s+/g, " ");
    expect(text).toContain("évaluées automatiquement une fois par jour (entre");
    expect(text).toContain("06:00 et 07:00 UTC");
    expect(text).toContain("Vous pouvez aussi lancer une évaluation manuelle.");
    expect(text).not.toContain("chaque jour à <strong>06:00 UTC</strong>");
  });

  it("un échec d'évaluation n'est jamais converti en résultat vide", () => {
    expect(source).not.toContain("setEvalResult({ evaluated: 0, fired: 0, alerts: [] })");
    expect(source).toContain("setEvalError(");
  });
});
