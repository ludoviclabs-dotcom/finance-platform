/**
 * tests/water-decision-cockpit.test.tsx — cockpit décisionnel hydrique
 * `/water/decision` (Wave E-Interface, commit F2).
 *
 * Les vingt contrôles exigés par la mission F2 :
 *
 * |  # | Exigence | describe |
 * |---|---|---|
 * |  1 | garde d'authentification | « route et garde » |
 * |  2 | route distincte de la vitrine publique | « route et garde » |
 * |  3 | formulaire initial vide | « formulaire initial » |
 * |  4 | champs obligatoires | « validation » |
 * |  5 | probabilité facultative | « validation » |
 * |  6 | taux d'actualisation obligatoire | « validation » |
 * |  7 | aucune valeur par défaut | « formulaire initial » |
 * |  8 | aucun `company_id` | « aucune donnée tenant » |
 * |  9 | aucune donnée tenant dans l'URL | « aucune donnée tenant » |
 * | 10 | navigation entre les étapes | « navigation » |
 * | 11 | tableau de revue | « navigation » |
 * | 12 | appel API uniquement au clic | « appel du moteur » |
 * | 13 | résultat central + sensibilités | « appel du moteur » |
 * | 14 | réinitialisation | « appel du moteur » |
 * | 15 | erreurs API | « erreurs API » |
 * | 16 | 304 côté client public | « erreurs API » |
 * | 17 | décimales conservées en chaînes | « décimales » |
 * | 18 | mobile | « mise en page et accessibilité » |
 * | 19 | clavier | « mise en page et accessibilité » |
 * | 20 | reduced motion | « mise en page et accessibilité » |
 *
 * Le calculateur est réellement MONTÉ (React 19 `act` + `createRoot` sur jsdom),
 * pas seulement rendu en chaîne : « l'appel n'a lieu qu'au clic » et « le retour
 * arrière ne perd rien » sont des affirmations sur le comportement, et un
 * rendu statique ne les vérifierait pas.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WaterDecisionPage from "@/app/water/(authenticated)/decision/page";
import { WdScenarioCalculator } from "@/components/water-decision/WdCalculator";
import { WdSynthesisPanel } from "@/components/water-decision/WdSynthesis";
import { fetchPublicSnapshot } from "@/lib/api/water-decision";
import { CANONICAL_EMPTY_SNAPSHOT } from "@/lib/water-intelligence/canonical-snapshot";
import {
  deriveFacetStates,
  FACET_ORDER,
  summariseAvailability,
} from "@/lib/water-decision/facets";
import {
  QUANTITY_ORDER,
  emptyScenarioDraft,
  isDraftPristine,
  quantityErrorKey,
  validateScenarioDraft,
  type QuantityField,
  type ScenarioDraft,
} from "@/lib/water-decision/scenario-form";

/* ------------------------------------------------------------- Emplacements */

const CARBON_ROOT = resolve(__dirname, "..");
const PAGE = resolve(CARBON_ROOT, "app/water/(authenticated)/decision/page.tsx");
const WATER_LAYOUT = resolve(CARBON_ROOT, "app/water/(authenticated)/layout.tsx");
const AUTH_BOUNDARY = resolve(CARBON_ROOT, "components/layout/authenticated-boundary.tsx");
const APP_LAYOUT = resolve(CARBON_ROOT, "app/(app)/layout.tsx");
const PUBLIC_PAGE = resolve(CARBON_ROOT, "app/water/page.tsx");
const CALCULATOR = resolve(CARBON_ROOT, "components/water-decision/WdCalculator.tsx");
const STATES = resolve(CARBON_ROOT, "components/water-decision/WdStates.tsx");
const SYNTHESIS = resolve(CARBON_ROOT, "components/water-decision/WdSynthesis.tsx");
const FORM_MODULE = resolve(CARBON_ROOT, "lib/water-decision/scenario-form.ts");

const read = (path: string) => readFileSync(path, "utf-8");

/**
 * Source débarrassée de ses commentaires.
 *
 * Les fichiers de ce module DÉCRIVENT longuement ce qu'ils refusent de faire :
 * « ni localStorage », « aucun score agrégé ». Chercher ces mots dans la source
 * brute ferait échouer les gardes sur leur propre documentation — et, pire,
 * inciterait à retirer la documentation pour faire passer le test.
 */
const readCode = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/* ------------------------------------------------------------- Outillage */

const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  const status = init.status ?? 200;
  return {
    ok: status < 400,
    status,
    headers: new Headers(init.headers ?? {}),
    json: async () => body,
    clone() {
      return this;
    },
  } as unknown as Response;
}

