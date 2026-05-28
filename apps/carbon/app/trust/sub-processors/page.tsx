import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Sous-traitants — CarbonCo",
  description:
    "Liste des sous-traitants ultérieurs utilisés par CarbonCo pour fournir la plateforme : rôle, région de stockage, transferts hors UE, fondement RGPD.",
  alternates: { canonical: "https://carbonco.fr/trust/sub-processors" },
};

type SubProcessor = {
  name: string;
  role: string;
  region: string;
  transferOutsideEU: "Non" | "Oui — CCT" | "Conditionnel";
  legalBasis: string;
  notes?: string;
};

const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Vercel Inc.",
    role: "Hébergement application Next.js, CDN mondial, fonctions serverless, AI Gateway",
    region: "Siège US (Californie) · CDN edge mondial · AI Gateway zone UE",
    transferOutsideEU: "Oui — CCT",
    legalBasis: "Clauses Contractuelles Types (CCT) de la Commission européenne",
    notes:
      "Les données métier (rapports, datapoints) transitent par le CDN mais sont stockées sur Neon EU. Les fonctions sont exécutées par défaut en région US sauf configuration Edge EU explicite.",
  },
  {
    name: "Neon (Databricks)",
    role: "Base de données Postgres principale — données métier (rapports ESG, datapoints, utilisateurs)",
    region: "Frankfurt (eu-central-1), Union européenne",
    transferOutsideEU: "Non",
    legalBasis: "RGPD article 28 (DPA Neon, hébergement EU)",
    notes:
      "Aucune réplication hors UE. Sauvegardes chiffrées AES-256 conservées en zone EU.",
  },
  {
    name: "Upstash, Inc.",
    role: "Cache Redis (rate-limiting, sessions) et base vectorielle Upstash Vector (corpus RAG ESRS du copilote NEURAL)",
    region: "Frankfurt (eu-central-1), Union européenne",
    transferOutsideEU: "Non",
    legalBasis: "RGPD article 28 (DPA Upstash, région EU configurée)",
    notes:
      "Le corpus vectoriel ne contient que des extraits de référentiels publics (ESRS, EFRAG, ADEME). Aucune donnée métier client n'y est indexée.",
  },
  {
    name: "Vercel Blob",
    role: "Stockage objet pour les fichiers utilisateurs (exports PDF, evidence packs ZIP, fichiers Excel uploadés)",
    region: "Région UE (Vercel Blob EU)",
    transferOutsideEU: "Non",
    legalBasis: "Clauses Contractuelles Types Vercel + DPA",
    notes:
      "Chaque blob est associé à un tenant et accessible uniquement via signed URL temporaire émise depuis l'application.",
  },
  {
    name: "Anthropic PBC",
    role: "Modèles de langage Claude utilisés par le copilote NEURAL (prompts, complétions)",
    region: "Accès via Vercel AI Gateway en zone UE — modèles hébergés US",
    transferOutsideEU: "Conditionnel",
    legalBasis:
      "CCT via Vercel AI Gateway · politique zero-retention Anthropic pour clients enterprise (les prompts ne sont pas utilisés pour l'entraînement)",
    notes:
      "Les prompts envoyés à Anthropic sont pseudonymisés côté CarbonCo : pas de noms d'entreprises clients, pas d'identifiants utilisateurs, pas de PII. Les datapoints ESG anonymisés peuvent transiter pour l'interprétation.",
  },
  {
    name: "Inngest",
    role: "Orchestration de jobs asynchrones (extraction batch de datapoints, ingestion documents RAG)",
    region: "À confirmer avec le client lors du contrat — région UE disponible",
    transferOutsideEU: "Conditionnel",
    legalBasis: "RGPD article 28 (DPA Inngest)",
    notes:
      "Inngest porte uniquement des références d'événements (job IDs, status). Les charges utiles métier restent dans Neon et Vercel Blob.",
  },
  {
    name: "Stripe, Inc.",
    role: "Facturation et abonnements (Checkout, portail client, webhooks). Activé uniquement pour les clients qui souscrivent en self-service.",
    region: "Stripe Payments Europe (Dublin) pour les paiements UE · siège US",
    transferOutsideEU: "Oui — CCT",
    legalBasis: "Clauses Contractuelles Types Stripe + DPA",
    notes:
      "Aucune donnée métier ESG n'est transmise à Stripe. Seuls les identifiants de facturation (email, raison sociale, mode de paiement) circulent. Pour les clients Enterprise contractualisés hors Stripe, ce sous-traitant n'est pas activé.",
  },
];

