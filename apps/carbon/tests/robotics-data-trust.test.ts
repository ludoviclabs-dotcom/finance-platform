/**
 * Robotics Data Trust — garde-fous du jeu « Robotique & IA physique ».
 *
 * Verrouille ce que la future page /robotics promettra : chaque valeur a une
 * provenance résolue, aucun chiffre n'est « vérifié » sur la seule foi du
 * dossier éditorial, le pont vers /materials ne cite que des fiches réelles, et
 * aucun contenu d'investissement (cours, tickers, thèses) n'est repris.
 */

import { describe, it, expect } from "vitest";

import { getMaterials } from "@/lib/crm/dataLoader";
import {
  blocForCountry,
  collectProvenances,
  getActorsForLayer,
  getRoboticsDataset,
  layersInReadingOrder,
  resolveLayerMaterials,
  summarizeRobotics,
  validateRoboticsDataset,
  ROBOTICS_SCHEMA_VERSION,
  type RoboticsDataset,
} from "@/lib/robotics/dataLoader";
import snapshot from "@/data/robotics_humanoid_snapshot_2026-11-02.json";

const clone = (ds: RoboticsDataset): RoboticsDataset => JSON.parse(JSON.stringify(ds));

describe("Intégrité du snapshot", () => {
  it("le snapshot ne présente aucun écart de validation", async () => {
    const ds = await getRoboticsDataset();
    const { materials } = await getMaterials();
    expect(validateRoboticsDataset(ds, materials)).toEqual([]);
  });

  it("porte la version de schéma et une date de snapshot cohérente avec son nom de fichier", async () => {
    const ds = await getRoboticsDataset();
    expect(ds.schema_version).toBe(ROBOTICS_SCHEMA_VERSION);
    expect(ds.snapshot_date).toBe("2026-11-02");
  });

  it("aucune source n'est consultée ni publiée après la date du snapshot", async () => {
    const ds = await getRoboticsDataset();
    for (const s of ds.sources) {
      expect(s.accessed <= ds.snapshot_date, `${s.id} consultée après le snapshot`).toBe(true);
      if (s.published) expect(s.published <= ds.snapshot_date, `${s.id} publiée après le snapshot`).toBe(true);
    }
  });

  it("douze couches, dans un ordre de lecture continu de 1 à 12", async () => {
    const ds = await getRoboticsDataset();
    expect(layersInReadingOrder(ds).map(l => l.order)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});

describe("Provenance — aucune valeur chiffrée sans source externe", () => {
  it("chaque chiffre (chiffres clés, projections, volumes, capacités, coût matériel) est sourcé, jamais « manual »", async () => {
    const ds = await getRoboticsDataset();
    const numeric = [
      ...ds.key_figures.map(k => ({ path: `key_figures.${k.id}`, p: k.provenance })),
      ...ds.projections.map(p => ({ path: `projections.${p.id}`, p: p.provenance })),
      ...ds.bom.map(b => ({ path: `bom.${b.id}`, p: b.provenance })),
      ...ds.oems.flatMap(o => [
        ...(o.volume ? [{ path: `oems.${o.actor_id}.volume`, p: o.volume.provenance }] : []),
        ...(o.capacity ? [{ path: `oems.${o.actor_id}.capacity`, p: o.capacity.provenance }] : []),
      ]),
    ];
    expect(numeric.length).toBeGreaterThan(0);
    for (const { path, p } of numeric) {
      expect(p.data_quality, `${path} ne peut pas être une saisie éditoriale`).not.toBe("manual");
    }
  });

  it("une valeur vérifiée sur la seule foi du dossier éditorial est rejetée", async () => {
    const ds = clone(await getRoboticsDataset());
    const { materials } = await getMaterials();
    const editorial = ds.sources.find(s => s.kind === "editorial")!;
    ds.key_figures[0].provenance = { data_quality: "verified", source_ids: [editorial.id] };
    expect(validateRoboticsDataset(ds, materials).some(i => i.includes("sans source externe"))).toBe(true);
  });

  it("une source citée mais absente du registre est signalée", async () => {
    const ds = clone(await getRoboticsDataset());
    const { materials } = await getMaterials();
    ds.layers[0].provenance.source_ids.push("source-fantome");
    expect(validateRoboticsDataset(ds, materials)).toContain(`layers.${ds.layers[0].id} : source inconnue source-fantome`);
  });

  it("une source du registre jamais citée est signalée", async () => {
    const ds = clone(await getRoboticsDataset());
    const { materials } = await getMaterials();
    ds.sources.push({ ...ds.sources[0], id: "orpheline" });
    expect(validateRoboticsDataset(ds, materials)).toContain("sources.orpheline : source jamais citée");
  });

  it("chaque provenance du jeu est contrôlée (aucune valeur n'échappe au décompte)", async () => {
    const ds = await getRoboticsDataset();
    const paths = collectProvenances(ds).map(p => p.path);
    expect(paths.filter(p => p.startsWith("layers.")).length).toBe(ds.layers.length);
    expect(paths.filter(p => p.startsWith("actors.")).length).toBe(ds.actors.length);
    expect(paths.filter(p => p.startsWith("key_figures.")).length).toBe(ds.key_figures.length);
  });
});

describe("Pont vers /materials", () => {
  it("la couche aimants renvoie aux fiches terres rares du snapshot CRM", async () => {
    const ds = await getRoboticsDataset();
    const { materials } = await getMaterials();
    const magnets = ds.layers.find(l => l.number === 1)!;
    const linked = resolveLayerMaterials(magnets, materials).map(m => m.id);
    expect(linked).toEqual(expect.arrayContaining(["light-ree", "heavy-ree"]));
  });

  it("un lien vers une matière absente de /materials est signalé, jamais résolu", async () => {
    const ds = clone(await getRoboticsDataset());
    const { materials } = await getMaterials();
    const layer = ds.layers[0];
    layer.material_links.push({ material_id: "unobtainium", rationale: "test" });
    expect(validateRoboticsDataset(ds, materials)).toContain(`layers.${layer.id} : matière absente de /materials unobtainium`);
    expect(resolveLayerMaterials(layer, materials).map(m => m.id)).not.toContain("unobtainium");
  });

  it("chaque couche a au moins un acteur", async () => {
    const ds = await getRoboticsDataset();
    for (const l of ds.layers) expect(getActorsForLayer(ds, l.id).length, l.id).toBeGreaterThan(0);
  });
});

describe("Hors périmètre — aucun contenu d'investissement", () => {
  const raw = JSON.stringify(snapshot);

  it("aucun champ de cours, de valorisation, de ticker ou de thèse", () => {
    for (const key of ["ticker", "tickers", "these", "theses", "valorisation", "valorisations", "capitalisation", "per"]) {
      expect(raw.includes(`"${key}":`), `champ ${key} présent`).toBe(false);
    }
  });

  it("aucun symbole boursier de la forme $ABC", () => {
    expect(raw.match(/\$[A-Z]{2,5}\b/g)).toBeNull();
  });
});

describe("Rattachement pays → bloc", () => {
  it("couvre les quatre blocs du dossier et isole le reste", () => {
    expect(blocForCountry("US")).toBe("us");
    expect(blocForCountry("CN")).toBe("cn");
    expect(blocForCountry("CH")).toBe("eu");
    expect(blocForCountry("GB")).toBe("eu");
    expect(blocForCountry("TW")).toBe("as");
    expect(blocForCountry("AU")).toBe("other");
  });

  it("un acteur dont aucun pays ne correspond au bloc est signalé", async () => {
    const ds = clone(await getRoboticsDataset());
    const { materials } = await getMaterials();
    const actor = ds.actors.find(a => a.countries.length === 1 && a.countries[0] === "US")!;
    actor.bloc = "cn";
    expect(validateRoboticsDataset(ds, materials)).toContain(`actors.${actor.id} : bloc cn sans pays correspondant`);
  });
});

describe("summarizeRobotics — indicateurs dérivés, aucun chiffre en dur", () => {
  it("compte couches, acteurs et matières reliées depuis le jeu", async () => {
    const ds = await getRoboticsDataset();
    const s = summarizeRobotics(ds);
    expect(s.layers).toBe(12);
    expect(s.actors).toBe(ds.actors.length);
    expect(s.linkedMaterials).toBeGreaterThanOrEqual(10);
    expect(s.externalSources).toBeLessThan(s.sources);
    expect(s.verifiedPct).toBeGreaterThanOrEqual(0);
    expect(s.verifiedPct).toBeLessThanOrEqual(100);
  });
});
