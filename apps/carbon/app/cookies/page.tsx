import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Cookies et traceurs — CarbonCo",
  description: "Politique d'utilisation des cookies et traceurs CarbonCo",
};

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookies et traceurs" lastUpdated="14 avril 2026">
      <Section title="Notre approche">
        <p>
          CarbonCo n'utilise <strong>aucun cookie publicitaire</strong> ni traceur de mesure
          d'audience tiers (Google Analytics, Meta Pixel, etc.). Conformément aux
          recommandations de la CNIL, seuls des cookies strictement nécessaires au
          fonctionnement du service sont déposés.
        </p>
        <p>
          C'est pourquoi nous n'affichons pas de bandeau cookies : il n'est pas requis pour
          des cookies strictement nécessaires.
        </p>
      </Section>

      <Section title="Cookies déposés">
        <table className="w-full text-xs border border-[var(--color-border)] rounded">
          <thead>
            <tr className="bg-[var(--color-surface)]">
              <th className="px-3 py-2 text-left text-[var(--color-foreground)]">Nom</th>
              <th className="px-3 py-2 text-left text-[var(--color-foreground)]">Finalité</th>
              <th className="px-3 py-2 text-left text-[var(--color-foreground)]">Durée</th>
              <th className="px-3 py-2 text-left text-[var(--color-foreground)]">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--color-border)]">
              <td className="px-3 py-2 font-mono">cc_refresh</td>
              <td className="px-3 py-2">Maintien de la session authentifiée</td>
              <td className="px-3 py-2">30 jours</td>
              <td className="px-3 py-2">Strictement nécessaire</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3">
          Le cookie <code>cc_refresh</code> est <strong>HttpOnly</strong>, <strong>Secure</strong>
          {" "}en production, et <strong>SameSite=Lax</strong>. Il n'est lisible ni par JavaScript
          ni par les domaines tiers.
        </p>
      </Section>

      <Section title="Stockage navigateur">
        <p>
          La plateforme n'utilise <strong>aucun stockage navigateur</strong>
          (<code>localStorage</code>, <code>sessionStorage</code>, IndexedDB) pour conserver
          des jetons d'authentification ou des données personnelles. Le jeton d'accès vit
          uniquement en mémoire pendant la session active et est révoqué à la déconnexion.
        </p>
      </Section>

      <Section title="Vos droits">
        <p>
          Vous pouvez configurer votre navigateur pour refuser ou supprimer les cookies à
          tout moment. La désactivation du cookie de session vous obligera à vous
          réauthentifier à chaque visite.
        </p>
        <p>
          Pour toute question, écrivez à <strong>privacy@carbonco.fr</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