const SYNTHESIS_PAYLOAD = {
  company_id: 4242,
  is_empty: false,
  facets: [
    {
      facet: "risk",
      label: "Risque",
      is_empty: false,
      vocabularies: ["water_stress_v1"],
      has_mixed_vocabularies: false,
      entries: [
        {
          facet: "risk",
          source_module: "water_screening",
          label: "Site principal",
          vocabulary: "water_stress_v1",
          value: "high",
          evidence_ref: "screening:12",
          absence_reason: null,
        },
      ],
    },
    {
      facet: "confidence",
      label: "Confiance",
      is_empty: false,
      vocabularies: ["confidence_v1", "resource_confidence_v2"],
      has_mixed_vocabularies: true,
      entries: [
        {
          facet: "confidence",
          source_module: "water_screening",
          label: "Socle documentaire",
          vocabulary: "confidence_v1",
          value: null,
          evidence_ref: null,
          absence_reason: "Aucun géocodage accepté sur ce site.",
        },
      ],
    },
  ],
};

const EVALUATION_PAYLOAD = {
  scenario_code: "SC-1",
  label: "Arrêt estival",
  horizon_year: 2030,
  is_absent: false,
  absence_reason: null,
  components: {
    revenue_at_risk: {
      value: "123456.78",
      unit: "currency",
      provenance: "derived",
      basis: "revenue_per_day × outage_days × affected_capacity_share",
    },
  },
  present_value: "98765.43",
  probability_weighted: null,
  sensitivities: [
    { driver: "outage_days", variation_pct: "10", low: "1.00", base: "2.00", high: "3.00" },
    { driver: "discount_rate", variation_pct: "10", low: "4.00", base: "5.00", high: "6.00" },
  ],
  signals: [],
};

interface Mounted {
  container: HTMLElement;
  root: Root;
}

async function mount(node: React.ReactElement): Promise<Mounted> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

