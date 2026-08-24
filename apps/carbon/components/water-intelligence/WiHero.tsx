"use client";

/**
 * WiHero — ouverture de Water Intelligence, en centre de commande
 * evidence-first (WI-V3-02).
 *
 * ## Les cinq questions auxquelles le premier écran répond
 *
 * 1. Qu'est-ce que ce module ? — titre et positionnement.
 * 2. Sur quel périmètre ? — pastilles de portée, et le compteur « Périmètre
 *    couvert », qui porte le code de commune plutôt qu'un nombre.
 * 3. Combien de données sont publiées ? — les quatre Evidence Counters.
 * 4. Quel est leur statut ? — le bloc Snapshot pilote.
 * 5. Quelle chaîne vais-je explorer ? — l'Evidence Chain, dont chaque maillon
 *    est un lien vers la section qui le traite.
 *
 * ## Pourquoi des compteurs, et surtout pourquoi PAS des jauges
 *
 * Un anneau de progression, une barre de complétion ou un pourcentage
 * supposent un DÉNOMINATEUR : « 3 sur combien ? ». Ce module n'en a aucun —
 * personne ne sait combien d'observations « il faudrait » publier, et
 * l'inventer transformerait un fait (« trois volumes publiés ») en score
 * implicite (« 3 sur 100, donc 3 % »). Les quatre compteurs sont donc des
 * valeurs nues, chacune avec son libellé, sa métadonnée et sa provenance.
 *
 * `1 source autorisée sur 7 instrumentées` est d'ailleurs un ÉCART qu'il faut
 * lire comme tel, pas comme un taux de remplissage à combler : six sources ne
 * publient pas pour six motifs distincts, dont aucun n'est un correctif
 * technique.
 *
 * ## L'Evidence Chain n'est pas un Sankey
 *
 * Aucune épaisseur de trait n'est proportionnelle à quoi que ce soit : rien
 * n'est quantifié entre deux maillons, et un trait qui s'épaissirait
 * prétendrait mesurer un flux. Le connecteur a une largeur constante d'un
 * pixel. Ce que la chaîne montre, c'est l'ORDRE du raisonnement et, sur chaque
 * maillon, l'état de publication réel de la facette correspondante — d'où le
 * fait qu'un seul maillon sur sept porte l'état « publié ».
 *
 * ## Mouvement
 *
 * Les animations d'entrée sont en CSS, jamais en JavaScript : leur état de
 * base est l'état FINAL (opacité 1, sans déplacement), et l'animation part de
 * l'état initial pour y revenir. Un lecteur sans JavaScript voit donc la page
 * complète — ce qu'une animation pilotée par `framer-motion`, dont l'état
 * initial est écrit dans le HTML rendu, ne garantissait pas.
 *
 * `prefers-reduced-motion` est tenu deux fois : `useReducedMotion()` retire les
 * classes d'animation côté client, et la règle globale de la feuille de style
 * neutralise toute animation restante. Aucun contenu ne dépend de l'animation
 * pour exister.
 */

import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CloudRain,
  Droplets,
  Factory,
  Landmark,
  Sprout,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

import {
  PUBLICATION_STATE_LABELS,
  PULSE_FACETS,
  type PulseFacetPublicationState,
} from "@/lib/water-intelligence/editorial-matrices";

import { WiScopeChip, WiStatusChip } from "./WiPrimitives";

/* ==========================================================================
   Evidence Chain — l'ordre du raisonnement, et l'état de chaque maillon
   ========================================================================== */

interface ChainLink {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: LucideIcon;
  /** Section de la page qui traite ce maillon. */
  readonly anchor: string;
  /**
   * Facette Water Pulse dont ce maillon porte l'état de publication, quand
   * elle existe. `null` pour les deux maillons qui sont des étapes de
   * RAISONNEMENT et non des facettes de données : « Risques opérationnels »
   * se décrit dans la matrice sectorielle, « Finance & ESG » dans le pont
   * financier — l'un et l'autre qualitativement, jamais chiffrés.
   */
  readonly facetId: string | null;
  /** État retenu quand aucune facette ne correspond. */
  readonly fallbackState: PulseFacetPublicationState;
}

