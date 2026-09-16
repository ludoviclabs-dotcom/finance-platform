/**
 * Raccourcis de l'aperçu dashboard de la homepage (QA 2026-09-16, m-11).
 *
 * ← / → dans le <select> du calculateur ROI faisaient aussi changer d'écran
 * l'aperçu : l'écouteur était global et n'ignorait pas les <select>.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  isEditableTarget,
  nextHotspotIndex,
  resolveMockupShortcut,
  type ShortcutKeyEvent,
} from "@/components/landing/mockup/mockup-shortcuts";
import { PremiumDashboardMockup } from "@/components/landing/mockup/premium-dashboard-mockup";

const COUNT = 5;

function keyEvent(key: string, overrides: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    isComposing: false,
    target: document.createElement("button"),
    ...overrides,
  };
}

describe("isEditableTarget", () => {
  it("reconnaît input, select, textarea et contenu éditable (y compris imbriqué)", () => {
    for (const tag of ["input", "select", "textarea"]) {
      expect(isEditableTarget(document.createElement(tag)), tag).toBe(true);
    }
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editor.appendChild(inner);
    expect(isEditableTarget(editor)).toBe(true);
    expect(isEditableTarget(inner)).toBe(true);

    const option = document.createElement("option");
    document.createElement("select").appendChild(option);
    expect(isEditableTarget(option)).toBe(true);
  });

  it("ignore boutons, conteneurs, contenteditable=false et cibles non-éléments", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    const readOnly = document.createElement("div");
    readOnly.setAttribute("contenteditable", "false");
    expect(isEditableTarget(readOnly)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("resolveMockupShortcut — garde", () => {
  it("traduit Échap, flèches et chiffres en actions", () => {
    expect(resolveMockupShortcut(keyEvent("Escape"), COUNT)).toEqual({ type: "reset" });
    expect(resolveMockupShortcut(keyEvent("ArrowRight"), COUNT)).toEqual({ type: "step", direction: 1 });
    expect(resolveMockupShortcut(keyEvent("ArrowLeft"), COUNT)).toEqual({ type: "step", direction: -1 });
    expect(resolveMockupShortcut(keyEvent("3"), COUNT)).toEqual({ type: "jump", index: 2 });
  });

  it("ignore toute frappe destinée à un champ (le <select> du calculateur ROI)", () => {
    const select = document.createElement("select");
    for (const key of ["ArrowLeft", "ArrowRight", "Escape", "2"]) {
      expect(resolveMockupShortcut(keyEvent(key, { target: select }), COUNT), key).toBeNull();
    }
    expect(resolveMockupShortcut(keyEvent("ArrowRight", { target: document.createElement("input") }), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("1", { target: document.createElement("textarea") }), COUNT)).toBeNull();
  });

  it("ignore les combinaisons Ctrl / Alt / Meta (dont AltGr)", () => {
    expect(resolveMockupShortcut(keyEvent("ArrowLeft", { altKey: true }), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("ArrowRight", { ctrlKey: true }), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("ArrowRight", { metaKey: true }), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("2", { ctrlKey: true, altKey: true }), COUNT)).toBeNull();
  });

  it("ignore Maj + flèche mais accepte Maj + chiffre (clavier AZERTY)", () => {
    expect(resolveMockupShortcut(keyEvent("ArrowRight", { shiftKey: true }), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("4", { shiftKey: true }), COUNT)).toEqual({ type: "jump", index: 3 });
  });

  it("ignore les événements déjà traités, la composition IME et les touches hors périmètre", () => {
    expect(resolveMockupShortcut(keyEvent("ArrowRight", { defaultPrevented: true }), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("ArrowRight", { isComposing: true }), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("6"), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("0"), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("a"), COUNT)).toBeNull();
    expect(resolveMockupShortcut(keyEvent("Tab"), COUNT)).toBeNull();
  });
});

describe("nextHotspotIndex", () => {
  it("part du premier (→) ou du dernier (←) quand rien n'est actif", () => {
    expect(nextHotspotIndex(-1, 1, COUNT)).toBe(0);
    expect(nextHotspotIndex(-1, -1, COUNT)).toBe(COUNT - 1);
  });

  it("boucle aux extrémités", () => {
    expect(nextHotspotIndex(COUNT - 1, 1, COUNT)).toBe(0);
    expect(nextHotspotIndex(0, -1, COUNT)).toBe(COUNT - 1);
    expect(nextHotspotIndex(2, 1, COUNT)).toBe(3);
    expect(nextHotspotIndex(0, 1, 0)).toBe(-1);
  });
});

/* ── Composant monté : l'écouteur n'est plus global ─────────────────────── */

let mounted: { container: HTMLElement; root: Root } | null = null;

afterEach(async () => {
  if (!mounted) return;
  const { container, root } = mounted;
  await act(async () => root.unmount());
  container.remove();
  mounted = null;
});

async function mountWithSelect(): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <>
        <select aria-label="Secteur">
          <option value="industrie">Industrie</option>
          <option value="services">Services</option>
        </select>
        <PremiumDashboardMockup />
      </>,
    ),
  );
  mounted = { container, root };
  return container;
}

const pressed = (scope: HTMLElement) =>
  [...scope.querySelectorAll('[data-hotspot-id][aria-pressed="true"]')].map((el) =>
    el.getAttribute("data-hotspot-id"),
  );

async function press(target: Element, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("PremiumDashboardMockup — clavier", () => {
  it("← / → dans un <select> voisin ne change pas l'écran de l'aperçu", async () => {
    const c = await mountWithSelect();
    const select = c.querySelector("select")!;
    await press(select, "ArrowRight");
    await press(select, "ArrowLeft");
    await press(select, "2");
    expect(pressed(c)).toEqual([]);
  });

  it("une frappe hors de l'aperçu (document) est ignorée", async () => {
    const c = await mountWithSelect();
    await press(document.body, "ArrowRight");
    await press(document.body, "1");
    expect(pressed(c)).toEqual([]);
  });

  it("réagit quand le focus est dans l'aperçu, et Échap revient à la vue globale", async () => {
    const c = await mountWithSelect();
    const group = c.querySelector('[role="group"]')!;
    const hotspot = c.querySelector('[data-hotspot-id="kpis"]')!;
    await press(group, "ArrowRight");
    expect(pressed(c)).toEqual(["scopes"]);
    await press(hotspot, "ArrowRight");
    expect(pressed(c)).toEqual(["kpis"]);
    await press(group, "5");
    expect(pressed(c)).toEqual(["rapports"]);
    await press(group, "Escape");
    expect(pressed(c)).toEqual([]);
  });

  it("ignore Ctrl + flèche même dans l'aperçu", async () => {
    const c = await mountWithSelect();
    const group = c.querySelector('[role="group"]')!;
    await act(async () => {
      group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true, bubbles: true }));
    });
    expect(pressed(c)).toEqual([]);
  });
});
