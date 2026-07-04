/**
 * WhyProofFirst — remplace l'ancien tableau comparatif concurrentiel
 * (T0.1 du PLAN_ACTION_CARBONCO). Pas de comparaison concurrentielle invérifiable.
 * Copy = annexe A.5 du plan, verbatim.
 */

import Link from "next/link";

export function WhyProofFirst() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 md:p-10">
        <h3 className="font-extrabold text-2xl md:text-3xl tracking-tight text-black mb-4">
          Pourquoi la preuve d&apos;abord
        </h3>
        <p className="text-base text-neutral-600 leading-relaxed">
          La plupart des plateformes collectent et calculent. CarbonCo ajoute ce que les auditeurs
          demandent en premier : un journal inviolable. Chaque donnée porte sa source (fichier,
          onglet, cellule), sa méthode, son auteur et un hash chaîné SHA-256 ; chaque export inclut
          un Evidence Pack vérifiable publiquement, sans compte ni outil tiers. Nous publions par
          ailleurs l&apos;état exact de notre couverture, standard par standard, sur{" "}
          <Link href="/couverture" className="text-green-700 underline hover:text-green-800">
            /couverture
          </Link>{" "}
          — y compris ce qui n&apos;est pas encore prêt.
        </p>
      </div>
    </div>
  );
}
