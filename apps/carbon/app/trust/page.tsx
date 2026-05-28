import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Trust Center — CarbonCo",
  description:
    "Sécurité, données et conformité de la plateforme CarbonCo : matrice data residency, mesures techniques, limites connues, contacts sécurité et privacy.",
  alternates: { canonical: "https://carbonco.fr/trust" },
};

type ResidencyRow = {
  layer: string;
  provider: string;
  region: string;
  notes: string;
};

const RESIDENCY: ResidencyRow[] = [
  {
    layer: "Application Next.js",
    provider: "Vercel",
    region: "Fonctions par défaut US · CDN edge mondial · AI Gateway zone UE",
    notes:
      "Les fonctions serverless qui n'effectuent que du rendu HTML ou des appels base de données ne traitent pas de données personnelles persistantes. Configuration région UE explicite en cours d'évaluation.",
  },
  {
    layer: "Base de données métier",
    provider: "Neon Postgres",
    region: "eu-central-1 (Frankfurt, Union européenne)",
    notes:
      "Toutes les données ESG, utilisateurs et audit trail. Aucune réplication hors UE. Sauvegardes chiffrées AES-256, point-in-time recovery 7 jours.",
  },
  {
    layer: "Cache & vector store",
    provider: "Upstash Redis & Vector",
    region: "eu-central-1 (Frankfurt, Union européenne)",
    notes:
      "Rate-limiting, sessions et corpus RAG ESRS du copilote. Le corpus vectoriel ne contient que des extraits publics (EFRAG, ADEME).",
  },
  {
    layer: "Stockage objet",
    provider: "Vercel Blob",
    region: "Région UE",
    notes:
      "PDF rapports, Evidence Packs ZIP, fichiers Excel uploadés. Accès uniquement via signed URL temporaire associée au tenant.",
  },
  {
    layer: "Copilote IA",
    provider: "Anthropic Claude via Vercel AI Gateway",
    region: "AI Gateway zone UE · modèles hébergés US (Anthropic)",
    notes:
      "Prompts pseudonymisés côté CarbonCo (pas de PII, pas de noms d'entreprises). Politique zero-retention Anthropic enterprise : prompts non utilisés pour l'entraînement.",
  },
  {
    layer: "Facturation",
    provider: "Stripe (si activé)",
    region: "Stripe Payments Europe Dublin · siège US",
    notes:
      "Aucune donnée métier ESG. Uniquement email, raison sociale, mode de paiement. Désactivable pour les contrats Enterprise hors Stripe.",
  },
];

