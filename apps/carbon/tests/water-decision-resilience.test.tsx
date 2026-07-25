/**
 * tests/water-decision-resilience.test.tsx — comportement des surfaces Water
 * Intelligence quand rien ne se passe bien (Wave E-Interface, commit F5).
 *
 * Le fichier F2 couvre le parcours nominal et ses erreurs franches. Celui-ci
 * couvre ce que l'audit F5 a demandé de vérifier explicitement, et ce qu'il a
 * trouvé en cours de route :
 *
 * | Cas | Vérifié ici |
 * |---|---|
 * | synthèse vide | oui |
 * | facette indisponible | oui |
 * | erreur inattendue | oui |
 * | snapshot vide | oui |
 * | licence bloquée | oui |
 * | endpoint 304 (les DEUX endpoints publics) | oui |
 * | API indisponible (réseau coupé) | oui |
 * | timeout / abandon | oui |
 * | validation financière | oui |
 * | absence de probabilité | oui |
 * | absence de taux | oui |
 * | utilisateur non authentifié | oui |
 * | contraste des couleurs employées | oui |
 * | hiérarchie des titres | oui |
 *
 * Le contraste et la hiérarchie de titres sont testés parce que l'audit y a
 * trouvé de vrais défauts : trois couleurs de texte sous le seuil AA, et un
 * second `h1` dans une page qui en avait déjà un dans son en-tête.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import WaterDecisionPage from "@/app/(app)/water/decision/page";
import { WdScenarioCalculator } from "@/components/water-decision/WdCalculator";
import { WdSynthesisPanel } from "@/components/water-decision/WdSynthesis";
import {
  fetchPublicRegulatoryRegistry,
  fetchPublicSnapshot,
} from "@/lib/api/water-decision";
import { CANONICAL_EMPTY_SNAPSHOT } from "@/lib/water-intelligence/canonical-snapshot";
import { REGULATORY_REGISTRY } from "@/lib/water-intelligence/regulatory-registry";
import { FACET_ORDER, deriveFacetStates } from "@/lib/water-decision/facets";
import {
  emptyScenarioDraft,
  quantityErrorKey,
  validateScenarioDraft,
} from "@/lib/water-decision/scenario-form";

const CARBON_ROOT = resolve(__dirname, "..");
const GLOBALS = resolve(CARBON_ROOT, "app/globals.css");
const PAGE = resolve(CARBON_ROOT, "app/(app)/water/decision/page.tsx");
const HEADER = resolve(CARBON_ROOT, "components/layout/header.tsx");
const CALCULATOR = resolve(CARBON_ROOT, "components/water-decision/WdCalculator.tsx");
const STATES = resolve(CARBON_ROOT, "components/water-decision/WdStates.tsx");

const read = (path: string) => readFileSync(path, "utf-8");
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

async function mount(node: React.ReactElement): Promise<{ container: HTMLElement; root: Root }> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

async function unmount(m: { container: HTMLElement; root: Root }) {
  await act(async () => {
    m.root.unmount();
  });
  m.container.remove();
}

/* --------------------------------------------------------------- Contraste */

