/**
 * M-04 — la barre latérale présente le compte connecté, jamais le persona
 * fictif « Marie Leclerc · Exemplia Industrie », et aucun score ESG codé en dur.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/lib/hooks/auth-context";

function render(auth: Parameters<typeof AuthProvider>[0]["value"]) {
  return renderToStaticMarkup(
    <AuthProvider value={auth}>
      <Sidebar collapsed={false} onToggle={() => {}} onLogout={() => {}} />
    </AuthProvider>,
  );
}

describe("Sidebar — carte utilisateur", () => {
  it("affiche l'utilisateur connecté et son rôle", () => {
    const html = render({
      status: "authenticated",
      email: "rse@acme.fr",
      role: "analyst",
      companyId: 7,
      isDemo: false,
    });

    expect(html).toContain("rse@acme.fr");
    expect(html).toContain("Analyste");
    expect(html).not.toContain("Marie Leclerc");
    expect(html).not.toContain("Exemplia");
    expect(html).not.toContain("62/100");
    expect(html).not.toContain(">Business<");
  });

  it("sans session : libellé neutre", () => {
    const html = render({ status: "unauthenticated" });
    expect(html).toContain("Compte CarbonCo");
    expect(html).not.toContain("Marie Leclerc");
  });
});