const TRANSFER_BADGE: Record<SubProcessor["transferOutsideEU"], string> = {
  Non: "bg-emerald-50 border-emerald-200 text-emerald-700",
  "Oui — CCT": "bg-amber-50 border-amber-200 text-amber-700",
  Conditionnel: "bg-amber-50 border-amber-200 text-amber-700",
};

export default function SubProcessorsPage() {
  return (
    <LegalLayout title="Sous-traitants ultérieurs" lastUpdated="28 mai 2026">
      <Section title="Périmètre">
        <p>
          Cette page liste l'ensemble des sous-traitants ultérieurs au sens de l'article 28
          du RGPD utilisés par CarbonCo pour fournir la plateforme. Elle est mise à jour à
          chaque ajout, retrait ou changement de région d'un sous-traitant. Toute modification
          est notifiée aux clients sous 30 jours avant prise d'effet.
        </p>
        <p>
          Pour le détail des clauses contractuelles ou un DPA signé bilatéralement, écrire à{" "}
          <strong>privacy@carbonco.fr</strong>.
        </p>
      </Section>

      <Section title="Liste des sous-traitants">
        <div className="space-y-4 not-prose">
          {SUB_PROCESSORS.map((sp) => (
            <div
              key={sp.name}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-[var(--color-foreground)]">{sp.name}</h3>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TRANSFER_BADGE[sp.transferOutsideEU]}`}
                >
                  Hors UE : {sp.transferOutsideEU}
                </span>
              </div>
              <dl className="text-xs space-y-1.5">
                <div>
                  <dt className="inline font-semibold text-[var(--color-foreground)]">Rôle : </dt>
                  <dd className="inline text-[var(--color-foreground-muted)]">{sp.role}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-[var(--color-foreground)]">Région : </dt>
                  <dd className="inline text-[var(--color-foreground-muted)]">{sp.region}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-[var(--color-foreground)]">Fondement RGPD : </dt>
                  <dd className="inline text-[var(--color-foreground-muted)]">{sp.legalBasis}</dd>
                </div>
                {sp.notes && (
                  <p className="text-[var(--color-foreground-muted)] mt-2 italic">{sp.notes}</p>
                )}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Notification des changements">
        <p>
          Toute modification de cette liste (ajout, retrait, changement de région d'un
          sous-traitant) est :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Datée sur cette page (champ « Dernière mise à jour »)</li>
          <li>
            Notifiée par email aux contacts privacy déclarés par les tenants clients sous 30
            jours avant prise d'effet
          </li>
          <li>
            Soumise à droit d'opposition motivé du client (cas spécifique de régulation
            sectorielle, par exemple secteur public)
          </li>
        </ul>
      </Section>

      <Section title="Liens utiles">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <Link href="/trust" className="underline">
              Trust Center — vue d'ensemble
            </Link>
          </li>
          <li>
            <Link href="/trust/exit-strategy" className="underline">
              Stratégie de sortie et formats d'export
            </Link>
          </li>
          <li>
            <Link href="/confidentialite" className="underline">
              Politique de confidentialité complète
            </Link>
          </li>
          <li>
            <Link href="/ai-act" className="underline">
              Conformité AI Act
            </Link>
          </li>
        </ul>
      </Section>
    </LegalLayout>
  );
}
