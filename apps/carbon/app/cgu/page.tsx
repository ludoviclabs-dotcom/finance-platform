import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — CarbonCo",
  description: "Conditions générales d'utilisation de la plateforme CarbonCo",
};

export default function CguPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" lastUpdated="14 avril 2026">
      <Section title="Objet">
        <p>
          Les présentes conditions générales d'utilisation (CGU) régissent l'accès et
          l'utilisation de la plateforme CarbonCo, dédiée au pilotage ESG, CSRD et VSME des
          entreprises. Toute utilisation de la plateforme implique l'acceptation pleine et
          entière des présentes CGU.
        </p>
      </Section>

      <Section title="Accès au service">
        <p>
          L'accès à la plateforme est réservé aux utilisateurs autorisés disposant d'un
          compte actif. Les identifiants sont strictement personnels et confidentiels.
          L'utilisateur est seul responsable de leur conservation et des actions effectuées
          avec ses identifiants.
        </p>
        <p>
          CarbonCo se réserve le droit de suspendre ou de supprimer tout compte en cas de
          manquement aux présentes CGU.
        </p>
      </Section>

      <Section title="Disponibilité">
        <p>
          CarbonCo s'efforce de maintenir la plateforme accessible 24h/24 et 7j/7, mais ne
          peut garantir une disponibilité ininterrompue. Des opérations de maintenance,
          mises à jour ou incidents techniques peuvent entraîner des interruptions
          temporaires.
        </p>
      </Section>

      <Section title="Propriété des données">
        <p>
          Les données métier saisies, importées ou générées par l'utilisateur restent la
          propriété exclusive de l'entreprise cliente. CarbonCo ne dispose d'aucun droit
          d'usage, de revente ou de partage sur ces données, hormis pour l'exécution stricte
          du service.
        </p>
        <p>
          L'utilisateur garantit qu'il dispose des droits nécessaires sur les données qu'il
          importe et qu'elles ne portent atteinte à aucun droit de tiers.
        </p>
      </Section>

      <Section title="Limites de responsabilité">
        <p>
          La plateforme fournit des indicateurs ESG, CSRD et VSME calculés à partir des
          données saisies par l'utilisateur. CarbonCo ne saurait être tenue responsable des
          décisions prises sur la base de ces indicateurs ni des erreurs résultant de
          données erronées ou incomplètes fournies par l'utilisateur.
        </p>
        <p>
          Les rapports générés ne se substituent pas à un avis d'auditeur, d'expert-comptable
          ou de conseil en durabilité.
        </p>
      </Section>

      <Section title="Sécurité">
        <p>
          CarbonCo met en œuvre des mesures techniques et organisationnelles appropriées
          (chiffrement TLS, hachage des mots de passe, journal d'audit, isolation
          multi-tenant, hébergement souverain). L'utilisateur s'engage à ne pas tenter de
          contourner ces mesures ni d'altérer le fonctionnement du service.
        </p>
      </Section>

      <Section title="Modification des CGU">
        <p>
          CarbonCo se réserve le droit de modifier les présentes CGU à tout moment. Les
          utilisateurs seront informés des modifications substantielles par email ou via une
          notification sur la plateforme.
        </p>
      </Section>

      <Section title="Loi applicable et juridiction">
        <p>
          Les présentes CGU sont soumises au droit français. Tout litige relatif à leur
          interprétation ou exécution relève de la compétence exclusive des tribunaux
          français.
        </p>
      </Section>
    </LegalLayout>
  );
}
