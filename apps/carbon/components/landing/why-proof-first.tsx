/**
 * WhyProofFirst — remplace l'ancien tableau comparatif concurrentiel
 * (T0.1 du PLAN_ACTION_CARBONCO). Pas de comparaison concurrentielle invérifiable.
 *
 * T8.2 du PLAN_ACTION_CSRD_2026-11 : le journal est décrit comme rendant toute
 * modification détectable (une chaîne de hachage ne l'empêche pas) et ajout
 * du bloc « ce que l'empreinte prouve, et ce qu'elle ne prouve pas » : intégrité
 * et traçabilité sont livrées ; exactitude et exhaustivité relèvent des
 * rapprochements, encore en développement (T11.8), et le bloc le dit.
 */

import Link from "next/link";

const CHAIN = ["Import", "Contrôle", "Validation", "Export"] as const;

const ASSERTIONS = [
  {
    title: "Intégrité",
    status: "Disponible",
    ready: true,
    text: "Chaque écriture porte l'empreinte SHA-256 de la précédente. Une modification après validation casse la chaîne et devient visible.",
  },
  {
    title: "Traçabilité",
    status: "Disponible",
    ready: true,
    text: "Chaque chiffre garde son fichier, son onglet, sa cellule, sa méthode et son auteur. Le vérificateur remonte jusqu'à la source.",
  },
  {
    title: "Exactitude et exhaustivité",
    status: "En développement",
    ready: false,
    text: "Une empreinte ne dit pas qu'un chiffre est juste. Les rapprochements avec le FEC et les factures d'énergie arrivent pour le prouver.",
  },
] as const;

export function WhyProofFirst() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-8 md:p-10">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <h3 className="font-extrabold text-2xl md:text-3xl tracking-tight text-black mb-4">
              Pourquoi la preuve d&apos;abord
            </h3>
            <p className="text-base text-neutral-600 leading-relaxed">
              La plupart des plateformes collectent et calculent. CarbonCo ajoute ce que les auditeurs
              demandent en premier : un journal où toute modification devient détectable. Chaque donnée
              porte sa source (fichier, onglet, cellule), sa méthode, son auteur et une empreinte
              SHA-256 chaînée ; chaque export inclut un Evidence Pack dont l&apos;intégrité se vérifie
              publiquement, sans compte ni outil tiers. Nous publions par ailleurs l&apos;état exact de
              notre couverture, standard par standard, sur{" "}
              <Link href="/couverture" className="text-green-700 underline hover:text-green-800">
                /couverture
              </Link>{" "}
              — y compris ce qui n&apos;est pas encore prêt.
            </p>
          </div>

          {/* Chaîne animée : chaque maillon s'allume à son tour (désactivé sous prefers-reduced-motion). */}
          <div aria-hidden className="relative rounded-2xl bg-neutral-950 p-6 overflow-hidden">
            <div
              className="absolute inset-0 opacity-40"
              style={{ backgroundImage: "radial-gradient(circle at 80% 0%, rgba(16,185,129,0.35), transparent 55%)" }}
            />
            <div className="relative space-y-3">
              {CHAIN.map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <span
                    className="proof-link-glow flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-[11px] font-mono font-bold text-emerald-300"
                    style={{ animationDelay: `${i * 0.6}s` }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-semibold text-white w-24">{step}</span>
                  <span className="flex-1 truncate font-mono text-[11px] text-emerald-200/70">
                    sha256:{["9f2c…a41e", "c07b…19d3", "4e81…f6a0", "b3d9…02c7"][i]}
                  </span>
                </div>
              ))}
              <div className="pt-3 mt-1 border-t border-white/10 text-[11px] font-mono text-neutral-400">
                prev_hash ⟶ hash · chaîne vérifiée chaque jour
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {ASSERTIONS.map((a) => (
            <div
              key={a.title}
              className={`rounded-2xl border p-5 transition-colors ${
                a.ready ? "border-emerald-200 bg-emerald-50/50" : "border-dashed border-neutral-300 bg-neutral-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-black">{a.title}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                    a.ready ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-600 leading-relaxed">{a.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
