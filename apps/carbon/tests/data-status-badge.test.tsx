/**
 * DataStatusBadge — rendu et accessibilité (PR-01).
 * Rendu serveur pur (renderToStaticMarkup) — aucune dépendance de test ajoutée.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DataStatusBadge, statusFromQuality } from "@/components/ui/data-status-badge";

describe("DataStatusBadge", () => {
  it("expose un aria-label décrivant la qualité de la donnée", () => {
    const html = renderToStaticMarkup(<DataStatusBadge status="ESTIMATED" />);
    expect(html).toContain('aria-label="Qualité de la donnée : Estimé.');
    expect(html).toContain('data-testid="data-status-badge-estimated"');
    expect(html).toContain("Estimé");
  });

  it("rend chacun des quatre états avec un testid distinct", () => {
    for (const status of ["VERIFIED", "ESTIMATED", "MANUAL", "STALE"] as const) {
      const html = renderToStaticMarkup(<DataStatusBadge status={status} />);
      expect(html).toContain(`data-status-badge-${status.toLowerCase()}`);
    }
  });

  it("accepte un libellé personnalisé sans casser l'aria-label", () => {
    const html = renderToStaticMarkup(<DataStatusBadge status="ESTIMATED" label="Estimation snapshot" />);
    expect(html).toContain("Estimation snapshot");
    expect(html).toContain("aria-label=");
  });

  it("statusFromQuality mappe correctement les qualités du dataset", () => {
    expect(statusFromQuality("verified")).toBe("VERIFIED");
    expect(statusFromQuality("estimated")).toBe("ESTIMATED");
    expect(statusFromQuality("manual")).toBe("MANUAL");
  });
});
