/**
 * app/water/page.tsx — Water Intelligence, surface publique autonome
 * (Water Intelligence v2).
 *
 * ## Où cette page vit
 *
 * Elle est le VOISIN du groupe `app/water/(authenticated)`, pas son enfant :
 * elle ne traverse ni son layout ni sa garde, et ne rend aucun chrome de
 * dashboard — ni sidebar, ni profil, ni score ESG, ni menu cockpit. Les deux
 * cockpits authentifiés vivent sous `/water/cockpit` et `/water/decision`, et
 * y portent un lien « Retour à Water Intelligence ».
 *
 * Aucune donnée d'entreprise n'atteint ce fichier, par construction.
 *
 * ## D'où vient ce qu'elle affiche
 *
 * De documents ÉMIS PAR LE BACKEND, jamais de constantes recopiées ici :
 *
 * - `public-snapshot-bnpe-v1.json` — le pilote publié, ou son marqueur
 *   « non généré » tant que le workflow de génération n'a pas tourné ;
 * - `source-status.json` — l'état réel des sept sources et leurs motifs ;
 * - le contrat du moteur financier, assemblé côté backend.
 *
 * Les seuls contenus rédigés ici sont ÉDITORIAUX et qualitatifs
 * (`editorial-matrices.ts`) : ils ne portent aucun chiffre, et ce fichier-là
 * explique pourquoi. Le marqueur de la carte (`MONTPELLIER_LONLAT`) est la
 * seule coordonnée écrite en dur de tout le module — un fait géographique
 * public et stable (le centre de la commune 34172, vérifié), pas une donnée
 * d'observation.
 *
 * ## Aucun appel réseau client
 *
 * Rien n'est fetché : les documents sont importés au build, et la topologie
 * cartographique (`world-atlas`) est un import de module — jamais un `fetch`
 * vers un CDN, y compris pour la carte. Aucune requête vers Hub'Eau n'est
 * émise depuis le navigateur.
 *
 * ## Ce que la v2 a retiré, et pourquoi ce n'est pas silencieux
 *
 * La maquette v2 réunit ce que la V1 présentait en deux sections séparées —
 * « Réglementation » (`WiRegulatoryRegistry`) et « Synergies Carbon&Co »
 * (`WiModuleBridges`) — dans une unique section 08 — Finance, centrée sur le
 * pont financier et son simulateur qualitatif. Les deux composants retirés
 * de CETTE page restent dans le dépôt, inchangés, avec leurs tests : rien
 * n'est supprimé, un choix éditorial de mise en page est fait. Les anciennes
 * ancres `#reglementation` et `#synergies` sont conservées comme cibles de
 * défilement — un lien externe existant vers l'une d'elles atterrit toujours
 * quelque part d'utile plutôt que nulle part.
 *
 * ## WI-V3-01 — fondation visuelle
 *
 * `WiStatusChip` centralise le rendu de l'axe Publication State
 * (`.wi-pubstate-*`), qui vivait en JSX local dans ce fichier ; le thème
 * `--wi-*` est désormais sombre par défaut sans dépendre de
 * `prefers-color-scheme` (voir `water-intelligence.css`). Voir
 * `WiPrimitives.tsx` pour la grammaire de statut à trois axes que ce chantier
 * centralise.
 *
 * ## WI-V3-02 — le hero absorbe la Provenance Rail
 *
 * `WiScopeRail`, introduit en WI-V3-01 sous le hero, est RETIRÉ : les quatre
 * Evidence Counters et le bloc « Snapshot pilote » du hero portent désormais
 * les mêmes sept faits, en meilleure place et avec la même provenance au
 * survol. Les garder tous les deux aurait affiché « 7 sources instrumentées »
 * deux fois dans le premier écran, à trente pixels d'écart — ce qui coûte
 * précisément la lisibilité que ce chantier cherche.
 *
 * Le composant et sa feuille de style sont supprimés plutôt que laissés
 * dormants : rien ne le rendait, et un composant mort se réveille toujours par
 * accident.
 *
 * ## Refonte Industry — chapitres en un écran
 *
 * La page adopte la charte de /materials et /robotics (Barlow Condensed sur
 * Barlow, fond acier clair, accent bleu acier, filets 1px, angles vifs) et se
 * découpe en NEUF chapitres qui tiennent chacun dans un écran : un rail de
 * progression et des liens Précédent / Suivant remplacent le défilement sans
 * fin. Les contenus secondaires d'un chapitre passent en onglets : ils restent
 * rendus côté serveur (panneau `hidden`, pas absent), et une ancre qui les vise
 * ouvre leur onglet. Toutes les ancres historiques sont conservées.
 *
 * Nouveautés de contenu, toutes lues dans des documents versionnés :
 * - la boussole des huit facettes (`PULSE_FACETS`) ;
 * - le chapitre « Repères France » et les cas Montpellier
 *   (`context-candidates.json`, filtré par `publishableContextFacts()` : revue
 *   signée et valeurs relues dans leur source primaire, seulement) ;
 * - la coupe du cycle de l'eau, qui remplace le bloc 3D et relie chaque étape
 *   à l'état réel de sa source (`source-status.json`) ;
 * - le bilan du parcours avec le guide NEURAL de l'accueil.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { industryFontVars } from "@/components/materials/industry/fonts";
import { WiChapter, type WiChapterLink } from "@/components/water-intelligence/WiChapter";
import { WiCompass } from "@/components/water-intelligence/WiCompass";
import { WiConstellation } from "@/components/water-intelligence/WiConstellation";
import { WiCycle, type WiCycleSource } from "@/components/water-intelligence/WiCycle";
import { WiFinancialEngineContract } from "@/components/water-intelligence/WiFinancialEngine";
import { WiHero } from "@/components/water-intelligence/WiHero";
import {
  WiInnovations,
  WiSectors,
  WiTerritory,
  WiTimeline,
} from "@/components/water-intelligence/WiMatrices";
import { WiNav, type WiNavItem } from "@/components/water-intelligence/WiNav";
import { WiPilotData } from "@/components/water-intelligence/WiPilotData";
import { WiSection } from "@/components/water-intelligence/WiPrimitives";
import {
  WiFinancialBridge,
  WiFinancialSimulator,
  WiProofTable,
} from "@/components/water-intelligence/WiProof";
import { WiQuiz } from "@/components/water-intelligence/WiQuiz";
import { WiReperes } from "@/components/water-intelligence/WiReperes";
import { WiTabs } from "@/components/water-intelligence/WiTabs";
import {
  IntelligenceThemeProvider,
  IntelligenceThemeToggle,
} from "@/components/intelligence/IntelligenceThemeProvider";
import { basinJoin } from "@/lib/water-intelligence/basin-atlas";
import { SOURCE_STATUS, orderedSources } from "@/lib/water-intelligence/canonical-snapshot";
import {
  CONTEXT_CANDIDATES,
  publishableContextFacts,
  publishableLocalCases,
} from "@/lib/water-intelligence/context-candidates";
import {
  PILOT_FILE,
  pilotCoverageWarnings,
  pilotIsPublished,
  pilotObservations,
  pilotScope,
} from "@/lib/water-intelligence/pilot-snapshot";

import "./water-intelligence.css";

export const metadata: Metadata = {
  title: "Water Intelligence — dépendance à l'eau et résilience | Carbon&Co",
  description:
    "Comprendre où l'entreprise dépend de l'eau, où la ressource est sous contrainte et quelles décisions de résilience prendre. Première publication pilote vérifiée, sur un périmètre communal et annuel explicitement limité.",
  alternates: { canonical: "/water" },
  openGraph: {
    title: "Water Intelligence — Carbon&Co",
    description:
      "Dépendance à l'eau, contrainte sur la ressource, décisions de résilience. Chaque valeur porte sa source, sa période et son checksum.",
    type: "website",
    url: "/water",
  },
};

/**
 * Chapitres — l'ordre de lecture. Les ancres historiques restent toutes des
 * cibles : `risques`, `carte`, `sources`, `secteurs`, `finance`, `limites`
 * sont des chapitres ; `pilote`, `preuves`, `evenements`, `innovations`,
 * `reglementation` et `synergies` vivent DANS un chapitre (un lien qui les vise
 * ouvre l'onglet qui les porte).
 */
