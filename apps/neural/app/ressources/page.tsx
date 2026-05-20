import type { Metadata } from "next";
import { Library } from "lucide-react";

import { HubCard } from "@/components/hubs/hub-card";
import { HubHeader } from "@/components/hubs/hub-header";
import { HubSection } from "@/components/hubs/hub-section";

export const metadata: Metadata = {
  title: "Ressources | NEURAL",
  description:
    "Documentation, publications, glossaire IA, outils gratuits, cas-types, recipes et sandbox. Le hub Ressources NEURAL.",
};

const UNDERSTAND = [
  {
    href: "/docs",
    title: "Documentation",
    description:
      "Architecture, conventions, sourcebooks et model cards. Le manuel de référence pour comprendre comment NEURAL est construit.",
    status: "live" as const,
  },
  {
    href: "/glossaire",
    title: "Glossaire IA",
    description:
      "26 termes IA définis en français avec contexte NEURAL : AI Act, RGPD, DORA, MCP, agents, audit trail, FRIA, RAG, etc.",
    status: "live" as const,
  },
];

const VERIFY = [
  {
    href: "/publications",
    title: "Publications",
    description:
      "Benchmarks, guides, retours terrain et perspectives sur l'IA en entreprise. Hub éditorial déjà en ligne.",
    status: "live" as const,
  },
  {
    href: "/dossier",
    title: "Dossier de preuve",
    description:
      "Dossier acheteur condensé : agents prouvables, métriques, claims actifs et limites visibles. À télécharger ou parcourir en ligne.",
    status: "live" as const,
  },
];

const TEST = [
  {
    href: "/outils",
    title: "Outils gratuits",
    description:
      "AI Act Classifier, ROI Calculator, Audit Maturité IA, Operator Score, Empreinte IA, DPIA Generator. Outils self-service pour cadrer un projet.",
    status: "live" as const,
  },
  {
    href: "/sandbox",
    title: "Sandbox",
    description:
      "Démos publiques exécutables sans engagement. Le bac à sable de NEURAL pour comprendre ce que font les agents.",
    status: "live" as const,
  },
];

const APPLY = [
  {
    href: "/cas-types",
    title: "Cas-types sectoriels",
    description:
      "Cas d'usage typiques par industrie : Luxe, Banque, Assurance, Transport, Aéronautique, SaaS. Avec retours d'expérience et limites.",
    status: "live" as const,
  },
  {
    href: "/recipes",
    title: "Recipes",
    description:
      "8 recettes documentées : enchaînement d'agents, connecteurs requis, outcomes typiques. Point de départ accéléré pour cas d'usage complexes.",
    status: "live" as const,
  },
];

export default function RessourcesHubPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" aria-hidden />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" aria-hidden />

      <HubHeader
        eyebrow="Ressources"
        icon={<Library className="h-3.5 w-3.5" />}
        title="Comprendre, vérifier, tester, appliquer."
        description="Le hub Ressources regroupe la documentation, les publications, les outils gratuits et les cas d'usage. Aucune ressource n'est cachée derrière un formulaire."
      />

      <HubSection title="Comprendre" description="Documentation technique et vocabulaire IA.">
        <div className="grid gap-4 md:grid-cols-2">
          {UNDERSTAND.map((card) => (
            <HubCard key={card.href} {...card} />
          ))}
        </div>
      </HubSection>

      <HubSection
        title="Vérifier"
        description="Publications éditoriales et dossier acheteur condensé."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {VERIFY.map((card) => (
            <HubCard key={card.href} {...card} />
          ))}
        </div>
      </HubSection>

      <HubSection
        title="Tester"
        description="Outils gratuits et sandbox publique pour explorer sans engagement."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {TEST.map((card) => (
            <HubCard key={card.href} {...card} />
          ))}
        </div>
      </HubSection>

      <HubSection
        title="Appliquer"
        description="Cas-types par secteur et recipes d'enchaînement d'agents."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {APPLY.map((card) => (
            <HubCard key={card.href} {...card} />
          ))}
        </div>
      </HubSection>

      <div className="h-24" />
    </div>
  );
}
