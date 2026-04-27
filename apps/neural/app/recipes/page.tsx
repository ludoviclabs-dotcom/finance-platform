import { ChefHat } from "lucide-react";

import recipesData from "@/content/recipes/catalog.json";
import { RecipesBoard } from "@/components/recipes/recipes-board";

export const metadata = {
  title: "Recipes — combinaisons d'agents NEURAL",
  description:
    "8 recettes documentées : enchaînement d'agents, connecteurs requis, outcomes typiques et conformité couverte. Point de départ accéléré pour cas d'usage métier complexes.",
};

export default function RecipesIndexPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <ChefHat className="h-3.5 w-3.5" />
            Recipes
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Combinaisons d&apos;agents prêtes
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            8 recettes documentées : enchaînement d&apos;agents, connecteurs requis, outcomes
            typiques et conformité couverte. Point de départ accéléré pour vos cas d&apos;usage —
            le calibrage final reste cadré avec vous.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <RecipesBoard recipes={recipesData.recipes} />
        </div>
      </section>
    </div>
  );
}
