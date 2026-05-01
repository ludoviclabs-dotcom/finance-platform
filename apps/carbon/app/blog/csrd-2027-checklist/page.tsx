import type { Metadata } from "next";
import {
  ArticleLayout,
  P,
  H2,
  Aside,
  Numbered,
  List,
} from "@/components/blog/article-layout";
import { getArticle } from "@/lib/blog-articles";

const article = getArticle("csrd-2027-checklist")!;

export const metadata: Metadata = {
  title: `${article.title} | CarbonCo`,
  description: article.description,
  alternates: { canonical: `https://carbonco.fr/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <P>
        L&apos;exercice 2026 sera le premier rapport CSRD pour les ETI françaises (vague 2 :
        plus de 250 salariés, plus de 50 M€ de CA ou plus de 25 M€ de bilan). Publication en
        2027, assurance limitée obligatoire. Voici les douze chantiers à verrouiller dès
        maintenant pour ne pas découvrir les manques en septembre.
      </P>

      <H2>1 — Cadrer le périmètre</H2>
      <P>
        Le périmètre CSRD = entité consolidée + filiales contrôlées (IFRS 10). Première
        question à régler avec votre commissaire aux comptes : périmètre identique ou
        élargi versus la consolidation financière ?
      </P>

      <H2>2 — Constituer l&apos;équipe projet</H2>
      <P>
        Trois rôles minimum à nommer formellement :
      </P>
      <List
        items={[
          <span key="1"><strong>Sponsor exécutif</strong> (DAF ou DG) — arbitrages et
            allocation budgétaire.</span>,
          <span key="2"><strong>Chef de projet ESG</strong> (RSE ou DAF adjoint) —
            coordination opérationnelle, point de contact OTI.</span>,
          <span key="3"><strong>Référents données</strong> (IT + métiers) — collecte et
            qualité.</span>,
        ]}
      />

      <H2>3 — Réaliser l&apos;analyse de double matérialité</H2>
      <P>
        L&apos;ESRS 1 §3 impose une analyse documentée croisant impact et matérialité
        financière. Cible : 6 à 10 enjeux matériels priorisés, scoring justifié, parties
        prenantes consultées.
      </P>

      <Aside title="Piège classique">
        Reprendre la matrice de matérialité historique sans la re-scorer aux critères ESRS.
        L&apos;auditeur le verra immédiatement à l&apos;absence de scores quantitatifs et
        de méthode reproductible.
      </Aside>

      <H2>4 — Cartographier les datapoints obligatoires</H2>
      <P>
        Les ESRS thématiques (E1 à E5, S1 à S4, G1) déclinent ~1 100 datapoints. Pour une
        ETI matériellement concernée par 4 à 6 standards, le périmètre opérationnel se
        réduit à 250-400 datapoints. Cartographier <em>quelle équipe / quel système /
        quelle fréquence</em> pour chacun.
      </P>

      <H2>5 — Verrouiller la collecte Scope 1 & 2</H2>
      <P>
        Scope 1 (combustion directe, fluides frigorigènes, flotte propre) : factures
        énergie + carnet de maintenance + relevés. Scope 2 (achat électricité, chaleur,
        vapeur) : factures EDF / opérateurs + attestations garanties d&apos;origine si
        market-based.
      </P>

      <H2>6 — Structurer le Scope 3</H2>
      <P>
        Le Scope 3 reste le poste le plus douloureux. La méthode pragmatique :
      </P>
      <Numbered
        items={[
          "Estimer les 15 catégories en hypothèses ratios (€ achetés × facteurs ADEME).",
          "Identifier les 3 à 5 catégories matérielles (généralement 1 — Achats, 4 — Transport amont, 11 — Utilisation produits vendus).",
          "Affiner uniquement ces catégories par collecte primaire fournisseurs.",
          "Documenter méthodes, hypothèses et taux de couverture par activité.",
        ]}
      />

      <H2>7 — Définir la chaîne de responsabilité OTI</H2>
      <P>
        Chaque datapoint doit avoir un « propriétaire métier » identifié, avec validation
        formelle (signature électronique ou workflow d&apos;approbation tracé). Le
        commissaire aux comptes vérifiera la séparation entre saisie et validation.
      </P>

      <H2>8 — Choisir l&apos;outil de pilotage</H2>
      <P>
        Critères non négociables pour passer l&apos;assurance limitée 2027 :
      </P>
      <List
        items={[
          "Audit trail immuable, idéalement avec hash cryptographique de chaîne.",
          "Lignée de la donnée (qui, quand, source, méthode) tracée à la ligne.",
          "Hébergement UE et conformité RGPD documentée.",
          "Export PDF signé incluant la justification méthodologique de chaque KPI.",
        ]}
      />

      <H2>9 — Préparer la note méthodologique</H2>
      <P>
        Annexée au rapport, elle décrit pour chaque indicateur matériel : périmètre,
        sources, facteurs d&apos;émission utilisés, hypothèses, incertitude estimée.
        L&apos;auditeur la lit en premier — soignez-la.
      </P>

      <H2>10 — Programmer la pré-revue interne</H2>
      <P>
        À T-3 mois de la clôture, organiser une revue blanche avec un binôme RSE + DAF
        externes (ou un consultant). Objectif : identifier les manques avant que
        l&apos;auditeur ne les trouve.
      </P>

      <H2>11 — Cadrer le plan d&apos;assurance avec l&apos;OTI</H2>
      <P>
        Réunion de cadrage dès T-6 mois : périmètre d&apos;assurance, échantillonnage,
        accès aux systèmes, format de restitution. Un OTI bien cadré demande moins de
        documents en cours de mission.
      </P>

      <H2>12 — Anticiper la communication</H2>
      <P>
        Le rapport CSRD est un document public. Aligner DAF, RSE, communication et
        relations investisseurs sur les points de force et les zones de progrès dès la
        rédaction. Un rapport solide qui passe l&apos;assurance limitée vaut mieux
        qu&apos;un rapport ambitieux qui se fait recadrer en réserve.
      </P>

      <Aside title="Récap exécutif">
        Sur ces 12 points, les trois leviers à plus haut ROI sur 2026 sont :
        <strong> double matérialité (3)</strong>, <strong>cartographie datapoints (4)</strong>,
        et <strong>chaîne OTI (7-8)</strong>. Tout le reste s&apos;exécute mieux une fois ces
        trois sujets verrouillés.
      </Aside>
    </ArticleLayout>
  );
}
