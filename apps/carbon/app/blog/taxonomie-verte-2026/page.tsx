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
  alternates: { canonical: `https://carbonco.fr/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <P>
        La Taxonomie verte européenne entre dans une nouvelle phase en 2026 :
        consolidation des critères techniques, articulation renforcée avec la CSRD, et
        attentes investisseurs croissantes sur les KPIs financiers. Tour d&apos;horizon
        des évolutions et de leur impact opérationnel pour une ETI.
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

      <H3>1 — Élargissement des critères techniques</H3>
      <P>
        Les Actes délégués 2024 et 2025 finalisent l&apos;extension aux 4 derniers
        objectifs (eau, économie circulaire, pollution, biodiversité). Application pleine
        et entière en 2026 : une ETI matériellement exposée doit publier ses KPIs sur les
        6 axes, et non plus seulement sur le climat.
      </P>

      <H3>2 — Articulation CSRD/Taxonomie clarifiée</H3>
      <P>
        Le rapport CSRD inclut désormais explicitement les KPIs Taxonomie (CA, CapEx,
        OpEx alignés). Plus de double tableau séparé : un seul rapport, une seule note
        méthodologique, un seul périmètre d&apos;audit.
      </P>

      <H3>3 — Critères DNSH renforcés</H3>
      <P>
        Le « Do No Significant Harm » devient plus exigeant : il ne suffit plus
        d&apos;affirmer le respect, il faut le documenter activité par activité, avec
        évaluation des impacts résiduels. C&apos;est la principale source de
        non-conformité observée en 2024-2025.
      </P>

      <H3>4 — Garanties minimales sociales</H3>
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
            servant des activités alignées.</span>,
        ]}
      />

      <Aside title="L&apos;astuce CapEx">
        La taxonomie permet d&apos;intégrer dans le CapEx aligné les investissements
        servant <em>la transition</em> d&apos;activités encore non alignées vers
        l&apos;alignement futur. Bien documenté, cela donne souvent un meilleur ratio que
        le CA aligné.
      </Aside>

      <H2>Cas d&apos;une ETI industrielle</H2>
      <P>
        Une ETI industrielle (production de matériaux de construction, 250 M€ CA) a publié
        en 2025 :
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
        Le KPI CapEx aligné de 47 % a été repris en argument central de la communication
        investisseurs : il démontre une trajectoire crédible sans surinvestir le KPI CA
        aligné qui reste structurellement bas dans ce secteur.
      </P>

      <H2>Recommandations pratiques 2026</H2>
      <Numbered
        items={[
          "Re-cartographier les activités selon la NACE-Taxonomie 2026 (ajustements mineurs mais réels sur certaines codes).",
          "Auditer le DNSH : c'est ici que se cachent 80 % des risques de déclassement.",
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
        devient un actif réputationnel ; une publication bâclée devient un passif.
      </P>
    </ArticleLayout>
  );
}