async function unmount({ container, root }: Mounted) {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

function pick<T extends Element>(scope: ParentNode, selector: string): T {
  const found = scope.querySelector<T>(selector);
  if (!found) throw new Error(`Élément introuvable : ${selector}`);
  return found;
}

/** Frappe clavier simulée : passe par le setter natif, comme un vrai champ. */
function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("Setter natif introuvable");
  setter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function fillQuantity(
  container: HTMLElement,
  field: QuantityField,
  value: string,
  provenance: "observed" | "assumption",
  basis: string,
) {
  const fieldset = pick<HTMLElement>(container, `[data-testid="wd-quantity-${field}"]`);
  await act(async () => {
    typeInto(pick<HTMLInputElement>(fieldset, 'input[inputmode="decimal"]'), value);
  });
  await act(async () => {
    pick<HTMLInputElement>(fieldset, `input[type="radio"][value="${provenance}"]`).click();
  });
  await act(async () => {
    typeInto(pick<HTMLInputElement>(fieldset, `[data-testid="wd-basis-${field}"]`), basis);
  });
}

async function click(container: HTMLElement, testId: string) {
  await act(async () => {
    pick<HTMLButtonElement>(container, `[data-testid="${testId}"]`).click();
  });
}

async function typeField(container: HTMLElement, testId: string, value: string) {
  await act(async () => {
    typeInto(pick<HTMLInputElement>(container, `[data-testid="${testId}"]`), value);
  });
}

/**
 * Remplit les trois premières étapes et s'arrête sur la revue.
 *
 * `probability` est volontairement laissée intacte : c'est le cas nominal —
 * une grandeur facultative non fournie ne bloque rien.
 */
async function fillThroughReview(
  container: HTMLElement,
  overrides: Partial<Record<QuantityField, string>> = {},
) {
  const value = (field: QuantityField, fallback: string) => overrides[field] ?? fallback;

  await fillQuantity(container, "outage_days", value("outage_days", "12"), "observed", "Relevé 2025");
  await fillQuantity(
    container,
    "affected_capacity_share",
    value("affected_capacity_share", "0.4"),
    "assumption",
    "Estimation exploitation",
  );
  await click(container, "wd-next");

  await fillQuantity(
    container,
    "revenue_per_day",
    value("revenue_per_day", "1234.56"),
    "observed",
    "Comptabilité analytique",
  );
  await fillQuantity(container, "margin_rate", value("margin_rate", "0,32"), "observed", "Marge N-1");
  await fillQuantity(
    container,
    "additional_opex_per_day",
    value("additional_opex_per_day", "980.10"),
    "assumption",
    "Devis transporteur",
  );
  await click(container, "wd-next");

  await fillQuantity(
    container,
    "adaptation_capex",
    value("adaptation_capex", "250000"),
    "assumption",
    "Étude avant-projet",
  );
  await fillQuantity(
    container,
    "discount_rate",
    value("discount_rate", "0.08"),
    "assumption",
    "WACC groupe fourni par la direction financière",
  );
  await typeField(container, "wd-scenario-code", "SC-1");
  await typeField(container, "wd-label", "Arrêt estival");
  await typeField(container, "wd-base-year", "2026");
  await typeField(container, "wd-horizon-year", "2030");
  await typeField(container, "wd-variation", "10");
  await click(container, "wd-next");
}

/** Brouillon complet côté logique pure, sans DOM. */
function completeDraft(mutate: (draft: ScenarioDraft) => void = () => {}): ScenarioDraft {
  const draft = emptyScenarioDraft();
  draft.scenario_code = "SC-1";
  draft.label = "Arrêt estival";
  draft.base_year = "2026";
  draft.horizon_year = "2030";
  draft.sensitivity_variation_pct = "10";
  const filled: Array<[QuantityField, string]> = [
    ["outage_days", "12"],
    ["affected_capacity_share", "0.4"],
    ["revenue_per_day", "1234.56"],
    ["margin_rate", "0.32"],
    ["additional_opex_per_day", "980.10"],
    ["adaptation_capex", "250000"],
    ["discount_rate", "0.08"],
  ];
  for (const [field, value] of filled) {
    draft.quantities[field] = { value, provenance: "observed", basis: "Base documentée" };
  }
  mutate(draft);
  return draft;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

/* ============================================================ 1 · 2 — Route */

describe("route et garde", () => {
  it("vit dans le groupe protégé et n’écrit aucune seconde garde", () => {
    expect(() => read(PAGE)).not.toThrow();
    const source = read(PAGE);
    // Aucune authentification locale : ni jeton lu, ni redirection propre.
    expect(source).not.toMatch(/useAuth|getAuthToken|router\.replace\(["'`]\/login/);
    expect(source).not.toContain("localStorage");
  });

  it("s’appuie sur la garde PARTAGÉE, qui redirige vers /login", () => {
    /*
      La page a quitté le groupe `(app)` pour le shell hydrique dédié. La règle
      d'accès, elle, n'a pas été recopiée : le layout du shell monte
      `AuthenticatedBoundary`, et c'est ce composant — un seul fichier — qui
      porte la condition et la redirection.

      Le test vérifie les deux moitiés de cette affirmation, sans quoi
      « partagée » ne serait qu'un mot dans un commentaire : la garde contient
      bien la règle, et le layout hydrique la monte réellement.
    */
    const boundary = read(AUTH_BOUNDARY);
    expect(boundary).toContain("auth.status !== \"authenticated\"");
    expect(boundary).toContain("/login?next=");

    expect(read(WATER_LAYOUT)).toContain("AuthenticatedBoundary");

    // Et c'est la MÊME garde des deux côtés : le groupe `(app)` ne conserve
    // aucune règle d'accès en propre.
    const appLayout = read(APP_LAYOUT);
    expect(appLayout).toContain("AuthenticatedBoundary");
    expect(appLayout).not.toContain("auth.status !== \"authenticated\"");
    expect(appLayout).not.toContain("/login?next=");
  });

  it("est une route distincte de la vitrine publique et du cockpit opérationnel", () => {
    expect(() => read(PUBLIC_PAGE)).not.toThrow();
    expect(PAGE.replace(/\\/g, "/")).toContain(
      "app/water/(authenticated)/decision/page.tsx",
    );
    // La page publique reste hors de tout groupe authentifié.
    const publicPage = PUBLIC_PAGE.replace(/\\/g, "/");
    expect(publicPage).toContain("app/water/page.tsx");
    expect(publicPage).not.toContain("(authenticated)");
  });
});

/* ==================================================== 3 · 7 — Vide au départ */

describe("formulaire initial", () => {
  it("est intégralement vide côté modèle", () => {
    const draft = emptyScenarioDraft();
    expect(isDraftPristine(draft)).toBe(true);
    for (const field of QUANTITY_ORDER) {
      expect(draft.quantities[field]).toEqual({ value: "", provenance: "", basis: "" });
    }
  });

  it("rend zéro champ pré-rempli et zéro origine pré-cochée", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    const inputs = Array.from(
      mounted.container.querySelectorAll<HTMLInputElement>("input[type='text'], textarea"),
    );
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input.value).toBe("");

    const radios = Array.from(
      mounted.container.querySelectorAll<HTMLInputElement>("input[type='radio']"),
    );
    expect(radios.length).toBeGreaterThan(0);
    expect(radios.some((radio) => radio.checked)).toBe(false);
    await unmount(mounted);
  });

  it("n’affiche aucun placeholder — un exemple chiffré serait une recommandation", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    expect(mounted.container.querySelectorAll("[placeholder]").length).toBe(0);
    await unmount(mounted);
  });

  it("ne pose aucun défaut de schéma sur les grandeurs financières", () => {
    expect(read(FORM_MODULE)).not.toContain(".default(");
  });
});

/* ============================================== 4 · 5 · 6 — Validation */

describe("validation", () => {
  it("refuse un formulaire vide et nomme chaque champ obligatoire", () => {
    const { errors, request } = validateScenarioDraft(emptyScenarioDraft());
    expect(request).toBeNull();
    for (const field of QUANTITY_ORDER) {
      if (field === "probability") continue; // facultative
      expect(errors[quantityErrorKey(field, "value")]).toBeTruthy();
      expect(errors[quantityErrorKey(field, "provenance")]).toBeTruthy();
      expect(errors[quantityErrorKey(field, "basis")]).toBeTruthy();
    }
    for (const key of ["scenario_code", "label", "base_year", "horizon_year", "sensitivity_variation_pct"]) {
      expect(errors[key]).toBeTruthy();
    }
  });

  it("accepte l’absence de probabilité et n’en fabrique aucune", () => {
    const { errors, request } = validateScenarioDraft(completeDraft());
    expect(errors).toEqual({});
    expect(request).not.toBeNull();
    expect(request && "probability" in request).toBe(false);
  });

  it("transmet la probabilité quand elle est fournie, sans la déduire", () => {
    const draft = completeDraft((d) => {
      d.quantities.probability = {
        value: "0.15",
        provenance: "assumption",
        basis: "Dire d’expert hydrologue",
      };
    });
    const { request } = validateScenarioDraft(draft);
    expect(request?.probability).toEqual({
      value: "0.15",
      provenance: "assumption",
      basis: "Dire d’expert hydrologue",
    });
  });

  it("refuse une probabilité entamée mais incomplète plutôt que de la compléter", () => {
    const draft = completeDraft((d) => {
      d.quantities.probability = { value: "0.15", provenance: "", basis: "" };
    });
    const { errors, request } = validateScenarioDraft(draft);
    expect(request).toBeNull();
    expect(errors[quantityErrorKey("probability", "provenance")]).toBeTruthy();
    expect(errors[quantityErrorKey("probability", "basis")]).toBeTruthy();
  });

  it("exige le taux d’actualisation — aucun taux n’est suggéré", () => {
    const draft = completeDraft((d) => {
      d.quantities.discount_rate = { value: "", provenance: "", basis: "" };
    });
    const { errors, request } = validateScenarioDraft(draft);
    expect(request).toBeNull();
    expect(errors[quantityErrorKey("discount_rate", "value")]).toMatch(/obligatoire/i);
  });

  it("borne les ratios à l’intervalle du contrat", () => {
    const draft = completeDraft((d) => {
      d.quantities.margin_rate = { value: "1.4", provenance: "observed", basis: "Erreur de saisie" };
    });
    const { errors } = validateScenarioDraft(draft);
    expect(errors[quantityErrorKey("margin_rate", "value")]).toMatch(/ratio/i);
  });

  it("refuse un horizon antérieur à l’année de référence", () => {
    const draft = completeDraft((d) => {
      d.horizon_year = "2020";
    });
    expect(validateScenarioDraft(draft).errors.horizon_year).toBeTruthy();
  });
});

/* ================================================ 8 · 9 — Aucune fuite tenant */

describe("aucune donnée tenant", () => {
  it("n’envoie aucun identifiant d’entreprise dans la requête d’évaluation", () => {
    const { request } = validateScenarioDraft(completeDraft());
    const serialized = JSON.stringify(request);
    expect(serialized).not.toMatch(/company_id|tenant|site_id/i);
  });

  it("interroge la synthèse sans le moindre paramètre d’URL", async () => {
    mockFetch.mockResolvedValue(jsonResponse(SYNTHESIS_PAYLOAD));
    const mounted = await mount(<WaterDecisionPage />);
    expect(mockFetch).toHaveBeenCalled();
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url.endsWith("/water/decision-synthesis")).toBe(true);
    expect(url).not.toContain("?");
    expect(url).not.toMatch(/company|tenant|site/i);
    await unmount(mounted);
  });

  it("n’affiche jamais le company_id que la réponse contient pourtant", async () => {
    mockFetch.mockResolvedValue(jsonResponse(SYNTHESIS_PAYLOAD));
    const mounted = await mount(<WaterDecisionPage />);
    expect(mounted.container.innerHTML).not.toContain("4242");
    expect(mounted.container.innerHTML).not.toContain("company_id");
    await unmount(mounted);
  });
});

/* ================================================ Facettes — états explicites */

describe("six facettes", () => {
  it("rend toujours les six facettes, y compris en erreur", () => {
    const cases = [
      { kind: "loading" } as const,
      { kind: "schema_unavailable" } as const,
      { kind: "access_denied", status: 403 } as const,
      { kind: "unexpected_error", message: "boum" } as const,
    ];
    for (const transport of cases) {
      const states = deriveFacetStates(transport);
      expect(Object.keys(states).sort()).toEqual([...FACET_ORDER].sort());
      const markup = renderToStaticMarkup(<WdSynthesisPanel states={states} />);
      for (const facet of FACET_ORDER) {
        expect(markup).toContain(`data-testid="wd-facet-${facet}"`);
      }
    }
  });

  it("distingue les six états d’une facette", () => {
    const expectations: Array<[Parameters<typeof deriveFacetStates>[0], string]> = [
      [{ kind: "loading" }, "wd-facet-risk-loading"],
      [{ kind: "schema_unavailable" }, "wd-facet-risk-schema-unavailable"],
      [{ kind: "access_denied", status: 403 }, "wd-facet-risk-access-denied"],
      [{ kind: "unexpected_error", message: "boum" }, "wd-facet-risk-unexpected-error"],
      [
        { kind: "ready", synthesis: { company_id: 1, is_empty: true, facets: [] } },
        "wd-facet-risk-empty",
      ],
      [
        {
          kind: "ready",
          synthesis: SYNTHESIS_PAYLOAD as never,
        },
        "wd-facet-risk-available",
      ],
    ];
    for (const [transport, marker] of expectations) {
      const markup = renderToStaticMarkup(
        <WdSynthesisPanel states={deriveFacetStates(transport)} />,
      );
      expect(markup).toContain(marker);
    }
  });

  it("ne masque pas une facette absente derrière un état global favorable", () => {
    // `is_empty: false` au niveau global, mais quatre facettes non renvoyées.
    const states = deriveFacetStates({
      kind: "ready",
      synthesis: SYNTHESIS_PAYLOAD as never,
    });
    const availability = summariseAvailability(states);
    expect(availability.available).toBe(2);
    expect(availability.empty).toBe(4);
    const markup = renderToStaticMarkup(<WdSynthesisPanel states={states} />);
    expect(markup).toContain("wd-facet-dependency-empty");
  });

  it("affiche une valeur nulle comme absence motivée, jamais comme zéro", () => {
    const markup = renderToStaticMarkup(
      <WdSynthesisPanel
        states={deriveFacetStates({ kind: "ready", synthesis: SYNTHESIS_PAYLOAD as never })}
      />,
    );
    expect(markup).toContain("Aucun géocodage accepté sur ce site.");
    expect(markup).toContain("Donnée absente");
    expect(markup).not.toMatch(/>\s*0\s*</);
  });

  it("avertit quand deux vocabulaires cohabitent au lieu de les comparer", () => {
    const markup = renderToStaticMarkup(
      <WdSynthesisPanel
        states={deriveFacetStates({ kind: "ready", synthesis: SYNTHESIS_PAYLOAD as never })}
      />,
    );
    expect(markup).toContain("wd-facet-confidence-mixed-vocabularies");
    expect(markup).toContain("ne sont pas comparables");
  });

  it("ne produit aucun score agrégé", () => {
    const code = [readCode(PAGE), readCode(SYNTHESIS), readCode(STATES)].join("\n");
    expect(code).not.toMatch(/score|indice global|note globale/i);

    // Et le rendu n'annonce qu'une disponibilité, explicitement distinguée d'un
    // niveau de risque.
    const markup = renderToStaticMarkup(
      <WdSynthesisPanel
        states={deriveFacetStates({ kind: "ready", synthesis: SYNTHESIS_PAYLOAD as never })}
      />,
    );
    expect(markup).not.toMatch(/score/i);
  });
});

/* ============================================= 10 · 11 — Étapes et revue */

describe("navigation", () => {
  it("avance et recule sans perdre la saisie", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    await fillQuantity(mounted.container, "outage_days", "12", "observed", "Relevé 2025");
    await click(mounted.container, "wd-next");

    expect(mounted.container.querySelector('[data-testid="wd-quantity-revenue_per_day"]')).toBeTruthy();

    await click(mounted.container, "wd-prev");
    const back = pick<HTMLInputElement>(
      mounted.container,
      '[data-testid="wd-quantity-outage_days"] input[inputmode="decimal"]',
    );
    expect(back.value).toBe("12");
    await unmount(mounted);
  });

  it("désactive « étape précédente » sur la première étape", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    expect(pick<HTMLButtonElement>(mounted.container, '[data-testid="wd-prev"]').disabled).toBe(true);
    await unmount(mounted);
  });

  it("présente en revue toutes les hypothèses, unités et origines", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    await fillThroughReview(mounted.container);

    const table = pick<HTMLElement>(mounted.container, '[data-testid="wd-review-table"]');
    expect(table.querySelectorAll("tbody tr").length).toBe(QUANTITY_ORDER.length);
    expect(table.textContent).toContain("Jours d’arrêt");
    expect(table.textContent).toContain("ratio (0 à 1)");
    expect(table.textContent).toContain("Observé");
    // La probabilité non fournie est dite non renseignée, pas ramenée à zéro.
    expect(table.textContent).toContain("Non renseigné");

    const warnings = pick<HTMLElement>(mounted.container, '[data-testid="wd-review-warnings"]');
    expect(warnings.textContent).toMatch(/probabilité/i);
    expect(warnings.textContent).toMatch(/aucune écriture comptable/i);

    const accounting = pick<HTMLElement>(mounted.container, '[data-testid="wd-accounting-questions"]');
    expect(accounting.textContent).toContain("IAS 36");
    expect(accounting.textContent).toContain("IAS 37");
    expect(accounting.textContent).toContain("IFRIC 21");
    await unmount(mounted);
  });
});