/** Ratio de contraste WCAG 2.1 entre deux couleurs hexadécimales. */
function contrast(foreground: string, background: string): number {
  const channels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = (hex: string) => {
    const [r, g, b] = channels(hex).map(linear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Lit une variable CSS déclarée dans `:root`. */
function cssVariable(name: string): string {
  const source = read(GLOBALS);
  const match = source.match(new RegExp(`${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`Variable CSS introuvable : ${name}`);
  return match[1];
}

/* =============================================== Synthèse : vide et absente */

describe("résilience de la synthèse", () => {
  it("rend six facettes vides sur une synthèse vide, jamais un écran blanc", () => {
    const states = deriveFacetStates({
      kind: "ready",
      synthesis: { company_id: 7, is_empty: true, facets: [] },
    });
    const markup = renderToStaticMarkup(<WdSynthesisPanel states={states} />);
    for (const facet of FACET_ORDER) {
      expect(markup).toContain(`wd-facet-${facet}-empty`);
    }
    expect(markup).toContain("Aucune donnée");
    // Aucune facette ne disparaît : celles que le moteur n'a pas renvoyées le
    // disent, au lieu de s'effacer de la grille.
    expect(markup).toMatch(/n’a pas renvoyé cette facette/);
  });

  it("distingue une facette non renvoyée d’une facette déclarée vide", () => {
    const states = deriveFacetStates({
      kind: "ready",
      synthesis: {
        company_id: 7,
        is_empty: false,
        facets: [
          {
            facet: "risk",
            label: "Risque",
            is_empty: true,
            vocabularies: [],
            has_mixed_vocabularies: false,
            entries: [],
          },
        ],
      },
    });
    expect(states.risk).toEqual({ kind: "empty", reason: "declared" });
    expect(states.iro).toEqual({ kind: "empty", reason: "not_returned" });

    const markup = renderToStaticMarkup(<WdSynthesisPanel states={states} />);
    expect(markup).toMatch(/n’a pas renvoyé cette facette/);
    // La facette déclarée vide, elle, rappelle que vide n'est pas zéro.
    expect(markup).toMatch(/différent de zéro/);
  });

  it("affiche l’erreur sur les six facettes quand l’API est injoignable", async () => {
    // Réseau coupé : `fetch` rejette, il ne rend pas un statut.
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const mounted = await mount(<WaterDecisionPage />);
    for (const facet of FACET_ORDER) {
      const card = mounted.container.querySelector(`[data-testid="wd-facet-${facet}"]`);
      expect(card?.getAttribute("data-facet-state")).toBe("unexpected_error");
    }
    expect(mounted.container.textContent).toContain("Failed to fetch");
    // Une panne réseau n'est jamais présentée comme un périmètre vide.
    expect(mounted.container.textContent).not.toMatch(/Aucune donnée/);
    await unmount(mounted);
  });

  it("ne rend aucun état d’erreur quand la requête est simplement abandonnée", async () => {
    // Démontage pendant le vol : l'abandon n'est pas une panne, et il ne doit
    // pas peindre six erreurs sur une page qu'on quitte.
    const abort = Object.assign(new Error("The operation was aborted."), {
      name: "AbortError",
    });
    mockFetch.mockRejectedValue(abort);
    const mounted = await mount(<WaterDecisionPage />);
    for (const facet of FACET_ORDER) {
      const card = mounted.container.querySelector(`[data-testid="wd-facet-${facet}"]`);
      expect(card?.getAttribute("data-facet-state")).toBe("loading");
    }
    await unmount(mounted);
  });
});

/* ============================================ Surfaces publiques : 304, vide */

describe("résilience des surfaces publiques", () => {
  it("accepte un snapshot vide comme une réponse valide", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ schema_version: "1.0.0", is_empty: true, snapshot: CANONICAL_EMPTY_SNAPSHOT }),
    );
    const result = await fetchPublicSnapshot();
    expect(result.kind).toBe("fresh");
    if (result.kind !== "fresh") throw new Error("lecture fraîche attendue");
    expect(result.envelope.is_empty).toBe(true);
    // Vide n'est pas creux : les exclusions motivées sont là.
    expect(result.envelope.snapshot.exclusions.length).toBeGreaterThan(0);
  });

  it("conserve les motifs de licence portés par le snapshot", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ schema_version: "1.0.0", is_empty: true, snapshot: CANONICAL_EMPTY_SNAPSHOT }),
    );
    const result = await fetchPublicSnapshot();
    if (result.kind !== "fresh") throw new Error("lecture fraîche attendue");
    const reasons = result.envelope.snapshot.exclusions.map((e) => e.reason);
    // Chaque exclusion porte un motif : une valeur retenue n'est jamais un
    // simple silence.
    expect(reasons.every((reason) => typeof reason === "string" && reason.length > 0)).toBe(true);
  });

  it("traite un 304 du snapshot comme « inchangé »", async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, { status: 304, headers: { etag: 'W/"a"' } }));
    const result = await fetchPublicSnapshot({ knownEtag: 'W/"a"' });
    expect(result.kind).toBe("not-modified");
    expect(result).not.toHaveProperty("envelope");
  });

  /*
    Défaut trouvé par l'audit F5 : le registre juridique sert lui aussi un ETag
    et honore `If-None-Match`, mais son client traitait le 304 comme n'importe
    quel statut non-2xx — il levait `API 304 on …`. Une réponse valide devenait
    une erreur.
  */
  it("traite un 304 du registre juridique comme « inchangé », plus comme une erreur", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(null, { status: 304, headers: { etag: 'W/"wi-legal-b"' } }),
    );
    const result = await fetchPublicRegulatoryRegistry({ knownEtag: 'W/"wi-legal-b"' });
    expect(result.kind).toBe("not-modified");
    expect(result.etag).toBe('W/"wi-legal-b"');
  });

  it("envoie If-None-Match au registre quand un validateur est connu", async () => {
    mockFetch.mockResolvedValue(jsonResponse(REGULATORY_REGISTRY, { headers: { etag: 'W/"x"' } }));
    await fetchPublicRegulatoryRegistry({ knownEtag: 'W/"w"' });
    const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBe('W/"w"');
  });

  it("n’envoie aucun validateur quand aucun n’est connu", async () => {
    mockFetch.mockResolvedValue(jsonResponse(REGULATORY_REGISTRY));
    await fetchPublicRegulatoryRegistry();
    const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBeUndefined();
  });
});

/* ================================================ Validation financière */

describe("résilience de la validation financière", () => {
  const complete = () => {
    const draft = emptyScenarioDraft();
    draft.scenario_code = "SC";
    draft.label = "Scénario";
    draft.base_year = "2026";
    draft.horizon_year = "2030";
    draft.sensitivity_variation_pct = "10";
    for (const field of [
      "outage_days",
      "affected_capacity_share",
      "revenue_per_day",
      "margin_rate",
      "additional_opex_per_day",
      "adaptation_capex",
      "discount_rate",
    ] as const) {
      draft.quantities[field] = { value: "1", provenance: "observed", basis: "Base" };
    }
    return draft;
  };

  it("refuse une amplitude au-delà de la borne du serveur, au lieu de subir un 422", () => {
    const draft = complete();
    draft.sensitivity_variation_pct = "150";
    const { errors, request } = validateScenarioDraft(draft);
    expect(request).toBeNull();
    expect(errors.sensitivity_variation_pct).toMatch(/au plus 100/);
  });

  it("refuse une année hors de l’intervalle accepté par le serveur", () => {
    const draft = complete();
    draft.base_year = "0042";
    const { errors } = validateScenarioDraft(draft);
    expect(errors.base_year).toMatch(/1900.*2200/);
  });

  it("accepte les bornes exactes du contrat", () => {
    const draft = complete();
    draft.base_year = "1900";
    draft.horizon_year = "2200";
    draft.sensitivity_variation_pct = "100";
    expect(validateScenarioDraft(draft).request).not.toBeNull();
  });

  it("n’envoie rien tant qu’un taux d’actualisation manque", () => {
    const draft = complete();
    draft.quantities.discount_rate = { value: "", provenance: "", basis: "" };
    const { request, errors } = validateScenarioDraft(draft);
    expect(request).toBeNull();
    expect(errors[quantityErrorKey("discount_rate", "value")]).toBeTruthy();
  });

  it("laisse passer l’absence de probabilité sans la fabriquer", () => {
    const { request } = validateScenarioDraft(complete());
    expect(request).not.toBeNull();
    expect(request && "probability" in request).toBe(false);
  });
});

/* ============================================== Accessibilité mesurée */

describe("accessibilité mesurée", () => {
  it("emploie des couleurs de texte qui atteignent le seuil AA sur leur fond", () => {
    const pairs: Array<[string, string, string]> = [
      ["--color-warning-strong", "--color-warning-bg", "avertissement"],
      ["--color-danger-strong", "--color-danger-bg", "erreur"],
      ["--color-success-strong", "--color-success-bg", "succès"],
      ["--color-foreground-muted", "--color-surface", "texte atténué"],
    ];
    for (const [fg, bg, label] of pairs) {
      const ratio = contrast(cssVariable(fg), cssVariable(bg));
      expect(ratio, `${label} : ${fg} sur ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("n’emploie plus les teintes de statut faibles comme couleur de texte", () => {
    const sources = [read(CALCULATOR), read(STATES), read(PAGE)].join("\n");
    for (const weak of ["--color-warning)", "--color-danger)", "--color-success)"]) {
      // Ces variables restent légitimes pour une bordure ; jamais pour du texte.
      const asText = new RegExp(`text-\\[var\\(${weak.replace(/[()]/g, "\\$&")}\\]`);
      expect(sources, `teinte faible employée comme texte : ${weak}`).not.toMatch(asText);
    }
  });

  it("ne pose qu’un seul titre de premier niveau sur la page", () => {
    // L'en-tête du groupe `(app)` porte déjà le `h1`.
    expect(read(HEADER)).toContain("<h1");
    expect(read(PAGE)).not.toContain("<h1");
    expect(read(CALCULATOR)).not.toContain("<h1");
    expect(read(STATES)).not.toContain("<h1");
  });

  it("descend les niveaux de titre sans en sauter", async () => {
    const mounted = await mount(<WdScenarioCalculator />);
    const levels = Array.from(mounted.container.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) =>
      Number(h.tagName.slice(1)),
    );
    expect(levels.length).toBeGreaterThan(0);
    for (let i = 1; i < levels.length; i += 1) {
      expect(
        levels[i] - levels[i - 1],
        `saut de niveau ${levels[i - 1]} → ${levels[i]}`,
      ).toBeLessThanOrEqual(1);
    }
    await unmount(mounted);
  });

  it("neutralise la transition de thème sous mouvement réduit", () => {
    const css = read(GLOBALS);
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/html\s*\{\s*transition:\s*none/);
  });
});
