import type { Metadata } from "next";
import {
  ArticleLayout,
  P,
  H2,
  Aside,
  List,
} from "@/components/blog/article-layout";
import { getArticle } from "@/lib/blog-articles";

const article = getArticle("vsme-standard-chaine-valeur")!;

export const metadata: Metadata = {
  title: `${article.title} | CarbonCo`,
  description: article.description,
  alternates: { canonical: `/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <P>
        Depuis le 18 mars 2026, la directive (UE) 2026/470 du 24 février 2026
        (« Omnibus I ») réserve la CSRD aux entreprises de plus de <strong>1 000 salariés
        et</strong> de plus de <strong>450 M€</strong> de chiffre d&apos;affaires net, deux
        critères cumulatifs : environ 90 % d&apos;entreprises en moins dans le champ, selon
        l&apos;ordre de grandeur cité par les cabinets. Les nouvelles entreprises concernées
        publieront en 2028 sur l&apos;exercice 2027. En France, la loi de transposition est en
        cours d&apos;examen (échéance : 19 mars 2027). Pour toutes les autres, la pression ne
        disparaît pas : elle change de canal.
      </P>

      <H2>La pression change de canal</H2>
      <P>
        Banques, assureurs et donneurs d&apos;ordre demandent des données ESG structurées à
        leurs contreparties et fournisseurs, quelle que soit leur taille. La{" "}
        <strong>norme volontaire</strong> (ex-VSME), adoptée par le règlement délégué (UE)
        2026/1560 et en vigueur depuis le 24 septembre 2026, devient leur langage commun ; à
        partir de l&apos;exercice 2027, un donneur d&apos;ordre soumis à la CSRD ne pourra plus
        exiger d&apos;une entreprise de 1 000 salariés ou moins davantage que ses points
        « nécessaires », pour son propre rapport. Enfin, le <strong>BEGES</strong> reste
        obligatoire en France au-delà de 500 salariés, et les entreprises qui sortent de la
        CSRD perdent la dispense prévue par la loi n° 2025-391 du 30 avril 2025 : leur bilan
        redevient dû tous les quatre ans.
      </P>

      <Aside title="Qu'est-ce que la norme volontaire (VS) ?">
        Issue du <strong>Voluntary SME Standard</strong> (VSME) publié par l&apos;EFRAG en
        décembre 2024, la norme volontaire est un référentiel court et gratuit : un module
        <strong> Basic</strong> (B1 à B11 : base de préparation, énergie &amp; GES, eau,
        déchets, effectifs, anti-corruption…) et un module <strong>Comprehensive</strong>
        (C1 à C9 : stratégie, cibles climat, droits humains, diversité…). Ces intitulés sont
        ceux de la version EFRAG ; l&apos;acte délégué a procédé à des ajustements ciblés et
        classe chaque point en « nécessaire », « nécessaire si applicable », « volontaire » ou
        « information sectorielle à considérer ».
      </Aside>

      <H2>Pourquoi c'est une opportunité, pas une contrainte</H2>
      <List
        items={[
          <span key="1"><strong>Public et gratuit</strong> — aucun coût de licence du
            référentiel, contrairement à un audit CSRD complet.</span>,
          <span key="2"><strong>Proportionné</strong> — un sous-ensemble d&apos;indicateurs
            réellement collectables par une PME.</span>,
          <span key="3"><strong>Reconnu</strong> — c&apos;est le format que vos donneurs
            d&apos;ordre et votre banque savent lire.</span>,
        ]}
      />

      <H2>Ce que CarbonCo apporte</H2>
      <P>
        CarbonCo mappe automatiquement les données que vous avez déjà (bilan GES Scopes 1-2-3,
        matérialité, indicateurs sociaux et de gouvernance) vers les modules VSME, affiche
        une jauge de complétude honnête (datapoints obligatoires renseignés, manquants, ou
        non applicables avec justification), et génère un <strong>Rapport VSME</strong>
        — PDF + annexe Excel avec une empreinte SHA-256 par ligne, vérifiable par votre
        auditeur sans aucun outil propriétaire. Chaque chiffre reste traçable jusqu&apos;à sa
        source. Le module (bêta) suit aujourd&apos;hui la version EFRAG de décembre 2024 ; son
        alignement sur le règlement délégué (UE) 2026/1560 est en feuille de route.
      </P>
    </ArticleLayout>
  );
}
