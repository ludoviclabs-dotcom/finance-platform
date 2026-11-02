import type { Metadata } from "next";
import {
  ArticleLayout,
  P,
  H2,
  Aside,
  List,
} from "@/components/blog/article-layout";
import { getArticle } from "@/lib/blog-articles";

const article = getArticle("vsme-devient-vs-2026")!;

export const metadata: Metadata = {
  title: `${article.title} | CarbonCo`,
  description: article.description,
  alternates: { canonical: `/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <Aside title="Mis à jour le 2 novembre 2026">
        Première version publiée le 2 juillet 2026, sur la base du projet d&apos;acte délégué du
        6 mai 2026. Article réécrit après l&apos;adoption du texte. État du droit au 2 novembre
        2026.
      </Aside>

      <P>
        La Commission européenne a adopté le 3 juillet 2026 la norme volontaire de reporting de
        durabilité : <strong>règlement délégué (UE) 2026/1560</strong> (C(2026) 5011), publié au
        Journal officiel de l&apos;UE le 21 septembre 2026 et <strong>en vigueur depuis le
        24 septembre 2026</strong>. Le référentiel connu sous le nom <strong>VSME</strong> (avis
        de l&apos;EFRAG de décembre 2024, puis recommandation (UE) 2025/1710 du 30 juillet 2025)
        devient la <strong>norme volontaire, « VS »</strong> (Voluntary Standard). Son usage
        reste volontaire ; son effet juridique tient au plafond qu&apos;elle fixe aux demandes
        adressées à la chaîne de valeur.
      </P>

      <H2>Ce que contient le texte adopté</H2>
      <List
        items={[
          <span key="1"><strong>Un nom élargi</strong> — « VS » plutôt que « VSME » : la norme
            n&apos;est plus présentée comme réservée aux PME, mais comme le socle volontaire de
            toute entreprise hors du champ de la CSRD.</span>,
          <span key="2"><strong>Une structure reprise de l&apos;EFRAG</strong> — les intitulés
            des modules B1–B11 et C1–C9 sont ceux de la version EFRAG ; l&apos;acte délégué a
            procédé à des ajustements ciblés.</span>,
          <span key="3"><strong>Quatre catégories de points</strong> — chaque information est
            classée « nécessaire », « nécessaire si applicable », « volontaire » ou
            « information sectorielle à considérer ».</span>,
          <span key="4"><strong>Un plafond de la chaîne de valeur</strong> — à partir des
            exercices ouverts au 1er janvier 2027, une entreprise soumise à la CSRD ne peut pas
            exiger d&apos;une entreprise de 1 000 salariés ou moins davantage que les points
            « nécessaires » (annexe II), pour la collecte qu&apos;elle mène au titre de son
            propre reporting CSRD.</span>,
        ]}
      />

      <Aside title="Ce que le plafond couvre, et ce qu&apos;il ne couvre pas">
        Il couvre les demandes d&apos;un donneur d&apos;ordre soumis à la CSRD, adressées à une
        entreprise de 1 000 salariés ou moins, pour alimenter son rapport de durabilité, à
        partir des exercices ouverts au 1er janvier 2027. Il ne couvre pas les demandes
        d&apos;une banque, les clauses contractuelles ni les diligences au titre du devoir de
        vigilance. Le plafond limite un canal ; il ne supprime pas tous les questionnaires.
      </Aside>

      <Aside title="Le calendrier">
        6 mai 2026 : projet d&apos;acte délégué · 3 juin 2026 : fin de la consultation ·
        3 juillet 2026 : adoption du règlement délégué (UE) 2026/1560 · 21 septembre 2026 :
        publication au JOUE · 24 septembre 2026 : entrée en vigueur · exercices ouverts à
        compter du 1er janvier 2027 : plafond de la chaîne de valeur applicable.
      </Aside>

      <H2>Ce qui ne change pas</H2>
      <P>
        Les ESRS 2026 (règlement délégué (UE) 2026/1563 du 3 juillet 2026, en vigueur le
        10 novembre 2026), qui s&apos;appliquent aux entreprises restées dans le champ de la
        CSRD, conservent la logique de <strong>double matérialité</strong> : pas de bascule vers
        une approche purement financière. Et la norme volontaire reste ce qu&apos;elle était sur
        le fond : un référentiel court, public et gratuit — base de préparation, énergie et GES,
        pollution, effectifs, gouvernance — que banques et donneurs d&apos;ordre savent lire.
      </P>

      <H2>Faut-il attendre pour commencer ?</H2>
      <P>
        Non, et c&apos;est même le contresens à éviter. Les données qui alimentaient un rapport
        VSME alimentent un rapport selon la norme volontaire : bilan GES Scopes 1-2-3,
        indicateurs énergie, effectifs, gouvernance. Des ajustements ciblés ne rendent pas
        obsolète la donnée déjà collectée. Les entreprises qui collectent dès maintenant seront
        prêtes lorsque leurs donneurs d&apos;ordre adapteront leurs questionnaires pour
        l&apos;exercice 2027 ; celles qui attendent repartiront de zéro.
      </P>

      <H2>Ce que CarbonCo fait du texte adopté</H2>
      <P>
        Le référentiel de CarbonCo (modules Basic B1-B11 et Comprehensive C1-C9) suit
        aujourd&apos;hui la version EFRAG de décembre 2024. Son alignement sur le règlement
        délégué (UE) 2026/1560, avec la catégorie de chaque point, est en feuille de route. Il
        passera par une migration versionnée : les datapoints modifiés ou supprimés seront
        marqués comme tels, jamais effacés, et vos données saisies resteront rattachées à leur
        version de référentiel.
      </P>
    </ArticleLayout>
  );
}
