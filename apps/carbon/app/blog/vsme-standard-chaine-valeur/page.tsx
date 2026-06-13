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
        Depuis la directive Omnibus (en vigueur depuis mars 2026), seules les entreprises
        de plus de 1 000 salariés réalisant plus de 450 M€ de chiffre d&apos;affaires
        restent soumises à la CSRD — environ 10 000 entreprises dans l&apos;UE, avec de
        premiers rapports attendus en 2028 sur l&apos;exercice 2027. Pour toutes les autres,
        la pression ne disparaît pas : elle change de canal.
      </P>

      <H2>La pression change de canal</H2>
      <P>
        Banques, assureurs et donneurs d&apos;ordre exigent désormais des données ESG
        structurées de leurs contreparties et fournisseurs, quelle que soit leur taille.
        Le standard volontaire <strong>VSME</strong> — dont l&apos;adoption par acte délégué
        est attendue à l&apos;été 2026 — devient le langage commun de la chaîne de valeur.
        En France, le bilan d&apos;émissions de GES (<strong>BEGES</strong>) reste par
        ailleurs obligatoire pour les entreprises de plus de 500 salariés.
      </P>

      <Aside title="Qu'est-ce que le VSME ?">
        Le <strong>Voluntary SME Standard</strong> publié par l&apos;EFRAG (décembre 2024)
        est un référentiel court et gratuit, pensé pour les PME : un module
        <strong> Basic</strong> (B1 à B11 : base de préparation, énergie &amp; GES, eau,
        déchets, effectifs, anti-corruption…) et un module <strong>Comprehensive</strong>
        (C1 à C9 : stratégie, cibles climat, droits humains, diversité…).
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
        non applicables avec justification), et génère un <strong>Rapport VSME auditable</strong>
        — PDF + annexe Excel avec un hash par ligne, vérifiable par votre auditeur sans aucun
        outil propriétaire. Chaque chiffre reste traçable jusqu&apos;à sa source.
      </P>
    </ArticleLayout>
  );
}
