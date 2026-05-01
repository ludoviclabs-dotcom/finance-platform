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

const article = getArticle("double-materialite")!;

export const metadata: Metadata = {
  title: `${article.title} | CarbonCo`,
  description: article.description,
  alternates: { canonical: `https://carbonco.fr/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <P>
        La double matérialité est le pilier méthodologique d&apos;un rapport CSRD :
        c&apos;est elle qui justifie quels enjeux ESRS vous traitez et lesquels vous
        excluez. Une analyse mal documentée bloque l&apos;assurance limitée. Voici la
        méthodologie en 6 étapes, conforme ESRS 1 §3.
      </P>

      <H2>Le concept en une phrase</H2>
      <Aside title="Définition">
        Un sujet est <strong>matériel</strong> s&apos;il a un impact significatif sur la
        société/environnement (matérialité d&apos;impact) <strong>OU</strong> s&apos;il
        crée des risques/opportunités financières significatives pour l&apos;entreprise
        (matérialité financière).
      </Aside>

      <H2>Les 6 étapes ESRS 1 §3</H2>

      <Numbered
        items={[
          <span key="1"><strong>Compréhension du contexte</strong> — modèle d&apos;affaires,
            chaîne de valeur, parties prenantes.</span>,
          <span key="2"><strong>Identification des impacts, risques, opportunités
            (IRO)</strong> — liste exhaustive par standard ESRS.</span>,
          <span key="3"><strong>Évaluation</strong> — scoring impact + scoring
            financier.</span>,
          <span key="4"><strong>Détermination de la matérialité</strong> — application
            d&apos;un seuil de matérialité documenté.</span>,
          <span key="5"><strong>Documentation</strong> — méthodologie écrite,
            consultations parties prenantes, arbitrages tracés.</span>,
          <span key="6"><strong>Validation gouvernance</strong> — Comité ESG / COMEX /
            Conseil selon délégation.</span>,
        ]}
      />

      <H2>Comment scorer un impact</H2>
      <P>
        L&apos;ESRS 1 §43 demande quatre dimensions :
      </P>
      <List
        items={[
          <span key="1"><strong>Échelle</strong> (sévérité) — combien de personnes /
            écosystèmes touchés.</span>,
          <span key="2"><strong>Étendue</strong> — géographique, durée, nombre
            d&apos;activités impactées.</span>,
          <span key="3"><strong>Caractère irrémédiable</strong> — réversibilité de
            l&apos;impact.</span>,
          <span key="4"><strong>Probabilité</strong> — uniquement pour les impacts
            potentiels.</span>,
        ]}
      />
      <P>
        Pratique recommandée : scorer chaque dimension de 1 à 5, calculer une moyenne, et
        documenter le seuil retenu (ex : moyenne ≥ 3,5 = matériel).
      </P>

      <H2>Comment scorer la matérialité financière</H2>
      <P>
        Deux dimensions, alignées avec la gestion des risques d&apos;entreprise existante :
      </P>
      <List
        items={[
          <span key="1"><strong>Ampleur de l&apos;effet financier</strong> — exprimé en
            pourcentage du résultat net ou des fonds propres.</span>,
          <span key="2"><strong>Probabilité d&apos;occurrence</strong> — fenêtre temporelle
            (court / moyen / long terme).</span>,
        ]}
      />
      <P>
        L&apos;auditeur appréciera fortement un alignement avec la cartographie des
        risques (DAF / Direction des risques) plutôt qu&apos;une analyse séparée.
      </P>

      <H2>Consultation des parties prenantes</H2>
      <P>
        Obligatoire mais le format reste libre. Les approches qui passent l&apos;audit :
      </P>
      <List
        items={[
          "Entretiens semi-directifs avec 8 à 12 parties prenantes représentatives (clients, salariés, fournisseurs, ONG, riverains, investisseurs).",
          "Sondage en ligne complémentaire pour quantifier les retours qualitatifs.",
          "Comité ESG dédié avec représentation interne pluri-fonctionnelle.",
        ]}
      />

      <Aside title="Piège fréquent">
        Consulter uniquement le top management interne. C&apos;est un signal rouge en audit.
        Au minimum 3 parties prenantes externes représentatives doivent être documentées.
      </Aside>

      <H2>Le livrable final</H2>
      <P>
        Une note de double matérialité de 15 à 30 pages, contenant :
      </P>
      <List
        items={[
          "Une matrice visuelle (impact × financier) avec sujets matériels en quadrant haut-droit.",
          "Le détail des scores par sujet avec source des données.",
          "Le compte rendu des consultations parties prenantes.",
          "L'arbitrage gouvernance (PV de comité ESG ou COMEX).",
          "La méthodologie de scoring documentée (seuils, rubriques, pondérations).",
        ]}
      />

      <H2>Cycle de mise à jour</H2>
      <P>
        L&apos;analyse de double matérialité doit être actualisée à chaque évolution
        significative du modèle d&apos;affaires (acquisition, sortie d&apos;activité,
        nouveau marché géographique) et au minimum tous les 3 ans. La revue annuelle
        peut se limiter à une confirmation par le comité ESG si rien n&apos;a changé.
      </P>

      <H2>Recommandation</H2>
      <P>
        Investissez dans cette première analyse : elle structure tout le reste du
        rapport. Une analyse rigoureuse économise des semaines de discussion ultérieure
        avec les auditeurs. Comptez 6 à 10 semaines pour une ETI, en mobilisant
        l&apos;équipe ESG, le DAF et la communication.
      </P>
    </ArticleLayout>
  );
}
