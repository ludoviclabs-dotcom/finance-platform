/**
 * Recherche du référentiel /materials (QA 2026-09-16, m-12) : « cobalt »
 * entouré d'espaces renvoyait 0 résultat, sans message.
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import MaterialsGrid from "@/components/materials/MaterialsGrid";
import {
  displaySearchQuery,
  filterMaterialsByQuery,
  materialMatchesQuery,
  normalizeSearchText,
} from "@/components/materials/materials-search";
import { getMaterials, type Material } from "@/lib/crm/dataLoader";

describe("normalizeSearchText", () => {
  it("retire les espaces de bord et réduit les espaces internes (y compris insécables)", () => {
    expect(normalizeSearchText(" cobalt ")).toBe("cobalt");
    expect(normalizeSearchText("  Terres \t  rares  lourdes ")).toBe("terres rares lourdes");
    expect(normalizeSearchText(" cobalt ")).toBe("cobalt");
    expect(normalizeSearchText("   ")).toBe("");
  });

  it("ignore la casse et les accents (NFD + marques combinantes)", () => {
    expect(normalizeSearchText("Béryllium")).toBe("beryllium");
    expect(normalizeSearchText("HÉLIUM")).toBe("helium");
    expect(normalizeSearchText("Platinoïdes")).toBe("platinoides");
    expect(normalizeSearchText("Câblage électrique")).toBe("cablage electrique");
    // Forme déjà décomposée (e + accent combinant) : même résultat.
    expect(normalizeSearchText("Béryllium")).toBe("beryllium");
  });

  it("réaffiche la requête sans espaces parasites mais avec ses accents", () => {
    expect(displaySearchQuery("  Terres   rares  ")).toBe("Terres rares");
    expect(displaySearchQuery(" Béryllium ")).toBe("Béryllium");
  });
});

describe("materialMatchesQuery", () => {
  const sample: Pick<Material, "name_fr" | "main_uses"> = {
    name_fr: "Béryllium",
    main_uses: ["Alliages aérospatiaux", "Fenêtres à rayons X"],
  };

  it("trouve par nom ou par usage, quelle que soit la graphie", () => {
    expect(materialMatchesQuery(sample, " beryllium ")).toBe(true);
    expect(materialMatchesQuery(sample, "AEROSPATIAUX")).toBe(true);
    expect(materialMatchesQuery(sample, "fenetres  a   rayons")).toBe(true);
  });

  it("accepte tout pour une requête vide ou blanche, rien pour une requête sans rapport", () => {
    expect(materialMatchesQuery(sample, "")).toBe(true);
    expect(materialMatchesQuery(sample, "   ")).toBe(true);
    expect(materialMatchesQuery(sample, "cobalt")).toBe(false);
  });
});

describe("sur le snapshot réel", () => {
  let materials: Material[] = [];

  beforeAll(async () => {
    materials = (await getMaterials()).materials;
  });

  it("« cobalt » entouré d'espaces trouve le cobalt (cas QA)", () => {
    const found = filterMaterialsByQuery(materials, " cobalt ");
    expect(found.map((m) => m.id)).toContain("cobalt");
  });

  it("une requête sans accent trouve une matière accentuée", () => {
    expect(filterMaterialsByQuery(materials, "helium").map((m) => m.id)).toContain("helium");
    expect(filterMaterialsByQuery(materials, "terres rares legeres").map((m) => m.id)).toContain("light-ree");
  });
});

/* ── Composant monté : état vide + réinitialisation ─────────────────────── */

let mounted: { container: HTMLElement; root: Root } | null = null;

afterEach(async () => {
  if (!mounted) return;
  const { container, root } = mounted;
  await act(async () => root.unmount());
  container.remove();
  mounted = null;
});

async function mountGrid(): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // framer-motion (whileInView) s'appuie sur IntersectionObserver, absent de jsdom.
  const g = globalThis as { IntersectionObserver?: unknown };
  if (!g.IntersectionObserver) {
    g.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }
  const { materials } = await getMaterials();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<MaterialsGrid materials={materials} />));
  mounted = { container, root };
  return container;
}

async function typeSearch(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const cards = (c: HTMLElement) => c.querySelectorAll("h3").length;

describe("MaterialsGrid", () => {
  it("affiche un état vide explicite, puis réinitialise la recherche", async () => {
    const c = await mountGrid();
    const total = cards(c);
    expect(total).toBe(34);

    const input = c.querySelector<HTMLInputElement>('[data-testid="materials-search"]')!;
    expect(input.getAttribute("aria-label")).toBe("Rechercher une matière ou un usage");

    await typeSearch(input, "  unobtainium   rare ");
    const empty = c.querySelector('[data-testid="materials-empty"]');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("Aucune matière ne correspond à « unobtainium rare ».");
    expect(cards(c)).toBe(0);

    const reset = [...c.querySelectorAll("button")].find((b) => b.textContent === "Réinitialiser la recherche")!;
    await act(async () => reset.click());
    expect(input.value).toBe("");
    expect(c.querySelector('[data-testid="materials-empty"]')).toBeNull();
    expect(cards(c)).toBe(total);
  });

  it("« cobalt » entouré d'espaces affiche la carte Cobalt, sans état vide", async () => {
    const c = await mountGrid();
    const input = c.querySelector<HTMLInputElement>('[data-testid="materials-search"]')!;
    await typeSearch(input, " cobalt ");
    expect(c.querySelector('[data-testid="materials-empty"]')).toBeNull();
    expect([...c.querySelectorAll("h3")].map((h) => h.textContent)).toContain("Cobalt");
  });
});
