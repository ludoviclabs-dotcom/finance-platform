/**
 * Robotique & IA physique — phase 3 : fiches par couche et découvrabilité.
 *
 * Couvre les fiches /robotics/[couche], le pont retour depuis les fiches
 * /materials, l'inscription au registre des statuts et au plan du site.
 * Le menu « Dépendances » est couvert par water-intelligence-discoverability.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// next/font est une transformation de build : hors Next, on neutralise les
// variables de police de la peau Industry.
vi.mock("@/components/materials/industry/fonts", () => ({ industryFontVars: {} }));

import registry from "@/data/feature-status.json";
import {
  getBomForLayer,
  getChokepointsForLayer,
  getLayersForMaterial,
  getRoboticsDataset,
  layersInReadingOrder,
} from "@/lib/robotics/dataLoader";
import RoboticsLayerPage, { generateMetadata, generateStaticParams } from "@/app/robotics/[layer]/page";
import MaterialPage from "@/app/materials/[id]/page";
import sitemap from "@/app/sitemap";

const REPO_ROOT = resolve(__dirname, "../../..");
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

describe("index des couches", () => {
  it("relie une matière aux couches qui la consomment, dans l'ordre de lecture", async () => {
    const ds = await getRoboticsDataset();
    const layers = getLayersForMaterial(ds, "light-ree").map(r => r.layer.id);
    expect(layers).toEqual(["aimants-terres-rares", "moteurs-actionneurs", "mains-prehenseurs"]);
    expect(getLayersForMaterial(ds, "baryte")).toEqual([]);
  });

  it("retrouve goulots et postes de coût par couche", async () => {
    const ds = await getRoboticsDataset();
    expect(getChokepointsForLayer(ds, "aimants-terres-rares").map(c => c.id)).toEqual(["aimants-controles-export"]);
    expect(getBomForLayer(ds, "batteries").map(b => b.id)).toEqual(["energie"]);
  });
});

describe("fiches /robotics/[couche]", () => {
  it("génère une fiche par couche", async () => {
    const ds = await getRoboticsDataset();
    expect((await generateStaticParams()).map(p => p.layer).sort()).toEqual(ds.layers.map(l => l.id).sort());
  });

  it("titre et URL canonique propres à la couche", async () => {
    const meta = await generateMetadata(params({ layer: "aimants-terres-rares" }));
    expect(meta.title).toContain("Matières premières & aimants NdFeB");
    expect(meta.alternates?.canonical).toBe("/robotics/aimants-terres-rares");
  });

  it("affiche chaque chiffre clé avec ses sources cliquables", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(await RoboticsLayerPage(params({ layer: "aimants-terres-rares" })));
    const layer = ds.layers.find(l => l.id === "aimants-terres-rares")!;
    for (const id of layer.key_figure_ids) {
      const figure = ds.key_figures.find(k => k.id === id)!;
      expect(html).toContain(figure.value_label);
      for (const sid of figure.provenance.source_ids) {
        const url = ds.sources.find(s => s.id === sid)!.url;
        expect(html).toContain(`href="${url.replace(/&/g, "&amp;")}"`);
      }
    }
  });

  it("renvoie aux fiches matières, aux voisines et à la page d'ensemble", async () => {
    const ds = await getRoboticsDataset();
    const ordered = layersInReadingOrder(ds);
    const html = renderToStaticMarkup(await RoboticsLayerPage(params({ layer: ordered[1].id })));
    expect(html).toContain('href="/materials/silicon-metal"');
    expect(html).toContain(`href="/robotics/${ordered[0].id}"`);
    expect(html).toContain(`href="/robotics/${ordered[2].id}"`);
    expect(html).toContain('href="/robotics"');
  });

  it("omet la section Matières quand la couche n'en consomme aucune", async () => {
    const html = renderToStaticMarkup(await RoboticsLayerPage(params({ layer: "modeles-ia-simulation" })));
    expect(html).not.toContain('id="matieres"');
    expect(html).toContain('id="acteurs"');
  });

  it("une couche inconnue mène à la page 404", async () => {
    await expect(RoboticsLayerPage(params({ layer: "inconnue" }))).rejects.toThrow();
  });
});

describe("pont retour depuis /materials", () => {
  it("la fiche d'une matière consommée liste les couches robotiques", async () => {
    const html = renderToStaticMarkup(await MaterialPage(params({ id: "light-ree" })));
    expect(html).toContain('data-testid="material-robotics-bridge"');
    expect(html).toContain('href="/robotics/aimants-terres-rares"');
    expect(html).toContain('href="/robotics/moteurs-actionneurs"');
  });

  it("une matière sans lien robotique n'affiche pas le bloc", async () => {
    const html = renderToStaticMarkup(await MaterialPage(params({ id: "baryte" })));
    expect(html).not.toContain('data-testid="material-robotics-bridge"');
  });
});

describe("registre et plan du site", () => {
  it("le module est inscrit au registre, en vérification tant que la production n'est pas confirmée", () => {
    const entry = registry.features.find(f => f.id === "robotique-ia-physique");
    expect(entry).toBeDefined();
    expect(entry!.href).toBe("/robotics");
    expect(entry!.statut).toBe("verification");
    expect(existsSync(resolve(REPO_ROOT, entry!.preuve!))).toBe(true);
  });

  it("le plan du site déclare la page et chacune des fiches", async () => {
    const ds = await getRoboticsDataset();
    const urls = (await sitemap()).map(e => new URL(e.url).pathname);
    expect(urls).toContain("/robotics");
    for (const l of ds.layers) expect(urls).toContain(`/robotics/${l.id}`);
  });
});
