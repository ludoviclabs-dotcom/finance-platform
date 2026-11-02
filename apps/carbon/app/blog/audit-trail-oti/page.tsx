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
  alternates: { canonical: `/blog/${article.slug}` },
};

export default function Page() {
  return (
    <ArticleLayout article={article}>
      <P>
        En assurance limitée CSRD, les informations de durabilité sont vérifiées par un
        commissaire aux comptes (CAC) ou un organisme tiers indépendant (OTI) inscrit à la H2A
        (Haute autorité de l&apos;audit). Un journal chaîné par empreinte SHA-256 l&apos;aide à
        répondre vite à une question précise : la donnée a-t-elle changé depuis sa capture ?
        Voici ce que cette technique apporte au vérificateur, et ce qu&apos;elle ne prouve pas.
      </P>

      <H2>Ce que contrôle le vérificateur</H2>
      <P>
        Lors d&apos;une assurance limitée, le vérificateur exécute notamment :
      </P>
      <List
        items={[
          "Des tests d'existence (l'écriture est-elle traçable depuis sa source ?).",
          "Des tests de complétude (l'ensemble des données pertinentes est-il pris en compte ?).",
          "Des tests d'exactitude (la donnée reflète-t-elle correctement la pièce source ?).",
          "Des tests de présentation (le rapport reflète-t-il fidèlement les données sous-jacentes ?).",
        ]}
      />
      <P>
        Le hash cryptographique ne répond qu&apos;à une partie de ces questions : il démontre
        que la donnée n&apos;a pas été altérée entre sa capture et sa publication.
      </P>

      <Aside title="Intégrité ≠ exactitude ≠ exhaustivité">
        L&apos;empreinte prouve l&apos;<strong>intégrité</strong> et l&apos;ordre des écritures
        depuis leur capture. Elle ne prouve pas l&apos;<strong>exactitude</strong> : une facture
        mal saisie reste fausse, même parfaitement chaînée. Elle ne prouve pas davantage
        l&apos;<strong>exhaustivité</strong> : une donnée jamais saisie n&apos;apparaît dans aucune
        chaîne. Ces deux points se vérifient par des rapprochements avec les pièces sources et
        la comptabilité.
      </Aside>

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
          "Un hash combiné des deux, qui devient l'identifiant de la nouvelle écriture : un identifiant qui change si le contenu change.",
        ]}
      />
      <P>
        Cette structure rend toute manipulation détectable : si quelqu&apos;un modifie une
        écriture, tous les hashs descendants deviennent invalides. C&apos;est la même
        mécanique que celle de Git. Elle ne l&apos;empêche pas pour autant : qui contrôle la
        base pourrait recalculer toute la chaîne. D&apos;où l&apos;intérêt de conserver
        l&apos;empreinte hors de la base, par exemple dans le PDF remis au vérificateur.
      </P>

      <H2>Ce que le vérificateur peut tester</H2>
      <H3>Test 1 — non-altération</H3>
      <P>
        L&apos;auditeur prend une donnée publiée dans le rapport (ex : 12 450 tCO2e
        Scope 2). Il remonte la chaîne de hash jusqu&apos;à l&apos;écriture initiale et
        vérifie qu&apos;à chaque étape le hash correspond. Test instantané.
      </P>

      <H3>Test 2 — chronologie</H3>
      <P>
        Chaque écriture porte un horodatage inclus dans le contenu haché. Si l&apos;écriture
        est antidatée après coup pour cacher une correction tardive, le hash combiné ne
        correspond plus. Sans ancrage externe, la chaîne prouve l&apos;ordre des écritures,
        pas leur date absolue.
      </P>

      <H3>Test 3 — lignée méthodologique</H3>
      <P>
        Les métadonnées (méthode, facteur d&apos;émission, source) sont incluses dans le
        contenu hashé. Modifier la méthode après publication invalide la chaîne.
      </P>

      <H2>Implications opérationnelles</H2>
      <List
        items={[
          "Une erreur détectée après publication ne peut pas être effacée discrètement : il faut une nouvelle écriture qui annule la précédente, datée et attribuée à son auteur.",
          "Toute opération destructive (delete, archive) est en réalité une écriture additionnelle marquée comme telle. La trace originale subsiste.",
          "L'export PDF du rapport peut inclure le hash racine de la période publiée. Le vérificateur peut contrôler en quelques secondes que ce hash correspond aux données enregistrées.",
        ]}
      />

      <H2>Combien de hash par rapport CSRD ?</H2>
      <P>
        Pour une ETI de 600 personnes avec 250 datapoints reportés, on peut estimer de
        15 000 à 40 000 écritures sur l&apos;année (saisies, corrections, validations,
        commentaires d&apos;auditeur). Chaque écriture est hashée. Le coût de stockage
        reste négligeable (quelques Mo).
      </P>

      <H2>Verdict</H2>
      <P>
        Le SHA-256 chaîné n&apos;est pas un gadget marketing : il donne au vérificateur un
        moyen rapide de tester l&apos;intégrité des données. Il ne remplace ni les
        rapprochements avec les pièces sources ni les tests d&apos;exhaustivité, qui restent
        son travail. Sans lui, la preuve d&apos;intégrité passe par un échantillonnage manuel
        plus long — des jours-homme que l&apos;on peut consacrer à l&apos;exactitude.
      </P>
    </ArticleLayout>
  );
}
