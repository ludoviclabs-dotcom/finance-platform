/**
 * Materials Data Trust — garde-fous PR-01.
 *
 * Verrouille l'alignement du module /materials sur la réalité des données :
 * modèle critique/stratégique non exclusif, score CarbonCo renommé, absence de
 * faux historique de prix, méthodologie visible et honnête.
 */

import { describe, it, expect } from "vitest";

import {
  getMaterials,
  summarize,
  getChinaShare,
  isChinaConcentrated,
  hasRenderableHistory,
  isSnapshotStale,
  CHINA_DOMINANCE_THRESHOLD,
  STALE_AFTER_DAYS,
  type Material,
} from "@/lib/crm/dataLoader";
import snapshot from "@/data/crm_full_34_snapshot_2026-06-30.json";
import featureStatus from "@/data/feature-status.json";

const LEGACY_FIELDS = ["criticality_eu", "criticality_score", "china_dominant"] as const;

describe("Modèle CRMA — critique / stratégique non exclusif", () => {
  it("toute matière est critique (is_critical_eu=true)", async () => {
    const { materials } = await getMaterials();
    for (const m of materials) {
      expect(m.is_critical_eu, `${m.id} devrait être critique`).toBe(true);
    }
  });

  it("toute matière stratégique est aussi critique", async () => {
    const { materials } = await getMaterials();
    const strategicNotCritical = materials.filter(m => m.is_strategic_eu && !m.is_critical_eu);
    expect(strategicNotCritical).toEqual([]);
  });

  it("le nombre de stratégiques est cohérent avec strategic_count", async () => {
    const { materials, strategic_count } = await getMaterials();
    const strategic = materials.filter(m => m.is_strategic_eu).length;
    expect(strategic).toBe(strategic_count);
    expect(strategic).toBe(17);
  });

  it("les stratégiques sont un SOUS-ENSEMBLE strict des critiques", async () => {
    const { materials } = await getMaterials();
    const critical = materials.filter(m => m.is_critical_eu).length;
    const strategic = materials.filter(m => m.is_strategic_eu).length;
    expect(strategic).toBeLessThan(critical);
    expect(critical).toBe(materials.length);
  });

  it("aucun champ hérité (criticality_eu / criticality_score / china_dominant) ne subsiste", () => {
    for (const m of snapshot.materials as Record<string, unknown>[]) {
      for (const legacy of LEGACY_FIELDS) {
        expect(legacy in m, `${legacy} devrait avoir disparu du snapshot`).toBe(false);
      }
    }
  });

  it("chaque matière porte regulation_version et les métadonnées du score CarbonCo", async () => {
    const { materials } = await getMaterials();
    for (const m of materials) {
      expect(m.regulation_version).toBe("CRMA-2024");
      expect(typeof m.carbonco_supply_risk_score === "number" || m.carbonco_supply_risk_score === null).toBe(true);
      expect(m.score_methodology_version).toBe("CC-SUPPLY-RISK-0.1");
      // Aucune méthode de confiance formalisée à ce stade → confiance non affirmée.
      expect(m.score_confidence).toBeNull();
    }
  });
});

describe("Dérivation « concentration Chine » (remplace china_dominant figé)", () => {
  it("getChinaShare lit la part du producteur Chine, 0 si absent", async () => {
    const { materials } = await getMaterials();
    const antimony = materials.find(m => m.id === "antimony")!;
    expect(getChinaShare(antimony)).toBe(48);
    const cobalt = materials.find(m => m.id === "cobalt")!;
    expect(getChinaShare(cobalt)).toBe(0);
  });

  it("isChinaConcentrated applique le seuil documenté (≥ 50%)", async () => {
    const { materials } = await getMaterials();
    const antimony = materials.find(m => m.id === "antimony")!; // 48% → sous le seuil
    const gallium = materials.find(m => m.id === "gallium")!;   // 98% → au-dessus
    expect(CHINA_DOMINANCE_THRESHOLD).toBe(50);
    expect(isChinaConcentrated(antimony)).toBe(false);
    expect(isChinaConcentrated(gallium)).toBe(true);
  });
});

