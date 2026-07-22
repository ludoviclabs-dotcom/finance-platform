/**
 * resources-demo-auth.test.tsx — parcours d'accès au cockpit Ressources
 * stratégiques (redirection préservée, action démo contrôlée).
 *
 * Rendu serveur pur (renderToStaticMarkup) des composants présentationnels :
 * DemoStepCard (lien vs bouton contrôlé selon `onExplore`) et LoginScreen
 * (bannière contextuelle + libellé démo selon `demoContext`). Ni l'un ni
 * l'autre n'appelle next/navigation — testables sans mock de routeur.
 * La validation anti-open-redirect (getSafeInternalRedirect) est couverte
 * exhaustivement dans lib/auth/safe-redirect.test.ts.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: unknown }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children as never}
    </a>
  ),
}));

import { DemoStepCard } from "@/components/demo/asterion/demo-step-card";
import { LoginScreen } from "@/components/pages/login-screen";
import { ASTERION_TOUR } from "@/lib/demo/asterion-motion-tour";

const step = ASTERION_TOUR[0];

describe("DemoStepCard — lien d'exploration", () => {
  it("sans onExplore : lien direct historique (comportement asterion-motion inchangé)", () => {
    const html = renderToStaticMarkup(<DemoStepCard step={step} />);
    expect(html).toContain('data-testid="demo-explore-link"');
    expect(html).toMatch(/<a[^>]*data-testid="demo-explore-link"/);
    expect(html).toContain(`href="${step.exploreHref}"`);
  });

  it("avec onExplore : action contrôlée (bouton, jamais un lien direct)", () => {
    const html = renderToStaticMarkup(
      <DemoStepCard step={step} onExplore={() => {}} />,
    );
    expect(html).toContain('data-testid="demo-explore-link"');
    expect(html).toMatch(/<button[^>]*data-testid="demo-explore-link"/);
    // Jamais de navigation directe vers une page protégée sans passer par onExplore.
    expect(html).not.toMatch(/<a[^>]*data-testid="demo-explore-link"/);
  });

  it("exploreLoading : bouton désactivé + libellé de chargement", () => {
    const html = renderToStaticMarkup(
      <DemoStepCard step={step} onExplore={() => {}} exploreLoading />,
    );
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Ouverture…");
  });

  it("exploreError : message visible et récupérable", () => {
    const html = renderToStaticMarkup(
      <DemoStepCard
        step={step}
        onExplore={() => {}}
        exploreError="Accès démo indisponible."
      />,
    );
    expect(html).toContain('data-testid="demo-explore-error"');
    expect(html).toContain("Accès démo indisponible.");
  });
});

describe("LoginScreen — contexte d'accès démo", () => {
  const noop = async () => ({ ok: true as const });

  it("sans demoContext : libellé démo par défaut, pas de bannière", () => {
    const html = renderToStaticMarkup(
      <LoginScreen onLogin={noop} onVerifyTotp={noop} onDemo={() => {}} />,
    );
    expect(html).not.toContain('data-testid="login-demo-context"');
    expect(html).toContain("Accès démo (sans compte)");
  });

  it("avec demoContext (/resources) : bannière + libellé dédiés", () => {
    const html = renderToStaticMarkup(
      <LoginScreen
        onLogin={noop}
        onVerifyTotp={noop}
        onDemo={() => {}}
        demoContext={{
          title: "Accéder aux Ressources stratégiques",
          description: "Ce cockpit utilise les données de votre organisation.",
          demoLabel: "Ouvrir le cockpit de démonstration",
        }}
      />,
    );
    expect(html).toContain('data-testid="login-demo-context"');
    expect(html).toContain("Accéder aux Ressources stratégiques");
    expect(html).toContain("Ouvrir le cockpit de démonstration");
    expect(html).not.toContain("Accès démo (sans compte)");
  });

  it("demoLoading : bouton démo désactivé", () => {
    const html = renderToStaticMarkup(
      <LoginScreen onLogin={noop} onVerifyTotp={noop} onDemo={() => {}} demoLoading />,
    );
    const buttonMatch = html.match(/<button[^>]*data-testid="login-demo-button"[^>]*>/);
    expect(buttonMatch?.[0]).toContain("disabled=\"\"");
  });

  it("demoError : message visible sur la page de connexion", () => {
    const html = renderToStaticMarkup(
      <LoginScreen
        onLogin={noop}
        onVerifyTotp={noop}
        onDemo={() => {}}
        demoError="Accès démo indisponible pour le moment."
      />,
    );
    expect(html).toContain('data-testid="login-demo-error"');
    expect(html).toContain("Accès démo indisponible pour le moment.");
  });
});
