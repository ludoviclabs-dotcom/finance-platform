/**
 * Calculateur ROI de la homepage (QA 2026-09-16 : M-09, m-04, m-05).
 *
 * - M-09 : 600 ETP / services / Scope 3 simple affichait « Économie annuelle
 *   estimée −18 600 € (−69 %) » en vert. Un écart négatif est un surcoût.
 * - m-04 : champ vidé puis « 500 » → 10500 ; aucun maximum ; « 1e3 » lu 1.
 * - m-05 : le texte annonçait −40 % la 1re année, le calcul appliquait −60 %.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { RoiCalculator } from "@/components/landing/roi-calculator";
import {
  CARBONCO_DAYS_REDUCTION,
  carbonCoPlan,
  clampInteger,
  commitIntegerInput,
  computeRoi,
  describeRoi,
  FTE_BOUNDS,
  parseIntegerInput,
  roiAssumptions,
  SITES_BOUNDS,
  type RoiInputs,
} from "@/components/landing/roi-model";

/** Espaces insécables (fines ou non) → espace simple, pour comparer du texte. */
const plain = (s: string | null | undefined) => (s ?? "").replace(/[  ]/g, " ");

const QA_CASE: RoiInputs = {
  fte: 600,
  sites: 1,
  sector: "services",
  scope3: "simple",
  hasConsultant: false,
};

describe("computeRoi — calcul pur", () => {
  it("reproduit le cas QA : surcoût de 18 600 € (69 % du coût manuel)", () => {
    const r = computeRoi(QA_CASE);
    expect(r.days).toBe(45);
    expect(r.manualTotal).toBe(27_000);
    expect(r.planName).toBe("Enterprise (estimation)");
    expect(r.carbonTotal).toBe(45_600);
    expect(r.delta).toBe(-18_600);
    expect(r.deltaPct).toBe(69);
    expect(r.outcome).toBe("extra-cost");
  });

  it("chiffre une économie sur le profil par défaut", () => {
    const r = computeRoi({ fte: 250, sites: 4, sector: "industrie", scope3: "medium", hasConsultant: true });
    expect(r.days).toBe(130);
    expect(r.manualTotal).toBe(117_000);
    expect(r.carbonTotal).toBe(46_680);
    expect(r.delta).toBe(70_320);
    expect(r.deltaPct).toBe(60);
    expect(r.outcome).toBe("saving");
  });

  it("applique la réduction de jours-homme de la constante, et elle seule", () => {
    const r = computeRoi({ ...QA_CASE, sector: "agro" });
    expect(r.reducedDays).toBe(Math.round(r.days * (1 - CARBONCO_DAYS_REDUCTION)));
    expect(CARBONCO_DAYS_REDUCTION).toBe(0.6);
  });

  it("borne l'effectif et le nombre de sites", () => {
    expect(computeRoi({ ...QA_CASE, fte: 10_000_000 })).toEqual(computeRoi({ ...QA_CASE, fte: FTE_BOUNDS.max }));
    expect(computeRoi({ ...QA_CASE, sites: 0 })).toEqual(computeRoi({ ...QA_CASE, sites: SITES_BOUNDS.min }));
  });

  it("choisit le forfait par tranche d'effectif", () => {
    expect(carbonCoPlan(100)).toEqual({ plan: "Starter", price: 5_880 });
    expect(carbonCoPlan(101)).toEqual({ plan: "Business", price: 15_480 });
    expect(carbonCoPlan(501).plan).toBe("Enterprise (estimation)");
  });
});

describe("describeRoi — jamais d'« économie » négative", () => {
  it("présente un écart négatif comme un surcoût, en montant positif et ton d'avertissement", () => {
    const s = describeRoi(computeRoi(QA_CASE));
    expect(s.label).toBe("Surcoût annuel estimé");
    expect(s.tone).toBe("warning");
    expect(plain(s.amount)).toBe("18 600 €");
    expect(s.amount).not.toContain("−");
    expect(s.amount).not.toContain("-");
    expect(plain(s.detail)).toBe("soit +69 % par rapport au coût manuel");
    expect(s.note).toBeTruthy();
  });

  it("présente un écart positif comme une économie", () => {
    const s = describeRoi(computeRoi({ fte: 250, sites: 4, sector: "industrie", scope3: "medium", hasConsultant: true }));
    expect(s.label).toBe("Économie annuelle estimée");
    expect(s.tone).toBe("positive");
    expect(plain(s.amount)).toBe("70 320 €");
  });

  it("présente un écart nul comme neutre", () => {
    const base = computeRoi(QA_CASE);
    const s = describeRoi({ ...base, delta: 0, deltaPct: 0, outcome: "even" });
    expect(s.label).toBe("Coût équivalent");
    expect(s.tone).toBe("neutral");
  });
});

describe("roiAssumptions — texte dérivé du calcul (m-05)", () => {
  const text = plain(roiAssumptions().join("\n"));

  it("annonce la réduction réellement appliquée, sans valeur concurrente", () => {
    expect(text).toContain(`−${CARBONCO_DAYS_REDUCTION * 100} % de jours-homme`);
    expect(text).not.toMatch(/40 %/);
    expect(text).not.toMatch(/1re année|2e année/);
  });

  it("reprend TJM, part du consultant et tranches de forfait du modèle", () => {
    expect(text).toContain("TJM interne : 600 €");
    expect(text).toContain("+50 % du coût interne");
    expect(text).toContain("Starter jusqu'à 100 ETP, Business jusqu'à 500 ETP");
  });
});

