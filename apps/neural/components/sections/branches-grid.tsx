import Link from "next/link";
import {
  Monitor,
  Users,
  Megaphone,
  MessageSquare,
  Calculator,
  TrendingUp,
  Truck,
} from "lucide-react";

const branches = [
  { id: "si",            label: "Systèmes d'Information", icon: Monitor,       agents: 24 },
  { id: "rh",            label: "Ressources Humaines",    icon: Users,         agents: 24 },
  { id: "marketing",     label: "Marketing",              icon: Megaphone,     agents: 24 },
  { id: "communication", label: "Communication",          icon: MessageSquare, agents: 24 },
  { id: "comptabilite",  label: "Comptabilité",           icon: Calculator,    agents: 24 },
  { id: "finance",       label: "Finance",                icon: TrendingUp,    agents: 24 },
  { id: "supply-chain",  label: "Supply Chain",           icon: Truck,         agents: 24 },
];

export function BranchesGrid() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">
            7 branches métier couvertes
          </h2>
          <p className="mt-4 text-lg text-foreground-muted">
            Des agents spécialisés pour chaque fonction de votre entreprise
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/solutions/${branch.id}`}
              className="card group p-6 transition-all hover:border-neural-violet/30 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neural-violet/10">
                <branch.icon className="h-5 w-5 text-neural-violet" />
              </div>
              <h3 className="mt-3 font-display text-sm font-semibold">
                {branch.label}
              </h3>
              <p className="mt-1 text-xs text-foreground-subtle">
                {branch.agents} agents
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
