/**
 * M-16 — /login avec une session démo active : plus de redirection
 * automatique (qui renvoyait sur /demo sans issue), mais un bandeau
 * « Quitter la démo » qui efface le cookie côté serveur puis réaffiche le
 * formulaire. m-20 — une erreur de connexion est toujours visible.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { LoginClient } from "@/app/login/login-client";
import { LoginScreen } from "@/components/pages/login-screen";
import { SERVICE_UNAVAILABLE_MESSAGE, setAuthToken } from "@/lib/api";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let demoCookie = true;

function installApi() {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/auth/refresh")) return json({ detail: "no refresh" }, 401);
    if (url === "/api/auth/demo" && method === "GET") {
      return demoCookie
        ? json({
            ok: true,
            isDemo: true,
            user: { email: "demo-session@exemplia-industrie.invalid", role: "viewer", company_id: 0, is_demo: true },
          })
        : json({ error: "Session démo absente ou expirée.", code: "DEMO_SESSION_REQUIRED" }, 401);
    }
    if (url === "/api/auth/demo" && method === "DELETE") {
      demoCookie = false;
      return json({ ok: true });
    }
    if (url.endsWith("/auth/login")) throw new TypeError("Failed to fetch");
    return json({ detail: "Not Found" }, 404);
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

async function mountLogin(): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<LoginClient safeNext="/dashboard" />);
  });
  await flush();
  mounted = { container, root };
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  demoCookie = true;
  setAuthToken(null);
  fetchMock.mockReset();
  router.push.mockReset();
  router.replace.mockReset();
  installApi();
});

afterEach(async () => {
  if (mounted) {
    const current = mounted;
    await act(async () => current.root.unmount());
    current.container.remove();
    mounted = null;
  }
});

describe("LoginClient — session démo active", () => {
  it("n'effectue aucune redirection et propose de quitter la démo", async () => {
    const container = await mountLogin();

    expect(router.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="login-demo-session"]')).not.toBeNull();
    expect(container.textContent).toContain("Vous êtes dans une session de démonstration");
    // Le formulaire réapparaît seulement après la sortie de la démo.
    expect(container.querySelector("#login-email")).toBeNull();
  });

  it("« Quitter la démo » efface le cookie côté serveur puis affiche le formulaire", async () => {
    const container = await mountLogin();
    const exit = container.querySelector<HTMLButtonElement>('[data-testid="login-demo-exit"]');
    expect(exit).not.toBeNull();

    await act(async () => {
      exit!.click();
    });
    await flush();

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/auth/demo" && (init as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    expect(container.querySelector('[data-testid="login-demo-session"]')).toBeNull();
    expect(container.querySelector("#login-email")).not.toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("échec de l'effacement : message visible, session conservée", async () => {
    const container = await mountLogin();
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="login-demo-exit"]')!.click();
    });
    await flush();

    expect(container.querySelector('[data-testid="login-demo-session"]')).not.toBeNull();
    expect(container.textContent).toContain("Impossible de quitter la démonstration");
    expect(container.textContent).not.toContain("Failed to fetch");
  });
});

describe("LoginClient — m-20 : API injoignable", () => {
  it("affiche un message d'indisponibilité au lieu d'aucune erreur", async () => {
    demoCookie = false;
    const container = await mountLogin();

    const email = container.querySelector<HTMLInputElement>("#login-email")!;
    const password = container.querySelector<HTMLInputElement>("#login-password")!;
    await act(async () => {
      setInputValue(email, "rse@acme.fr");
      setInputValue(password, "motdepasse");
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    const alert = container.querySelector("#login-error");
    expect(alert?.textContent).toContain(SERVICE_UNAVAILABLE_MESSAGE);
    expect(container.textContent).not.toContain("Failed to fetch");
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("LoginScreen — rendu serveur", () => {
  const noop = async () => ({ ok: true });

  it("sans session démo : formulaire présent", () => {
    const html = renderToStaticMarkup(
      <LoginScreen onLogin={noop} onVerifyTotp={noop} onDemo={() => {}} />,
    );
    expect(html).toContain('id="login-email"');
    expect(html).not.toContain('data-testid="login-demo-session"');
  });

  it("avec session démo : bandeau et bouton « Quitter la démo », pas de formulaire", () => {
    const html = renderToStaticMarkup(
      <LoginScreen
        onLogin={noop}
        onVerifyTotp={noop}
        onDemo={() => {}}
        demoSession={{ onExit: () => {}, onResume: () => {}, exiting: false, error: null }}
      />,
    );
    expect(html).toContain('data-testid="login-demo-session"');
    expect(html).toContain("Quitter la démo");
    expect(html).toContain("Revenir à la démo");
    expect(html).not.toContain('id="login-email"');
  });
});
