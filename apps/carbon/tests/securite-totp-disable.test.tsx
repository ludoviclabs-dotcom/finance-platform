/**
 * Contrat 3 — la désactivation de la 2FA exige le code courant (ou un code de
 * récupération) : l'écran le demande avant d'appeler l'API.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SecuritePage from "@/app/(app)/securite/page";
import { setAuthToken, setOnTokenExpired } from "@/lib/api";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
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

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(label),
  );
  if (!found) throw new Error(`Bouton « ${label} » introuvable`);
  return found;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function mountEnabled(): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SecuritePage />);
  });
  await flush();
  mounted = { container, root };
  return container;
}

async function submitCode(container: HTMLElement, code: string) {
  await act(async () => {
    button(container, "Désactiver la 2FA").click();
  });
  const input = container.querySelector<HTMLInputElement>("#totp-disable-code");
  expect(input).not.toBeNull();
  await act(async () => {
    setInputValue(input!, code);
  });
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await flush();
}

beforeEach(() => {
  fetchMock.mockReset();
  setAuthToken("jeton-test");
  setOnTokenExpired(null);
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

describe("SecuritePage — désactivation de la 2FA", () => {
  it("demande le code puis l'envoie à l'API", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ enabled: true }))
      .mockResolvedValueOnce(json(null, 204));
    const container = await mountEnabled();

    await submitCode(container, " 123456 ");

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toMatch(/\/auth\/totp\/disable$/);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ code: "123456" });
    expect(container.textContent).toContain("La 2FA n'est pas activée");
  });

  it("code refusé : message clair, la 2FA reste active côté écran", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ enabled: true }))
      .mockResolvedValueOnce(json({ detail: "Code de vérification invalide." }, 401));
    const container = await mountEnabled();

    await submitCode(container, "000000");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Code refusé");
    expect(container.textContent).not.toMatch(/API \d{3}/);
    expect(container.querySelector("#totp-disable-code")).not.toBeNull();
  });

  it("trop de tentatives : message dédié", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ enabled: true }))
      .mockResolvedValueOnce(json({ detail: "Too Many Requests" }, 429));
    const container = await mountEnabled();

    await submitCode(container, "111111");

    expect(container.textContent).toContain("Trop de tentatives");
  });
});
