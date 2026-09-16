/**
 * B-06 — /q/[token] : `params` est une Promise en Next 16. La page appelait
 * /suppliers/public/q/undefined et affichait « API 404 » brut.
 */

import { Suspense, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import QuestionnairePage from "@/app/q/[token]/page";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let mounted: { container: HTMLElement; root: Root } | null = null;

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mountPage(token: string): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const params = Promise.resolve({ token });
  await act(async () => {
    root.render(
      <Suspense fallback={<p>chargement</p>}>
        <QuestionnairePage params={params} />
      </Suspense>,
    );
  });
  await flush();
  mounted = { container, root };
  return container;
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(async () => {
  if (mounted) {
    const current = mounted;
    await act(async () => current.root.unmount());
    current.container.remove();
    mounted = null;
  }
});

describe("QuestionnairePage", () => {
  it("déballe le token de la Promise et l'utilise dans l'appel API", async () => {
    fetchMock.mockResolvedValue(
      json({
        supplier_name: "Fournisseur A",
        company_name: "Donneur d'ordre",
        campaign: "Campagne 2026",
        expires_at: null,
        already_answered: false,
      }),
    );

    const container = await mountPage("tok-123");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/suppliers\/public\/q\/tok-123$/);
    expect(url).not.toContain("undefined");
    expect(container.querySelector('[data-testid="questionnaire-form"]')).not.toBeNull();
    expect(container.textContent).toContain("Donneur d'ordre vous invite");
  });

  it("404 : lien invalide, sans message technique", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Token invalide ou introuvable" }, 404));
    const container = await mountPage("inconnu");
    const text = container.textContent ?? "";

    expect(text).toContain("Ce lien n'est pas valide");
    expect(text).not.toMatch(/API \d{3}/);
  });

  it("410 : lien expiré", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Ce lien questionnaire a expiré" }, 410));
    const container = await mountPage("expire");
    expect(container.textContent).toContain("Ce lien a expiré");
  });

  it("panne réseau : service indisponible (le lien n'est pas mis en cause) et nouvel essai possible", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const container = await mountPage("tok-123");
    const text = container.textContent ?? "";

    expect(text).toContain("Questionnaire momentanément inaccessible");
    expect(text).not.toContain("Failed to fetch");
    expect(text).not.toContain("n'est pas valide");

    fetchMock.mockResolvedValue(
      json({ supplier_name: "F", company_name: "C", campaign: null, expires_at: null, already_answered: true }),
    );
    const retry = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Réessayer"),
    );
    await act(async () => {
      retry!.click();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Questionnaire déjà soumis");
  });
});
