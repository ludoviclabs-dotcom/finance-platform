/**
 * Tests structurels de la nav V2 (refonte V2, PR 1).
 *
 * Garantit que la nav V2 respecte les contraintes définies par l'audit V2 :
 * - exactement 6 entrées top-level
 * - libellés cibles présents (Produit, Preuves, Secteurs, Ressources, À propos, Contact)
 * - aucun des doublons V1 retirés ("Preuve produit", "Proof Console" simultanés ;
 *   "Publications", "Dossier" en top-level)
 * - le dernier item est marqué `primary: true` (= CTA bouton)
 */

import { describe, expect, it } from "vitest";

import { NAV_V2, FOOTER_V2, STATUS_LABELS_SHORT } from "@/lib/navigation";

describe("Navigation V2", () => {
  it("exposes exactly 6 top-level entries", () => {
    expect(NAV_V2).toHaveLength(6);
  });

  it("uses the 6 target labels in order", () => {
    expect(NAV_V2.map((item) => item.label)).toEqual([
      "Produit",
      "Preuves",
      "Secteurs",
      "Ressources",
      "À propos",
      "Contact",
    ]);
  });

  it("marks the last item (Contact) as primary CTA", () => {
    expect(NAV_V2[NAV_V2.length - 1]?.primary).toBe(true);
    // Aucun autre item ne doit porter primary=true (un seul CTA bouton).
    const primaries = NAV_V2.filter((item) => item.primary);
    expect(primaries).toHaveLength(1);
  });

  it("does not expose the V1 duplicates 'Preuve produit' or 'Proof Console' at top-level", () => {
    const labels = NAV_V2.map((item) => item.label);
    expect(labels).not.toContain("Preuve produit");
    expect(labels).not.toContain("Proof Console");
  });

  it("does not expose 'Publications' or 'Dossier' at top-level (moved under Ressources/Preuves)", () => {
    const labels = NAV_V2.map((item) => item.label);
    expect(labels).not.toContain("Publications");
    expect(labels).not.toContain("Dossier");
  });

  it("includes Publications under Ressources", () => {
    const ressources = NAV_V2.find((item) => item.label === "Ressources");
    expect(ressources?.children?.some((c) => c.label === "Publications")).toBe(true);
  });

  it("includes 'Dossier de preuve' under Preuves", () => {
    const preuves = NAV_V2.find((item) => item.label === "Preuves");
    expect(preuves?.children?.some((c) => c.label === "Dossier de preuve")).toBe(true);
  });

  it("renames the V1 'Proof Console' label to 'Console de preuve' under Preuves", () => {
    const preuves = NAV_V2.find((item) => item.label === "Preuves");
    expect(preuves?.children?.some((c) => c.label === "Console de preuve")).toBe(true);
  });

  it("uses '/produit' as Produit href even if the page is created later (PR 3)", () => {
    const produit = NAV_V2.find((item) => item.label === "Produit");
    expect(produit?.href).toBe("/produit");
  });
});

describe("Footer V2", () => {
  it("exposes exactly 5 footer columns", () => {
    expect(Object.keys(FOOTER_V2)).toHaveLength(5);
  });

  it("uses the 5 target column names", () => {
    expect(Object.keys(FOOTER_V2)).toEqual([
      "Produit",
      "Preuves",
      "Secteurs",
      "Ressources",
      "Entreprise",
    ]);
  });

  it("keeps every footer link with a defined status", () => {
    for (const [category, links] of Object.entries(FOOTER_V2)) {
      for (const link of links) {
        expect(
          STATUS_LABELS_SHORT[link.status],
          `${category} → ${link.label}: status inconnu (${link.status})`,
        ).toBeDefined();
      }
    }
  });
});
