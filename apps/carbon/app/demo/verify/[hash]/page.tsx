/**
 * /demo/verify/[hash] — Page de FAUSSE vérification de la démo cinématique.
 *
 * Pendant la démo /demo, la card « Rapport vérifié » expose un lien public
 * /demo/verify/<hash>. Cette page matérialise la promesse « vérifiable par
 * n'importe qui » SANS jamais appeler d'API : tout est statique et fictif.
 *
 * À la différence de /verify/[hash] (la vraie page qui interroge l'API), ici :
 *   - aucun fetch, aucune dépendance réseau ;
 *   - le résultat est TOUJOURS « vérifié » (données de démonstration) ;
 *   - les métadonnées proviennent du contrat VERIFY_META (demo-types).
 *
 * Composant SERVEUR (pas de "use client") : rendu statique, aucun hook.
 * On reste dans l'ambiance sombre de la démo (#070909, texte blanc).
 */

import Link from "next/link";

import { VERIFY_META, VERIFY_CHECKS } from "@/components/demo/demo-types";

interface Props {
  params: Promise<{ hash: string }>;
}

// Page non indexable : c'est une démo, pas une vraie preuve publique.
export const metadata = { robots: { index: false } };

/**
 * Tronque élégamment un hash très long au milieu (début…fin) pour l'affichage
 * compact, tout en gardant la valeur complète disponible ailleurs sur la page.
 */
function truncateMiddle(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default async function DemoVerifyPage({ params }: Props) {
  const { hash } = await params;

  // Métadonnées fictives issues du contrat de démo (aucune donnée réelle).
  const fields: Array<{ label: string; value: string; mono?: boolean; fullWidth?: boolean }> = [
    { label: "Entreprise", value: VERIFY_META.company },
    { label: "Domaine", value: VERIFY_META.domain },
    { label: "Généré le", value: VERIFY_META.generatedAt },
    { label: "Taille", value: VERIFY_META.sizeLabel },
    { label: "Événements tracés", value: String(VERIFY_META.eventCount) },
    { label: "Datapoints gelés", value: String(VERIFY_META.frozenCount) },
    { label: "Nom de fichier", value: VERIFY_META.filename, mono: true, fullWidth: true },
  ];

  return (
    <main className="min-h-screen bg-[#070909] px-4 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        {/* Branding — retour vers l'accueil CarbonCo. */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white"
          >
            ← CarbonCo
          </Link>
        </div>

        <h1 className="font-display text-3xl font-bold text-white">
          Vérification de package
        </h1>
        <p className="mt-2 mb-8 text-sm text-white/60">
          Cette page confirme qu&apos;un hash correspond à un package d&apos;export
          auditable. Ici, il s&apos;agit d&apos;un exemple issu de la démonstration.
        </p>

        {/* Bandeau succès VERT. */}
        <div
          className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
          data-testid="demo-verify-success"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-lg text-emerald-300"
            >
              {/* Coche SVG (tracé statique, pas d'animation côté serveur). */}
              <svg
                viewBox="0 0 24 24"
                width={18}
                height={18}
                fill="none"
                stroke="#34D399"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.2 4.2L19 7" />
              </svg>
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-emerald-300">
                Package vérifié
              </h2>
              <p className="mt-1 text-sm text-white/70">
                Ce hash correspond à un export officiel enregistré par CarbonCo.
              </p>
            </div>
          </div>
        </div>

        {/* Hash recherché — valeur complète en font-mono, version tronquée pour l'aperçu. */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
            Hash vérifié
          </div>
          <div className="mt-2 font-mono text-xs text-white/60" aria-hidden="true">
            {truncateMiddle(hash)}
          </div>
          {/* Valeur complète, sélectionnable, exposée pour les tests et la copie. */}
          <code
            data-testid="demo-verify-hash"
            className="mt-2 block break-all rounded bg-white/[0.05] p-3 font-mono text-xs text-white/80"
          >
            {hash}
          </code>
        </div>

        {/* Métadonnées du package (grille de définitions). */}
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className={field.fullWidth ? "sm:col-span-2" : undefined}>
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {field.label}
              </dt>
              <dd
                className={
                  field.mono
                    ? "mt-1 break-all font-mono text-xs text-white/80"
                    : "mt-1 text-sm text-white"
                }
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Contrôles d'intégrité — chacun coché en vert. */}
        <ul className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          {VERIFY_CHECKS.map((check) => (
            <li key={check} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15"
              >
                <svg
                  viewBox="0 0 24 24"
                  width={13}
                  height={13}
                  fill="none"
                  stroke="#34D399"
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5l4.2 4.2L19 7" />
                </svg>
              </span>
              <span className="text-sm text-white/80">{check}</span>
            </li>
          ))}
        </ul>

        {/* Encart « démonstration » discret. */}
        <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-xs text-white/40">
          Démonstration — données fictives, aucune donnée réelle.
        </p>

        {/* Liens de navigation. */}
        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6 text-sm">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1 text-emerald-300/90 transition-colors hover:text-emerald-200"
          >
            ← Retour à la démo
          </Link>
          <Link
            href="/"
            className="text-white/50 transition-colors hover:text-white"
          >
            CarbonCo
          </Link>
        </div>
      </div>
    </main>
  );
}