/* ================================ 12 · 13 · 14 — Appel, résultat, réinitialisation */

describe("appel du moteur", () => {
  it("n’appelle rien pendant la saisie, et appelle une seule fois au clic", async () => {
    mockFetch.mockResolvedValue(jsonResponse(EVALUATION_PAYLOAD));
    const mounted = await mount(<WdScenarioCalculator />);
    await fillThroughReview(mounted.container);

    // Toute la saisie est faite, la revue est affichée : rien n'a été appelé.
    expect(mockFetch).not.toHaveBeenCalled();

    await click(mounted.container, "wd-submit");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url).endsWith("/water/financial-scenarios/evaluate")).toBe(true);
    expect((init as RequestInit).method).toBe("POST");
    await unmount(mounted);
  });

  it("rend la valeur centrale accompagnée de ses sensibilités", async () => {
    mockFetch.mockResolvedValue(jsonResponse(EVALUATION_PAYLOAD));
    const mounted = await mount(<WdScenarioCalculator />);
    await fillThroughReview(mounted.container);
    await click(mounted.container, "wd-submit");

    const result = pick<HTMLElement>(mounted.container, '[data-testid="wd-result"]');
    expect(result.getAttribute("data-result-state")).toBe("done");
    expect(pick<HTMLElement>(result, '[data-testid="wd-result-central"]').textContent).toBe("98765.43");
    const sensitivities = pick<HTMLElement>(result, '[data-testid="wd-sensitivities"]');
    expect(sensitivities.querySelectorAll("tbody tr").length).toBe(2);
    // Les hypothèses restent affichées avec le résultat.
    expect(result.textContent).toContain("Hypothèses de ce résultat");
    expect(result.textContent).toContain("Aucune pondération par probabilité");
    await unmount(mounted);
  });

  it("affiche un résultat absent comme absent et motivé", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        ...EVALUATION_PAYLOAD,
        is_absent: true,
        absence_reason: "Entrée manquante côté moteur.",
        present_value: null,
        sensitivities: [],
      }),
    );
    const mounted = await mount(<WdScenarioCalculator />);
    await fillThroughReview(mounted.container);
    await click(mounted.container, "wd-submit");

    const absent = pick<HTMLElement>(mounted.container, '[data-testid="wd-result-absent"]');
    expect(absent.textContent).toContain("Entrée manquante côté moteur.");
    expect(absent.textContent).not.toContain("0,00");
    await unmount(mounted);
  });

  it("réinitialise la saisie, le résultat et l’étape", async () => {
    mockFetch.mockResolvedValue(jsonResponse(EVALUATION_PAYLOAD));
    const mounted = await mount(<WdScenarioCalculator />);
    await fillThroughReview(mounted.container);
    await click(mounted.container, "wd-submit");
    await click(mounted.container, "wd-reset");

    expect(
      pick<HTMLElement>(mounted.container, '[data-testid="wd-result"]').getAttribute(
        "data-result-state",
      ),
    ).toBe("idle");
    const first = pick<HTMLInputElement>(
      mounted.container,
      '[data-testid="wd-quantity-outage_days"] input[inputmode="decimal"]',
    );
    expect(first.value).toBe("");
    expect(
      mounted.container
        .querySelector('[data-testid="wd-step-marker-interruption"]')
        ?.getAttribute("aria-current"),
    ).toBe("step");
    await unmount(mounted);
  });

  it("bloque le calcul et annonce les erreurs quand la saisie est incomplète", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-submit");

    expect(mockFetch).not.toHaveBeenCalled();
    const summary = pick<HTMLElement>(mounted.container, '[data-testid="wd-error-summary"]');
    expect(summary.getAttribute("aria-live")).toBe("assertive");
    expect(summary.textContent).toMatch(/à corriger avant de calculer/);
    await unmount(mounted);
  });

  it("reconduit la saisie sur la première étape fautive plutôt que de laisser un message sans issue", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-submit");

    expect(
      mounted.container
        .querySelector('[data-testid="wd-step-marker-interruption"]')
        ?.getAttribute("aria-current"),
    ).toBe("step");
    expect(
      mounted.container.querySelector('[data-testid="wd-quantity-outage_days"]'),
    ).toBeTruthy();
    await unmount(mounted);
  });
});

