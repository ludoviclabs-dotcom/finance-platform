/**
 * tests/water-pilot-document-contract.test.ts — le document produit par Python
 * satisfait-il le contrat que le front impose ?
 *
 * ## Pourquoi ce test existe
 *
 * `pilot-snapshot.ts` valide le document par un `PilotFileSchema.parse()` :
 * un document hors contrat CASSE le build, délibérément — un snapshot dont la
 * forme a dérivé est un snapshot dont on ne sait plus ce qu'il dit.
 *
 * Mais le workflow de publication **committe le document avant** que quoi que
 * ce soit ne le relise côté TypeScript. Sans ce test, une clé renommée côté
 * Python se découvrirait au build suivant — c'est-à-dire après un appel réseau
 * consommé, après un commit, et sur un document déjà publié.
 *
 * ## Ce que l'échantillon est, et ce qu'il n'est pas
 *
 * `fixtures/pilot-document-sample.json` est produit par `_document()`, la
 * fonction même du publieur, et **verrouillé aux octets** par
 * `TestThePythonDocumentSatisfiesTheTypeScriptContract` côté Python. Il ne peut
 * donc pas dériver : toute évolution du publieur fait échouer le test Python
 * tant que l'échantillon n'a pas été régénéré.
 *
 * Ses VALEURS sont fabriquées — ouvrages `TEST-OPR-*`, attribution qui
 * s'annonce comme fixture. Il exerce un contrat ; il ne décrit aucun
 * prélèvement, et il n'est importé par aucune surface.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PilotBlockSchema,
  PilotFileSchema,
  pilotCoverageWarnings,
  pilotIsPublished,
  pilotObservations,
  pilotScope,
} from "@/lib/water-intelligence/pilot-snapshot";

const SAMPLE = resolve(__dirname, "fixtures/pilot-document-sample.json");
const raw: unknown = JSON.parse(readFileSync(SAMPLE, "utf-8"));

/**
 * Parse PARESSEUX, appelé dans chaque test.
 *
 * Un `parse()` au corps d'un `describe` s'exécute à la COLLECTE : un document
 * hors contrat y fait échouer la suite entière avant qu'aucun test ne tourne,
 * et le test qui liste les écarts — le seul qui liste les écarts lisiblement — ne rend
 * alors rien. Vérifié en renommant `pilot_status` côté Python : la suite
 * rendait « no tests » au lieu du champ fautif.
 */
const parse = () => PilotFileSchema.parse(raw);

describe("le document Python passe le contrat TypeScript", () => {
  it("est accepté par le schéma qui garde le build", () => {
    const parsed = PilotFileSchema.safeParse(raw);
    expect(
      parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    ).toEqual([]);
  });

  it("est reconnu comme GÉNÉRÉ, pas comme marqueur", () => {
    /* Le discriminant décide de tout l'affichage : lu de travers, `/water`
       rendrait « document pilote non généré » sur un document publié. */
    const parsed = parse();
    expect(pilotIsPublished(parsed)).toBe(true);
  });

  it("porte les métadonnées obligatoires de la Phase D", () => {
    const parsed = parse();
    if (!pilotIsPublished(parsed)) throw new Error("échantillon non généré");
    const pilot = PilotBlockSchema.parse(parsed.pilot);
    expect(pilot.publication_mode).toBe("table_first");
    expect(pilot.geo_layers).toBe("deferred");
    expect(pilot.pilot_status).toBe("limited_scope");
    expect(pilot.observation_count).toBe(3);
    expect(pilot.observed_period_start).toBe("2020-01-01");
    expect(pilot.observed_period_end).toBe("2020-12-31");
    /* Absences ASSUMÉES : le contrat les autorise explicitement à `null`, et
       le front les rend comme des absences plutôt que de les inventer. */
    expect(pilot.source_refresh_cadence).toBeNull();
    expect(pilot.source_last_updated_on).toBeNull();
  });
});

describe("les lectures du front tiennent sur un document réel", () => {
  it("rend les trois observations", () => {
    const parsed = parse();
    const rows = pilotObservations(parsed);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.ouvrageCode).not.toBe("—");
      expect(row.unit).toBe("m3");
      expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(row.periodStart).toBe("2020-01-01");
    }
  });

  it("lit le périmètre signé DANS le document, jamais dans une constante", () => {
    const scope = pilotScope(parse());
    expect(scope.geographyCode).toBe("34172");
    expect(scope.geographyType).toBe("code_commune_insee");
    expect(scope.expectedObservationCount).toBe(3);
    expect(scope.reviewedBy).toBe("ludoviclabs-dotcom");
  });

  it("porte les trois avertissements de couverture avec les valeurs", () => {
    const warnings = pilotCoverageWarnings(parse());
    expect(warnings).toHaveLength(3);
    expect(warnings.join(" ")).toContain("JAMAIS un prélèvement nul");
  });

  it("n'expose aucune permission d'usage dérivé", () => {
    const parsed = parse();
    if (!pilotIsPublished(parsed)) throw new Error("échantillon non généré");
    /* `derived_use_allowed = false` est ce qui interdit à la surface tout
       total, moyenne, classement ou score. Il doit survivre au transport. */
    expect(parsed.pilot.permissions.derived_use_allowed).toBe(false);
    expect(parsed.pilot.permissions.display_allowed).toBe(true);
  });
});

describe("l'échantillon ne peut pas être pris pour une donnée publiée", () => {
  it("s'annonce comme fixture et ne porte que des ouvrages fictifs", () => {
    const content = readFileSync(SAMPLE, "utf-8");
    expect(content).toContain("FIXTURE DE TEST");
    for (const fake of ["TEST-OPR-A", "TEST-OPR-B", "TEST-OPR-C"]) {
      expect(content).toContain(fake);
    }
  });

  it("n'est importé par aucun module de l'application", () => {
    /* Un échantillon atteignable depuis `app/` ou `lib/` finirait par être
       rendu. Le contrôle porte sur les répertoires servis, pas sur `tests/`. */
    const hits = execSync(
      "grep -rl 'pilot-document-sample' app components lib 2>/dev/null || true",
      { cwd: resolve(__dirname, ".."), encoding: "utf-8" },
    ).trim();
    expect(hits).toBe("");
  });
});
