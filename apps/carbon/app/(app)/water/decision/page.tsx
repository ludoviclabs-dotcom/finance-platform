"use client";

/**
 * app/(app)/water/decision/page.tsx — cockpit décisionnel hydrique
 * (Wave E-Interface, commit F2).
 *
 * ## Où vit cette page, et pourquoi
 *
 * Dans le groupe `(app)`, donc **derrière la garde d'authentification déjà en
 * place** (`app/(app)/layout.tsx`) : aucune seconde logique d'authentification
 * n'est écrite ici. Une garde locale supplémentaire divergerait tôt ou tard de
 * celle du groupe, et c'est la divergence qui produit les pages accessibles par
 * accident.
 *
 * L'URL est `/water/decision`. Elle est distincte de `/water-intelligence`
 * (surface publique, hors groupe) et de `/water` (cockpit opérationnel) —
 * aucune des trois n'en masque une autre.
 *
 * ## Ce que le client n'envoie jamais
 *
 * Ni `company_id`, ni identifiant d'entreprise, de tenant ou de site — ni dans
 * l'URL, ni dans un corps de requête. `fetchDecisionSynthesis` ne prend qu'un
 * `AbortSignal` : sa signature interdit d'en passer un. Le périmètre est résolu
 * côté serveur, à partir du jeton, et nulle part ailleurs.
 *
 * La réponse PORTE un `company_id` — le contrat serveur le renvoie — mais cette
 * page ne l'affiche pas. Un identifiant de tenant rendu dans le DOM finit dans
 * une capture d'écran, un rapport de bug ou une trace de support.
 *
 * ## Les six facettes portent chacune leur état
 *
 * Une seule requête alimente six facettes ; chacune affiche pourtant son propre
 * état (disponible, aucune donnée, schéma non disponible, accès refusé, erreur
 * inattendue, chargement). Aucun bandeau global ne les recouvre : c'est ce qui
 * empêche une facette indisponible de passer pour une facette vide.
 *
 * Aucun score agrégé n'est produit — ni dans le hero, ni ailleurs. Le seul
 * décompte affiché porte sur la DISPONIBILITÉ de l'information, et le dit.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { WdScenarioCalculator } from "@/components/water-decision/WdCalculator";
import {
  WdAvailabilityLine,
  WdSynthesisPanel,
} from "@/components/water-decision/WdSynthesis";
import {
  DecisionAuthError,
  DecisionSchemaNotReadyError,
  fetchDecisionSynthesis,
} from "@/lib/api/water-decision";
import { deriveFacetStates, type WdTransport } from "@/lib/water-decision/facets";

export default function WaterDecisionPage() {
  const [transport, setTransport] = useState<WdTransport>({ kind: "loading" });

  const load = useCallback(async (signal: AbortSignal) => {
    setTransport({ kind: "loading" });
    try {
      const synthesis = await fetchDecisionSynthesis(signal);
      setTransport({ kind: "ready", synthesis });
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if (error instanceof DecisionAuthError) {
        setTransport({ kind: "access_denied", status: error.status });
        return;
      }
      if (error instanceof DecisionSchemaNotReadyError) {
        setTransport({ kind: "schema_unavailable" });
        return;
      }
      setTransport({ kind: "unexpected_error", message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const states = deriveFacetStates(transport);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6" data-testid="wd-page">
      {/* ------------------------------------------------------------- Hero */}
      {/*
        `h2` et non `h1` : l'en-tête du groupe `(app)` rend déjà un `h1` portant
        le titre de la page (`components/layout/header.tsx`). Un second `h1`
        dans le corps annoncerait deux titres de premier niveau au lecteur
        d'écran, pour un seul document — et ici, avec le même texte.
      */}
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--color-foreground)]">
          Cockpit décisionnel hydrique
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm text-[var(--color-foreground-muted)]">
          Rassembler, sur un même écran, ce que les modules savent déjà de votre exposition à l’eau,
          puis chiffrer un scénario financier à partir d’hypothèses que vous déclarez. Les six
          facettes restent séparées&nbsp;: aucune n’est fusionnée dans un indice unique.
        </p>

        <div className="mt-3" data-testid="wd-hero-status">
          <WdAvailabilityLine states={states} />
        </div>

        {/*
          Lien en couleur de texte courante, souligné. `--color-success` sur le
          fond clair donne 3,77:1 — sous le seuil AA de 4,5:1 pour du texte
          normal, et le lien serait le seul élément à en pâtir. Le soulignement
          porte déjà la nature du lien : la couleur n'ajoutait rien qu'elle ne
          dise, et lui coûtait sa lisibilité.
        */}
        <p className="mt-3 text-sm">
          <Link
            href="/water"
            className="text-[var(--color-foreground)] underline underline-offset-2"
            data-testid="wd-back-to-water"
          >
            Retour au cockpit Eau &amp; stress hydrique
          </Link>
        </p>
      </header>

      {/* -------------------------------------------------- Synthèse facettes */}
      <section aria-labelledby="wd-synthese-titre" className="mb-8">
        <h3
          id="wd-synthese-titre"
          className="text-lg font-semibold text-[var(--color-foreground)]"
        >
          Synthèse à six facettes
        </h3>
        <p className="mb-4 mt-1 max-w-[62ch] text-sm text-[var(--color-foreground-muted)]">
          Chaque facette affiche son propre état. Une facette sans donnée n’est pas un risque nul,
          et une facette qui n’a pas pu être interrogée n’est pas une facette vide.
        </p>
        <WdSynthesisPanel states={states} />
      </section>

      {/* ----------------------------------------------------- Calculateur */}
      <WdScenarioCalculator />
    </div>
  );
}