const CHAPTERS = [
  { id: "vue-ensemble", label: "Vue d'ensemble" },
  { id: "risques", label: "Risques" },
  { id: "reperes", label: "Repères France" },
  { id: "carte", label: "Territoire" },
  { id: "cycle", label: "Cycle" },
  { id: "sources", label: "Sources" },
  { id: "secteurs", label: "Secteurs" },
  { id: "finance", label: "Finance" },
  { id: "limites", label: "Bilan" },
] as const;

const NAV_ITEMS: readonly WiNavItem[] = CHAPTERS.map((c) => ({ id: c.id, label: c.label }));

function rail(id: (typeof CHAPTERS)[number]["id"]): {
  index: number;
  total: number;
  prev: WiChapterLink | null;
  next: WiChapterLink | null;
} {
  const at = CHAPTERS.findIndex((c) => c.id === id);
  return {
    index: at + 1,
    total: CHAPTERS.length,
    prev: at > 0 ? CHAPTERS[at - 1] : null,
    next: at < CHAPTERS.length - 1 ? CHAPTERS[at + 1] : null,
  };
}

/**
 * Centre de la commune 34172 (Montpellier) — un fait géographique public et
 * stable, pas une observation. Précision suffisante pour un marqueur sur une
 * silhouette de la France ; ce n'est pas une donnée de mesure.
 */