/* ============================================== 15 · 16 — Erreurs et 304 */

describe("erreurs API", () => {
  const scenarios: Array<[string, Response, string, RegExp]> = [
    [
      "401",
      jsonResponse({ detail: "unauthenticated" }, { status: 401 }),
      "access_denied",
      /Session expirée/,
    ],
    [
      "403",
      jsonResponse({ detail: "forbidden" }, { status: 403 }),
      "access_denied",
      /n’est pas autorisé/,
    ],
    [
      "503 schema_not_ready",
      jsonResponse({ detail: "schema_not_ready" }, { status: 503 }),
      "schema_unavailable",
      /Schéma non disponible/,
    ],
    [
      "500",
      jsonResponse({ detail: "moteur indisponible" }, { status: 500 }),
      "unexpected_error",
      /Erreur inattendue/,
    ],
  ];

  for (const [name, response, expectedState, expectedText] of scenarios) {
    it(`traduit ${name} en état dédié, jamais en absence de données`, async () => {
      mockFetch.mockResolvedValue(response);
      const mounted = await mount(<WdScenarioCalculator />);
      await fillThroughReview(mounted.container);
      await click(mounted.container, "wd-submit");

      const result = pick<HTMLElement>(mounted.container, '[data-testid="wd-result"]');
      expect(result.getAttribute("data-result-state")).toBe(expectedState);
      expect(result.textContent).toMatch(expectedText);
      expect(result.textContent).not.toMatch(/Résultat absent/);
      await unmount(mounted);
    });
  }

  it("propage une erreur de synthèse sur les six facettes, sans les vider", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: "boum" }, { status: 500 }));
    const mounted = await mount(<WaterDecisionPage />);
    for (const facet of FACET_ORDER) {
      const card = pick<HTMLElement>(mounted.container, `[data-testid="wd-facet-${facet}"]`);
      expect(card.getAttribute("data-facet-state")).toBe("unexpected_error");
    }
    await unmount(mounted);
  });

  it("traite un 304 public comme « inchangé », jamais comme « absent »", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(null, { status: 304, headers: { etag: 'W/"v2"' } }),
    );
    const result = await fetchPublicSnapshot({ knownEtag: 'W/"v1"' });
    expect(result.kind).toBe("not-modified");
    expect(result).not.toHaveProperty("envelope");
    expect(result.etag).toBe('W/"v2"');

    // Et une réponse fraîche reste une enveloppe complète.
    mockFetch.mockResolvedValue(
      jsonResponse(
        { schema_version: "1.0.0", is_empty: true, snapshot: CANONICAL_EMPTY_SNAPSHOT },
        { headers: { etag: 'W/"v2"' } },
      ),
    );
    const fresh = await fetchPublicSnapshot();
    expect(fresh.kind).toBe("fresh");
  });
});

