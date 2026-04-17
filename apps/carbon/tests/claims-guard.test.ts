/**
 * Claims Guard — Phase 5.0 Truth Alignment regression test.
 *
 * Vérifie qu'aucun claim interdit ne réapparaît dans les fichiers UI publics.
 * Ce test fait partie du pipeline `npm test` et bloque les commits qui
 * réintroduisent une formulation non opposable.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";

const ROOT = resolve(__dirname, "..");

/**
 * Claims qu'on n'a PAS le droit de remettre dans l'UI publique.
 * Format : { pattern, reason, scope } — scope = "public" (landing/login) ou "all".
 *
 * Exception : les disclaimers explicites sur /etat-du-produit et /couverture
 * peuvent mentionner SecNumCloud dans le contexte "non disponible — migration
 * possible" — c'est un rejet de promesse, pas une promesse. Le guard distingue
 * via le `scope`.
 */
const FORBIDDEN_CLAIMS: { pattern: RegExp; reason: string; scope: "public" | "all" }[] = [
  {
    pattern: /Conformit[ée]\s+ESRS\s+\d{4}\s+garantie/i,
    reason: "Pas de claim 'Conformité ESRS YYYY garantie' — couverture E1 seulement",
    scope: "all",
  },
  {
    pattern: /Conforme\s+EU\s+AI\s+Act/i,
    reason: "AI Act classification en cours d'évaluation — pas 'conforme'",
    scope: "all",
  },
  {
    pattern: /CarbonCo\s+est\s+conforme\s+au\s+r[èe]glement\s+UE\s+2024\/1689/i,
    reason: "Idem — claim de conformité AI Act non opposable",
    scope: "all",
  },
  {
    pattern: /−87\s*%|-87\s*%/,
    reason: "Pas de % de réduction non sourcé en dur",
    scope: "all",
  },
  {
    pattern: /JWT\s*\+\s*2FA/i,
    reason: "2FA pas implémenté — claim retiré jusqu'à TOTP réel",
    scope: "all",
  },
  {
    pattern: /certifi[ée]e?\s+SecNumCloud|h[ée]berg[ée]e?\s+SecNumCloud/i,
    reason: "Pas de certification SecNumCloud — éviter claim positif",
    scope: "public",
  },
  {
    pattern: /99[,.]9\s*%\s+SLA|SLA\s+99/i,
    reason: "Pas de SLA contractuel",
    scope: "all",
  },
  {
    pattern: /h[ée]berg[ée]\s+(?:chez\s+)?OVH|h[ée]bergement\s+OVH/i,
    reason: "Pas hébergé OVH — Vercel + Neon",
    scope: "all",
  },
];

/**
 * Liste des fichiers UI à scanner avec leur scope.
 * - "public" : landing, login, modals marketing — règles strictes
 * - "transparency" : pages /etat-du-produit, /couverture — peuvent mentionner
 *   des items "non disponibles" sans déclencher le guard
 */
const FILES_TO_SCAN: { path: string; scope: "public" | "transparency" }[] = [
  { path: "components/pages/landing-page.tsx", scope: "public" },
  { path: "components/pages/login-screen.tsx", scope: "public" },
  { path: "components/dashboard/methodology-modal.tsx", scope: "public" },
  { path: "app/etat-du-produit/page.tsx", scope: "transparency" },
  { path: "app/couverture/page.tsx", scope: "transparency" },
];

describe("Claims Guard — aucun claim interdit dans l'UI publique", () => {
  for (const { path: relPath, scope: fileScope } of FILES_TO_SCAN) {
    it(`${relPath} ne contient aucun claim interdit`, () => {
      const filePath = join(ROOT, relPath);
      const content = readFileSync(filePath, "utf8");
      const violations: string[] = [];

      for (const { pattern, reason, scope } of FORBIDDEN_CLAIMS) {
        // Scope "public" only checks public marketing files, not transparency pages
        if (scope === "public" && fileScope !== "public") continue;
        const matches = content.match(pattern);
        if (matches) {
          violations.push(
            `❌ "${matches[0]}" trouvé dans ${relPath} — ${reason}`,
          );
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `\n${violations.join("\n")}\n\nVoir lib/claims-dictionary.ts pour les formulations approuvées.`,
        );
      }
    });
  }

  it("le dictionnaire de claims est non vide et exporte PROOF + DISCLAIMERS", async () => {
    const dict = await import("../lib/claims-dictionary");
    expect(dict.COVERAGE).toBeDefined();
    expect(dict.HOSTING).toBeDefined();
    expect(dict.AI).toBeDefined();
    expect(dict.PROOF).toBeDefined();
    expect(dict.DISCLAIMERS).toBeDefined();
    expect(dict.SAVINGS).toBeDefined();
  });
});
