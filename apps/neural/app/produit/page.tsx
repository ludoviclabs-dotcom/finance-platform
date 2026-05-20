import type { Metadata } from "next";
import { Boxes } from "lucide-react";

import { HubCard } from "@/components/hubs/hub-card";
import { HubHeader } from "@/components/hubs/hub-header";
import { HubSection } from "@/components/hubs/hub-section";

export const metadata: Metadata = {
  title: "Produit | NEURAL",
  description:
    "Démo live, Operator Gateway, Connecteurs, Simulation Studio et Branches métier. Le point d'entrée Produit du framework NEURAL.",
};

const FLAGSHIP = [
  {
    href: "/secteurs/luxe/finance",
    title: "Démo live · Luxe Finance",
    description:
      "Le noyau prouvé en production : consolidation Groupe, exports XLSX/ZIP, KPI runtime. La preuve produit la plus complète exposée publiquement.",
    status: "live" as const,
    meta: "Flagship",
  },
  {
    href: "/secteurs/luxe/communication",
    title: "Démo live · Luxe Communication",
    description:
      "MaisonVoiceGuard et GreenClaimChecker avec exports JSON, voice scorer en direct et supervision humaine documentée.",
    status: "live" as const,
    meta: "Flagship",
  },
];

const BUILDING_BLOCKS = [
  {
    href: "/agents",
    title: "Catalogue agents",
    description:
      "Toutes les fiches agents publiques, par maturité et secteur. Chaque agent a sa mission, ses KPI, son statut et sa supervision humaine.",
    status: "live" as const,
  },
  {
    href: "/operator-gateway",
    title: "Operator Gateway",
    description:
      "La couche d'orchestration : gouvernance, gates serveur, exports signés, audit trail. Démo régulée avec scénarios figés.",
    status: "demo" as const,
  },
  {
    href: "/connecteurs",
    title: "Connecteurs",
    description:
      "Intégrations vers ERP, CRM, data warehouse. Pilotage avec droits, traces et validation humaine — pas d'exécution silencieuse.",
    status: "live" as const,
  },
  {
    href: "/simulation",
    title: "Simulation Studio",
    description:
      "Bac à sable de simulation pour cadrer un cas d'usage avant déploiement. Output : un parcours agent estimé.",
    status: "demo" as const,
  },
  {
    href: "/solutions",
    title: "Branches métier",
    description:
      "Les 7 branches du framework : Finance, Communication, Comptabilité, Supply Chain, RH, Marketing, SI. Distinction explicite entre branches matures et branches en préparation.",
    status: "live" as const,
  },
];

export default function ProduitHubPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-neural-violet/10 blur-[140px]" aria-hidden />
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/7 blur-[120px]" aria-hidden />

      <HubHeader
        eyebrow="Produit"
        icon={<Boxes className="h-3.5 w-3.5" />}
        title="Voir ce que NEURAL fait, concrètement."
        description="Le produit n'est pas un slide deck : il existe en démo publique avec exports signés et supervision humaine. Cette page agrège les surfaces directement testables et la couche d'orchestration qui les gouverne."
      />

      <HubSection
        title="Noyau prouvé"
        description="Les deux démos les plus complètes, exposées publiquement avec données réelles."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {FLAGSHIP.map((card) => (
            <HubCard key={card.href} {...card} />
          ))}
        </div>
      </HubSection>

      <HubSection
        title="Surfaces et orchestration"
        description="Catalogue d'agents, gateway gouverné, connecteurs métier, sandbox et branches transverses."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BUILDING_BLOCKS.map((card) => (
            <HubCard key={card.href} {...card} />
          ))}
        </div>
      </HubSection>

      <div className="h-24" />
    </div>
  );
}
