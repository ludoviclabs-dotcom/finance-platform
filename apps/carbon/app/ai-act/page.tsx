import { CONTACT_EMAIL } from "@/lib/site-url";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "NEURAL et l'AI Act — CarbonCo",
  description:
    "Position de CarbonCo vis-à-vis du règlement (UE) 2024/1689 sur l'intelligence artificielle, modifié par le règlement (UE) 2026/1744 : classification du copilote NEURAL, transparence (article 50), supervision humaine.",
  alternates: { canonical: "/ai-act" },
};

/**
 * Calendrier d'application du règlement (UE) 2024/1689, tel que modifié par le
 * règlement (UE) 2026/1744 (« Omnibus numérique »). Source : dossier de maîtrise
 * CSRD, état du droit au 2 novembre 2026.
 */
const CALENDAR = [
  { date: "2 février 2025", what: "Pratiques interdites ; maîtrise de l'IA (article 4)", us: "Concerné : formation de nos utilisateurs" },
  { date: "2 août 2025", what: "Modèles d'IA à usage général", us: "Obligations portées par Anthropic, fournisseur du modèle" },
  { date: "2 août 2026", what: "Application générale, dont la transparence (article 50)", us: "Concerné" },
  { date: "2 décembre 2026", what: "Article 50(2) pour les systèmes déjà sur le marché avant le 2 août 2026", us: "Concerné : marquage des contenus générés" },
  { date: "2 décembre 2027", what: "Systèmes à haut risque de l'annexe III (reporté par 2026/1744)", us: "Non concerné" },
  { date: "2 août 2028", what: "Systèmes à haut risque de l'annexe I (produits réglementés)", us: "Non concerné" },
] as const;

