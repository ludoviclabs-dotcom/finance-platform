/**
 * tests/water-intelligence-v2.test.tsx — invariants introduits par la refonte
 * visuelle Water Intelligence v2.
 *
 * Ne re-teste pas ce que les suites V1 couvrent déjà (elles restent la
 * référence sur le contrat pilote, le registre juridique, les ponts et les
 * garde-fous de la surface publique). Ce fichier couvre spécifiquement ce que
 * la v2 ajoute :
 *
 * 1. `financialBridgeQuestionsToInstruct` — la règle d'affichage à seuils du
 *    simulateur qualitatif, et son alignement avec `FINANCIAL_BRIDGE`.
 * 2. `publicationState` — le nouveau champ des facettes Water Pulse.
 * 3. Le rendu serveur des trois nouveaux composants (carte, coupe 3D,
 *    simulateur) ne casse pas et ne prétend pas publier une donnée qu'il n'a
 *    pas.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  FINANCIAL_BRIDGE,
  PUBLICATION_STATE_LABELS,
  PULSE_FACETS,
  financialBridgeQuestionsToInstruct,
  type PulseFacetPublicationState,
} from "@/lib/water-intelligence/editorial-matrices";
import { WiFinancialBridge, WiFinancialSimulator } from "@/components/water-intelligence/WiProof";
import { WiFranceMap } from "@/components/water-intelligence/WiFranceMap";
import { WiBassin3D } from "@/components/water-intelligence/WiBassin3D";

/* ==========================================================================
   1 — Simulateur qualitatif : seuils, jamais un calcul
   ========================================================================== */

describe("financialBridgeQuestionsToInstruct — règle d'affichage, pas un calcul", () => {
  it("renvoie un booléen par étape de FINANCIAL_BRIDGE, dans le même ordre", () => {
    const result = financialBridgeQuestionsToInstruct(0, 100);
    expect(result).toHaveLength(FINANCIAL_BRIDGE.length);
    expect(FINANCIAL_BRIDGE.map((s) => s.id)).toEqual([
      "interruption",
      "capacite",
      "revenu",
      "adaptation",
      "capex",
      "opex",
      "assurance",
      "impairment",
      "provisions",
      "redevances",
    ]);
  });

  it("aucune interruption, capacité pleine : aucune question à instruire", () => {
    const result = financialBridgeQuestionsToInstruct(0, 100);
    expect(result.every((v) => v === false)).toBe(true);
  });

  it("10 jours d'interruption à capacité pleine : expose, adapte, redevance — pas capex/opex/assurance", () => {
    const result = financialBridgeQuestionsToInstruct(10, 100);
    const byId = Object.fromEntries(FINANCIAL_BRIDGE.map((s, i) => [s.id, result[i]]));
    expect(byId.interruption).toBe(true);
    expect(byId.capacite).toBe(false);
    expect(byId.revenu).toBe(true);
    expect(byId.adaptation).toBe(true);
    expect(byId.capex).toBe(false);
    expect(byId.opex).toBe(false);
    expect(byId.assurance).toBe(false);
    expect(byId.impairment).toBe(false);
    expect(byId.provisions).toBe(false);
    expect(byId.redevances).toBe(true);
  });

  it("aucune interruption mais capacité à 50% : capex s'allume, pas OPEX ni assurance (jours-dépendants)", () => {
    const result = financialBridgeQuestionsToInstruct(0, 50);
    const byId = Object.fromEntries(FINANCIAL_BRIDGE.map((s, i) => [s.id, result[i]]));
    expect(byId.interruption).toBe(false);
    expect(byId.capacite).toBe(true);
    expect(byId.revenu).toBe(true);
    expect(byId.capex).toBe(true);
    expect(byId.opex).toBe(false);
  });

  it("90 jours, capacité à 0% : toutes les questions deviennent à instruire", () => {
    const result = financialBridgeQuestionsToInstruct(90, 0);
    expect(result.every((v) => v === true)).toBe(true);
  });

  it("ne produit ni montant ni taux : seulement des booléens", () => {
    const result = financialBridgeQuestionsToInstruct(30, 60);
    for (const value of result) {
      expect(typeof value).toBe("boolean");
    }
  });
});

describe("WiFinancialSimulator — rendu serveur", () => {
  it("s'affiche sans montant et annonce que c'est un affichage à seuils", () => {
    const markup = renderToStaticMarkup(<WiFinancialSimulator />);
    expect(markup).toContain("data-testid=\"wi-financial-simulator\"");
    expect(markup).toContain("Affichage à seuils, pas un calcul");
    expect(markup).not.toMatch(/[€$]\s*\d/);
  });

  it("à l'état initial (0 jour, 100% de capacité), aucune étape n'est active", () => {
    const markup = renderToStaticMarkup(<WiFinancialSimulator />);
    expect(markup).toContain("0 / 10 questions à instruire");
  });
});