export default function TrustCenterPage() {
  return (
    <LegalLayout title="Trust Center" lastUpdated="28 mai 2026">
      <Section title="Vue d'ensemble">
        <p>
          Cette page centralise tout ce qu'un acheteur, un DAF, un RSI ou un commissaire aux
          comptes a besoin de savoir avant de déployer CarbonCo dans une entreprise régulée :
          où sont stockées les données, quelles mesures techniques protègent la plateforme,
          quels sont les sous-traitants et leurs régions, comment récupérer ses données en cas
          de sortie, et quelles sont les limites connues de notre niveau de certification.
        </p>
        <p>
          Pour des questions spécifiques (audit de sécurité, signature d'un DPA, demande de
          questionnaire éditeur), écrire à <strong>security@carbonco.fr</strong>.
        </p>
      </Section>

      <Section title="Matrice data residency">
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-xs border border-[var(--color-border)] rounded-lg overflow-hidden">
            <thead className="bg-[var(--color-surface)]">
              <tr>
                <th className="text-left p-3 font-semibold border-b border-[var(--color-border)]">
                  Couche
                </th>
                <th className="text-left p-3 font-semibold border-b border-[var(--color-border)]">
                  Fournisseur
                </th>
                <th className="text-left p-3 font-semibold border-b border-[var(--color-border)]">
                  Région
                </th>
              </tr>
            </thead>
            <tbody>
              {RESIDENCY.map((row) => (
                <tr key={row.layer} className="border-b border-[var(--color-border)] last:border-b-0 align-top">
                  <td className="p-3 font-semibold text-[var(--color-foreground)]">{row.layer}</td>
                  <td className="p-3 text-[var(--color-foreground-muted)]">{row.provider}</td>
                  <td className="p-3 text-[var(--color-foreground-muted)]">
                    {row.region}
                    <p className="text-[10px] italic mt-1 text-[var(--color-foreground-muted)]">{row.notes}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          La promesse <em>« données métier en zone UE »</em> renvoie spécifiquement aux couches{" "}
          <strong>base de données</strong>, <strong>cache</strong> et <strong>stockage objet</strong>{" "}
          — les données extra-financières des clients y sont stockées exclusivement en zone UE.
          La couche application (Vercel) bénéficie d'un CDN mondial pour la performance et de
          CCT pour les transferts techniques opérationnels. Voir aussi la{" "}
          <Link href="/confidentialite" className="underline">politique de confidentialité</Link>{" "}
          et la liste des{" "}
          <Link href="/trust/sub-processors" className="underline">sous-traitants</Link>.
        </p>
      </Section>

      <Section title="Mesures techniques">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Chiffrement en transit</strong> — TLS 1.3 sur toutes les communications,
            HSTS avec preload, redirection HTTPS forcée (voir headers servis par la plateforme).
          </li>
          <li>
            <strong>Chiffrement au repos</strong> — AES-256 sur la base de données Neon, le
            stockage Vercel Blob et les sauvegardes.
          </li>
          <li>
            <strong>Authentification</strong> — Email/mot de passe avec mots de passe hachés
            bcrypt. Tokens JWT signés HS256 avec rotation de refresh tokens via cookie httpOnly.
            La double authentification (TOTP) est sur la{" "}
            <Link href="/etat-du-produit" className="underline">roadmap produit</Link>.
          </li>
          <li>
            <strong>Isolation multi-tenant</strong> — Chaque organisation cliente dispose d'un
            identifiant tenant propagé dans toutes les requêtes ; toutes les écritures et
            lectures sont filtrées au niveau base de données par cet identifiant.
          </li>
          <li>
            <strong>Journal d'audit append-only</strong> — Chaque écriture porte un hash
            SHA-256 chaîné. La rupture de la chaîne est détectable côté commissaire aux comptes
            ou OTI. Conservation 12 mois glissants.
          </li>
          <li>
            <strong>Headers de sécurité</strong> — CSP stricte, X-Frame-Options DENY, COOP /
            CORP same-origin, Referrer-Policy strict-origin, Permissions-Policy minimale. CSP
            violations remontées sur un endpoint dédié.
          </li>
          <li>
            <strong>Rate-limiting</strong> — Limites configurées sur les endpoints sensibles
            (auth, copilote IA, API) via Upstash Ratelimit.
          </li>
          <li>
            <strong>Gestion secrets</strong> — Variables d'environnement chiffrées côté Vercel,
            rotation manuelle documentée, aucun secret dans le code source.
          </li>
        </ul>
      </Section>

      <Section title="Limites connues">
        <p>
          Par souci de transparence, voici ce qui n'est <strong>pas</strong> en place
          aujourd'hui :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Pas de certification <strong>SOC 2 Type II</strong> ni <strong>ISO 27001</strong> à
            ce stade — déclenchables sur engagement client grand compte (budget estimé
            20–40 k€).
          </li>
          <li>
            Pas de certification <strong>SecNumCloud</strong> ni d'hébergement souverain
            OVH / Scaleway — la migration est sur la roadmap produit, déclenchée par contrainte
            client public ou OIV.
          </li>
          <li>
            Pas encore de <strong>signature électronique qualifiée eIDAS</strong> sur les
            exports — partenariat envisagé (Yousign / Universign) sur demande.
          </li>
          <li>
            Pas de <strong>double authentification (TOTP)</strong> en production — sur la
            roadmap.
          </li>
          <li>
            Pas de programme <strong>bug bounty</strong> public. Les rapports de sécurité
            responsables (responsible disclosure) sont accueillis à{" "}
            <strong>security@carbonco.fr</strong>.
          </li>
        </ul>
        <p>
          Pour le détail des fonctionnalités produit Live / Beta / Planifié, voir{" "}
          <Link href="/etat-du-produit" className="underline">/etat-du-produit</Link> (mis à
          jour à chaque sprint).
        </p>
      </Section>

      <Section title="Disponibilité et incidents">
        <p>
          La plateforme s'appuie sur la disponibilité de Vercel et Neon — chacun cible un
          SLA &gt; 99,9 % avec redondance régionale. CarbonCo ne publie pas encore de status
          page publique ; les incidents majeurs sont notifiés par email aux contacts admin des
          tenants concernés sous 4 heures, avec post-mortem à J+5 ouvrés.
        </p>
        <p>
          Une status page publique est prévue lorsque le nombre de tenants en production justifie
          l'investissement (typiquement &gt; 20 clients payants).
        </p>
      </Section>

      <Section title="Pour aller plus loin">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <Link href="/trust/sub-processors" className="underline">
              Liste des sous-traitants ultérieurs
            </Link>
          </li>
          <li>
            <Link href="/trust/exit-strategy" className="underline">
              Stratégie de sortie et formats d'export
            </Link>
          </li>
          <li>
            <Link href="/ai-act" className="underline">
              Conformité AI Act (copilote NEURAL)
            </Link>
          </li>
          <li>
            <Link href="/confidentialite" className="underline">
              Politique de confidentialité complète
            </Link>
          </li>
          <li>
            <Link href="/etat-du-produit" className="underline">
              État réel du produit (Live / Beta / Planifié)
            </Link>
          </li>
        </ul>
      </Section>

      <Section title="Contacts">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Sécurité &amp; vulnérabilités</strong> — security@carbonco.fr
          </li>
          <li>
            <strong>Privacy &amp; RGPD</strong> — privacy@carbonco.fr
          </li>
          <li>
            <strong>AI Act &amp; copilote</strong> — ai-act@carbonco.fr
          </li>
          <li>
            <strong>Contact général</strong> — contact@carbonco.fr
          </li>
        </ul>
      </Section>
    </LegalLayout>
  );
}
