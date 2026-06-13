import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Stratégie de sortie — CarbonCo",
  description:
    "Comment récupérer toutes vos données ESG si vous quittez CarbonCo : formats d'export, SLA de restitution, manifeste Evidence Pack vérifiable hors-ligne.",
  alternates: { canonical: "/trust/exit-strategy" },
};

export default function ExitStrategyPage() {
  return (
    <LegalLayout title="Stratégie de sortie" lastUpdated="28 mai 2026">
      <Section title="Principe directeur">
        <p>
          Vos données ESG vous appartiennent. À tout moment — pendant le contrat ou à sa fin —
          vous devez pouvoir récupérer l'intégralité de votre rapport CSRD et de ses pièces
          justificatives dans des formats ouverts, sans appel à CarbonCo et sans dépendance à
          un outil propriétaire.
        </p>
        <p>
          Cette page documente les quatre formats d'export disponibles, le SLA de restitution
          en cas de fin de contrat, et la procédure de vérification hors-ligne du{" "}
          <em>Evidence Pack</em>.
        </p>
      </Section>

      <Section title="Quatre formats d'export disponibles">
        <p>Tous les exports sont déclenchables depuis l'interface ou via l'API REST authentifiée.</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>JSON structuré</strong> — Snapshot complet du tenant : utilisateurs (sans
            mots de passe), datapoints, rapports, audit trail, mappages méthodologiques. Format
            stable documenté et versionné. Idéal pour migration vers un autre outil ou
            archivage interne.
          </li>
          <li>
            <strong>Excel structuré</strong> — Workbook avec une feuille par standard ESRS
            (E1, E2, etc.), facteurs d'émission utilisés, horodatages, identifiants utilisateurs
            et hash d'intégrité par ligne. Compatible avec la majorité des outils de reporting
            financier.
          </li>
          <li>
            <strong>PDF rapport CSRD</strong> — Rapport assemblé selon la présentation ESRS,
            prêt pour soumission auditeur (ISAE 3000). Inclut narratifs, tableaux quantitatifs
            et page de signature.
          </li>
          <li>
            <strong>Evidence Pack ZIP</strong> — Archive contenant : (a) les rapports PDF, (b)
            les workbooks Excel sources, (c) un fichier <code>manifest.json</code> listant
            chaque pièce avec son hash SHA-256, (d) le journal d'audit complet en JSON.
            Vérifiable hors-ligne avec un simple <code>shasum -a 256</code>.
          </li>
        </ul>
      </Section>

      <Section title="SLA de restitution">
        <p>
          En cas de fin de contrat (résiliation à l'initiative du client ou non-renouvellement),
          CarbonCo s'engage à :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Maintenir l'accès export</strong> à l'interface et à l'API pendant{" "}
            <strong>30 jours</strong> après la date de fin de contrat, pour permettre la
            récupération autonome.
          </li>
          <li>
            <strong>Fournir un export manuel</strong> sur demande écrite (Evidence Pack ZIP
            complet) sous <strong>10 jours ouvrés</strong> à compter de la réception de la
            demande, si l'accès self-service a été interrompu prématurément.
          </li>
          <li>
            <strong>Supprimer définitivement les données</strong> sous 30 jours après la fin du
            contrat, avec attestation écrite de suppression sur demande du client. Cette
            attestation couvre les bases de données (Neon), le stockage objet (Vercel Blob),
            les caches (Upstash) et les sauvegardes.
          </li>
        </ul>
        <p>
          Le journal d'audit du tenant reste conservé pendant <strong>12 mois</strong> après la
          suppression effective, à des fins de preuve réglementaire en cas de contrôle (article
          5 RGPD, obligation de minimisation et de licéité). Au-delà, suppression définitive.
        </p>
      </Section>

      <Section title="Format Evidence Pack — vérifiable hors-ligne">
        <p>L'archive ZIP générée respecte la structure suivante :</p>
        <pre className="not-prose bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 text-xs overflow-x-auto">
{`evidence-pack-{tenantId}-{periodId}.zip
├── manifest.json            # Liste des fichiers + hash SHA-256 + horodatage
├── report.pdf               # Rapport CSRD assemblé
├── report-data.json         # Données structurées
├── workbook.xlsx            # Workbook Excel exporté
├── audit-trail.json         # Journal d'audit complet (append-only)
├── methodology.json         # Facteurs ADEME utilisés + versions
└── README.txt               # Instructions de vérification`}
        </pre>
        <p>Vérification du manifeste depuis n'importe quel poste, sans outil CarbonCo :</p>
        <pre className="not-prose bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 text-xs overflow-x-auto">
{`# Pour chaque fichier listé dans manifest.json
shasum -a 256 report.pdf
# Doit correspondre au champ "sha256" du manifeste`}
        </pre>
        <p>
          Le manifeste est lui-même signé par une clé publique CarbonCo (Ed25519), permettant
          à un commissaire aux comptes ou un OTI de prouver qu'il n'a pas été falsifié après
          export.
        </p>
      </Section>

      <Section title="Continuité de service en cas d'incident CarbonCo">
        <p>
          Au-delà du SLA contractuel, deux dispositifs limitent le risque de perte d'accès en
          cas d'incident majeur côté CarbonCo (par exemple : cessation d'activité, indisponibilité
          prolongée) :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Sauvegardes automatiques Neon</strong> — Snapshots quotidiens point-in-time
            recovery sur 7 jours, conservés en zone UE par Neon indépendamment de l'activité
            CarbonCo.
          </li>
          <li>
            <strong>Procédure d'escrow contractuelle</strong> — Disponible sur demande client
            grand compte : dépôt chez un tiers (typiquement un cabinet d'avocats) d'une copie
            des données et d'un export Evidence Pack annuel, déblocable par le client en cas
            de défaillance documentée de CarbonCo.
          </li>
        </ul>
        <p>
          Le code source applicatif n'est pas mis en escrow à ce stade ; la portabilité repose
          sur les formats ouverts d'export (JSON, Excel, PDF) plutôt que sur une reprise du
          code.
        </p>
      </Section>

      <Section title="Liens utiles">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <Link href="/trust" className="underline">
              Trust Center — vue d'ensemble
            </Link>
          </li>
          <li>
            <Link href="/trust/sub-processors" className="underline">
              Liste des sous-traitants
            </Link>
          </li>
          <li>
            <Link href="/etat-du-produit" className="underline">
              État réel du produit
            </Link>
          </li>
          <li>
            <Link href="/confidentialite" className="underline">
              Politique de confidentialité
            </Link>
          </li>
        </ul>
      </Section>
    </LegalLayout>
  );
}
