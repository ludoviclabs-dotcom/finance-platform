/**
 * Regulatory Claims Guard — T8.1 du PLAN_ACTION_CSRD_2026-11.
 *
 * Complète `claims-guard.test.ts` (qui ne couvre que l'accueil, le login et
 * /materials) : scanne toute l'UI publique ET applicative, les fiches produit,
 * le blog, /ai-act, /trust et la démo pour empêcher le retour d'une formulation
 * périmée (état du droit au 2 novembre 2026) ou non opposable devant un
 * commissaire aux comptes.
 *
 * Sources : « Dossier de maîtrise CSRD Carbon&Co », chap. 2 et 7 (lexique).
 *
 * Exemptions documentées :
 * - module Ressources et Water : « run immuable » y désigne une contrainte de
 *   base de données (trigger append-only), pas une promesse marketing ;
 * - /etat-du-produit et /couverture : pages de transparence, peuvent nommer
 *   l'ESEF pour dire qu'il n'est PAS exigible.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join, relative, sep } from "path";

const ROOT = resolve(__dirname, "..");

type Rule = {
  pattern: RegExp;
  reason: string;
  /** Si présent, la règle ne s'applique qu'aux chemins qui matchent. */
  onlyIn?: RegExp;
  /** Si présent, la règle ne s'applique pas aux chemins qui matchent. */
  exceptIn?: RegExp;
  /** Formulations exactes autorisées, retirées du contenu avant le test. */
  allow?: string[];
};

const TRANSPARENCY = /^app\/(etat-du-produit|couverture)\//;
const RESOURCES_AND_WATER =
  /^(app\/\(app\)\/resources|components\/resources|lib\/api\/resources\.ts|app\/water|components\/water|components\/cockpit)/;