const MONTPELLIER_LONLAT: readonly [number, number] = [3.8772, 43.6119];

export default function WaterIntelligencePage() {
  /* La garde est appliquée EN LIGNE : `pilotIsPublished` est un prédicat de
     type, et TypeScript ne rétrécit `PILOT_FILE` que là où il est invoqué. Un
     booléen intermédiaire ferait perdre le rétrécissement, et l'accès au bloc
     `pilot` ne compilerait pas — ce qui est précisément le comportement
     voulu : le document non généré n'a pas de bloc `pilot`, et rien ne doit
     pouvoir le lire comme s'il en avait un. */
  const pilotDocument = pilotIsPublished(PILOT_FILE) ? PILOT_FILE : null;
  const published = pilotDocument !== null;
  const pilot = pilotDocument?.pilot ?? null;

  const observations = pilotObservations(PILOT_FILE);
  const scope = pilotScope(PILOT_FILE);
  /* Jointure bassin : DÉRIVÉE du document, jamais affirmée dans le JSX. Voir
     `lib/water-intelligence/basin-atlas.ts` — elle exige deux faits canoniques
     dont aucun n'est vrai aujourd'hui. */
  const join = basinJoin(PILOT_FILE);
  const warnings = pilotCoverageWarnings(PILOT_FILE);
  const sources = orderedSources(SOURCE_STATUS);
  const scopeLabel = `commune ${scope.geographyCode}, année ${scope.periodStart.slice(0, 4)}`;
  const yearLabel = scope.periodStart.slice(0, 4);
  const licenseLabel = pilot
    ? `${pilot.license_code} — portée ${pilot.license_scope}`
    : "ETALAB-2.0 — portée platform";
  const methodLabel = observations[0]
    ? `${observations[0].methodCode} · ${observations[0].methodVersion}`
    : "n.c.";
  const snapshotDate = pilotDocument ? pilotDocument.generated_at.slice(0, 10) : null;

  /* Repères de contexte : seulement ce que la revue laisse passer. */
  const contextFacts = publishableContextFacts();
  /* Chaque cas local passe par SA vérification, pas par celle des repères. */
  const local = publishableLocalCases();
  const cycleSources: WiCycleSource[] = SOURCE_STATUS.sources.map((source) => ({
    code: source.source_code,
    label: source.label,
    stateLabel: source.state_label,
    publishable: source.state === "publishable",
  }));

  return (
    <IntelligenceThemeProvider scope="wi" defaultTheme="clair" style={industryFontVars}>
      <a href="#contenu" className="wi-skip">
        Aller au contenu principal
      </a>

      <WiNav
        items={NAV_ITEMS}
        brand={
          <>
            <span className="wi-nav-mark">Carbon&amp;Co</span>
            <span className="wi-nav-module">Eau &amp; résilience</span>
          </>
        }
        aside={
          <>
            <span className="wi-nav-snapshot">
              {snapshotDate ? `Snapshot ${snapshotDate.split("-").reverse().join(".")}` : "Snapshot non généré"}
            </span>
            <IntelligenceThemeToggle className="wi-btn wi-nav-theme" />
          </>
        }
      />

      <main id="contenu" className="wi-shell wi-chapters">
        {/* ------------------------------------------- 01 — Vue d'ensemble */}
        <WiChapter id="vue-ensemble" bare {...rail("vue-ensemble")}>
          <WiHero
            observationCount={observations.length}
            isPublished={published}
            snapshotDate={snapshotDate}
            scopeLabel={scopeLabel}
            territoryCode={scope.geographyCode}
            periodLabel={yearLabel}
            reviewedOn={scope.reviewedOn}
            sourceCode={scope.sourceCode}
            sourceCount={SOURCE_STATUS.source_count}
            publishableCount={SOURCE_STATUS.publishable_count}
          />
        </WiChapter>

        {/* ------------------------------------------------- 02 — Risques */}
        <WiChapter
          id="risques"
          kicker="Water Pulse"
          title="Huit questions sur l'eau. Une seule déjà prouvée."
          lead={
            <p className="wi-muted">
              «&nbsp;Risque hydrique&nbsp;» recouvre des réalités qui n&apos;ont ni les
              mêmes causes, ni les mêmes échelles de temps, ni les mêmes réponses. Le
              module les tient séparées et ne produit aucun indice composite&nbsp;: chaque
              facette reste lisible, comparable et contestable seule.
            </p>
          }
          {...rail("risques")}
        >
          <WiCompass />
        </WiChapter>

        {/* ------------------------------------------ 03 — Repères France */}
        <WiChapter
          id="reperes"
          kicker="Repères France"
          title="Moins d'eau prélevée. Moins d'eau disponible."
          lead={
            <>
              <p className="wi-muted">
                Le contexte national avant le zoom sur la commune pilote. Seules les
                valeurs relues dans leur source primaire sont affichées, chacune avec sa
                source et sa période.
              </p>
              <p className="wi-tag wi-hatched">Contexte national — hors pilote</p>
            </>
          }
          {...rail("reperes")}
        >
          {contextFacts.length > 0 ? (
            <WiReperes
              facts={contextFacts}
              restrictions={
                local.restrictions
                  ? {
                      years: local.restrictions.years,
                      sourceName: local.restrictions.source.name,
                      sourceUrl: local.restrictions.source.url,
                      caveat: local.restrictions.caveat,
                    }
                  : null
              }
              pfas={
                local.pfas
                  ? {
                      analyses: local.pfas.analyses,
                      limit: local.pfas.quality_limit,
                      unit: local.pfas.unit,
                      parameterLabel: local.pfas.parameter.label,
                      sourceName: local.pfas.source.name,
                      sourceUrl: local.pfas.source.url,
                      caveat: local.pfas.caveat,
                    }
                  : null
              }
              scale={CONTEXT_CANDIDATES.restriction_scale}
            />
          ) : (
            <p className="wi-muted">
              Aucun repère de contexte n&apos;a encore passé la revue : rien n&apos;est
              affiché tant qu&apos;une revue signée ne l&apos;autorise.
            </p>
          )}
        </WiChapter>

        {/* ------------------------------------------------ 04 — Territoire */}
        <WiChapter
          id="carte"
          kicker="Territoire"
          title="Un point vérifié. Pas une couverture."
          lead={
            <p className="wi-muted">
              Les couches géographiques complètes restent différées. Un unique point
              vérifié est désormais montré — la commune du périmètre signé, rien de
              plus — et la section dit toujours ce qui manque pour aller plus loin.
            </p>
          }
          {...rail("carte")}
        >
          <div className="wi-chapter-split">
            <div className="wi-chapter-split-main">
              <WiTerritory
                geographyType={scope.geographyType}
                geographyCode={scope.geographyCode}
                periodLabel={scope.periodStart.slice(0, 4)}
                ouvrageCount={observations.length}
                isPublished={published}
                markerLonLat={published ? MONTPELLIER_LONLAT : null}
                join={join}
                sourceCode={scope.sourceCode}
                reviewedOn={scope.reviewedOn}
              />
            </div>
            <div className="wi-chapter-split-side">
              <WiSection id="pilote" kicker="Données pilotes" title="Ce qui est effectivement publié">
                <p className="wi-muted">
                  Valeurs indépendantes — aucune agrégation, moyenne ou hiérarchie
                  n&apos;est calculée.{" "}
                  {published
                    ? `${observations.length} observation${observations.length > 1 ? "s" : ""}, dans l'ordre du document, sur le périmètre signé et rien d'autre.`
                    : "Aucune observation publiée à ce jour : le document pilote n'a pas encore été généré."}
                </p>
                <div style={{ marginTop: "1rem" }}>
                  <WiPilotData
                    observations={observations}
                    coverageWarnings={warnings}
                    scopeLabel={scopeLabel}
                    attribution={pilot?.attribution ?? null}
                    sourceUrl={pilot?.source_information_url ?? null}
                    isPublished={published}
                    reviewedOn={scope.reviewedOn}
                    sourceCode={scope.sourceCode}
                    licenseLabel={licenseLabel}
                    methodLabel={methodLabel}
                    yearLabel={yearLabel}
                    notGeneratedExplanation="Le document canonique est produit par un workflow de génération : il réacquiert le périmètre signé, vérifie le checksum, le nombre d'observations, la pagination exhaustive et le budget, puis écrit le document et son miroir. Tant qu'il n'a pas été déclenché, aucune observation n'est publiée."
                  />
                </div>
              </WiSection>
            </div>
          </div>
        </WiChapter>

        {/* ----------------------------------------------------- 05 — Cycle */}
        <WiChapter
          id="cycle"
          kicker="Cycle et bassin"
          title="De la pluie au forage. Ce que chaque source mesure."
          lead={
            <p className="wi-muted">
              Six étapes, six questions, six sources possibles. Suivez la goutte : à
              chaque étape, la page dit quelle source officielle la mesure — et si sa
              valeur est publiable aujourd&apos;hui.
            </p>
          }
          {...rail("cycle")}
        >
          <WiCycle sources={cycleSources} facts={contextFacts} />
        </WiChapter>

        {/* --------------------------------------------------- 06 — Sources */}
        <WiChapter
          id="sources"
          kicker="Provenance"
          title="Sept sources. Une seule franchit la décision humaine."
          lead={
            <p className="wi-muted">
              Sept sources officielles instrumentées, sept licences vérifiées, une seule
              publication autorisée. Chacune ouvre son état réel&nbsp;: son rôle, sa
              couverture, sa méthode, ce qui la bloque et la prochaine action.
            </p>
          }
          {...rail("sources")}
        >
          <WiTabs
            label="Sources et preuves"
            tabs={[
              { id: "constellation", label: "Constellation des sources", content: <WiConstellation sources={sources} /> },
              {
                id: "preuves",
                label: "Chaque valeur porte sa preuve",
                content: (
                  <div id="preuves">
                    <p className="wi-muted" style={{ maxWidth: "62ch", marginBottom: "1rem" }}>
                      Ce qu&apos;il faut pouvoir emporter pour vérifier par soi-même. Les
                      références techniques sont copiables&nbsp;: une empreinte de 64
                      caractères ne se recopie pas à la main sans erreur, et rendre la
                      vérification pénible revient à la décourager.
                    </p>
                    <WiProofTable
                      fields={[
                        { label: "Source", value: scope.sourceCode, mono: true, copyable: true },
                        {
                          label: "Clé de release",
                          value: pilot?.release_key ?? null,
                          mono: true,
                          copyable: Boolean(pilot),
                          note: pilot ? undefined : "Attribuée à la génération du document.",
                        },
                        {
                          label: "Checksum du payload source",
                          value: pilot?.payload_sha256 ?? null,
                          mono: true,
                          copyable: Boolean(pilot),
                          note: "Empreinte SHA-256 des octets reçus de la source, approuvée avant publication.",
                        },
                        {
                          label: "URL officielle",
                          value: pilot?.source_information_url ?? null,
                          href: pilot?.source_information_url,
                          mono: true,
                          copyable: Boolean(pilot),
                        },
                        {
                          label: "Licence",
                          value: licenseLabel,
                          note: "Vérifiée au niveau de la plateforme, pas jeu par jeu.",
                        },
                        { label: "Attribution", value: pilot?.attribution ?? null },
                        {
                          label: "Date de consultation",
                          value: pilot?.retrieved_at ?? null,
                          note: "Le jour où la source a été interrogée — pas le jour où elle a changé.",
                        },
                        {
                          label: "Dernière mise à jour de la source",
                          value: pilot?.source_last_updated_on ?? null,
                          note: "Non relevée. La condition de paternité de la Licence Ouverte 2.0 est satisfaite par la voie de l'URL officielle, retenue explicitement par le signataire. Le relevé direct reste dû.",
                        },
                        {
                          label: "Période observée",
                          value: pilot
                            ? `${pilot.observed_period_start} → ${pilot.observed_period_end}`
                            : `${scope.periodStart} → ${scope.periodEnd}`,
                        },
                        {
                          label: "Cadence de rafraîchissement",
                          value: pilot?.source_refresh_cadence ?? null,
                          note: "Non vérifiée. Aucune cadence n'est affichée tant qu'aucun relevé direct n'a eu lieu.",
                        },
                        {
                          label: "Méthode",
                          value: observations[0] ? methodLabel : null,
                          mono: true,
                          note: "Reprise verbatim des volumes déclarés, sans conversion d'unité.",
                        },
                        {
                          label: "Statut de qualité",
                          value: observations[0]?.dataStatus ?? null,
                          mono: true,
                          note: "Une donnée déclarée par un exploitant, ni observée ni modélisée.",
                        },
                        {
                          label: "Décision de publication",
                          value: `approuvée le ${scope.reviewedOn} par ${scope.reviewedBy}`,
                          note: "Périmètre signé : une commune, une année. Aucun usage dérivé n'est autorisé — ni total, ni moyenne, ni classement, ni score.",
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        </WiChapter>

        {/* -------------------------------------------------- 07 — Secteurs */}
        <WiChapter
          id="secteurs"
          kicker="Exposition"
          title="Où l'eau pèse, et ce qui s'y adapte."
          lead={
            <p className="wi-muted">
              Où l&apos;eau est-elle une contrainte de procédé, et où est-elle un risque
              d&apos;approvisionnement&nbsp;? La matrice décrit la <strong>nature</strong>{" "}
              d&apos;une dépendance, qui se vérifie par lecture — pas son ampleur, qui se
              mesure sur site.
            </p>
          }
          {...rail("secteurs")}
        >
          <WiTabs
            label="Secteurs, événements et adaptation"
            tabs={[
              { id: "matrice", label: "Secteurs et dépendances", content: <WiSectors /> },
              {
                id: "evenements",
                label: "Climat et événements",
                content: (
                  <div id="evenements">
                    <p className="wi-muted" style={{ maxWidth: "62ch", marginBottom: "1rem" }}>
                      Sécheresses, restrictions, inondations, pollutions, tensions sur
                      nappes et interruptions opérationnelles. Un événement est rapporté
                      avec sa source, jamais expliqué par cette page.
                    </p>
                    <WiTimeline />
                  </div>
                ),
              },
              {
                id: "innovations",
                label: "Innovations et adaptation",
                content: (
                  <div id="innovations">
                    <p className="wi-muted" style={{ maxWidth: "62ch", marginBottom: "1rem" }}>
                      Chaque famille porte sa contrepartie au même niveau que son
                      bénéfice&nbsp;: énergie, carbone, coût, maturité. Une solution
                      présentée par son seul gain hydrique est une promesse, pas une option.
                    </p>
                    <WiInnovations />
                  </div>
                ),
              },
            ]}
          />
        </WiChapter>

        {/* --------------------------------------------------- 08 — Finance */}
        <WiChapter
          id="finance"
          kicker="Finance"
          title="Financial Water Bridge"
          lead={
            <p className="wi-muted">
              Dix étapes, d&apos;une interruption d&apos;usage à un signal comptable.
              Chacune est une <strong>question à instruire</strong>, jamais un calcul — le
              moteur de scénarios vit côté authentifié et exige des hypothèses explicites.
            </p>
          }
          {...rail("finance")}
        >
          {/* Cibles de défilement historiques — invisibles, sans contenu propre :
              elles existent pour qu'un ancien lien externe atterrisse ici. */}
          <span id="reglementation" aria-hidden="true" />
          <span id="synergies" aria-hidden="true" />
          <WiTabs
            label="Passerelle financière"
            tabs={[
              { id: "passerelle", label: "La passerelle", content: <WiFinancialBridge /> },
              { id: "correcteurs", label: "Les correcteurs", content: <WiFinancialSimulator /> },
              { id: "moteur", label: "Le moteur authentifié", content: <WiFinancialEngineContract /> },
            ]}
          />
          <p className="wi-muted wi-chapter-note">
            Cette section réunit ce que la V1 présentait séparément sous « Réglementation »
            et « Synergies Carbon&amp;Co »&nbsp;: le registre juridique et les ponts vers
            les autres modules restent dans le code, avec leurs tests, mais ne sont pour
            l&apos;instant rendus sur aucune route.
          </p>
        </WiChapter>

        {/* ------------------------------------------------- 09 — Limites */}
        <WiChapter
          id="limites"
          kicker="Honnêteté"
          title="Limites et prochaines étapes"
          lead={
            <p className="wi-muted">
              L&apos;état réel de ce module, sans arrondi favorable. Aucune de ces étapes
              n&apos;est technique&nbsp;: ce sont des décisions et des démarches humaines.
            </p>
          }
          {...rail("limites")}
        >
          <WiTabs
            label="Bilan et limites"
            tabs={[
              {
                id: "bilan",
                label: "Bilan du parcours",
                content: (
                  <WiQuiz restitution={contextFacts.find((fact) => fact.id === "restitution-2023")} />
                ),
              },
              {
                id: "reste-du",
                label: "Ce qui reste dû",
                content: (
                  <>
                    <h3 className="wi-h3">Ce qui reste dû</h3>
                  <div className="wi-limits-grid" style={{ marginTop: "1rem" }}>
                    <div className="wi-limits-card wi-frame">
                      <p className="wi-kicker" style={{ margin: 0 }}>
                        Provenance
                      </p>
                      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
                        Le relevé direct de la date de dernière mise à jour de chaque source. Il
                        reste <strong>bloquant</strong> pour la piézométrie et la qualité,
                        qu&apos;aucune signature ne couvre.
                      </p>
                    </div>
                    <div className="wi-limits-card wi-frame">
                      <p className="wi-kicker" style={{ margin: 0 }}>
                        Cartographie
                      </p>
                      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
                        Les couches géographiques validées, sans lesquelles aucune carte de
                        couverture ne monte — seul un point reste montré aujourd&apos;hui.
                      </p>
                    </div>
                    <div className="wi-limits-card wi-frame">
                      <p className="wi-kicker" style={{ margin: 0 }}>
                        Réglementation
                      </p>
                      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
                        Un réviseur juridique, sans lequel chaque règle du registre reste{" "}
                        <span className="wi-mono">unknown</span>.
                      </p>
                    </div>
                    <div className="wi-limits-card wi-frame">
                      <p className="wi-kicker" style={{ margin: 0 }}>
                        Sources mondiales
                      </p>
                      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
                        L&apos;enregistrement exigé par WRI, et l&apos;arbitrage sur le décodage
                        raster Copernicus. Deux démarches humaines, pas des réglages.
                      </p>
                    </div>
                  </div>
                  </>
                ),
              },
            ]}
          />
        </WiChapter>
      </main>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="wi-footer">
        <div className="wi-shell" style={{ paddingTop: "2rem", paddingBottom: "2.5rem" }}>
          <p className="wi-footer-title">Water Intelligence — Carbon&amp;Co</p>
          <p className="wi-muted" style={{ marginTop: "0.75rem", maxWidth: "62ch", fontSize: "0.9375rem" }}>
            Publication pilote sur un périmètre limité. Les six autres sources restent non
            publiées, chacune pour un motif nommé — aucune n&apos;attend un correctif
            technique.
          </p>
          <p className="wi-muted" style={{ marginTop: "0.875rem", fontSize: "0.875rem" }}>
            <Link href="/water/cockpit" className="wi-link">
              Cockpit Eau (authentifié)
            </Link>
            {" · "}
            <Link href="/materials" className="wi-link">
              Métaux critiques
            </Link>
            {" · "}
            <Link href="/robotics" className="wi-link">
              Robotique &amp; IA physique
            </Link>
            {" · "}
            <Link href="/" className="wi-link">
              Accueil Carbon&amp;Co
            </Link>
          </p>
        </div>
      </footer>
    </IntelligenceThemeProvider>
  );
}