describe("saisie des champs entiers (m-04)", () => {
  it("accepte les chiffres, et les espaces comme séparateurs de milliers", () => {
    expect(parseIntegerInput("500")).toEqual({ kind: "ok", value: 500 });
    expect(parseIntegerInput("007")).toEqual({ kind: "ok", value: 7 });
    expect(parseIntegerInput("1 000")).toEqual({ kind: "ok", value: 1000 });
    expect(parseIntegerInput("100 000")).toEqual({ kind: "ok", value: 100_000 });
    expect(parseIntegerInput(" 42 ")).toEqual({ kind: "ok", value: 42 });
  });

  it("distingue un champ vide d'une saisie invalide", () => {
    expect(parseIntegerInput("")).toEqual({ kind: "empty" });
    expect(parseIntegerInput("   ")).toEqual({ kind: "empty" });
  });

  it("refuse notation exponentielle, décimales, signes et lettres", () => {
    for (const raw of ["1e3", "1E3", "2,5", "2.5", "-5", "+5", "12abc", "0x10", "Infinity", "NaN"]) {
      expect(parseIntegerInput(raw), raw).toEqual({ kind: "invalid" });
    }
  });

  it("borne la valeur retenue et revient à la dernière valeur valide sinon", () => {
    expect(clampInteger(0, FTE_BOUNDS)).toBe(1);
    expect(clampInteger(250_000, FTE_BOUNDS)).toBe(100_000);
    expect(commitIntegerInput("999999999999", FTE_BOUNDS, 250)).toBe(100_000);
    expect(commitIntegerInput("0", SITES_BOUNDS, 4)).toBe(1);
    expect(commitIntegerInput("", FTE_BOUNDS, 250)).toBe(250);
    expect(commitIntegerInput("1e3", SITES_BOUNDS, 4)).toBe(4);
    expect(commitIntegerInput("20000", SITES_BOUNDS, 4)).toBe(10_000);
  });
});

/* ── Composant monté (jsdom) ─────────────────────────────────────────────── */

interface Mounted {
  container: HTMLElement;
  root: Root;
}

let mounted: Mounted | null = null;

async function mount(): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<RoiCalculator />));
  mounted = { container, root };
  return container;
}

afterEach(async () => {
  if (!mounted) return;
  const { container, root } = mounted;
  await act(async () => root.unmount());
  container.remove();
  mounted = null;
});

function field(scope: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const lab = [...scope.querySelectorAll("label")].find((l) => l.textContent?.trim() === label);
  const target = lab?.htmlFor ? scope.querySelector(`[id="${lab.htmlFor}"]`) : null;
  if (!target) throw new Error(`Champ introuvable : ${label}`);
  return target as HTMLInputElement | HTMLSelectElement;
}

/** Frappe simulée : setter natif puis événement, comme un vrai champ. */
async function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function choose(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function blur(el: HTMLElement) {
  await act(async () => {
    el.focus();
    el.blur();
  });
}

const result = (scope: HTMLElement) => scope.querySelector<HTMLElement>('[data-testid="roi-result"]')!;

describe("RoiCalculator — rendu", () => {
  it("affiche l'économie du profil par défaut et les hypothèses dérivées", () => {
    const html = plain(renderToStaticMarkup(<RoiCalculator />));
    expect(html).toContain("Économie annuelle estimée");
    expect(html).toContain("70 320 €");
    expect(html).toContain("−60 % de jours-homme internes");
    expect(html).not.toContain("1re");
  });

  it("affiche le cas QA comme un surcoût, sans vert ni libellé « économie »", async () => {
    const c = await mount();
    await type(field(c, "Effectif total (ETP)") as HTMLInputElement, "600");
    await type(field(c, "Nombre de sites / établissements") as HTMLInputElement, "1");
    await choose(field(c, "Secteur") as HTMLSelectElement, "services");
    await choose(field(c, "Complexité Scope 3") as HTMLSelectElement, "simple");
    const consultant = c.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => consultant.click());

    const box = result(c);
    expect(box.dataset.outcome).toBe("extra-cost");
    expect(plain(box.textContent)).toContain("Surcoût annuel estimé");
    expect(plain(box.textContent)).toContain("18 600 €");
    expect(plain(box.textContent)).not.toContain("Économie annuelle estimée");
    expect(box.innerHTML).not.toMatch(/text-green|from-green/);
  });

  it("un champ vidé puis « 500 » vaut 500 (et non 10500)", async () => {
    const c = await mount();
    const fte = field(c, "Effectif total (ETP)") as HTMLInputElement;
    await type(fte, "");
    expect(fte.value).toBe("");
    await type(fte, "500");
    expect(fte.value).toBe("500");
    // 500 ETP → forfait Business.
    expect(result(c).textContent).toContain("Coût CarbonCo (Business)");
    await blur(fte);
    expect(fte.value).toBe("500");
  });

  it("« 1e3 » est signalé, n'altère pas le calcul, puis la dernière valeur revient", async () => {
    const c = await mount();
    const sites = field(c, "Nombre de sites / établissements") as HTMLInputElement;
    const before = result(c).textContent;
    await type(sites, "1e3");
    expect(sites.getAttribute("aria-invalid")).toBe("true");
    expect(result(c).textContent).toBe(before);
    await blur(sites);
    expect(sites.value).toBe("4");
    expect(sites.hasAttribute("aria-invalid")).toBe(false);
  });

  it("borne l'effectif au maximum à la sortie du champ", async () => {
    const c = await mount();
    const fte = field(c, "Effectif total (ETP)") as HTMLInputElement;
    await type(fte, "2500000");
    await blur(fte);
    expect(plain(fte.value)).toBe("100 000");
  });
});
