import { AlertTriangle, CheckCircle2 } from "lucide-react";

const problems = [
  "POC qui ne passent jamais en production",
  "Adoption faible : les équipes n'utilisent pas l'outil",
  "ROI impossible à mesurer",
  "Coûts qui explosent sans valeur tangible",
];

const solutions = [
  "Agents intégrés dans vos processus existants",
  "Formation et accompagnement au changement",
  "KPIs définis avant le déploiement",
  "Forfaits prévisibles, ROI mesuré mensuellement",
];

export function ProblemSolution() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-4xl font-bold">
          Pourquoi <span className="text-danger">80%</span> des projets IA
          échouent ?
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {/* Problem */}
          <div className="card border-danger/20 p-8">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold text-danger">
              <AlertTriangle className="h-6 w-6" />
              Le constat
            </h3>
            <ul className="mt-6 space-y-4">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-3 text-foreground-muted">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="card border-success/20 p-8">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold text-success">
              <CheckCircle2 className="h-6 w-6" />
              L&apos;approche NEURAL
            </h3>
            <ul className="mt-6 space-y-4">
              {solutions.map((s) => (
                <li key={s} className="flex items-start gap-3 text-foreground-muted">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