const CHAIN: readonly ChainLink[] = [
  {
    id: "climat",
    label: "Climat",
    hint: "Régime hydrologique, extrêmes",
    icon: CloudRain,
    anchor: "#evenements",
    facetId: "secheresse",
    fallbackState: "deferred",
  },
  {
    id: "bassin",
    label: "Bassin et ressource",
    hint: "Disponibilité à l'échelle qui compte",
    icon: Waves,
    anchor: "#carte",
    facetId: "disponibilite",
    fallbackState: "deferred",
  },
  {
    id: "prelevements",
    label: "Prélèvements",
    hint: "Ce qui est effectivement soutiré",
    icon: Droplets,
    anchor: "#pilote",
    facetId: "prelevements",
    fallbackState: "deferred",
  },
  {
    id: "activites",
    label: "Activités dépendantes",
    hint: "Procédés, sites, fournisseurs",
    icon: Factory,
    anchor: "#secteurs",
    facetId: "dependances",
    fallbackState: "qualitative",
  },
  {
    id: "risques",
    label: "Risques opérationnels",
    hint: "Interruption, perte de capacité",
    icon: AlertTriangle,
    anchor: "#risques",
    facetId: null,
    fallbackState: "qualitative",
  },
  {
    id: "finance",
    label: "Finance & ESG",
    hint: "Exposition, obligations, reporting",
    icon: Landmark,
    anchor: "#finance",
    facetId: null,
    fallbackState: "qualitative",
  },
  {
    id: "adaptation",
    label: "Adaptation",
    hint: "Marges, arbitrages, investissements",
    icon: Sprout,
    anchor: "#innovations",
    facetId: "adaptation",
    fallbackState: "qualitative",
  },
];

/**
 * État d'un maillon — LU sur la facette correspondante, jamais réécrit ici.
 * Si la facette change d'état dans `editorial-matrices.ts`, la chaîne suit
 * sans qu'aucune ligne de ce fichier ne bouge.
 */
function chainState(link: ChainLink): PulseFacetPublicationState {
  if (link.facetId === null) return link.fallbackState;
  const facet = PULSE_FACETS.find((entry) => entry.id === link.facetId);
  return facet ? facet.publicationState : link.fallbackState;
}

/* ==========================================================================
   Evidence Counter
   ========================================================================== */

interface EvidenceCounterProps {
  readonly label: string;
  readonly value: string;
  /** Métadonnée secondaire — TOUJOURS visible, jamais réservée au survol. */
  readonly meta: string;
  /** Provenance, révélée au survol ET au focus clavier, en supplément. */
  readonly provenance: string;
  /** Rend la valeur en monospace : c'est une RÉFÉRENCE, pas une quantité. */
  readonly reference?: boolean;
  readonly valueTestId?: string;
  readonly index: number;
  readonly animate: boolean;
}

function EvidenceCounter({
  label,
  value,
  meta,
  provenance,
  reference,
  valueTestId,
  index,
  animate,
}: EvidenceCounterProps) {
  return (
    <a
      href="#preuves"
      className={animate ? "wi-counter wi-anim-rise" : "wi-counter"}
      style={{ "--wi-i": index } as CSSProperties}
    >
      <span
        className={reference ? "wi-counter-value wi-counter-value-ref" : "wi-counter-value wi-num"}
        data-testid={valueTestId}
      >
        {value}
      </span>
      <span className="wi-counter-label">{label}</span>
      <span className="wi-counter-meta">{meta}</span>
      <span className="wi-counter-tip" role="tooltip">
        {provenance}
      </span>
    </a>
  );
}

/* ==========================================================================
   Hero
   ========================================================================== */

export interface WiHeroProps {
  /** Nombre d'observations RÉELLEMENT publiées — lu au document. */
  observationCount: number;
  /** `false` tant que le workflow de génération n'a pas tourné. */
  isPublished: boolean;
  /** Date d'assemblage du snapshot, ou `null` s'il n'est pas généré. */
  snapshotDate: string | null;
  /** Territoire et année du périmètre signé, en une phrase. */
  scopeLabel: string;
  /** Code du territoire signé, seul (ex. code commune INSEE). */
  territoryCode: string;
  /** Année observée. */
  periodLabel: string;
  /** Date de la revue humaine qui a autorisé la publication. */
  reviewedOn: string;
  /** Code de la source principale du pilote. */
  sourceCode: string;
  /** Nombre de sources instrumentées, et nombre autorisé à publier. */
  sourceCount: number;
  publishableCount: number;
}

