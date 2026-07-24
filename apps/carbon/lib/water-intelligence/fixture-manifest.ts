/**
 * lib/water-intelligence/fixture-manifest.ts — chargement du mini manifest de
 * DÉMONSTRATION P02, pour le shell public P04.
 *
 * `fixture-manifest.json` est une COPIE, à l'octet près, du manifest canonique
 * `docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json` (celui que
 * valident déjà les deux suites de contrats P02 :
 * `apps/api/tests/test_water_intelligence_contracts.py` côté Python et
 * `lib/water-intelligence/contracts.test.ts` côté TypeScript).
 *
 * Pourquoi une copie plutôt qu'un import direct du fichier canonique : le
 * bundler (Turbopack) refuse de résoudre un module hors de la racine de
 * l'application — un import `../../../../docs/...` casse le build Next.js.
 * La copie est donc une contrainte d'outillage, pas un choix de conception.
 *
 * Le risque de divergence est neutralisé par un test dédié
 * (`tests/water-intelligence-public-shell.test.tsx`) qui lit le fichier
 * canonique et le compare à cette copie : toute dérive fait échouer la CI.
 *
 * L'import est STATIQUE : le JSON est inliné dans le bundle au build, donc la
 * page ne lit aucun fichier et n'effectue aucun appel réseau au runtime
 * (invariant §6 de l'en-tête invariant du pack maître).
 *
 * Le manifest est revalidé ici par le schéma Zod P02 : si la fixture cessait
 * de respecter le contrat, le build échouerait au lieu d'afficher une donnée
 * hors contrat. Aucun fallback silencieux.
 */

import rawFixtureManifest from "./fixture-manifest.json";
import {
  WaterIntelligenceManifestSchema,
  type WaterIntelligenceManifest,
} from "./contracts";

/**
 * Manifest de démonstration, validé contre le contrat P02.
 *
 * `.parse()` (et non `.safeParse()`) est délibéré : une fixture invalide doit
 * casser bruyamment le build, jamais dégrader silencieusement l'affichage.
 */
export const FIXTURE_MANIFEST: WaterIntelligenceManifest =
  WaterIntelligenceManifestSchema.parse(rawFixtureManifest);

/*
 * P04B — `formatIsoDate()`, `IS_DEMONSTRATION_ONLY` et `DEMONSTRATION_LABEL`
 * ont été retirés : ils n'avaient plus (ou n'avaient jamais eu) de
 * consommateur une fois les valeurs fabriquées ôtées de la surface publique.
 * Un formateur de date reviendra quand une date de récupération RÉELLE sera
 * affichée (P05+), pas avant — inutile de conserver du code mort en attendant.
 */
