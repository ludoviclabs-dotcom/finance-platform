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
      <P>
        Le 6 mai 2026, la Commission européenne a publié son projet d&apos;acte délégué
        établissant le standard volontaire de reporting de durabilité. Deux surprises :
        le référentiel connu depuis décembre 2024 sous le nom <strong>VSME</strong> y est
        rebaptisé <strong>« VS » (Voluntary Standard)</strong>, et il en ressort allégé.
        La consultation publique s&apos;est achevée le 3 juin ; le texte final est attendu
        à la mi-juillet 2026.
      </P>

      <H2>Ce qui change concrètement</H2>
      <List
        items={[
          <span key="1"><strong>Un nom élargi</strong> — « VS » plutôt que « VSME » : le standard
            n&apos;est plus présenté comme réservé aux PME, mais comme le socle volontaire de
            toute entreprise hors du champ CSRD.</span>,
          <span key="2"><strong>Moins de datapoints</strong> — le volume de données demandées est
            réduit par rapport à la version EFRAG de décembre 2024, en cohérence avec la
            révision parallèle des ESRS.</span>,
          <span key="3"><strong>Exemptions renforcées</strong> — des allègements supplémentaires
            sont prévus pour les entreprises de 10 salariés ou moins.</span>,
          <span key="4"><strong>Le « value chain cap » devient opposable</strong> — les grands
            donneurs d&apos;ordre ne pourront pas exiger de leurs fournisseurs de moins de
            1 000 salariés des informations au-delà de ce standard. C&apos;est LA protection
            concrète pour les PME sous pression de questionnaires clients.</span>,
        ]}
      />

      <Aside title="Le calendrier">
        Consultation close le 3 juin 2026 · publication des ESRS révisés attendue fin
        juin · acte délégué VS attendu à la mi-juillet · application aux exercices
        ouverts en 2027, avec application volontaire anticipée possible dès l&apos;exercice
        2026.
      </Aside>

      <H2>Ce qui ne change pas</H2>
      <P>
        Contrairement à ce que certains anticipaient, la Commission maintient pleinement la
        logique de <strong>double matérialité</strong> dans les ESRS révisés : pas de bascule
        vers une approche purement financière à l&apos;américaine. Et le standard volontaire
        reste ce qu&apos;il était sur le fond : un référentiel court, public et gratuit —
        base de préparation, énergie et GES, pollution, effectifs, gouvernance — que banques
        et donneurs d&apos;ordre savent lire.
      </P>

      <H2>Faut-il attendre le texte final pour commencer ?</H2>
      <P>
        Non, et c&apos;est même le contresens à éviter. Les données qui alimentent un rapport
        VSME 2024 alimenteront un rapport VS 2026 : bilan GES Scopes 1-2-3, indicateurs
        énergie, effectifs, gouvernance. Un standard qui s&apos;allège ne rend jamais obsolète
        la donnée déjà collectée — il en supprime une partie. Les entreprises qui collectent
        dès maintenant seront prêtes quel que soit le périmètre final ; celles qui attendent
        repartiront de zéro en 2027, au moment où leurs donneurs d&apos;ordre basculeront
        leurs questionnaires sur le VS.
      </P>

      <H2>Ce que CarbonCo fera à la publication de l&apos;acte</H2>
      <P>
        Le référentiel VSME de CarbonCo (modules Basic B1-B11 et Comprehensive C1-C9) est
        versionné : dès la publication de l&apos;acte délégué, le catalogue de datapoints sera
        aligné sur le texte final par une migration tracée — les datapoints supprimés seront
        marqués comme tels, jamais effacés, et vos données saisies resteront rattachées à leur
        version de référentiel. C&apos;est exactement le scénario pour lequel l&apos;architecture
        « chaque évolution du standard = migration versionnée » a été conçue.
      </P>
    </ArticleLayout>
  );
}
