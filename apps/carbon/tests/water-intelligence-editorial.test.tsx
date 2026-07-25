/**
 * water-intelligence-editorial.test.tsx — contenus sourcés (P12, Wave C).
 *
 * Vérifie les garde-fous, pas des textes : source obligatoire, date de revue
 * obligatoire, réviseur obligatoire, aucun classement d'acteur sans méthode,
 * aucun chiffre sans provenance, date d'événement distincte de la publication,
 * et rendu accessible sans carte.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  WiEditorialEmpty,
  WiEditorialList,
  WiEventItem,
} from "@/components/water-intelligence/WiEditorial";
import type { WaterEditorialRecord } from "@/lib/water-intelligence/contracts";
import {
  EDITORIAL_SECTIONS,
  PUBLISHED_EDITORIAL_RECORDS,
  containsUnsourcedFigure,
  rejectsRanking,
  recordsOfType,
  validateEditorialRecords,
} from "@/lib/water-intelligence/editorial";

const SOURCE = {
  source_code: "FIXTURE_SOURCE",
  release_key: "fixture-release",
  checksum_sha256: "c".repeat(64),
  retrieved_at: "2026-01-15",
  published_at: "2026-01-10",
  methodology_version: "1.0.0",
  license: {
    allow_ingest: true,
    allow_store: true,
    allow_display: true,
    allow_derived_use: true,
    reasons: [],
    warnings: [],
  },
  attribution: "Source de test",
  warnings: [],
};

function record(overrides: Partial<WaterEditorialRecord> = {}): WaterEditorialRecord {
  return {
    record_id: "rec-1",
    record_type: "industry",
    title: "Titre",
    summary: "Résumé sans quantité.",
    jurisdiction: "France",
    valid_from: "2026-01-05",
    valid_to: null,
    source: SOURCE,
    reviewed_on: "2026-01-20",
    reviewed_by: "Réviseur de test",
    ...overrides,
  } as WaterEditorialRecord;
}

describe("aucun contenu n'est publié à ce jour", () => {
  it("le jeu publié est vide", () => {
    expect(PUBLISHED_EDITORIAL_RECORDS).toHaveLength(0);
  });

  it("les deux ancres du blueprint sont déclarées", () => {
    expect(EDITORIAL_SECTIONS.event.anchor).toBe("evenements");
    expect(EDITORIAL_SECTIONS.innovation.anchor).toBe("innovations");
  });
});

describe("garde-fous de publication", () => {
  it("accepte un record complet", () => {
    const { published, rejected } = validateEditorialRecords([record()]);

    expect(published).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("refuse un record sans réviseur", () => {
    const { published, rejected } = validateEditorialRecords([record({ reviewed_by: "" })]);

    expect(published).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/réviseur|reviewed_by|1 character/i);
  });

  it("refuse un record sans date de revue", () => {
    const invalid = { ...record() } as Record<string, unknown>;
    delete invalid.reviewed_on;

    const { published } = validateEditorialRecords([invalid]);

    expect(published).toHaveLength(0);
  });

  it("refuse un record sans source", () => {
    const invalid = { ...record() } as Record<string, unknown>;
    delete invalid.source;

    const { published } = validateEditorialRecords([invalid]);

    expect(published).toHaveLength(0);
  });

  it("nomme chaque record écarté plutôt que de l'ignorer", () => {
    const { rejected } = validateEditorialRecords([record({ record_id: "rec-ko", reviewed_by: "" })]);

    expect(rejected[0].id).toBe("rec-ko");
    expect(rejected[0].reason.length).toBeGreaterThan(0);
  });
});

describe("acteurs — aucun classement sans méthode", () => {
  it("détecte un rang explicite", () => {
    expect(rejectsRanking({ ...record({ record_type: "actor" }), rank: 1 })).toBe(true);
    expect(rejectsRanking({ ...record({ record_type: "actor" }), classement: 2 })).toBe(true);
    expect(rejectsRanking(record({ record_type: "actor" }))).toBe(false);
  });

  it("écarte un acteur porteur d'un rang", () => {
    const { published, rejected } = validateEditorialRecords([
      { ...record({ record_type: "actor" }), rank: 1 },
    ]);

    expect(published).toHaveLength(0);
    expect(rejected[0].reason).toContain("méthodologie objective");
  });

  it("rend les acteurs en liste non ordonnée", () => {
    const html = renderToStaticMarkup(
      <WiEditorialList type="actor" records={[record({ record_type: "actor" })]} />,
    );

    expect(html).toContain("<ul");
    expect(html).not.toContain("<ol");
  });
});

describe("chiffres — aucune statistique sans provenance", () => {
  it("détecte une quantité dans un résumé non sourcé", () => {
    const unsourced = record({
      summary: "Les prélèvements atteignent 120 Mm³.",
      source: { ...SOURCE, source_code: "", release_key: "" } as never,
    });

    expect(containsUnsourcedFigure(unsourced)).toBe(true);
  });

  it("accepte une quantité quand la source est identifiée", () => {
    const sourced = record({ summary: "Les prélèvements atteignent 120 Mm³." });

    expect(containsUnsourcedFigure(sourced)).toBe(false);
  });

  it("ne se déclenche pas sur une année seule", () => {
    expect(containsUnsourcedFigure(record({ summary: "Depuis 2024, le suivi est continu." }))).toBe(
      false,
    );
  });
});

describe("événements", () => {
  it("exige une date d'événement", () => {
    const { published } = validateEditorialRecords([
      record({ record_type: "event", valid_from: null }),
    ]);

    expect(published).toHaveLength(0);
  });

  it("exige un territoire", () => {
    const { published } = validateEditorialRecords([
      record({ record_type: "event", jurisdiction: null }),
    ]);

    expect(published).toHaveLength(0);
  });

  it("rend la date de l'événement distinctement de celle de la source", () => {
    const html = renderToStaticMarkup(
      <WiEventItem record={record({ record_type: "event", valid_from: "2026-01-05" })} />,
    );

    expect(html).toContain("2026-01-05");
    expect(html).toContain("distincte de la date de publication");
  });
});

describe("rendu", () => {
  it("affiche toujours la revue humaine", () => {
    const html = renderToStaticMarkup(<WiEditorialList type="industry" records={[record()]} />);

    expect(html).toContain("Revu le 2026-01-20");
    expect(html).toContain("Réviseur de test");
  });

  it("rend un état vide honnête, sans exemple inventé", () => {
    const html = renderToStaticMarkup(<WiEditorialEmpty type="event" />);

    expect(html).toContain("Aucun contenu publié");
    expect(html).toContain("réviseur identifié");
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("le contenu reste accessible sans carte", () => {
    const html = renderToStaticMarkup(<WiEditorialList type="industry" records={[record()]} />);

    expect(html).toContain("Titre");
    expect(html).not.toContain("<svg");
  });

  it("filtre par type", () => {
    const records = [record({ record_type: "event" }), record({ record_type: "innovation" })];

    expect(recordsOfType(records, "event")).toHaveLength(1);
  });
});
