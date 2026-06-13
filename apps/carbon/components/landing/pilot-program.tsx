/**
 * PilotProgram — remplace l'ancienne section de témoignages clients
 * (T0.1 du PLAN_ACTION_CARBONCO). Aucun témoignage ni logo client fictif.
 * Copy = annexe A.4 du plan, verbatim.
 */

import Link from "next/link";

export function PilotProgram() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 md:p-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200 mb-5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-bold text-green-700 uppercase tracking-wide">3 places pour l&apos;exercice 2026</span>
        </div>
        <h3 className="font-extrabold text-2xl md:text-3xl tracking-tight text-black mb-4">
          Programme pilote
        </h3>
        <p className="text-base text-neutral-600 leading-relaxed">
          Nous équipons gratuitement trois organisations (PME, ETI ou cabinet) pour produire leur
          premier rapport VSME auditable, en échange d&apos;un retour d&apos;expérience publiable.
          Vos données restent en zone UE, votre auditeur dispose d&apos;un accès lecture seule, et
          chaque chiffre est vérifiable par hash public.
        </p>
        <div className="mt-7">
          <a
            href="mailto:contact@carbonco.fr?subject=Programme%20pilote%20CarbonCo%20%E2%80%94%20exercice%202026"
            className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform"
          >
            Candidater au programme pilote
            <span aria-hidden="true">→</span>
          </a>
          <p className="text-xs text-neutral-400 mt-3">
            Vous préférez explorer d&apos;abord ?{" "}
            <Link href="/couverture" className="underline hover:text-neutral-600">
              Voir notre couverture réelle
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