/* ================================================== 17 — Décimales en chaînes */

describe("décimales", () => {
  it("transmet les montants tels quels, en chaînes", async () => {
    mockFetch.mockResolvedValue(jsonResponse(EVALUATION_PAYLOAD));
    const mounted = await mount(<WdScenarioCalculator />);
    await fillThroughReview(mounted.container);
    await click(mounted.container, "wd-submit");

    const body = JSON.parse(String((mockFetch.mock.calls[0][1] as RequestInit).body));
    expect(body.revenue_per_day.value).toBe("1234.56");
    expect(typeof body.revenue_per_day.value).toBe("string");
    expect(body.adaptation_capex.value).toBe("250000");
    expect(body.discount_rate.value).toBe("0.08");
    await unmount(mounted);
  });

  it("normalise la virgule française sans arrondir ni convertir", async () => {
    mockFetch.mockResolvedValue(jsonResponse(EVALUATION_PAYLOAD));
    const mounted = await mount(<WdScenarioCalculator />);
    await fillThroughReview(mounted.container, { outage_days: "12,5" });
    await click(mounted.container, "wd-submit");

    const body = JSON.parse(String((mockFetch.mock.calls[0][1] as RequestInit).body));
    expect(body.outage_days.value).toBe("12.5");
    // La marge saisie « 0,32 » ne devient pas 0.32000000000000001.
    expect(body.margin_rate.value).toBe("0.32");
    await unmount(mounted);
  });

  it("conserve une précision qu’un flottant binaire perdrait", () => {
    const draft = completeDraft((d) => {
      d.quantities.adaptation_capex = {
        value: "10000000000000000.01",
        provenance: "observed",
        basis: "Grand livre",
      };
    });
    const { request } = validateScenarioDraft(draft);
    expect(request?.adaptation_capex.value).toBe("10000000000000000.01");
    // La preuve que la conversion aurait détruit l'information.
    expect(String(Number("10000000000000000.01"))).not.toBe("10000000000000000.01");
  });
});

