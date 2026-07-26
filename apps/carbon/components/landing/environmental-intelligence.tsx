"use client";

/**
 * components/landing/environmental-intelligence.tsx — section publique
 * « Intelligence environnementale » (feat/water-intelligence-discoverability).
 *
 * Deux modules thématiques, deux surfaces publiques : Métaux critiques et Eau.
 *
 * ## Ce que cette section ne dit pas, et pourquoi
 *
 * Le module Eau a une infrastructure opérationnelle et **aucune donnée
 * publiée** : les sept sources ont une licence vérifiée, aucune n'a de décision
 * humaine de publication signée. Une carte d'accueil est exactement l'endroit
 * où cette nuance se perd — « 7 sources officielles » se lit comme « 7 sources
 * affichées » si rien ne l'en empêche.
 *
 * La carte annonce donc l'état de l'INFRASTRUCTURE, jamais celui de l'eau, et
 * porte explicitement « Données publiques en attente de validation humaine ».
 * Aucun chiffre hydrique n'y figure — il n'y en a aucun à montrer.
 *
 * Formulations bannies, et vérifiées par un test : données en temps réel, carte
 * actuellement alimentée, surveillance active, conformité automatique,
 * couverture mondiale complète.
 *
 * ## Trois surfaces distinctes, dites comme telles
 *
 * `/water` est publique. `/water/cockpit` est le cockpit d'entreprise et
 * `/water/decision` le cockpit décisionnel : les deux exigent une session, et
 * la section le mentionne au lieu de laisser un visiteur buter sur une
 * redirection de connexion.
 *
 * ## Couleur
 *
 * Vert/minéral pour les métaux, bleu/cyan pour l'eau — mais chaque carte porte
 * son titre, sa description et ses puces en texte. La teinte double
 * l'information, elle ne la porte jamais seule.
 */

import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";

interface ModuleAccent {
  readonly ring: string;
  readonly chipBg: string;
  readonly chipText: string;
  readonly bullet: string;
}

const MINERAL: ModuleAccent = {
  ring: "border-green-200",
  chipBg: "bg-green-50",
  chipText: "text-green-700",
  bullet: "bg-green-500",
};

const WATER: ModuleAccent = {
  ring: "border-cyan-200",
  chipBg: "bg-cyan-50",
  chipText: "text-cyan-700",
  bullet: "bg-cyan-500",
};

function ModuleCard({
  accent,
  kicker,
  title,
  status,
  intro,
  bullets,
  cta,
  href,
  testId,
  children,
}: {
  accent: ModuleAccent;
  kicker: string;
  title: string;
  status: string;
  intro: string;
  bullets: readonly string[];
  cta: string;
  href: string;
  testId: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-3xl border ${accent.ring} bg-white p-8 shadow-sm`}
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs font-bold uppercase tracking-widest ${accent.chipText}`}>
          {kicker}
        </span>
        {/* Le statut est du TEXTE dans une puce, jamais une pastille colorée
            muette : c'est l'information la plus facile à mal lire de la carte. */}
        <span
          className={`rounded-full ${accent.chipBg} ${accent.chipText} px-3 py-1 text-xs font-semibold`}
          data-testid={`${testId}-status`}
        >
          {status}
        </span>
      </div>

      <h3 className="mt-4 text-2xl font-extrabold tracking-tighter text-black">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-neutral-500">{intro}</p>

      <ul className="mt-5 space-y-2.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-sm text-neutral-600">
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${accent.bullet}`} aria-hidden="true" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-7">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition-colors motion-reduce:transition-none hover:bg-neutral-800"
          data-testid={`${testId}-cta`}
        >
          {cta}
          <span aria-hidden="true">→</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

export function EnvironmentalIntelligence() {
  return (
    <section
      id="intelligence-environnementale"
      className="bg-[#f9f9fb] px-8 py-32 md:px-12"
      aria-labelledby="intelligence-environnementale-titre"
      data-testid="environmental-intelligence"
    >
      <div className="mx-auto max-w-[1440px]">
        <Reveal className="mb-4 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-green-600">
            Au-delà du carbone
          </span>
        </Reveal>
        <Reveal className="mb-4 text-center" delay={0.05}>
          <h2
            id="intelligence-environnementale-titre"
            className="text-4xl font-extrabold tracking-tighter text-black md:text-5xl"
          >
            Intelligence{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #16a34a 0%, #059669 40%, #0891b2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              environnementale
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="mb-16 text-center">
          <p className="mx-auto max-w-2xl text-lg text-neutral-500">
            Deux modules publics sur les dépendances physiques de votre activité. Chaque valeur y
            porte sa source&nbsp;; ce qui n’est pas encore publié est affiché comme tel.
          </p>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <ModuleCard
              accent={MINERAL}
              kicker="Minéral"
              title="Métaux critiques"
              status="Catalogue public consultable"
              intro="Dépendances, criticité et chaînes d’approvisionnement des matières premières stratégiques, avec leur concentration géographique."
              bullets={[
                "Dépendances, criticité et chaînes d’approvisionnement",
                "Concentration géographique par matière",
                "Cadre CRMA et matières stratégiques",
              ]}
              cta="Explorer les métaux critiques"
              href="/materials"
              testId="env-card-materials"
            />
          </Reveal>

          <Reveal delay={0.08}>
            <ModuleCard
              accent={WATER}
              kicker="Hydrique"
              title="Eau & risques hydriques"
              status="Infrastructure opérationnelle"
              intro="Le contexte hydrique à partir de sources officielles traçables. Les connecteurs et les contrats fonctionnent ; la publication des données attend une décision humaine, source par source."
              bullets={[
                "7 sources officielles instrumentées",
                "Licences vérifiées",
                "Données publiques en attente de validation humaine",
                "Stress, sécheresse, nappes, prélèvements, qualité et réglementation",
              ]}
              cta="Explorer Water Intelligence"
              href="/water"
              testId="env-card-water"
            >
              {/*
                Les deux surfaces authentifiées sont nommées ici, avec leur
                condition d'accès. Un visiteur qui clique sans session serait
                sinon renvoyé vers /login sans avoir compris pourquoi.
              */}
              <div className="mt-5 border-t border-neutral-100 pt-5" data-testid="env-water-private">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Pour les entreprises clientes
                </p>
                <p className="mt-2 text-sm">
                  <Link
                    href="/water/cockpit"
                    className="font-semibold text-black underline underline-offset-2"
                    data-testid="env-water-cockpit-link"
                  >
                    Accéder au cockpit entreprise
                  </Link>{" "}
                  <span className="text-neutral-500">
                    — sites, prélèvements, permis et screening.{" "}
                    <span className="font-semibold text-neutral-600">Connexion requise.</span>
                  </span>
                </p>
                <p className="mt-2 text-sm text-neutral-500">
                  Le{" "}
                  <Link
                    href="/water/decision"
                    className="font-semibold text-black underline underline-offset-2"
                    data-testid="env-water-decision-link"
                  >
                    cockpit décisionnel
                  </Link>{" "}
                  y rassemble six facettes séparées et un calculateur de scénarios financiers.{" "}
                  <span className="font-semibold text-neutral-600">Connexion requise.</span>
                </p>
              </div>
            </ModuleCard>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-neutral-400">
            Water Intelligence ne publie aucune observation tant qu’une décision humaine de
            publication n’a pas été signée pour la source concernée. Les libellés ci-dessus
            décrivent l’état de l’infrastructure, pas l’état de la ressource en eau.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