export default function AiActPage() {
  return (
    <LegalLayout title="NEURAL et l'AI Act" lastUpdated="2 novembre 2026">
      <Section title="Périmètre">
        <p>
          Cette page décrit la position de CarbonCo vis-à-vis du{" "}
          <a
            href="https://eur-lex.europa.eu/eli/reg/2024/1689/oj"
            target="_blank"
            rel="noopener noreferrer"
          >
            règlement (UE) 2024/1689 sur l'intelligence artificielle
          </a>{" "}
          (« AI Act »), entré en vigueur le 1<sup>er</sup> août 2024 et modifié par le{" "}
          <a
            href="https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng"
            target="_blank"
            rel="noopener noreferrer"
          >
            règlement (UE) 2026/1744
          </a>{" "}
          (« Omnibus numérique »), qui a notamment reporté les obligations des systèmes à haut
          risque.
        </p>
        <p>
          CarbonCo intègre un copilote IA nommé <strong>NEURAL</strong>, fondé sur les modèles
          de langage d'Anthropic (Claude). NEURAL répond à des questions sur les obligations
          ESRS / CSRD, cite les textes sources et aide à interpréter des données métier. Il ne
          prend pas de décision automatisée à la place de l'utilisateur et n'attribue pas de
          score d'éligibilité, de crédit, de risque ou de sanction.
        </p>
      </Section>

      <Section title="Calendrier qui nous concerne">
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase tracking-wider text-[var(--color-foreground-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Ce qui s'applique</th>
                <th className="px-4 py-3 font-semibold">Pour NEURAL</th>
              </tr>
            </thead>
            <tbody>
              {CALENDAR.map((row) => (
                <tr key={row.date} className="border-t border-[var(--color-border)] align-top">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[var(--color-foreground-muted)]">{row.date}</td>
                  <td className="px-4 py-3 text-[var(--color-foreground)]">{row.what}</td>
                  <td
                    className={`px-4 py-3 text-xs font-semibold ${
                      row.us.startsWith("Non") ? "text-[var(--color-foreground-subtle)]" : "text-[var(--color-success)]"
                    }`}
                  >
                    {row.us}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Classification retenue">
        <p>
          Sur la base de notre analyse interne, NEURAL est un système d'IA soumis aux{" "}
          <strong>obligations de transparence de l'article 50</strong>, et non un système à haut
          risque :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            L'aide à la rédaction et à l'interprétation d'un rapport de durabilité ne relève
            d'aucun des domaines de l'annexe III (pas de scoring de crédit, pas d'évaluation RH,
            pas de décision administrative automatisée).
          </li>
          <li>
            NEURAL ne calcule aucun chiffre publié : il rédige à partir de chiffres calculés et
            tracés par le moteur de CarbonCo, qu'il cite. Ses sorties (textes, citations,
            recommandations) restent des propositions, validées par un humain avant tout usage
            dans un rapport ou une décision.
          </li>
          <li>
            NEURAL ne cote pas et ne décide pas la matérialité : il peut proposer une liste
            d'impacts, risques et opportunités ; les échelles, les seuils et les décisions
            restent humains et tracés.
          </li>
        </ul>
        <p>
          Si nous automatisions un jour la cotation de matérialité ou la priorisation des
          risques, nous referions cette analyse. Toute évolution sera tracée sur cette page.
        </p>
      </Section>

      <Section title="Ce que nous appliquons">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Article 4 — maîtrise de l'IA.</strong> Depuis le règlement 2026/1744, il
            s'agit de « prendre des mesures pour favoriser » cette maîtrise : nous documentons
            les limites du copilote (hallucinations possibles, absence de calcul) pour nos
            utilisateurs et nos pilotes.
          </li>
          <li>
            <strong>Article 50(1) — information de l'utilisateur.</strong> Le copilote est
            présenté comme une IA dans l'interface, avec le modèle utilisé. Une mention sous
            chaque réponse générée est en cours de généralisation à toutes les surfaces.
          </li>
          <li>
            <strong>Article 50(2) — marquage lisible par machine.</strong> En cours de
            déploiement avant le 2 décembre 2026 : chaque texte généré portera, dans nos données
            et nos exports, une marque d'origine IA (modèle, date, statut de validation humaine).
          </li>
        </ul>
        <p>
          Côté client, l'article 50(4) (textes publiés pour informer le public) joue a priori
          peu : le rapport de durabilité est relu et arrêté par la direction, qui en porte la
          responsabilité éditoriale.
        </p>
      </Section>

      <Section title="Supervision humaine">
        <p>NEURAL est conçu pour assister, pas pour décider :</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Citations sources</strong> (corpus EFRAG, ADEME) permettant de vérifier la
            cohérence d'une réponse avec le texte réglementaire.
          </li>
          <li>
            <strong>Mention d'incertitude</strong> lorsque le copilote ne dispose pas de
            données fiables.
          </li>
          <li>
            <strong>Validation explicite</strong> par l'utilisateur avant l'intégration d'une
            proposition dans un datapoint, un rapport ou un export.
          </li>
        </ul>
      </Section>

      <Section title="Journal d'usage IA">
        <p>
          <strong>En cours de déploiement (décembre 2026).</strong> Les propositions de
          datapoints extraites par l'IA conservent déjà leur passage source et leur validation.
          Nous étendons la journalisation à toutes les sorties du copilote : modèle, version de
          prompt, empreinte de l'entrée et de la sortie, horodatage, décision humaine (acceptée,
          modifiée, rejetée), dans un journal en ajout seul consultable par les administrateurs
          du tenant et exportable pour le vérificateur.
        </p>
      </Section>

      <Section title="Modèles fondateurs et fournisseur en amont">
        <p>
          NEURAL repose sur les modèles Claude d'Anthropic (PBC, États-Unis), accédés via{" "}
          <strong>Vercel AI Gateway</strong> ; les modèles sont hébergés aux États-Unis.
          Anthropic est le <em>fournisseur</em> du modèle d'IA à usage général et porte les
          obligations attachées depuis le 2 août 2025 ; CarbonCo est le <em>fournisseur</em> du
          système d'IA spécifique (le copilote NEURAL) et assume les obligations de
          transparence de l'article 50 pour sa couche applicative.
        </p>
        <p>
          Notre documentation technique s'inspire volontairement de la structure de l'annexe IV
          du règlement, qui ne s'impose qu'aux systèmes à haut risque.
        </p>
      </Section>

      <Section title="Questions fréquentes">
        <p>
          <strong>Votre copilote est-il un système à haut risque ?</strong> Non : l'aide à la
          rédaction d'un rapport ESG ne relève d'aucun domaine de l'annexe III. Nous appliquons
          les obligations de transparence de l'article 50, et chaque sortie est validée par un
          humain avant usage.
        </p>
        <p>
          <strong>Un texte rédigé par l'IA dans notre rapport pose-t-il problème à notre
          auditeur ?</strong> Pas si chaque phrase renvoie à des chiffres tracés et si un humain
          l'a validée. Ce qui poserait problème, c'est un chiffre produit par l'IA : chez
          CarbonCo, l'IA ne calcule jamais, elle rédige à partir de calculs vérifiables.
        </p>
      </Section>

      <Section title="Limites et incidents">
        <p>
          Toute hallucination, erreur de citation ou sortie inappropriée détectée par un
          utilisateur peut être signalée à <strong>{CONTACT_EMAIL}</strong>. Les signalements
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
