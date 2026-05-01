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

const article = getArticle("audit-trail-oti")!;

export const metadata: Metadata = {
  title: `${article.title} | CarbonCo`,
  description: article.description,
  alternates: { canonical: `https://carbonco.fr/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <P>
        L&apos;assurance limitée CSRD impose à l&apos;Organisme Tiers Indépendant (OTI) de
        vérifier la fiabilité des données extra-financières. Sans audit trail
        cryptographique, vous ne pouvez pas répondre techniquement à ses tests. Voici
        pourquoi le SHA-256 s&apos;est imposé comme standard de fait.
      </P>

      <H2>Ce que contrôle un OTI</H2>
      <P>
        Lors d&apos;une assurance limitée, l&apos;auditeur exécute :
      </P>
      <List
        items={[
          "Des tests d'existence (l'écriture est-elle traçable depuis sa source ?).",
          "Des tests de complétude (l'ensemble des données pertinentes est-il pris en compte ?).",
          "Des tests d'exactitude (la donnée n'a-t-elle pas été altérée entre la collecte et la publication ?).",
          "Des tests de présentation (le rapport reflète-t-il fidèlement les données sous-jacentes ?).",
        ]}
      />
      <P>
        Sur les tests d&apos;exactitude, le hash cryptographique devient l&apos;outil le
        plus efficace.
      </P>

      <H2>Pourquoi SHA-256 et pas un simple log</H2>
      <P>
        Un log applicatif classique répond à la question « quelle action a été faite ? »
        mais pas à « la donnée que je vois aujourd&apos;hui est-elle exactement celle qui
        a été saisie le 12 mars ? ». Un hash SHA-256 répond aux deux.
      </P>

      <Aside title="Définition">
        SHA-256 (Secure Hash Algorithm 256-bit) produit une empreinte de 64 caractères
        hexadécimaux à partir de n&apos;importe quel contenu. Toute modification, même
        d&apos;un seul bit, change radicalement l&apos;empreinte. Calculer ce hash coûte
        quelques microsecondes ; l&apos;inverser est calculatoirement impossible.
      </Aside>

      <H2>Le principe de la chaîne de hash</H2>
      <P>
        Chaque écriture dans la base de données est étiquetée avec :
      </P>
      <Numbered
        items={[
          "Un hash du contenu (la donnée saisie).",
          "Un hash de l'écriture précédente (lien vers l'antécédent).",
          "Un hash combiné des deux, qui devient l'identifiant immuable de la nouvelle écriture.",
        ]}
      />
      <P>
        Cette structure rend toute manipulation détectable : si un attaquant modifie une
        écriture, tous les hashs descendants deviennent invalides. C&apos;est la même
        mécanique qui sécurise Git ou les blockchains.
      </P>

      <H2>Ce que l&apos;OTI peut tester</H2>
      <H3>Test 1 — non-altération</H3>
      <P>
        L&apos;auditeur prend une donnée publiée dans le rapport (ex : 12 450 tCO2e
        Scope 2). Il remonte la chaîne de hash jusqu&apos;à l&apos;écriture initiale et
        vérifie qu&apos;à chaque étape le hash correspond. Test instantané.
      </P>

      <H3>Test 2 — chronologie</H3>
      <P>
        Chaque écriture a un timestamp signé. Si l&apos;écriture est antidatée pour
        cacher une correction tardive, le hash combiné ne correspond plus. Détection
        automatique.
      </P>

      <H3>Test 3 — lignée méthodologique</H3>
      <P>
        Les métadonnées (méthode, facteur d&apos;émission, source) sont incluses dans le
        contenu hashé. Modifier la méthode après publication invalide la chaîne.
      </P>

      <H2>Implications opérationnelles</H2>
      <List
        items={[
          "Une erreur détectée après publication ne peut pas être effacée discrètement : il faut une nouvelle écriture qui annule la précédente, signée et datée.",
          "Toute opération destructive (delete, archive) est en réalité une écriture additionnelle marquée comme telle. La trace originale subsiste.",
          "L'export PDF du rapport peut inclure le hash racine de la période publiée. L'OTI peut vérifier en quelques secondes que ce hash correspond aux données sources.",
        ]}
      />

      <H2>Combien de hash par rapport CSRD ?</H2>
      <P>
        Pour une ETI de 600 personnes avec 250 datapoints reportés, on observe en moyenne
        15 000 à 40 000 écritures sur l&apos;année (saisies, corrections, validations,
        commentaires d&apos;auditeur). Chaque écriture est hashée. Le coût de stockage
        reste négligeable (quelques Mo).
      </P>

      <H2>Verdict</H2>
      <P>
        Le SHA-256 chaîné n&apos;est pas un gadget marketing : c&apos;est devenu le
        standard de fait que les Big Four et la majorité des cabinets OTI demandent
        désormais lors des phases de cadrage. Si votre solution ESG actuelle n&apos;en
        propose pas, vous risquez de devoir produire les preuves d&apos;exactitude par
        échantillonnage manuel — un travail consommateur de jours-homme évitables.
      </P>
    </ArticleLayout>
  );
}
