"use client";

// FEATURE C — vérification publique.
//
// Encadré présentationnel qui matérialise la promesse « vérifiable par
// n'importe qui, sans outil propriétaire ». Deux temps, une fois `visible` :
//   (1) en haut, l'URL publique de vérification se « tape » caractère par
//       caractère (HashTypewriter : du hash court vers le hash complet) ;
//   (2) une card « Rapport vérifié » apparaît (centrée au desktop, bottom sheet
//       au mobile) avec les 4 contrôles VERIFY_CHECKS qui se cochent en cascade,
//       puis un bouton-lien vers la vérification publique.
//
// Le composant NE pilote PAS la timeline : il réagit à la prop `visible`
// (passée par son parent) et anime sa séquence pour tenir dans la durée du
// moment "export-verify-card" (~8 s). Le callback `onDismiss` est OPTIONNEL
// (analytics) — il est appelé à la sortie de la card et rien ne doit en
// dépendre pour séquencer.
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL (URL complète,
// toutes les coches tracées, card visible), sans aucun timer ni animation
// d'entrée. Tous les timers sont nettoyés au démontage (ici via AnimatePresence
// et les primitives, qui gèrent eux-mêmes leurs timers).

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import { SPRING, DEMO_CSS } from "@/components/demo/demo-tokens";
import {
  VERIFY_CHECKS,
  DEMO_HASH_FULL,
  DEMO_HASH_SHORT,
} from "@/components/demo/demo-types";
import { HashTypewriter } from "@/components/demo/primitives/hash-typewriter";
import { CheckmarkDraw } from "@/components/demo/primitives/checkmark-draw";

type CarbonVerifyCardProps = {
  /** Hash complet (64 hex) révélé dans l'URL et passé au lien. Défaut DEMO_HASH_FULL. */
  hash?: string;
  /** Préfixe court du hash affiché avant expansion. Défaut DEMO_HASH_SHORT. */
  shortHash?: string;
  /** Le parent rend l'encadré visible pour le moment courant. */
  visible: boolean;
  /** Callback optionnel (analytics) appelé à la sortie de la card. */
  onDismiss?: () => void;
  /** Classes additionnelles sur le conteneur racine. */
  className?: string;
};

// Décalage d'apparition d'une coche à l'autre (en phase avec delayMs = index * step).
const CHECK_STEP_MS = 150;

export function CarbonVerifyCard({
  hash = DEMO_HASH_FULL,
  shortHash = DEMO_HASH_SHORT,
  visible,
  onDismiss,
  className,
}: CarbonVerifyCardProps) {
  const reduce = useReducedMotion();
  const { isMobile } = useDemoTimeline();

  // Variants d'entrée/sortie de la card.
  // - Desktop : pop centré, légère remontée.
  // - Mobile : bottom sheet qui glisse depuis le bas.
  // Dans les deux cas on part de (y 40, opacity 0) → (y 0, opacity 1) et on
  // sort vers (y 40, opacity 0). Sous mouvement réduit : état final immédiat.
  const cardInitial = reduce ? false : { y: 40, opacity: 0 };
  const cardAnimate = reduce ? undefined : { y: 0, opacity: 1 };
  const cardExit = reduce ? undefined : { y: 40, opacity: 0 };

  return (
    // onExitComplete → appelle onDismiss une fois la card sortie (optionnel,
    // analytics). En mouvement réduit il n'y a pas d'animation de sortie : ce
    // callback reste néanmoins déclenché par AnimatePresence au démontage.
    <AnimatePresence onExitComplete={onDismiss}>
      {visible ? (
        <motion.div
          key="verify"
          data-testid="demo-verify-card"
          className={[
            "flex w-full flex-col gap-4",
            isMobile ? "items-stretch" : "items-center",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={reduce ? undefined : { duration: 0.3 }}
        >
          {/* (1) Encart URL : la vérification publique se « tape » en direct. */}
          <div
            className={[
              "w-full overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3",
              isMobile ? "" : "max-w-lg",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
              Vérification publique
            </p>
            <div className="mt-1.5 whitespace-nowrap font-mono text-xs">
              <HashTypewriter
                shortHash={shortHash}
                fullHash={hash}
                basePath="/demo/verify/sha256-"
              />
            </div>
          </div>

          {/* (2) Card de vérification : centrée (desktop) ou bottom sheet (mobile). */}
          <motion.div
            className={[
              "border border-emerald-400/20 bg-neutral-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
              isMobile
                ? "fixed inset-x-0 bottom-0 z-40 rounded-t-3xl"
                : "w-full max-w-lg rounded-2xl",
            ].join(" ")}
            initial={cardInitial}
            animate={cardAnimate}
            exit={cardExit}
            transition={reduce ? undefined : SPRING.sheet}
          >
            {/* Titre : coche tracée + libellé. */}
            <div className="flex items-center gap-2">
              <CheckmarkDraw size={20} />
              <span className="font-bold text-white">Rapport vérifié</span>
            </div>

            {/* Les 4 contrôles VERIFY_CHECKS, cochés en cascade. */}
            <ul className="mt-4 flex flex-col gap-3">
              {VERIFY_CHECKS.map((check, i) => (
                <li key={check} className="flex items-center gap-2">
                  <CheckmarkDraw size={16} delayMs={i * CHECK_STEP_MS} />
                  <span className="text-sm text-white/80">{check}</span>
                </li>
              ))}
            </ul>

            {/* Bouton-lien vers la vérification publique (nouvel onglet). */}
            <Link
              href={"/demo/verify/" + hash}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="demo-verify-link"
              aria-label="Ouvrir la vérification publique dans un nouvel onglet"
              className={[
                "mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-center font-bold text-black transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
                reduce ? "" : DEMO_CSS.neuralPulse,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              Ouvrir la vérification publique
            </Link>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
