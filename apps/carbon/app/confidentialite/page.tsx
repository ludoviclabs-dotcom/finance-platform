import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Politique de confidentialité — CarbonCo",
  description: "Politique de confidentialité et traitement des données personnelles CarbonCo",
};

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" lastUpdated="14 avril 2026">
      <Section title="Responsable du traitement">
        <p>
          CarbonCo agit en tant que responsable du traitement des données personnelles
          collectées via la plateforme dans le cadre de ses propres services
          (compte utilisateur, support, facturation).
        </p>
        <p>
          Pour les données ESG des entreprises clientes traitées via la plateforme, CarbonCo
          agit en tant que sous-traitant au sens du RGPD, sous la responsabilité de l'entreprise
          cliente. Un contrat de sous-traitance (DPA) est conclu avec chaque client.
        </p>
      </Section>

      <Section title="Données collectées">
        <p>Nous collectons uniquement les données strictement nécessaires :</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Compte utilisateur</strong> : adresse email professionnelle, mot de passe
            (haché via bcrypt), rôle (admin / analyst / viewer), entreprise de rattachement.
          </li>
          <li>
            <strong>Données techniques</strong> : adresse IP, user-agent, horodatages d'accès
            (à des fins de sécurité et journal d'audit).
          </li>
          <li>
            <strong>Données métier</strong> : indicateurs ESG, fichiers Excel uploadés par
            l'entreprise cliente. Ces données restent la propriété exclusive du client.
          </li>
        </ul>
      </Section>

      <Section title="Finalités du traitement">
        <ul className="ml-5 list-disc space-y-1">
          <li>Authentification et gestion des accès</li>
          <li>Calcul et restitution des indicateurs ESG / CSRD</li>
          <li>Génération des rapports et exports</li>
          <li>Sécurité de la plateforme et journal d'audit</li>
          <li>Support client</li>
        </ul>
      </Section>

      <Section title="Base légale">
        <p>
          Le traitement repose sur l'exécution du contrat conclu avec l'entreprise cliente
          (article 6.1.b RGPD), ainsi que sur l'intérêt légitime du responsable de traitement
          pour la sécurité et l'amélioration du service (article 6.1.f).
        </p>
      </Section>

      <Section title="Hébergement et transferts">
        <p>
          Les données applicatives sont hébergées sur l'infrastructure Vercel (États-Unis) et
          la base de données Neon Postgres en région Union européenne. Aucun transfert de
          données personnelles hors UE n'est effectué pour les données métier des clients.
        </p>
        <p>
          Les services Vercel sont couverts par les Clauses Contractuelles Types (CCT) de la
          Commission européenne pour les transferts de données techniques opérationnels.
        </p>
      </Section>

      <Section title="Durée de conservation">
        <ul className="ml-5 list-disc space-y-1">
          <li>Données de compte : pendant toute la durée du contrat + 3 ans</li>
          <li>Journal d'audit : 12 mois glissants</li>
          <li>
            Données ESG métier : tant que le client le souhaite ; suppression sur demande sous
            30 jours après la fin du contrat
          </li>
        </ul>
      </Section>

      <Section title="Vos droits">
        <p>
          Conformément au RGPD, vous disposez des droits d'accès, de rectification, d'effacement,
          de limitation, de portabilité et d'opposition sur vos données personnelles. Vous pouvez
          exercer ces droits en écrivant à <strong>privacy@carbonco.fr</strong>.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL :{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
            cnil.fr
          </a>
          .
        </p>
      </Section>

      <Section title="Sécurité">
        <p>
          CarbonCo met en œuvre des mesures techniques et organisationnelles appropriées pour
          garantir la sécurité des données : chiffrement TLS en transit, mots de passe hachés,
          jetons JWT signés avec rotation de refresh, isolation multi-tenant, journal d'audit
          des accès, hébergement souverain pour les données métier.
        </p>
      </Section>
    </LegalLayout>
  );
}
