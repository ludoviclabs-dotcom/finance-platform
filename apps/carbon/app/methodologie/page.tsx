import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Méthodologie d'audit — CarbonCo",
  description:
    "Comment CarbonCo calcule, source et rend vérifiable chaque chiffre : GHG Protocol, " +
    "facteurs ADEME Base Empreinte® versionnés, chaîne de preuve SHA-256, score d'audit et " +
    "qualité de la donnée. Méthode publiée et reproductible.",
  alternates: { canonical: "/methodologie" },
};

/** Carte de section réutilisable. */
function Block({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-2">
        {kicker}
      </div>
      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-4">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

export default function MethodologiePage() {
  return (
    <main className="bg-white min-h-screen">
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Accueil
          </Link>
        </div>
      </div>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
          Méthodologie d&apos;audit
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 mb-4">
          De la cellule source à la preuve vérifiable.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mb-12 leading-relaxed">
          Chaque chiffre publié par CarbonCo porte sa source, sa méthode de calcul, son auteur et
          une empreinte cryptographique. Cette page décrit comment, sans jargon — pour que votre
          auditeur (OTI, expert-comptable, DAF) puisse la reproduire.
        </p>

        <Block kicker="01 · Calcul" title="Méthode de calcul des émissions">
          <p>
            Les émissions sont calculées selon le <strong>GHG Protocol</strong> (Scope 1, 2 &amp; 3) :
            pour chaque ligne d&apos;activité, <code className="font-mono text-[13px]">émissions = quantité d&apos;activité × facteur d&apos;émission</code>.
            Le résultat est exprimé en tCO₂e.
          </p>
          <p>
            Les facteurs d&apos;émission proviennent de la <strong>Base Empreinte® de l&apos;ADEME</strong>,
            référentiel public et gratuit. Chaque facteur est <strong>versionné</strong> (ex. <code className="font-mono text-[13px]">v2025</code>)
            et conservé dans le journal de preuve : un recalcul avec une version postérieure crée un
            nouvel événement tracé, l&apos;ancienne valeur restant consultable.
          </p>
          <p>
            Le Scope 2 est restitué en approche <em>location-based</em> par défaut. Le Scope 3 est
            ventilé sur les <strong>15 catégories du GHG Protocol</strong> ; les catégories non
            évaluées restent affichées « en creux » plutôt que masquées, par honnêteté sur la
            couverture.
          </p>
        </Block>

        <Block kicker="02 · Screening monétaire" title="FEC & ratios monétaires (Scope 3)">
          <p>
            À partir d&apos;un <strong>FEC</strong> (Fichier des Écritures Comptables, format art.
            A.47 A-1 du LPF) ou d&apos;exports de dépenses, les comptes de charges (PCG classe 6) sont
            mappés vers les catégories Scope 3, puis convertis en tCO₂e via des <strong>ratios
            monétaires</strong> (kgCO₂e/€). Ces estimations sont marquées <strong>qualité 4</strong>
            (donnée monétaire) et n&apos;entrent <strong>jamais</strong> dans la chaîne sans un écran
            de revue et une validation humaine explicite.
          </p>
        </Block>

        <Block kicker="03 · Réglementaire" title="BEGES (France)">
          <p>
            Le bilan GES réglementaire est produit par une table de passage déterministe
            GHG Protocol → nomenclature <strong>BEGES v5</strong> (6 catégories / 22 postes, arrêté
            du 25/01/2022). Une réconciliation automatique garantit que <code className="font-mono text-[13px]">total BEGES = total GHG</code>.
            Le dépôt final s&apos;effectue manuellement sur{" "}
            <a href="https://bilans-ges.ademe.fr" className="text-green-700 underline" rel="noopener noreferrer" target="_blank">
              bilans-ges.ademe.fr
            </a>.
          </p>
        </Block>

        <Block kicker="04 · Preuve" title="Chaîne de preuve SHA-256 (inviolable)">
          <p>
            Chaque donnée consolidée est un <strong>événement signé</strong> : on calcule un hash
            SHA-256 chaîné à l&apos;événement précédent (<code className="font-mono text-[13px]">hash = SHA256(hash_précédent | société | code | valeur | unité | facteur | source | date)</code>,
            valeur formatée à 6 décimales, premier maillon = <code className="font-mono text-[13px]">GENESIS</code>).
            Modifier rétroactivement une valeur casse la chaîne et devient détectable.
          </p>
          <p>
            Chaque export génère un <strong>Evidence Pack</strong> (ZIP) contenant le rapport PDF,
            l&apos;export Excel à hash par ligne, les pièces justificatives, un <code className="font-mono text-[13px]">manifest.json</code> et
            un fichier <code className="font-mono text-[13px]">CHECKSUMS.sha256</code> (compatible <code className="font-mono text-[13px]">sha256sum -c</code>).
            Le hash global est imprimé en pied de chaque page du PDF et se vérifie publiquement sur{" "}
            <Link href="/verify" className="text-green-700 underline">/verify</Link> — sans compte,
            sans outil propriétaire.
          </p>
        </Block>

        <Block kicker="05 · Indicateurs" title="Qualité de la donnée & score d'audit">
          <p>
            Chaque fact porte un <strong>niveau de qualité de 1 à 5</strong> (1 = mesure primaire,
            2 = facture/pièce, 3 = donnée d&apos;activité estimée, 4 = ratio monétaire,
            5 = extrapolation), déduit de la source puis ajustable.
          </p>
          <p>
            Le <strong>score d&apos;audit (0-100)</strong> agrège quatre composantes pondérées :{" "}
            <code className="font-mono text-[13px]">0,30 × couverture des pièces + 0,30 × qualité moyenne + 0,30 × intégrité de la chaîne + 0,10 × fraîcheur des facteurs</code>.
            La formule est publiée et reproductible.
          </p>
        </Block>

        <Block kicker="06 · Vérification indépendante" title="Reproduire la vérification">
          <p>
            Téléchargez l&apos;Evidence Pack, puis exécutez en ligne de commande :
          </p>
          <pre className="bg-neutral-900 text-neutral-100 p-4 rounded-lg text-[12px] overflow-x-auto">
{`# Linux / macOS — recalcule et compare les empreintes
sha256sum -c CHECKSUMS.sha256

# Le hash imprimé en pied du PDF doit résoudre sur :
#   https://.../verify/<hash>`}
          </pre>
          <p>
            Aucune confiance en CarbonCo n&apos;est requise : la preuve se vérifie avec des outils
            standards.
          </p>
        </Block>

        <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-6 text-sm text-neutral-600">
          Les référentiels mobilisés (GHG Protocol, EFRAG/VSME, ADEME Base Empreinte®, BEGES v5) sont
          publics. Voir aussi{" "}
          <Link href="/couverture" className="text-green-700 underline">la couverture standard par standard</Link>{" "}
          et{" "}
          <Link href="/etat-du-produit" className="text-green-700 underline">l&apos;état du produit</Link>.
        </div>
      </section>
    </main>
  );
}
