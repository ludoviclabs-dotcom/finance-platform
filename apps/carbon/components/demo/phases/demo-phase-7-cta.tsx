"use client";

// PHASE 7 — Appel à l'action (clôture de la démo cinématique /demo).
//
// Scène finale, centrée : on récapitule la promesse produit (« un rapport prêt à
// être audité, traçable jusqu'à la cellule source, vérifiable sans outil
// propriétaire ») et on propose les actions de sortie :
//   • démarrer l'essai gratuit (CTA principal, fond blanc) ;
//   • vérifier publiquement la preuve (lien secondaire vers /demo/verify/<hash>) ;
//   • rejouer la démo (relance l'horloge via replay()) ;
//   • revenir à l'accueil (lien discret).
//
// Composant PRÉSENTATIONNEL : il NE pilote PAS la progression de la timeline —
// l'horloge auto-avance toute seule jusqu'à cette phase. La seule commande qu'il
// déclenche est `replay`, sur action explicite de l'utilisateur (clic), ce qui
// est attendu : la démo est terminée et l'utilisateur choisit de la relancer.
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL (tout visible, sans
// animation d'entrée / stagger). Aucun timer (setTimeout/interval/raf) n'est posé
// dans ce fichier — l'orchestration du stagger est confiée à framer-motion via
// les variants —, il n'y a donc rien à nettoyer au démontage.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { DEMO_HASH_FULL } from "@/components/demo/demo-types";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Variants du conteneur : orchestre la cascade d'apparition des boutons. */
const actionsVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

/** Variants d'un bouton : fondu + léger glissement vertical à l'entrée. */
const actionItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export function DemoPhase7Cta() {
  const reduce = useReducedMotion();
  const { replay } = useDemoTimeline();

  return (
    <PhaseShell testId="demo-cta">
      {/* Scène centrée verticalement (le conteneur parent fournit la hauteur). */}
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        {/* Titre principal — la promesse d'auditabilité. */}
        <h2 className="max-w-3xl text-4xl font-extrabold tracking-tight text-white md:text-5xl">
          Votre rapport, prêt à être audité.
        </h2>

        {/* Sous-titre — traçabilité + vérifiabilité ouverte. */}
        <p className="mt-4 max-w-2xl text-white/55">
          Traçable jusqu'à la cellule source. Vérifiable sans aucun outil
          propriétaire.
        </p>

        {/* Actions de sortie (cascade d'entrée via framer-motion). */}
        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          variants={reduce ? undefined : actionsVariants}
          initial={reduce ? false : "hidden"}
          animate={reduce ? undefined : "visible"}
        >
          {/* CTA principal : démarrer l'essai gratuit. */}
          <motion.div variants={reduce ? undefined : actionItemVariants}>
            <Link
              href="/login"
              aria-label="Démarrer gratuitement — essai de 14 jours"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 font-bold text-black transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Démarrer gratuitement — 14 jours
            </Link>
          </motion.div>

          {/* CTA secondaire : vérification publique de la preuve (nouvel onglet). */}
          <motion.div variants={reduce ? undefined : actionItemVariants}>
            <Link
              href={"/demo/verify/" + DEMO_HASH_FULL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Vérifier la preuve publiquement dans un nouvel onglet"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-4 font-bold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Vérifier la preuve publiquement
            </Link>
          </motion.div>

          {/* Rejouer la démo : relance l'horloge depuis le début. */}
          <motion.div variants={reduce ? undefined : actionItemVariants}>
            <button
              type="button"
              onClick={replay}
              data-testid="demo-replay"
              aria-label="Rejouer la démo depuis le début"
              className="inline-flex items-center gap-2 rounded-full px-4 py-4 font-bold text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rejouer la démo
            </button>
          </motion.div>
        </motion.div>

        {/* Lien discret : retour à l'accueil. */}
        <Link
          href="/"
          className="mt-12 text-sm text-white/40 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          ← Retour à l'accueil
        </Link>
      </div>
    </PhaseShell>
  );
}