const RULES: Rule[] = [
  {
    pattern: /\bSet\s*2\b/,
    reason: "« ESRS Set 2 » est ambigu et périmé : écrire « ESRS 2026 (règlement délégué (UE) 2026/1563) »",
  },
  {
    pattern: /\bESEF\b/,
    reason: "Aucun dépôt ESEF de l'état de durabilité n'est exigible (directive (UE) 2026/470) : « export iXBRL (bêta) »",
    exceptIn: TRANSPARENCY,
  },
  {
    pattern: /infalsifiable|inviolable|tamper-?proof/i,
    reason: "Une chaîne de hachage rend une modification détectable, elle ne l'empêche pas",
  },
  {
    pattern: /\bimmuables?\b/i,
    reason: "« immuable » promet l'impossible : « en ajout seul, modification détectable »",
    exceptIn: RESOURCES_AND_WATER,
  },
  {
    pattern: /sign[ée]e?s?\s+SHA-?256|Signature\s+SHA-?256|ZIP\s+sign[ée]|Ed25519/i,
    reason: "Un hash n'est pas une signature, et aucun code ne signe le manifeste aujourd'hui",
  },
  {
    pattern:
      /pr[êe]ts?\s+(?:pour\s+(?:l(?:'|&apos;|’))?audit|OTI)|OTI\s+ready|sign[ée]\s+OTI|Compatible\s+OTI|Statut\s+OTI|OTI\s+·\s+V[ée]rifi[ée]|V[ée]rifi[ée]\s+OTI/i,
    reason: "Le vérificateur (CAC ou OTI) reste juge : « dossier de preuves pour le vérificateur »",
  },
  {
    pattern: /pr[êe]t\s+pour\s+(?:la\s+)?soumission/i,
    reason: "On ne « soumet » pas un rapport à une norme d'audit ni à un dépôt ESEF",
  },
  {
    pattern: /ISAE\s*3000|ISSA\s*5000/,
    reason: "Une norme d'assurance s'impose au vérificateur, pas à un logiciel",
    allow: ["lignes directrices H2A, ISSA 5000", "lignes directrices de la H2A, ISSA 5000"],
  },
  {
    pattern:
      /conformes?\s+(?:à\s+|aux?\s+)?(?:l(?:'|&apos;|’))?(?:ADEME|IPCC|DEFRA|GHG|CSRD|ESRS|VSME|EFRAG|ESEF)|Rapports?\s+conformes|conformit[ée]\s+(?:CSRD|ESRS)|Votre\s+conformit[ée]|Conformit[ée]\s+AI\s+Act/i,
    reason: "Seul un tiers habilité certifie : « selon », « aligné sur », « conçu pour »",
  },
  {
    pattern: /CSRD-?Ready|short:\s*"Conforme"/i,
    reason: "Badge de conformité autoproclamée",
  },
  {
    pattern: /audit-grade/i,
    reason: "Promesse implicite de qualité d'audit : décrire les contrôles (« 30+ règles de contrôle »)",
  },
  {
    pattern: /30\s*(?:à|-|–)\s*50\s*%/,
    reason: "Gain de mission non mesuré",
  },
  {
    pattern:
      /attendue?\s+(?:à|a)\s+l(?:'|&apos;|’)été\s+2026|adoption\s+par\s+acte\s+délégué\s+est\s+attendue|acte\s+délégué\s+VS\s+attendu|attendu\s+à\s+la\s+mi-juillet/i,
    reason: "La norme volontaire est adoptée : règlement délégué (UE) 2026/1560, en vigueur le 24 septembre 2026",
  },
  {
    pattern: /10\s*000\s+entreprises/,
    reason: "Chiffre absolu non sourcé : « environ 90 % d'entreprises en moins dans le champ »",
  },
  {
    pattern: /\bDORA\b/,
    reason: "DORA vise la résilience numérique des entités financières, pas le reporting de durabilité",
  },
  {
    pattern: /cat(?:\.|égorie)\s*8[^.\n]{0,40}(?:cloud|SaaS|serveurs)/i,
    reason: "Un service cloud acheté relève de la catégorie 1 du scope 3",
  },
  {
    pattern: /ESRS\s+native/i,
    reason: "Formule creuse : « ESRS 2026 »",
  },
  {
    pattern: /Ecoinvent|Facteurs\s+IEA/i,
    reason: "Bases payantes non intégrées (licence de redistribution requise)",
  },
  {
    pattern: /250\s+salariés\s*\/\s*50\s*M€|Omnibus\s+du\s+26\s+février\s+2025/,
    reason: "Seuils et date d'avant l'Omnibus I (directive (UE) 2026/470 du 24 février 2026)",
  },
  {
    pattern: /Devoirs\s+du\s+déployeur|article\s+26\s+de\s+l(?:'|&apos;|’)AI\s+Act/i,
    reason: "L'article 26 vise les déployeurs de systèmes à haut risque",
  },
  {
    pattern: /par\s+défaut\s+US|hébergement\s+entièrement\s+européen/i,
    reason: "Les fonctions s'exécutent en fra1 depuis T9.1 ; ne pas promettre un hébergement « entièrement » européen",
  },
  {
    pattern: /Synchronisation\s+automatique\s+avec\s+les\s+bases|PRG\s+IPCC\s+AR6/i,
    reason: "Mécanisme non implémenté (facteurs importés par version ; PRG seedés en AR4)",
  },
  {
    pattern: /Toute\s+invocation\s+du\s+copilote\s+NEURAL\s+est\s+tracée/i,
    reason: "Les réponses du copilote ne sont pas encore journalisées (T9.4)",
  },
];

/** Répertoires scannés intégralement (.ts / .tsx), hors tests. */
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"]);

function walk(absDir: string, out: string[]) {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = join(absDir, entry.name);
    if (entry.isDirectory()) walk(child, out);
    else if (/\.(tsx?|json)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(relative(ROOT, child).split(sep).join("/"));
    }
  }
}

const FILES: string[] = [];
for (const dir of SCAN_DIRS) walk(join(ROOT, dir), FILES);

describe("Regulatory Claims Guard — état du droit au 2 novembre 2026", () => {
  it("scanne un périmètre large (app, components, lib)", () => {
    expect(FILES.length).toBeGreaterThan(200);
    expect(FILES).toContain("lib/product-modules.ts");
    expect(FILES).toContain("app/ai-act/page.tsx");
  });

  for (const relPath of FILES) {
    it(`${relPath}`, () => {
      const raw = readFileSync(join(ROOT, relPath), "utf8");
      const violations: string[] = [];
      for (const rule of RULES) {
        if (rule.onlyIn && !rule.onlyIn.test(relPath)) continue;
        if (rule.exceptIn && rule.exceptIn.test(relPath)) continue;
        let content = raw;
        for (const phrase of rule.allow ?? []) content = content.split(phrase).join("");
        const match = content.match(rule.pattern);
        if (match) violations.push(`❌ « ${match[0]} » — ${rule.reason}`);
      }
      if (violations.length > 0) {
        throw new Error(`\n${relPath}\n${violations.join("\n")}\n\nLexique : docs/carbonco/PLAN_ACTION_CSRD_2026-11.md, annexe A.`);
      }
    });
  }
});
