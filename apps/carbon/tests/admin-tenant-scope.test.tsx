/**
 * Contrat 4 — administration tenant-scoped : un admin d'organisation ne voit
 * ni création / suppression d'organisation ni choix libre d'entreprise ; seul
 * `platformAdmin` (GET /auth/me) les débloque. Les 403 sont traduits.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "@/app/(app)/admin/page";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { setAuthToken } from "@/lib/api";
import { AuthProvider } from "@/lib/hooks/auth-context";
import type { AuthState } from "@/lib/hooks/use-auth";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN: AuthState = {
  status: "authenticated",
  email: "admin@acme.fr",
  role: "admin",
  companyId: 7,
  isDemo: false,
};

const OWN_COMPANY = {
  id: 7,
  name: "Acme SAS",
  slug: "acme",
  naf_code: null,
  plan: "pro",
  created_at: "2026-01-01T00:00:00Z",
  user_count: 1,
};

function installApi(opts: { platformAdmin: boolean; companiesStatus?: number }) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return json({ user: { email: ADMIN.status === "authenticated" ? ADMIN.email : "", role: "admin", company_id: 7 }, platformAdmin: opts.platformAdmin });
    }
    if (url.endsWith("/admin/companies")) {
      return opts.companiesStatus
        ? json({ detail: "Accès refusé" }, opts.companiesStatus)
        : json([OWN_COMPANY]);
    }
    if (url.includes("/admin/users")) return json([]);
    return json({ detail: "Not Found" }, 404);
  });
}

let mounted: { container: HTMLElement; root: Root } | null = null;

async function mountAdmin(auth: AuthState = ADMIN): Promise<HTMLElement> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConfirmDialogProvider>
        <AuthProvider value={auth}>
          <AdminPage />
        </AuthProvider>
      </ConfirmDialogProvider>,
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

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(label));
}

beforeEach(() => {
  fetchMock.mockReset();
  setAuthToken("jeton-admin");
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

describe("AdminPage — périmètre de l'organisation", () => {
  it("admin d'organisation : ni création ni suppression d'organisation, entreprise imposée", async () => {
    installApi({ platformAdmin: false });
    const container = await mountAdmin();

    expect(findButton(container, "Nouvelle entreprise")).toBeUndefined();
    expect(container.textContent).toContain("réservés aux administrateurs de la plateforme");
    expect(container.querySelector('button[aria-label^="Supprimer l\'entreprise"]')).toBeNull();

    await act(async () => {
      findButton(container, "Utilisateurs")!.click();
    });
    await act(async () => {
      findButton(container, "Nouvel utilisateur")!.click();
    });
    // Pas de sélecteur libre d'entreprise : seule la sienne est affichée.
    const selects = Array.from(container.querySelectorAll("select"));
    expect(selects.some((s) => Array.from(s.options).some((o) => o.textContent === "Acme SAS"))).toBe(false);
    expect(container.textContent).toContain("Acme SAS");
  });

  it("admin plateforme : gestion des organisations disponible", async () => {
    installApi({ platformAdmin: true });
    const container = await mountAdmin();

    expect(findButton(container, "Nouvelle entreprise")).toBeDefined();
  });

  it("403 de l'API : message présentable", async () => {
    installApi({ platformAdmin: false, companiesStatus: 403 });
    const container = await mountAdmin();

    expect(container.textContent).toContain("vos droits ne couvrent que les comptes de votre organisation");
    expect(container.textContent).not.toMatch(/API 403/);
  });

  it("non-admin : accès refusé sans appel API", async () => {
    installApi({ platformAdmin: false });
    const container = await mountAdmin({ ...ADMIN, role: "analyst" } as AuthState);

    expect(container.textContent).toContain("Accès refusé");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
