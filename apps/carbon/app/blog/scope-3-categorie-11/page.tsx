import type { Metadata } from "next";
import {
  ArticleLayout,
  P,
  H2,
  H3,
  Aside,
  List,
  Numbered,
} from "@/components/blog/article-layout";
import { getArticle } from "@/lib/blog-articles";

const article = getArticle("scope-3-categorie-11")!;

export const metadata: Metadata = {
  title: `${article.title} | CarbonCo`,
  description: article.description,
  alternates: { canonical: `https://carbonco.fr/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <P>
        La catégorie 11 du Scope 3 — émissions liées à l&apos;utilisation des produits
        vendus — est souvent le poste le plus volumineux d&apos;un industriel et le plus
        sous-estimé des services. Ce guide détaille la méthode GHG Protocol, les facteurs
        ADEME pertinents et les pièges qui bloquent l&apos;assurance limitée.
      </P>

      <H2>Pourquoi cette catégorie est critique</H2>
      <P>
        Pour un fabricant de chaudières, de véhicules, de logiciels énergivores ou de
        produits laitiers, la catégorie 11 peut représenter 40 à 80 % du total Scope 3.
        L&apos;auditeur la passera systématiquement au crible.
      </P>

      <H2>Le périmètre exact</H2>
      <P>
        La catégorie 11 couvre les émissions générées <em>par l&apos;utilisateur final</em>
        pendant la durée de vie du produit. On distingue :
      </P>
      <List
        items={[
          <span key="d"><strong>Usage direct</strong> — le produit consomme de
            l&apos;énergie (voiture, chaudière, serveur).</span>,
          <span key="i"><strong>Usage indirect</strong> — le produit nécessite des
            consommables (toner, recharges).</span>,
          <span key="o"><strong>Usage par activation</strong> — le produit catalyse une
            consommation tierce (logiciel SaaS qui orchestre des serveurs).</span>,
        ]}
      />

      <H2>Méthode de calcul (formule GHG Protocol)</H2>
      <P>
        La formule canonique est :
      </P>
      <Aside title="Formule">
        Émissions cat. 11 = (unités vendues année N) × (énergie consommée par unité × durée
        de vie) × (facteur d&apos;émission de l&apos;énergie)
      </Aside>

      <H2>Étape par étape</H2>
      <Numbered
        items={[
          <span key="1"><strong>Recenser les unités vendues</strong> — données de gestion
            commerciales, livraisons facturées année N.</span>,
          <span key="2"><strong>Estimer la durée de vie technique</strong> — fiche
            produit, retours SAV, statistiques sectorielles.</span>,
          <span key="3"><strong>Mesurer la consommation unitaire</strong> — fiche
            d&apos;essai, étiquette énergétique, mesure terrain sur échantillon.</span>,
          <span key="4"><strong>Choisir le facteur d&apos;émission</strong> — base ADEME
            (électricité France 0,054 kgCO2e/kWh en 2026, gaz naturel 0,205 kgCO2e/kWh).</span>,
          <span key="5"><strong>Documenter les hypothèses</strong> — cycle d&apos;usage
            (8h/jour, 220 jours/an...), géographie (mix énergétique du pays
            d&apos;utilisation).</span>,
        ]}
      />

      <H2>Pièges classiques en audit</H2>

      <H3>Piège n°1 — confondre émissions de production et émissions d&apos;utilisation</H3>
      <P>
        Une voiture de 1 800 kg émet ~7 tCO2 à la fabrication mais ~30 tCO2 sur 200 000 km
        d&apos;utilisation. La catégorie 11 ne couvre que la seconde partie.
      </P>

      <H3>Piège n°2 — utiliser un facteur monétaire (€) sans justification</H3>
      <P>
        Les facteurs monétaires ratio sont acceptés à défaut de données primaires, mais
        l&apos;auditeur attendra une justification du choix de la matrice (NACE, domaine
        d&apos;activité) et un plan d&apos;amélioration vers la donnée primaire.
      </P>

      <H3>Piège n°3 — oublier l&apos;évolution du mix électrique</H3>
      <P>
        Pour des produits à durée de vie longue (15 ans pour une chaudière), figer le
        facteur électricité 2026 sur toute la durée surestime les émissions. Méthode
        admise : trajectoire ADEME ou IEA (mix décarboné évolutif).
      </P>

      <H2>Cas réel — éditeur SaaS B2B</H2>
      <P>
        Un éditeur SaaS de 60 personnes a recalculé sa catégorie 11 selon trois méthodes :
      </P>
      <List
        items={[
          "Méthode 1 (ratio CA fournisseur) → 2 400 tCO2e — très imprécise.",
          "Méthode 2 (facteur unitaire data center moyen) → 480 tCO2e — médiane.",
          "Méthode 3 (mesure CPU réelle × mix régional) → 320 tCO2e — précise, vérifiable.",
        ]}
      />
      <P>
        L&apos;écart entre méthode 1 et 3 est de 7,5x. C&apos;est ce qui sépare un rapport
        crédible d&apos;un rapport déclassé en réserve.
      </P>

      <H2>Recommandation finale</H2>
      <P>
        Pour cette catégorie 11, la priorité absolue n&apos;est pas la précision parfaite —
        c&apos;est la <strong>traçabilité documentée</strong> des hypothèses. Un calcul
        approximatif mais entièrement justifié passe l&apos;assurance limitée. Un calcul
        précis mais opaque ne passe pas.
      </P>
    </ArticleLayout>
  );
}