describe("isSnapshotStale — calcul déterministe, injectable (pas de Date.now() implicite en test)", () => {
  it("n'est pas périmé sous le seuil", () => {
    const now = new Date("2026-07-16").getTime();
    expect(isSnapshotStale("2026-06-30", now)).toBe(false);
  });

  it("est périmé au-delà du seuil", () => {
    const now = new Date("2026-06-30").getTime() + (STALE_AFTER_DAYS + 1) * 86_400_000;
    expect(isSnapshotStale("2026-06-30", now)).toBe(true);
  });

  it("n'est pas périmé exactement au seuil (comparaison stricte)", () => {
    const now = new Date("2026-06-30").getTime() + STALE_AFTER_DAYS * 86_400_000;
    expect(isSnapshotStale("2026-06-30", now)).toBe(false);
  });

  it("renvoie false pour une date invalide plutôt que de planter", () => {
    expect(isSnapshotStale("not-a-date", Date.now())).toBe(false);
  });
});

describe("Historique de prix — pas de tendance sur un seul point", () => {
  it("hasRenderableHistory exige au moins 2 points datés", () => {
    expect(hasRenderableHistory([])).toBe(false);
    expect(hasRenderableHistory([{ date: "2026-06-30", value: 1, unit: "x" }])).toBe(false);
    expect(hasRenderableHistory([
      { date: "2026-06-30", value: 1, unit: "x" },
      { date: "2026-07-07", value: 2, unit: "x" },
    ])).toBe(true);
    expect(hasRenderableHistory(undefined)).toBe(false);
  });

  it("aucune matière du snapshot n'a assez d'historique pour une courbe (1 seul relevé)", async () => {
    const { materials } = await getMaterials();
    const withRenderable = materials.filter(m => hasRenderableHistory(m.price_history));
    // État actuel : le snapshot n'a jamais été rafraîchi → 1 point max partout.
    // Ce test documente l'invariant et échouera légitimement le jour où un vrai
    // 2ᵉ snapshot daté sera publié (il faudra alors autoriser les courbes).
    expect(withRenderable).toEqual([]);
  });
});

describe("summarize() — indicateurs dérivés, aucun chiffre en dur", () => {
  it("calcule les compteurs depuis le dataset", async () => {
    const { materials } = await getMaterials();
    const s = summarize(materials);
    expect(s.total).toBe(materials.length);
    expect(s.critical).toBe(materials.length);
    expect(s.strategic).toBe(materials.filter(m => m.is_strategic_eu).length);
    expect(s.chinaConcentrated).toBe(materials.filter(m => isChinaConcentrated(m)).length);
    expect(s.withPrice).toBe(materials.filter(m => m.price_snapshot !== null).length);
    expect(s.chinaThreshold).toBe(CHINA_DOMINANCE_THRESHOLD);
  });

  it("estimatedPct vaut 100 tant que toutes les valeurs sont estimées", async () => {
    const { materials } = await getMaterials();
    expect(summarize(materials).estimatedPct).toBe(100);
    expect(materials.every(m => m.data_quality === "estimated")).toBe(true);
  });

  it("estimatedPct est robuste au dataset vide", () => {
    expect(summarize([] as Material[]).estimatedPct).toBe(0);
  });
});

describe("Transparence — méthodologie visible et honnête", () => {
  it("methodology_note existe et signale le caractère estimé/non normatif", async () => {
    const { methodology_note } = await getMaterials();
    expect(methodology_note.length).toBeGreaterThan(40);
    expect(methodology_note.toLowerCase()).toMatch(/estim|d[ée]mo|illustrat/);
  });

  it("la description du module ne promet ni « donnée non inventée » ni rafraîchissement hebdomadaire", () => {
    const feat = featureStatus.features.find(f => f.id === "materiaux-critiques")!;
    expect(feat).toBeTruthy();
    expect(feat.description).not.toMatch(/aucune donn[ée]e invent[ée]e/i);
    expect(feat.description).not.toMatch(/hebdomadaire/i);
    expect(feat.description.toLowerCase()).toMatch(/estim|d[ée]monstration/);
  });
});
