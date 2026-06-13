import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Mentions légales — CarbonCo",
  description: "Mentions légales de la plateforme CarbonCo",
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" lastUpdated="13 juin 2026">
      <Section title="Éditeur du site">
        <p>
          Le présent site est édité par <strong>CarbonCo — projet en développement, non
          commercialisé</strong>. Il est mis en ligne à titre de démonstration technique :
          aucune offre commerciale n'est ouverte à la souscription à ce jour, et aucune société
          n'est immatriculée sous ce nom.
        </p>
        <p>
          Les informations légales détaillées (raison sociale, forme juridique, RCS, siège,
          TVA intracommunautaire) seront publiées sur cette page si et quand une entité juridique
          est créée. Toute demande peut être adressée à{" "}
          <strong>ludoviclabs@gmail.com</strong>.
        </p>
      </Section>

      <Section title="Direction de la publication">
        <p>
          La direction de la publication est assurée par l'éditeur du projet. Contact :{" "}
          <a href="mailto:ludoviclabs@gmail.com">ludoviclabs@gmail.com</a>.
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
          La base de données est fournie par <strong>Neon Inc.</strong> (San Francisco,
          Californie, États-Unis), avec déploiement des données en région Union européenne
          (eu-central-1). Site web :{" "}
          <a href="https://neon.tech" target="_blank" rel="noopener noreferrer">
            neon.tech
          </a>
          .
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
          l'adresse : <strong>ludoviclabs@gmail.com</strong>
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
