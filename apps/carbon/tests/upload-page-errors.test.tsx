/**
 * m-19 — /upload : un échec d'envoi n'affiche jamais de message technique
 * (« Vercel Blob: No token found… », « data.files is not iterable »…), et
 * l'utilisateur peut revenir en arrière ou réessayer.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import UploadPage from "@/app/(app)/upload/page";
import { setAuthToken } from "@/lib/api";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let mounted: { container: HTMLElement; root: Root } | null = null;

async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function button(container: HTMLElement, label: RegExp): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) => label.test(b.textContent ?? ""));
  if (!found) throw new Error(`Bouton ${label} introuvable`);
  return found;
}

async function goToSend(uploadResponse: () => Promise<Response>): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/excel/preview")) return json({ detail: "Accès refusé" }, 403);
    if (url.endsWith("/excel/validate")) {
      return json({
        filename: "c.xlsx",
        domain: "carbon",
        status: "ok",
        issues: [],
        named_ranges_found: [],
        named_ranges_missing: [],
        sheets_found: [],
        sheets_missing: [],
      });
    }
    if (url === "/api/upload") return uploadResponse();
    return json({ detail: "Not Found" }, 404);
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<UploadPage />);
  });
  mounted = { container, root };

  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["xlsx"], "CarbonCo_Carbon.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await act(async () => button(container, /Prévisualiser/).click());
  await flush();
  // Aperçu refusé (403) : message présentable au lieu d'un panneau vide.
  expect(container.textContent).toContain("rôle analyste ou administrateur requis");

  await act(async () => button(container, /Valider la structure/).click());
  await flush();
  await act(async () => button(container, /Envoyer 1 fichier/).click());
  await flush();
  return container;
}

beforeEach(() => {
  fetchMock.mockReset();
  setAuthToken("jeton");
});

afterEach(async () => {
  setAuthToken(null);
  if (mounted) {
    const current = mounted;
    await act(async () => current.root.unmount());
    current.container.remove();
    mounted = null;
  }
});

describe("UploadPage — échecs d'envoi", () => {
  it("réponse 403 non structurée : message clair, retour possible", async () => {
    const container = await goToSend(async () => json({ error: "Rôle insuffisant" }, 403));
    const text = container.textContent ?? "";

    expect(text).toContain("rôle analyste ou administrateur requis");
    expect(text).not.toContain("is not iterable");
    expect(button(container, /Retour/)).toBeDefined();
    expect(button(container, /Réessayer l'envoi/)).toBeDefined();
  });

  it("panne réseau : message d'indisponibilité", async () => {
    const container = await goToSend(async () => {
      throw new TypeError("Failed to fetch");
    });
    const text = container.textContent ?? "";

    expect(text).toContain("Service momentanément indisponible");
    expect(text).not.toContain("Failed to fetch");
  });

  it("échec de stockage par fichier : détail présentable, aucune URL", async () => {
    const container = await goToSend(async () =>
      json(
        {
          status: "error",
          files: [
            {
              domain: "carbon",
              status: "error",
              detail: "Le stockage des fichiers est indisponible pour le moment. Réessayez plus tard ou contactez le support.",
            },
          ],
        },
        400,
      ),
    );
    const text = container.textContent ?? "";

    expect(text).toContain("Le stockage des fichiers est indisponible");
    expect(text).toContain("Échec");
    expect(text).not.toContain("blob.vercel-storage.com");
  });

  it("succès : fichier archivé en accès privé, sans URL affichée", async () => {
    const container = await goToSend(async () =>
      json({
        status: "ok",
        files: [
          {
            domain: "carbon",
            status: "ok",
            pathname: "workbooks/company-7/carbon/x.xlsx",
            filename: "CarbonCo_Carbon.xlsx",
          },
        ],
      }),
    );
    const text = container.textContent ?? "";

    expect(text).toContain("archivé en accès privé");
    expect(text).not.toContain("workbooks/company-7");
    expect(container.querySelector('[data-testid="ingest-panel"]')).not.toBeNull();
  });
});
