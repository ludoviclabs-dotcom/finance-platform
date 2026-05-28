import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Conformité AI Act — CarbonCo",
  description:
    "Position de CarbonCo vis-à-vis du règlement européen sur l'intelligence artificielle (AI Act). Classification du copilote NEURAL, supervision humaine, journal d'usage.",
  alternates: { canonical: "https://carbonco.fr/ai-act" },
};

export default function AiActPage() {
  return (
    <LegalLayout title="Conformité AI Act" lastUpdated="28 mai 2026">
      <Section title="Périmètre">
        <p>
          Cette page décrit la position de CarbonCo vis-à-vis du{" "}
          <a
            href="https://eur-lex.europa.eu/eli/reg/2024/1689/oj"
            target="_blank"
            rel="noopener noreferrer"
          >
            règlement (UE) 2024/1689 sur l'intelligence artificielle
          </a>
          {" "}(« AI Act »), entré en vigueur le 1<sup>er</sup> août 2024 et applicable par
          paliers jusqu'en 2027.
        </p>
        <p>
          CarbonCo intègre un copilote IA nommé <strong>NEURAL</strong>, fondé sur les modèles
          de langage d'Anthropic (Claude). NEURAL répond à des questions sur les obligations
          ESRS / CSRD, cite les articles sources et aide à interpréter des données métier. Il
          ne prend pas de décision automatisée à la place de l'utilisateur et n'attribue pas
          de score d'éligibilité, de crédit, de risque ou de sanction.
        </p>
      </Section>

      <Section title="Classification envisagée">
        <p>
          Sur la base de l'analyse interne, le copilote NEURAL relève de la catégorie{" "}
          <strong>« système d'IA à risque limité »</strong> au sens des articles 50 et
          suivants de l'AI Act. Cette qualification s'appuie sur trois éléments :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            NEURAL n'est pas un système à <em>haut risque</em> au sens de l'annexe III (pas de
            scoring crédit, pas d'évaluation RH, pas de décision administrative automatisée).
          </li>
          <li>
            NEURAL est explicitement identifié comme une IA à chaque interaction (mention
            visible dans l'interface, obligation de transparence article 50).
          </li>
          <li>
            Les sorties (chiffres, citations, recommandations) sont restituées comme assistance
            et doivent être validées par un utilisateur humain avant tout usage en rapport
            officiel ou décision d'entreprise.
          </li>
        </ul>
        <p>
          Cette classification peut évoluer si les fonctionnalités de NEURAL s'étendent (par
          exemple à l'automatisation de la matérialité ou à la priorisation des risques). Toute
          évolution sera tracée dans cette page.
        </p>
      </Section>

      <Section title="Supervision humaine">
        <p>
          NEURAL est conçu pour assister, pas pour décider. Chaque sortie inclut systématiquement :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Citations sources ESRS</strong> permettant à l'utilisateur de vérifier la
            cohérence de la réponse avec le texte réglementaire (corpus EFRAG, ADEME).
          </li>
          <li>
            <strong>Mention d'incertitude</strong> lorsque le copilote ne dispose pas de
            données fiables (par exemple sur des sujets sectoriels ou des données futures).
          </li>
          <li>
            <strong>Validation explicite</strong> par l'utilisateur avant l'intégration dans
            un rapport, un export ou un document soumis à un commissaire aux comptes.
          </li>
        </ul>
      </Section>

      <Section title="Journal d'usage IA">
        <p>
          Toute invocation du copilote NEURAL est tracée dans un journal d'audit auquel
          accèdent les administrateurs du tenant. Ce journal contient :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Identifiant utilisateur (pseudonymisé pour les exports externes)</li>
          <li>Horodatage de l'invocation</li>
          <li>Type de prompt (catégorie : explication ESRS, interprétation données, etc.)</li>
          <li>Datapoint ou rapport concerné, le cas échéant</li>
          <li>Indicateur de validation utilisateur (acceptée / rejetée / modifiée)</li>
        </ul>
        <p>
          Ce journal est exportable au format JSON pour permettre une revue indépendante par
          un OTI (Organisme Tiers Indépendant) ou un audit interne.
        </p>
      </Section>

      <Section title="Devoirs du déployeur (article 26)">
        <p>
          L'entreprise cliente qui déploie CarbonCo dans son organisation est considérée comme{" "}
          <strong>« déployeur »</strong> au sens de l'article 26 de l'AI Act. À ce titre, elle
          doit notamment :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Informer ses utilisateurs internes (collaborateurs, sous-traitants ESG) que les
            sorties marquées « NEURAL » sont générées par un système d'IA.
          </li>
          <li>
            S'assurer que les données ESG saisies dans CarbonCo sont conformes à sa politique
            interne de gouvernance de la donnée.
          </li>
          <li>
            Conserver les journaux d'usage pertinents en cas de contrôle d'une autorité de
            marché ou d'un commissaire aux comptes.
          </li>
        </ul>
        <p>
          CarbonCo met à disposition les outils de journalisation et d'export nécessaires pour
          faciliter ces obligations.
        </p>
      </Section>

      <Section title="Modèles fondateurs et fournisseur en amont">
        <p>
          NEURAL repose sur les modèles Claude d'Anthropic (PBC, États-Unis), accédés via{" "}
          <strong>Vercel AI Gateway</strong> en zone Union européenne. Anthropic est considéré
          comme <em>fournisseur</em> du modèle fondateur ; CarbonCo est <em>fournisseur</em> du
          système d'IA spécifique (copilote NEURAL) intégrant ce modèle dans un contexte ESG /
          CSRD. Les obligations de transparence (article 50) et de documentation technique
          (annexe IV) sont assumées par CarbonCo pour la couche applicative.
        </p>
      </Section>

      <Section title="Limites et incidents">
        <p>
          Toute hallucination, erreur de citation ou sortie inappropriée détectée par un
          utilisateur peut être signalée à <strong>ai-act@carbonco.fr</strong>. Les signalements
          sont traités sous 72 heures et peuvent déclencher une mise à jour du système de
          prompts, du corpus RAG ou de la documentation utilisateur.
        </p>
        <p>
          Cette page sera actualisée à chaque évolution significative du périmètre IA de
          CarbonCo. Pour le détail de la stack technique sous-jacente, voir le{" "}
          <Link href="/trust" className="underline">Trust Center</Link> et la liste des{" "}
          <Link href="/trust/sub-processors" className="underline">sous-traitants</Link>.
        </p>
      </Section>
    </LegalLayout>
  );
}
