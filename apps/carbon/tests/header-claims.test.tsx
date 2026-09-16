/**
 * M-05 — en-tête : plus de comptes à rebours « E1 · 15j / CSRD · 45j » ni de
 * notifications de démonstration. Seule l'échéance BEGES connue de l'API est
 * affichée ; les notifications viennent de /alerts/notifications.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BegesDeadline } from "@/lib/beges-deadline";

const deadline = vi.hoisted(() => ({ current: null as BegesDeadline | null }));

vi.mock("@/lib/hooks/use-beges-deadline", () => ({
  useBegesDeadline: () => deadline.current,
}));

// Le sélecteur de thème lit window.matchMedia (absent de jsdom) : hors sujet ici.
vi.mock("@/components/ui/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

import { Header } from "@/components/layout/header";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let mounted: { container: HTMLElement; root: Root } | null = null;

async function mountHeader(): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <Header title="Tableau de bord" subtitle="Vue d'ensemble ESG" onLogout={() => {}} userEmail="rse@acme.fr" />,
    );
  });
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  mounted = { container, root };
  return container;
}

beforeEach(() => {
  deadline.current = null;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/alerts/notifications")) {
      return json({
        unread: 1,
        notifications: [
          {
            id: 9,
            rule_id: 1,
            rule_name: "Seuil",
            title: "Scope 1 au-dessus du seuil",
            body: null,
            fired_at: new Date().toISOString(),
            read_at: null,
            archived_at: null,
          },
        ],
      });
    }
    return json({ detail: "Not Found" }, 404);
  });
});

afterEach(async () => {
  if (mounted) {
    const current = mounted;
    await act(async () => current.root.unmount());
    current.container.remove();
    mounted = null;
  }
});

describe("Header", () => {
  it("aucune échéance inventée quand l'échéance BEGES est inconnue", async () => {
    const container = await mountHeader();
    const text = container.textContent ?? "";

    expect(text).not.toContain("15j");
    expect(text).not.toContain("45j");
    expect(text).not.toContain("CSRD");
    expect(container.querySelector(".cc-dl-chip")).toBeNull();
    // Plus d'affirmation de fraîcheur « Données au » : date de consultation.
    expect(text).not.toContain("Données au");
  });

  it("affiche l'échéance BEGES réelle quand elle est connue", async () => {
    deadline.current = {
      days: 30,
      dueDateLabel: "16/10/2026",
      level: "warn",
      chipText: "BEGES · 30 j",
      title: "Renouvellement du bilan GES réglementaire : échéance le 16/10/2026",
    };
    const container = await mountHeader();

    const chip = container.querySelector<HTMLAnchorElement>("a.cc-dl-chip");
    expect(chip?.textContent).toContain("BEGES · 30 j");
    expect(chip?.getAttribute("href")).toBe("/beges");
    expect(chip?.className).toContain("warn");
  });

  it("notifications réelles de l'organisation, plus de notifications de démonstration", async () => {
    const container = await mountHeader();
    const bell = container.querySelector<HTMLButtonElement>('button[aria-haspopup="true"]')!;
    expect(bell.getAttribute("aria-label")).toBe("Notifications — 1 non lue");

    await act(async () => {
      bell.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Scope 1 au-dessus du seuil");
    expect(text).not.toContain("Import ERP SAP");
    expect(text).not.toContain("Rapport CSRD Q2");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/alerts/notifications"))).toBe(true);
  });
});
