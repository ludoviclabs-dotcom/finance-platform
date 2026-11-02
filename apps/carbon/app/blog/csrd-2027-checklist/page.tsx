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
  alternates: { canonical: `/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <Aside title="Mis à jour le 2 novembre 2026">
        Depuis le 18 mars 2026, la directive (UE) 2026/470 du 24 février 2026 (« Omnibus I »)
        réserve la CSRD aux entreprises de plus de 1 000 salariés <strong>et</strong> de plus de
        450 M€ de chiffre d&apos;affaires net (critères cumulatifs). La vague 3 (PME cotées) sort
        du champ. Les groupes non européens sont visés à partir de l&apos;exercice 2028 (CA dans
        l&apos;UE supérieur à 450 M€ et filiale ou succursale UE au-delà de 200 M€). En France, la
        loi de transposition est en cours d&apos;examen (échéance : 19 mars 2027).
      </Aside>

      <P>
        Pour les entreprises de la vague 2 qui restent dans le champ, le premier rapport CSRD
        portera sur l&apos;exercice 2027 et sera publié en 2028 (report décidé par la directive
        « stop-the-clock » 2025/794 du 14 avril 2025), avec une assurance limitée conduite par
        un commissaire aux comptes ou un OTI inscrit à la H2A. Les entreprises de la vague 1
        ont, pour l&apos;exercice 2026, trois options : ESRS 2023 avec le « quick fix »
        2025/1416, ESRS 2026 par anticipation, ou ESRS 2023 avec les allègements 2026. Voici les
        douze chantiers à verrouiller dès maintenant pour ne pas découvrir les manques au
        dernier moment.
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
        L&apos;ESRS 1 (chapitre 3) impose une analyse documentée croisant impact et matérialité
        financière ; les ESRS 2026 admettent une approche descendante (top-down). Cible : 6 à 10 enjeux matériels priorisés, scoring justifié, parties
        prenantes consultées.
      </P>

      <Aside title="Piège classique">
        Reprendre la matrice de matérialité historique sans la re-scorer aux critères ESRS.
        L&apos;auditeur le verra immédiatement à l&apos;absence de scores quantitatifs et
        de méthode reproductible.
      </Aside>

      <H2>4 — Cartographier les datapoints obligatoires</H2>
      <P>
        Les ESRS thématiques (E1 à E5, S1 à S4, G1) déclinaient ~1 100 datapoints dans leur
        version 2023 ; les ESRS 2026 (règlement délégué (UE) 2026/1563, obligatoires pour les
        exercices ouverts à compter du 1er janvier 2027) réduisent d&apos;environ 61 % les points
        obligatoires. Pour une entreprise matériellement concernée par 4 à 6 normes, le
        périmètre opérationnel se compte en centaines de datapoints. Cartographier{" "}
        <em>quelle équipe / quel système / quelle fréquence</em> pour chacun.
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
        Critères à exiger de l&apos;outil avant l&apos;assurance limitée de l&apos;exercice 2027 :
      </P>
      <List
        items={[
          "Journal en ajout seul, modifications détectables, chaîné par empreinte cryptographique et ancré hors de la base.",
          "Lignée de la donnée (qui, quand, source, méthode) tracée à la ligne.",
          "Données stockées en UE, sous-traitants et transferts hors UE documentés (RGPD).",
          "Export PDF avec empreinte vérifiable, incluant la justification méthodologique de chaque KPI.",
          "Version du référentiel ESRS appliquée (2023 ou 2026) tracée sur chaque rapport.",
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
