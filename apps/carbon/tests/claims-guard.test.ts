/**
 * Claims Guard — Phase 5.0 Truth Alignment regression test.
 *
 * Vérifie qu'aucun claim interdit ne réapparaît dans les fichiers UI publics.
 * Ce test fait partie du pipeline `npm test` et bloque les commits qui
 * réintroduisent une formulation non opposable.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join, relative } from "path";

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
  // ─── T0.1 — Purge des claims invérifiables ───────────────────────────────
  {
    pattern: /Early Adopter/i,
    reason: "Programme « Early Adopter » retiré — aucun client réel à exhiber",
    scope: "all",
  },
  {
    pattern: /Workiva|Enablon|Greenly/i,
    reason: "Comparatif concurrents retiré — claims invérifiables",
    scope: "all",
  },
  {
    pattern: /2\s?%\s+du\s+CA/i,
    reason: "« 2 % du CA » : sanction non opposable telle quelle post-Omnibus",
    scope: "all",
  },
  {
    pattern: /CarbonCo\s+SAS/i,
    reason: "Aucune société immatriculée — pas de mention « CarbonCo SAS » (D2)",
    scope: "all",
  },
  {
    pattern: /Con[çc]u avec des experts/i,
    reason: "« Conçu avec des experts » non sourcé — remplacé par les référentiels publics",
    scope: "public",
  },
  {
    // Case-sensitive : « Bilan Carbone® » est une marque déposée (ABC). La forme
    // minuscule générique « bilan carbone » reste licite et n'est pas visée.
    pattern: /Bilan Carbone/,
    reason: "« Bilan Carbone® » est une marque déposée — utiliser « bilan GES »",
    scope: "all",
  },
  // ─── PR-01 — Vérité des données /materials ────────────────────────────────
  {
    pattern: /aucune donn[ée]e invent[ée]e/i,
    reason: "PR-01 : « aucune donnée inventée » interdit tant que les valeurs sont estimated",
    scope: "all",
  },
  {
    pattern: /mise à jour automatique/i,
    reason: "PR-01 : pas de « mise à jour automatique » — le snapshot est statique, aucun flux externe",
    scope: "all",
  },
  {
    pattern: /(snapshot|historique)[^.]{0,40}hebdomadaire/i,
    reason: "PR-01 : pas de promesse de rafraîchissement hebdomadaire du snapshot /materials",
    scope: "all",
  },
  // ─── PR-01 post-merge — SupplyChainExplainer : géopolitique non sourcée ───
  // Ces valeurs n'ont ni source, ni date, ni statut de qualité, ni distinction
  // extraction/raffinage/transformation dans le dataset — cf. audit post-merge.
  // Note : ne bannit PAS les pourcentages en général (ex. part Chine dérivée
  // du dataset, affichée ESTIMATED, reste légitime), seulement ces couples
  // valeur+sujet précis qui étaient codés en dur sans source.
  {
    pattern: /91\s*%[\s\S]{0,40}terres\s+rares|terres\s+rares[\s\S]{0,40}91\s*%/i,
    reason: "PR-01 : pas de « 91% des terres rares » codé en dur — aucune source/date/statut associée",
    scope: "all",
  },
  {
    pattern: /94\s*%[\s\S]{0,40}aimants\s+permanents|aimants\s+permanents[\s\S]{0,40}94\s*%/i,
    reason: "PR-01 : pas de « 94% des aimants permanents » codé en dur — aucune source/date/statut associée",
    scope: "all",
  },
  {
    pattern: /Quasi-monopole chinois sur 91\s*%/i,
    reason: "PR-01 : formulation exacte supprimée de SupplyChainExplainer (non sourcée)",
    scope: "all",
  },
  {
    pattern: /Chine contr[ôo]le 94\s*%/i,
    reason: "PR-01 : formulation exacte supprimée de SupplyChainExplainer (non sourcée)",
    scope: "all",
  },
  {
    pattern: /[ée]quipementiers asiatiques\s*\(\s*CATL\s*,\s*TSMC\s*,\s*Samsung\s*\)/i,
    reason: "PR-01 : dépendance à des noms d'équipementiers précis retirée (non sourcée) — formulation générique désormais",
    scope: "all",
  },
];

/**
 * Liste des fichiers UI à scanner avec leur scope.
 * - "public" : landing, login, modals marketing — règles strictes
 * - "transparency" : pages /etat-du-produit, /couverture — peuvent mentionner
 *   des items "non disponibles" sans déclencher le guard
 */
const STATIC_FILES_TO_SCAN: { path: string; scope: "public" | "transparency" }[] = [
  { path: "components/pages/landing-page.tsx", scope: "public" },
  { path: "components/pages/login-screen.tsx", scope: "public" },
  { path: "components/dashboard/methodology-modal.tsx", scope: "public" },
  { path: "app/etat-du-produit/page.tsx", scope: "transparency" },
  { path: "app/couverture/page.tsx", scope: "transparency" },
];

/**
 * Tous les composants de components/landing sont du marketing public : on les
 * scanne intégralement pour empêcher toute réintroduction d'un claim interdit
 * (T0.1). Parcours récursif (inclut le sous-dossier mockup/).
 */
function landingFiles(): { path: string; scope: "public" }[] {
  const out: { path: string; scope: "public" }[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".tsx")) {
        out.push({ path: relative(ROOT, child), scope: "public" });
      }
    }
  };
  walk(join(ROOT, "components/landing"));
  return out;
}

/**
 * Fichiers publics du module /materials (page, fiche matière, composants).
 * Scannés pour empêcher la réapparition d'un claim de fraîcheur/vérité (PR-01).
 */
function materialsFiles(): { path: string; scope: "public" }[] {
  const out: { path: string; scope: "public" }[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".tsx")) out.push({ path: relative(ROOT, child), scope: "public" });
    }
  };
  walk(join(ROOT, "app/materials"));
  walk(join(ROOT, "components/materials"));
  return out;
}

const FILES_TO_SCAN: { path: string; scope: "public" | "transparency" }[] = [
  ...STATIC_FILES_TO_SCAN,
  ...landingFiles(),
  ...materialsFiles(),
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
