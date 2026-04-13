import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Mentions légales — CarbonCo",
  description: "Mentions légales de la plateforme CarbonCo",
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" lastUpdated="14 avril 2026">
      <Section title="Éditeur du site">
        <p>
          Le présent site est édité par <strong>CarbonCo</strong>, plateforme de pilotage
          ESG &amp; CSRD.
        </p>
        <p>
          Les informations légales détaillées (raison sociale, forme juridique, capital social,
          numéro RCS, siège social, numéro de TVA intracommunautaire) seront publiées lors de la
          mise en service commerciale de la plateforme.
        </p>
      </Section>

      <Section title="Directeur de la publication">
        <p>
          Le directeur de la publication est le représentant légal de la société éditrice.
        </p>
      </Section>

      <Section title="Hébergement">
        <p>
          Le site est hébergé par <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133,
          Covina, CA 91723, États-Unis. Site web :{" "}
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
            vercel.com
          </a>
          .
        </p>
        <p>
          La base de données est hébergée en région Union européenne via Neon Postgres
          (Vercel Marketplace).
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus présents sur ce site (textes, graphismes, logos, icônes,
          images, code source) est la propriété exclusive de CarbonCo, sauf mention contraire.
          Toute reproduction, représentation, modification, publication ou adaptation, totale
          ou partielle, est interdite sans autorisation écrite préalable.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Pour toute question relative au site ou à la plateforme, contactez-nous à
          l'adresse : <strong>contact@carbonco.fr</strong>
        </p>
      </Section>

      <Section title="Loi applicable">
        <p>
          Le présent site est soumis au droit français. En cas de litige, et après échec de
          toute tentative de résolution amiable, les tribunaux français seront seuls compétents.
        </p>
      </Section>
    </LegalLayout>
  );
}