/* ================================= 18 · 19 · 20 — Mise en page, clavier, motion */

describe("mise en page et accessibilité", () => {
  const sources = () => [read(PAGE), read(CALCULATOR), read(STATES), read(SYNTHESIS)].join("\n");

  it("part du mobile et n’impose aucune largeur fixe en pixels", () => {
    const all = sources();
    expect(all).toContain("grid-cols-1");
    expect(all).toMatch(/md:grid-cols-2|sm:grid-cols-2/);
    // Aucune largeur figée en px : elle produirait un défilement horizontal.
    expect(all).not.toMatch(/\bw-\[\d+px\]/);
  });

  it("enferme chaque table dans un conteneur défilant plutôt que la page", () => {
    const calculator = read(CALCULATOR);
    const tables = calculator.match(/<table/g) ?? [];
    const scrollers = calculator.match(/overflow-x-auto/g) ?? [];
    expect(tables.length).toBeGreaterThan(0);
    expect(scrollers.length).toBeGreaterThanOrEqual(tables.length);
  });

  it("ne rend le résumé collant que sur grand écran", () => {
    const calculator = readCode(CALCULATOR);
    expect(calculator).toContain("lg:sticky");
    // `sticky` non préfixé collerait aussi sur téléphone, où il mangerait la
    // moitié de la surface de saisie. Le `(?<![\w:-])` exclut `lg:sticky`.
    expect(calculator).not.toMatch(/(?<![\w:-])sticky\b/);
  });

  it("n’utilise que des éléments nativement focalisables", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    const interactive = mounted.container.querySelectorAll("button, input, textarea, select, a[href]");
    expect(interactive.length).toBeGreaterThan(0);
    // Aucun gestionnaire de clic posé sur un conteneur non focalisable.
    expect(sources()).not.toMatch(/<(div|span|li|p)[^>]*onClick/);
    await unmount(mounted);
  });

  it("relie chaque erreur à son champ et l’annonce", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-next");
    await click(mounted.container, "wd-submit");

    const invalid = mounted.container.querySelector<HTMLInputElement>("input[aria-invalid='true']");
    expect(invalid).toBeTruthy();
    const describedBy = invalid?.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    // `getElementById` plutôt qu'un sélecteur : les identifiants produits par
    // `useId` contiennent des caractères que CSS exigerait d'échapper.
    const targets = describedBy
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    expect(targets.length).toBe(describedBy.split(" ").length);
    await unmount(mounted);
  });

  it("annonce le résultat en région vivante polie", () => {
    const markup = renderToStaticMarkup(<WdScenarioCalculator />);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-live="assertive"');
  });

  it("neutralise chaque transition sous reduced motion et n’anime rien en boucle", () => {
    const all = sources();
    const transitions = (all.match(/transition-/g) ?? []).filter(
      (_, index, list) => list.length > 0,
    ).length;
    const guarded = (all.match(/motion-reduce:transition-none/g) ?? []).length;
    expect(transitions).toBeGreaterThan(0);
    // Chaque `transition-*` est doublé de son garde-fou.
    expect(guarded * 2).toBe(transitions);
    expect(all).not.toMatch(/\banimate-|infinite/);
  });

  it("ne persiste rien, nulle part", () => {
    const code = [readCode(PAGE), readCode(CALCULATOR), readCode(STATES), readCode(SYNTHESIS)].join(
      "\n",
    );
    expect(code).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  });
});
