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

const article = getArticle("taxonomie-verte-2026")!;

export const metadata: Metadata = {
  title: `${article.title} | CarbonCo`,
  description: article.description,
  alternates: { canonical: `/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <Aside title="Mis à jour le 2 novembre 2026">
        Article complété après l&apos;entrée en application de l&apos;acte délégué de
        simplification (UE) 2026/73 et de la directive (UE) 2026/470 (Omnibus I). État du
        droit au 2 novembre 2026.
      </Aside>

      <P>
        La Taxonomie verte européenne entre dans une phase de simplification en 2026 :
        allègement des publications par l&apos;acte délégué (UE) 2026/73, champ resserré avec
        celui de la CSRD, et attentes investisseurs toujours fortes sur les KPIs financiers.
        Tour d&apos;horizon des évolutions et de leur impact opérationnel.
      </P>

      <H2>Rappel — qu&apos;est-ce que la Taxonomie</H2>
      <P>
        Le règlement UE 2020/852 définit six objectifs environnementaux et un référentiel
        d&apos;activités économiques considérées comme « durables ». L&apos;objectif est
        de rediriger les flux financiers vers les activités contribuant à la transition.
      </P>
      <Aside title="Les 6 objectifs">
        1. Atténuation du changement climatique · 2. Adaptation · 3. Eau · 4. Économie
        circulaire · 5. Pollution · 6. Biodiversité.
      </Aside>

      <H2>Ce qui change en 2026</H2>

      <H3>1 — Un acte délégué de simplification</H3>
      <P>
        L&apos;acte délégué (UE) 2026/73, adopté le 4 juillet 2025 et publié au JOUE le
        8 janvier 2026, s&apos;applique depuis le 1er janvier 2026 (son application était
        facultative pour l&apos;exercice 2025). Il introduit un <strong>seuil de matérialité de
        10 %</strong>, à documenter KPI par KPI, une{" "}
        <strong>exemption pour le KPI OpEx</strong> et une réduction d&apos;environ 64 % des
        points à publier pour les entreprises non financières. Une nouvelle révision des
        publications est visée au premier trimestre 2027.
      </P>

      <H3>2 — Un champ qui suit celui de la CSRD</H3>
      <P>
        L&apos;obligation de publier les KPIs Taxonomie (article 8 du règlement (UE) 2020/852)
        vise les entreprises soumises à la CSRD. Depuis la directive (UE) 2026/470 du
        24 février 2026, ce sont celles de plus de 1 000 salariés et de plus de 450 M€ de
        chiffre d&apos;affaires net. Une entreprise sortie du champ de la CSRD peut continuer à
        calculer ses KPIs à titre volontaire, notamment pour ses banques.
      </P>

      <H3>3 — Articulation CSRD/Taxonomie</H3>
      <P>
        Le rapport de durabilité CSRD inclut les KPIs Taxonomie (CA, CapEx, OpEx alignés).
        Pas de double tableau séparé : un seul rapport, une seule note méthodologique, un
        seul périmètre de vérification.
      </P>

      <H3>4 — Le DNSH à documenter</H3>
      <P>
        Le « Do No Significant Harm » ne se présume pas : il faut le documenter activité
        par activité, avec évaluation des impacts résiduels.
      </P>

      <H3>5 — Garanties minimales sociales</H3>
      <P>
        L&apos;alignement Taxonomie nécessite désormais le respect documenté des
        principes UN Global Compact, OCDE pour les entreprises multinationales, et
        Déclaration de l&apos;OIT. Une politique formelle, des canaux de remontée et un
        suivi des incidents sont attendus.
      </P>

      <H2>Les 3 KPIs financiers à publier</H2>
      <Numbered
        items={[
          <span key="1"><strong>CA aligné</strong> — pourcentage du chiffre d&apos;affaires
            issu d&apos;activités éligibles ET alignées (les deux conditions cumulées).</span>,
          <span key="2"><strong>CapEx aligné</strong> — pourcentage des investissements
            consacrés à des activités alignées ou à leur transition.</span>,
          <span key="3"><strong>OpEx aligné</strong> — pourcentage des dépenses
            d&apos;exploitation R&D, location à court terme, maintenance et formation
            servant des activités alignées. L&apos;acte 2026/73 prévoit une exemption pour ce
            KPI, à justifier.</span>,
        ]}
      />

      <Aside title="L&apos;astuce CapEx">
        La taxonomie permet d&apos;intégrer dans le CapEx aligné les investissements
        servant <em>la transition</em> d&apos;activités encore non alignées vers
        l&apos;alignement futur. Bien documenté, cela donne souvent un meilleur ratio que
        le CA aligné.
      </Aside>

      <H2>Cas illustratif d&apos;une ETI industrielle</H2>
      <P>
        Exemple fictif : une ETI industrielle (production de matériaux de construction,
        250 M€ CA) publiant volontairement ses KPIs Taxonomie :
      </P>
      <List
        items={[
          "CA éligible : 64 % (activités listées dans la Taxonomie).",
          "CA aligné : 18 % (respect strict des critères techniques + DNSH).",
          "CapEx aligné : 47 % (investissements lourds dans la décarbonation des fours).",
          "OpEx aligné : 29 % (R&D ciment bas carbone + maintenance équipements efficients).",
        ]}
      />
      <P>
        Dans ce cas, le KPI CapEx aligné de 47 % devient l&apos;argument central de la
        communication investisseurs : il démontre une trajectoire crédible sans surinvestir
        le KPI CA aligné qui reste structurellement bas dans ce secteur.
      </P>

      <H2>Recommandations pratiques 2026</H2>
      <Numbered
        items={[
          "Appliquer le seuil de matérialité de 10 % de l'acte délégué (UE) 2026/73 KPI par KPI, et documenter chaque choix (y compris le recours à l'exemption OpEx).",
          "Auditer le DNSH : c'est le critère le plus exigeant à documenter, activité par activité.",
          "Documenter les garanties minimales sociales avec un tableau de correspondance dispositif/principe.",
          "Aligner la note méthodologique CSRD et la note Taxonomie sur un seul périmètre, un seul vocabulaire.",
          "Anticiper le scénario d'audit : préparer 2 ou 3 activités pilotes que l'auditeur testera en priorité.",
        ]}
      />

      <H2>Verdict</H2>
      <P>
        2026 marque la fin de la phase d&apos;expérimentation : la Taxonomie devient un
        instrument central du dialogue avec les investisseurs et avec les banques (qui
        l&apos;utilisent pour leur reporting Pilier 3 ESG). Une publication soignée
        devient un actif réputationnel ; une publication bâclée devient un passif. À
        surveiller : la nouvelle révision des publications visée au premier trimestre 2027.
      </P>

      <Aside title="Et CarbonCo ?">
        CarbonCo : module Taxonomie en feuille de route. La plateforme ne calcule pas
        aujourd&apos;hui l&apos;éligibilité, l&apos;alignement ni les critères DNSH.
      </Aside>
    </ArticleLayout>
  );
}
