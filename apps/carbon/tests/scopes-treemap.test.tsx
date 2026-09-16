/**
 * B-05 — /scopes plantait (« Maximum call stack size exceeded ») : la
 * récursion de `splitTreemap` ne terminait pas quand la somme d'un groupe
 * valait 0 ou NaN (ou pour deux valeurs égales). La fonction doit être totale.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  splitTreemap,
  Treemap,
  type EnrichedCategory,
  type TreemapItem,
} from "@/components/cockpit/scopes-sections";

function cats(values: number[]): EnrichedCategory[] {
  return values.map((value, i) => ({
    name: `Poste ${i}`,
    value,
    scopeId: 1,
    scopeName: "Scope 1",
    color: "#059669",
    source: { src: "—", q: "estimated" },
  }));
}

const area = (r: TreemapItem) => r.w * r.h;
const totalArea = (rects: TreemapItem[]) => rects.reduce((s, r) => s + area(r), 0);

function expectFiniteRects(rects: TreemapItem[]) {
  for (const r of rects) {
    for (const v of [r.x, r.y, r.w, r.h, r.value]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(r.w).toBeGreaterThanOrEqual(0);
    expect(r.h).toBeGreaterThanOrEqual(0);
  }
}

describe("splitTreemap — fonction totale", () => {
  it("[0, 0, 0] : termine, aucune surface à dessiner", () => {
    expect(splitTreemap(cats([0, 0, 0]), 0, 0, 100, 100)).toEqual([]);
  });

  it("[5, 0, 0] : seul le poste non nul occupe tout le conteneur", () => {
    const rects = splitTreemap(cats([5, 0, 0]), 0, 0, 100, 100);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ name: "Poste 0", x: 0, y: 0, w: 100, h: 100, value: 5 });
  });

  it("[NaN, 1] : la valeur non finie est ignorée", () => {
    const rects = splitTreemap(cats([Number.NaN, 1]), 0, 0, 100, 100);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ name: "Poste 1", w: 100, h: 100, value: 1 });
    expectFiniteRects(rects);
  });

  it("valeurs négatives et infinies ramenées à 0", () => {
    const rects = splitTreemap(
      cats([-4, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 3]),
      0, 0, 100, 100,
    );
    expect(rects.map((r) => r.name)).toEqual(["Poste 3"]);
  });

  it("liste vide : aucun rectangle", () => {
    expect(splitTreemap([], 0, 0, 100, 100)).toEqual([]);
  });

  it("élément unique : occupe exactement le conteneur", () => {
    const rects = splitTreemap(cats([42]), 10, 20, 30, 40);
    expect(rects).toEqual([expect.objectContaining({ x: 10, y: 20, w: 30, h: 40, value: 42 })]);
  });

  it("deux valeurs égales (ancienne récursion infinie) : moitié / moitié", () => {
    const rects = splitTreemap(cats([5, 5]), 0, 0, 100, 100);
    expect(rects).toHaveLength(2);
    expect(area(rects[0])).toBeCloseTo(5000, 6);
    expect(area(rects[1])).toBeCloseTo(5000, 6);
  });

  it("valeurs extrêmes : aucune surface NaN (pas de débordement de la somme)", () => {
    const big = Number.MAX_VALUE;
    const rects = splitTreemap(cats([big, big, big]), 0, 0, 100, 100);
    expect(rects).toHaveLength(3);
    expectFiniteRects(rects);
    expect(totalArea(rects)).toBeCloseTo(10_000, 6);
  });

  it("cas nominal : surfaces proportionnelles, somme = surface du conteneur", () => {
    const values = [482, 353, 195, 210, 553, 210, 127, 2680, 1020];
    const total = values.reduce((a, b) => a + b, 0);
    const rects = splitTreemap(cats(values), 0, 0, 100, 100);

    expect(rects).toHaveLength(values.length);
    expectFiniteRects(rects);
    expect(totalArea(rects)).toBeCloseTo(10_000, 6);
    for (const r of rects) {
      expect(area(r) / 10_000).toBeCloseTo(r.value / total, 9);
      // Chaque rectangle reste dans le conteneur.
      expect(r.x + r.w).toBeLessThanOrEqual(100 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(100 + 1e-9);
    }
    // Pavage trié par valeur décroissante (comportement historique).
    expect(rects[0].value).toBe(2680);
  });

  it("conteneur non rectangulaire : proportions conservées", () => {
    const rects = splitTreemap(cats([3, 1]), 0, 0, 40, 10);
    expect(totalArea(rects)).toBeCloseTo(400, 9);
    expect(area(rects[0])).toBeCloseTo(300, 9);
  });
});

describe("Treemap — rendu", () => {
  it("affiche un état vide lisible quand tous les postes sont à 0", () => {
    const html = renderToStaticMarkup(
      <Treemap items={cats([0, 0, 0])} total={0} hovered={null} setHovered={() => {}} />,
    );
    expect(html).toContain("Aucune émission à représenter");
    expect(html).not.toContain("sc-tm-cell");
  });

  it("rend une cellule par poste non nul", () => {
    const html = renderToStaticMarkup(
      <Treemap items={cats([5, 0, 3])} total={8} hovered={null} setHovered={() => {}} />,
    );
    expect(html.match(/sc-tm-cell/g)).toHaveLength(2);
  });
});