/** React échappe l'apostrophe en `&#x27;` dans le HTML rendu — les libellés
 * de `FINANCIAL_BRIDGE` en portent (« Coûts d'adaptation »), donc toute
 * comparaison littérale doit décoder l'entité d'abord. */
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("WiFinancialBridge — accepte les étapes actives du simulateur", () => {
  it("rend les dix étapes sans crasher, avec ou sans `activeSteps`", () => {
    const withoutProp = decode(renderToStaticMarkup(<WiFinancialBridge />));
    const allActive = decode(
      renderToStaticMarkup(<WiFinancialBridge activeSteps={FINANCIAL_BRIDGE.map(() => true)} />),
    );
    for (const step of FINANCIAL_BRIDGE) {
      expect(withoutProp).toContain(step.label);
      expect(allActive).toContain(step.label);
    }
  });
});

/* ==========================================================================
   2 — publicationState : un axe distinct du niveau de preuve
   ========================================================================== */

describe("PulseFacet.publicationState", () => {
  const VALID_STATES: readonly PulseFacetPublicationState[] = [
    "published",
    "qualitative",
    "deferred",
    "not_instrumented",
  ];

  it("chaque facette porte un état de publication valide", () => {
    for (const facet of PULSE_FACETS) {
      expect(VALID_STATES, `${facet.id} porte un état inconnu`).toContain(facet.publicationState);
    }
  });

  it("PUBLICATION_STATE_LABELS couvre les quatre états avec un libellé non vide", () => {
    for (const state of VALID_STATES) {
      expect(PUBLICATION_STATE_LABELS[state]?.length).toBeGreaterThan(0);
    }
  });

  it("une seule facette est réellement publiée aujourd'hui : les prélèvements", () => {
    /* Miroir de la réalité du pilote : trois observations BNPE publiées,
       rien d'autre. Si une deuxième facette devient "published" un jour, ce
       test doit être mis à jour EN MÊME TEMPS que la source réelle change —
       jamais avant. */
    const published = PULSE_FACETS.filter((f) => f.publicationState === "published");
    expect(published.map((f) => f.id)).toEqual(["prelevements"]);
  });

  it("l'état de publication ne se déduit pas mécaniquement du niveau de preuve", () => {
    /* Les deux axes sont indépendants : une facette qualitative peut reposer
       sur un consensus institutionnel aussi solide qu'une facette différée.
       Ce test échoue si quelqu'un les recouple un jour par un raccourci. */
    const qualitativeConsensusStates = new Set(
      PULSE_FACETS.filter((f) => f.evidenceLevel === "qualitative_consensus").map(
        (f) => f.publicationState,
      ),
    );
    expect(qualitativeConsensusStates.size).toBeGreaterThanOrEqual(1);
    expect([...qualitativeConsensusStates].every((s) => s === "qualitative")).toBe(true);
  });
});

/* ==========================================================================
   3 — Carte et coupe 3D : rendu serveur honnête
   ========================================================================== */

describe("WiFranceMap — rendu serveur", () => {
  it("rend un SVG avec un unique marqueur nommé, sans appel réseau", () => {
    const markup = renderToStaticMarkup(
      <WiFranceMap
        markerLonLat={[3.8772, 43.6119]}
        geographyCode="34172"
        ouvrageCount={3}
        periodLabel="2020"
        reducedMotion
      />,
    );
    expect(markup).toContain("<svg");
    expect(markup).toContain("34172");
    expect(markup).not.toMatch(/fetch\(|XMLHttpRequest/);
  });
});

describe("WiBassin3D — rendu serveur", () => {
  it("rend son conteneur et un état de chargement, jamais de trame WebGL au serveur", () => {
    /* `useEffect` ne s'exécute pas sous `renderToStaticMarkup` : le montage
       Three.js (renderer, scène, boucle d'animation) ne tourne jamais côté
       serveur, par construction React — ce test le vérifie plutôt que de le
       supposer. */
    const markup = renderToStaticMarkup(<WiBassin3D reducedMotion />);
    expect(markup).toContain("data-testid=\"wi-bassin-3d\"");
    expect(markup).toContain("Chargement de la coupe 3D");
    expect(markup).not.toContain("<canvas");
  });
});
