"use client";

/**
 * WiHero — ouverture de Water Intelligence.
 *
 * ## Ce que ce hero doit faire, et ce qu'il ne doit pas
 *
 * Il doit poser la proposition et l'état RÉEL de la publication en un écran.
 * Il ne doit pas promettre : les compteurs qu'il affiche viennent du document
 * publié, jamais d'une constante — un « 3 observations publiées » écrit en dur
 * resterait affiché après un retour arrière.
 *
 * ## La cascade
 *
 * Sept maillons, du climat aux décisions. Ce n'est pas une frise décorative :
 * elle énonce l'ordre de causalité que le module respecte, et dont chaque
 * section suivante traite un maillon. Elle est rendue en **liste ordonnée**,
 * donc lisible par un lecteur d'écran dans le bon ordre, et l'animation
 * n'ajoute aucune information.
 *
 * `prefers-reduced-motion` est respecté par `useReducedMotion()` : sous cette
 * préférence, les maillons apparaissent à leur place finale, sans
 * déplacement. Aucun contenu ne dépend de l'animation pour exister.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

/**
 * L'ordre de causalité du module. Il se lit de haut en bas et chaque maillon
 * correspond à une section de la page — la cascade est la table des matières
 * du raisonnement, pas une illustration.
 */
const CASCADE = [
  { label: "Climat", hint: "Régime hydrologique, extrêmes" },
  { label: "Bassin et ressource", hint: "Disponibilité à l'échelle qui compte" },
  { label: "Prélèvements", hint: "Ce qui est effectivement soutiré" },
  { label: "Activités dépendantes", hint: "Procédés, sites, fournisseurs" },
  { label: "Risques opérationnels", hint: "Interruption, perte de capacité" },
  { label: "Impacts financiers et ESG", hint: "Exposition, obligations, reporting" },
  { label: "Adaptation et résilience", hint: "Marges, arbitrages, investissements" },
] as const;

export interface WiHeroProps {
  /** Nombre d'observations RÉELLEMENT publiées — lu au document. */
  observationCount: number;
  /** `false` tant que le workflow de génération n'a pas tourné. */
  isPublished: boolean;
  /** Date d'assemblage du snapshot, ou `null` s'il n'est pas généré. */
  snapshotDate: string | null;
  /** Territoire et année du périmètre signé. */
  scopeLabel: string;
  /** Nombre de sources instrumentées, et nombre autorisé à publier. */
  sourceCount: number;
  publishableCount: number;
}

export function WiHero({
  observationCount,
  isPublished,
  snapshotDate,
  scopeLabel,
  sourceCount,
  publishableCount,
}: WiHeroProps) {
  const reduce = useReducedMotion();

  /* Sous `prefers-reduced-motion`, l'état initial EST l'état final : rien ne
     bouge, et rien n'attend une animation pour devenir visible. */
  const appear = (index: number) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <header className="wi-hero" data-testid="wi-hero">
      {!reduce && (
        <div className="wi-hero-halo" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
      <div className="wi-hero-grid">
        {/* ------------------------------------------------------ Colonne texte */}
        <div>
          <div className="wi-hero-badges">
            <span className="wi-chip" data-testid="wi-hero-badge-pilot">
              <span aria-hidden="true">◆</span>
              Pilote public vérifié
            </span>
            <span className="wi-chip" data-testid="wi-hero-badge-scope">
              <span aria-hidden="true">▨</span>
              Périmètre limité — {scopeLabel}
            </span>
          </div>

          <h1 className="wi-h1" style={{ marginTop: "1.25rem" }}>
            Water Intelligence
          </h1>

          <p className="wi-lede" style={{ marginTop: "1.25rem" }}>
            Comprendre où l&apos;entreprise dépend de l&apos;eau, où la ressource est sous
            contrainte et quelles décisions de résilience prendre.
          </p>

          {/* Compteurs : tous LUS, aucun écrit en dur. */}
          <dl className="wi-hero-stats" data-testid="wi-hero-stats">
            <div>
              <dt>Observations publiées</dt>
              <dd className="wi-num" data-testid="wi-hero-observations">
                {observationCount}
              </dd>
            </div>
            <div>
              <dt>Sources instrumentées</dt>
              <dd className="wi-num">{sourceCount}</dd>
            </div>
            <div>
              <dt>Sources autorisées</dt>
              <dd className="wi-num">{publishableCount}</dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd data-testid="wi-hero-snapshot-date">
                {/* Jamais une date plausible : « non généré » est un état, pas
                    une panne, et il se dit. */}
                {isPublished ? (snapshotDate ?? "n.c.") : "non généré"}
              </dd>
            </div>
          </dl>

          <p className="wi-muted wi-hero-provenance">
            <span aria-hidden="true">⛭</span>{" "}
            {isPublished
              ? "Provenance complète : chaque valeur porte sa source, sa période, sa méthode, son checksum et sa licence."
              : "Provenance prête : le document pilote sera produit par un workflow de génération vérifié, jamais écrit à la main."}
          </p>

          <div className="wi-hero-cta">
            <a href="#pilote" className="wi-cta wi-cta-primary">
              Explorer les données pilotes
            </a>
            <a href="#preuves" className="wi-cta wi-cta-secondary">
              Comprendre la méthode
            </a>
          </div>

          <p className="wi-muted wi-hero-note">
            Vous cherchez le suivi hydrique de votre entreprise&nbsp;?{" "}
            <Link href="/water/cockpit" className="wi-link">
              Cockpit Eau &amp; stress hydrique
            </Link>{" "}
            (accès authentifié).
          </p>
        </div>

        {/* --------------------------------------------------- Colonne cascade */}
        <div className="wi-cascade" aria-labelledby="wi-cascade-title">
          <p className="wi-kicker" id="wi-cascade-title">
            La chaîne que ce module suit
          </p>
          {/*
            Liste ORDONNÉE : l'ordre est l'information. Un lecteur d'écran la
            restitue dans le bon sens sans dépendre de la mise en page.
          */}
          <ol className="wi-cascade-list">
            {CASCADE.map((step, index) => (
              <motion.li key={step.label} {...appear(index)} className="wi-cascade-item">
                <span className="wi-cascade-rank wi-num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="wi-cascade-body">
                  <span className="wi-cascade-label">{step.label}</span>
                  <span className="wi-cascade-hint">{step.hint}</span>
                </span>
              </motion.li>
            ))}
          </ol>
          <p className="wi-cascade-foot wi-muted">
            Chaque maillon a sa section. Le module ne saute pas d&apos;étape&nbsp;: il
            ne déduit pas un impact financier d&apos;un régime climatique.
          </p>
        </div>
      </div>
    </header>
  );
}