export function WiHero({
  observationCount,
  isPublished,
  snapshotDate,
  scopeLabel,
  territoryCode,
  periodLabel,
  reviewedOn,
  sourceCode,
  sourceCount,
  publishableCount,
}: WiHeroProps) {
  const reduce = useReducedMotion();
  /* `useReducedMotion()` vaut `null` au rendu serveur : les classes sont donc
     présentes dans le HTML initial, et la règle globale
     `prefers-reduced-motion` de la feuille de style les neutralise avant même
     l'hydratation. Le retrait côté client est une seconde ceinture. */
  const animate = !reduce;

  /**
   * Compose la classe d'entrée AVEC la classe de base plutôt qu'à sa place.
   *
   * Le helper prend la classe de base en argument, et ne s'étale pas sur un
   * élément qui en porterait déjà une : un `{...rise(n)}` posé après un
   * `className=` l'écraserait silencieusement — c'est exactement ce qui avait
   * fait disparaître `.wi-hero-provenance` du balisage, sans qu'aucun type ne
   * s'en plaigne.
   */
  const rise = (base: string, index: number, extra?: CSSProperties) => ({
    className: animate ? `${base} wi-anim-rise` : base,
    style: { ...extra, "--wi-i": index } as CSSProperties,
  });

  return (
    <header className="wi-hero" data-testid="wi-hero">
      {animate && (
        <div className="wi-hero-halo" aria-hidden="true">
          <span />
          <span />
        </div>
      )}

      <div className="wi-hero-grid">
        {/* ------------------------------------------------------ Colonne texte */}
        <div>
          <div {...rise("wi-hero-badges", 0)}>
            <WiScopeChip icon="◆" label="Pilote public vérifié" testId="wi-hero-badge-pilot" />
            <WiScopeChip
              icon="▨"
              label={`Périmètre limité — ${scopeLabel}`}
              testId="wi-hero-badge-scope"
            />
          </div>

          <h1 {...rise("wi-h1", 1, { marginTop: "1.25rem" })}>Water Intelligence</h1>

          <p {...rise("wi-lede", 2, { marginTop: "1.25rem" })}>
            Dépendance à l&apos;eau, exposition territoriale et résilience — des
            observations aux décisions, avec leur niveau de preuve.
          </p>

          {/* ------------------------------------------- Evidence Counters
              Quatre valeurs, aucune jauge : voir la docstring de fichier sur
              l'absence de dénominateur. Toutes sont LUES, aucune écrite en
              dur — un « 3 » constant resterait affiché après un retour
              arrière du document. */}
          <div className="wi-counters" data-testid="wi-hero-counters">
            <EvidenceCounter
              index={3}
              animate={animate}
              label="Observations publiées"
              value={String(observationCount)}
              meta="Volumes déclarés, un par ouvrage"
              provenance="Lu au document pilote publié, jamais écrit dans l'interface. Vaut zéro tant que le workflow de génération n'a pas tourné."
              valueTestId="wi-hero-observations"
            />
            <EvidenceCounter
              index={4}
              animate={animate}
              label="Sources instrumentées"
              value={String(sourceCount)}
              meta="Connecteurs construits, licences vérifiées"
              provenance="Sept sources officielles dont le connecteur existe et dont la licence a été vérifiée. Vérifier une licence n'autorise pas à publier."
            />
            <EvidenceCounter
              index={5}
              animate={animate}
              label="Sources autorisées"
              value={String(publishableCount)}
              meta="Décision humaine signée, source par source"
              provenance="L'écart avec les sources instrumentées est le sujet de la section Provenance : six sources ne publient pas, pour six motifs distincts."
            />
            <EvidenceCounter
              index={6}
              animate={animate}
              reference
              label="Périmètre couvert"
              value={territoryCode}
              meta={`Commune INSEE · année ${periodLabel}`}
              provenance="Le périmètre de la décision signée. Toute autre commune et toute autre année exigeraient une nouvelle décision humaine."
            />
          </div>

          <p {...rise("wi-muted wi-hero-provenance", 7)}>
            <span aria-hidden="true">⛭</span>{" "}
            {isPublished
              ? "Provenance complète : chaque valeur porte sa source, sa période, sa méthode, son checksum et sa licence."
              : "Provenance prête : le document pilote sera produit par un workflow de génération vérifié, jamais écrit à la main."}
          </p>

          <div {...rise("wi-hero-cta", 8)}>
            <a href="#pilote" className="wi-cta wi-cta-primary">
              Explorer les données pilotes
            </a>
            <a href="#preuves" className="wi-cta wi-cta-secondary">
              Comprendre la méthode
            </a>
          </div>

          <p {...rise("wi-muted wi-hero-note", 9)}>
            Vous cherchez le suivi hydrique de votre entreprise&nbsp;?{" "}
            <Link href="/water/cockpit" className="wi-link">
              Cockpit Eau &amp; stress hydrique
            </Link>{" "}
            (accès authentifié).
          </p>
        </div>

        {/* --------------------------------------------- Colonne statut + chaîne */}
        <div className="wi-hero-side">
          {/* ------------------------------------------------ Snapshot pilote */}
          <section
            {...rise("wi-snapshot", 2)}
            aria-labelledby="wi-snapshot-title"
            data-testid="wi-snapshot-status"
          >
            <div className="wi-snapshot-head">
              {/*
                `h2` et non `h3` : ce bloc vit dans le hero, avant la première
                section de la page. Le niveau suit la structure du document ;
                la classe `wi-h3` n'en règle que la taille — un titre
                visuellement petit ne doit pas creuser un saut de niveau.
              */}
              <h2 id="wi-snapshot-title" className="wi-h3">
                Snapshot pilote
              </h2>
              <WiStatusChip state={isPublished ? "published" : "not_instrumented"} />
            </div>

            <dl className="wi-snapshot-grid">
              <div>
                <dt>Territoire</dt>
                <dd className="wi-mono">{territoryCode}</dd>
              </div>
              <div>
                <dt>Période</dt>
                <dd className="wi-num">{periodLabel}</dd>
              </div>
              <div>
                <dt>Snapshot</dt>
                <dd data-testid="wi-hero-snapshot-date">
                  {/* Jamais une date plausible : « non généré » est un état,
                      pas une panne, et il se dit. */}
                  {isPublished ? (snapshotDate ?? "n.c.") : "non généré"}
                </dd>
              </div>
              <div>
                <dt>Revu le</dt>
                <dd className="wi-num">{reviewedOn}</dd>
              </div>
              <div className="wi-snapshot-source">
                <dt>Source principale</dt>
                <dd className="wi-mono">{sourceCode}</dd>
              </div>
            </dl>

            <p className="wi-snapshot-foot">
              Données publiées sous périmètre signé.{" "}
              <a href="#preuves" className="wi-link">
                Provenance vérifiable
              </a>
            </p>
          </section>

          {/* ------------------------------------------------- Evidence Chain */}
          <div
            className={animate ? "wi-cascade wi-chain-draw" : "wi-cascade"}
            aria-labelledby="wi-cascade-title"
            data-testid="wi-evidence-chain"
          >
            <p className="wi-kicker" id="wi-cascade-title">
              La chaîne que ce module suit
            </p>
            {/*
              Liste ORDONNÉE : l'ordre est l'information. Un lecteur d'écran la
              restitue dans le bon sens sans dépendre de la mise en page, et
              chaque maillon est un lien vers la section qui le traite.
            */}
            <ol className="wi-cascade-list">
              {CHAIN.map((link, index) => {
                const state = chainState(link);
                const Icon = link.icon;
                return (
                  <li
                    key={link.id}
                    className="wi-chain-node"
                    style={{ "--wi-i": index } as CSSProperties}
                  >
                    <a href={link.anchor} className="wi-chain-link">
                      <span className="wi-chain-icon" aria-hidden="true">
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <span className="wi-chain-body">
                        <span className="wi-chain-label">{link.label}</span>
                        <span className="wi-chain-hint">{link.hint}</span>
                      </span>
                      {/* La pastille double un texte réel : la couleur ne
                          porte jamais seule l'état de publication. */}
                      <span className="wi-chain-dot" data-state={state} aria-hidden="true" />
                      <span className="wi-visually-hidden">
                        {" "}
                        — {PUBLICATION_STATE_LABELS[state]}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <p className="wi-cascade-foot wi-muted">
              Chaque maillon a sa section. Le module ne saute pas d&apos;étape&nbsp;: il
              ne déduit pas un impact financier d&apos;un régime climatique.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
