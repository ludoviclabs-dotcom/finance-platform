/**
 * crma-presentation.test.ts — garde-fous de présentation CRMA (PR-07).
 *
 * Ces tests protègent les règles qui, si elles cassaient, produiraient un
 * affichage FAUX plutôt qu'une erreur visible :
 *   - un risque absent ne doit jamais se lire « faible » ;
 *   - risque et confiance gardent deux vocabulaires distincts ;
 *   - la fiche produit annonce bien la feature en BETA.
 */

import { describe, it, expect } from "vitest";
import { confidenceBand, formatPct, riskBand } from "@/lib/api/crma";
import registry from "@/data/feature-status.json";

describe("riskBand", () => {
  it("ne présente jamais un risque absent comme faible", () => {
    const band = riskBand(null);
    expect(band.tone, "un score absent doit être 'unknown', jamais 'low'").toBe("unknown");
    expect(band.label).toBe("Non calculé");
  });

  it("classe les scores par palier croissant", () => {
    expect(riskBand(10).tone).toBe("low");
    expect(riskBand(30).tone).toBe("moderate");
    expect(riskBand(60).tone).toBe("high");
    expect(riskBand(90).tone).toBe("severe");
  });

  it("traite NaN comme inconnu, pas comme zéro", () => {
    expect(riskBand(Number.NaN).tone).toBe("unknown");
  });
});

describe("confidenceBand", () => {
  it("emploie un vocabulaire distinct de celui du risque", () => {
    const riskLabels = [riskBand(10), riskBand(30), riskBand(60), riskBand(90)].map((b) => b.label);
    const confLabels = [confidenceBand(10), confidenceBand(50), confidenceBand(90)].map(
      (b) => b.label,
    );
    for (const label of confLabels) {
      expect(
        riskLabels,
        `« ${label} » ne doit pas être réutilisé pour le risque — les deux axes ne se confondent pas`,
      ).not.toContain(label);
      expect(label).toMatch(/[Dd]ocumentation/);
    }
  });

  it("classe la confiance par palier croissant", () => {
    expect(confidenceBand(10).tone).toBe("weak");
    expect(confidenceBand(50).tone).toBe("partial");
    expect(confidenceBand(85).tone).toBe("solid");
  });
});

describe("formatPct", () => {
  it("rend « n. d. » plutôt que 0 quand la donnée manque", () => {
    expect(formatPct(null)).toBe("n. d.");
    expect(formatPct(undefined)).toBe("n. d.");
    expect(formatPct(Number.NaN)).toBe("n. d.");
    expect(formatPct(0)).toBe("0.0 %");
  });
});

describe("fiche produit CRMA", () => {
  const feature = registry.features.find((f) => f.id === "crma-exposition-matieres");

  it("est déclarée en BETA avec sa preuve", () => {
    expect(feature, "la feature CRMA doit exister dans feature-status.json").toBeDefined();
    expect(feature?.statut).toBe("beta");
    expect(feature?.href).toBe("/crma");
    expect(feature?.preuve).toBeTruthy();
  });

  it("ne présente jamais le score comme officiel UE", () => {
    const description = feature?.description ?? "";
    // Toute mention de « score officiel » doit être NIÉE. On vérifie chaque
    // occurrence plutôt que la simple présence d'un démenti quelque part :
    // une description pourrait sinon nier une fois et affirmer ailleurs.
    const mentions = [...description.matchAll(/score officiel/gi)];
    expect(mentions.length, "la description doit qualifier le score").toBeGreaterThan(0);
    for (const mention of mentions) {
      const before = description.slice(Math.max(0, mention.index - 20), mention.index);
      expect(
        before,
        `« score officiel » doit être précédé d'une négation, trouvé : « …${before} »`,
      ).toMatch(/n'est pas un |pas un /i);
    }
  });

  it("annonce la séparation risque / confiance", () => {
    expect(feature?.description ?? "").toMatch(/risque et la confiance/i);
  });

  it("n'existe pas en double dans le registre", () => {
    const ids = registry.features.map((f) => f.id);
    expect(new Set(ids).size, "ids de features dupliqués").toBe(ids.length);
  });
});
