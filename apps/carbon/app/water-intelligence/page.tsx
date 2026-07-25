/**
 * app/water-intelligence/page.tsx — shell public du module Water Intelligence (P04).
 *
 * Route PUBLIQUE, hors du groupe authentifié `(app)` : elle ne partage ni le
 * layout, ni la garde d'authentification du cockpit. Le cockpit entreprise
 * reste `app/(app)/water/page.tsx` (URL `/water`), inchangé — les deux URL
 * sont distinctes et aucune ne masque l'autre.
 *
 * Server Component intégral : aucun `"use client"`, aucun hook, aucun
 * `useSearchParams`, donc aucun bailout CSR. Le seul JavaScript embarqué est
 * celui du framework.
 *
 * Aucune donnée réelle : la seule source affichée est le mini manifest de
 * fixture P02, marqué « Démonstration » partout où il apparaît.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { WiEditorialEmpty } from "@/components/water-intelligence/WiEditorial";
import {
  WiExclusionList,
  WiFinancialBridgePreview,
  WiWaterPulse,
} from "@/components/water-intelligence/WiFoundations";
import { WiModuleBridges } from "@/components/water-intelligence/WiBridges";
import { WiMapFrame } from "@/components/water-intelligence/WiMapFrame";
import { WiNav, type WiNavItem } from "@/components/water-intelligence/WiNav";
import { WiRegulatoryRegistry } from "@/components/water-intelligence/WiRegulatory";
import { WiSnapshotBanner } from "@/components/water-intelligence/WiSnapshotBanner";
import {
  WiAbsentValue,
  WiBadge,
  WiCard,
  WiPendingValue,
  WiPlaceholder,
  WiSection,
} from "@/components/water-intelligence/WiPrimitives";
import { FIXTURE_MANIFEST } from "@/lib/water-intelligence/fixture-manifest";
import { PUBLISHED_EDITORIAL_RECORDS } from "@/lib/water-intelligence/editorial";
import { EMPTY_SNAPSHOT } from "@/lib/water-intelligence/public-snapshot";

import "./water-intelligence.css";

export const metadata: Metadata = {
  title: "Water Intelligence — contexte hydrique sourcé | Carbon&Co",
  description:
    "Module public de contexte hydrique de Carbon&Co : méthode, sources officielles et provenance. Module en construction — aucune donnée réelle publiée à ce stade.",
  alternates: { canonical: "/water-intelligence" },
  openGraph: {
    title: "Water Intelligence — Carbon&Co",
    description:
      "Comprendre le risque hydrique à partir de sources officielles traçables. Module en construction : aucune donnée réelle publiée à ce stade.",
    type: "website",
    url: "/water-intelligence",
  },
};

/**
 * Les huit ancres historiques sont GELÉES : elles existent déjà en production
 * publique et Wave C ne les renomme, ne les réordonne ni n'en supprime aucune.
 * `#evenements` et `#innovations` sont ajoutées entre `#secteurs` et
 * `#reglementation` — ajouter une ancre ne casse aucun lien existant.
 */
const NAV_ITEMS: readonly WiNavItem[] = [
  { id: "vue-ensemble", label: "Vue d'ensemble" },
  { id: "risques", label: "Comprendre les risques" },
  { id: "carte", label: "Carte et territoires" },
  { id: "sources", label: "Sources et preuves" },
  { id: "secteurs", label: "Secteurs et dépendances" },
  { id: "evenements", label: "Climat et événements" },
  { id: "innovations", label: "Innovations et adaptation" },
  { id: "reglementation", label: "Réglementation" },
  { id: "synergies", label: "Synergies Carbon&Co" },
  { id: "limites", label: "Limites et suite" },
];

/**
 * Les neuf dimensions restent SÉPARÉES : le module ne produit aucun score
 * hydrique composite unique. Chacune porte sa propre couleur ET son propre
 * libellé — la couleur ne code jamais seule la nature de la dimension.
 */
const DIMENSIONS: readonly { label: string; accent: "water" | "data" | "stress" | "compliance" | "adapt"; body: string }[] = [
  {
    label: "Stress structurel",
    accent: "water",
    body: "Tension durable entre les prélèvements et la ressource disponible sur un bassin.",
  },
  {
    label: "Sécheresse",
    accent: "stress",
    body: "Situation conjoncturelle observée sur une période donnée, distincte du stress structurel.",
  },
  {
    label: "Inondation",
    accent: "water",
    body: "Aléa d'excès d'eau, sans rapport de causalité avec la rareté — jamais fusionné avec elle.",
  },
  {
    label: "Eaux souterraines",
    accent: "water",
    body: "État des nappes, suivi par des points de mesure officiels et leurs codes.",
  },
  {
    label: "Qualité et pollution",
    accent: "data",
    body: "Paramètres physico-chimiques, avec unités et limites de quantification conservées.",
  },
  {
    label: "Dépendance opérationnelle",
    accent: "adapt",
    body: "Intensité du besoin en eau d'une activité, indépendamment de l'état de la ressource.",
  },
  {
    label: "Sensibilité réglementaire",
    accent: "compliance",
    body: "Exposition aux obligations applicables, selon la juridiction et la période.",
  },
  {
    label: "Capacité d'adaptation",
    accent: "adapt",
    body: "Marges de manœuvre techniques et organisationnelles documentées.",
  },
  {
    label: "Confiance documentaire",
    accent: "data",
    body: "Solidité de la preuve derrière une valeur — jamais confondue avec le niveau de risque.",
  },
];

export default function WaterIntelligencePage() {
  const manifest = FIXTURE_MANIFEST;
  const demoObservation = manifest.observations[0];

  /*
    Snapshot public réel (P10). Il est VIDE : le gate licence exige une
    décision humaine explicite et revue par source, et aucune n'est active.
    Cet état est valide — il porte les exclusions et leurs motifs, qui sont de
    l'information réelle et vérifiable même quand zéro valeur est publiée.
  */
  const snapshot = EMPTY_SNAPSHOT;
  const editorialRecords = PUBLISHED_EDITORIAL_RECORDS;

  return (
    <div data-wi>
      <a href="#contenu" className="wi-skip">
        Aller au contenu principal
      </a>

      <WiNav items={NAV_ITEMS} />

      <main id="contenu" className="wi-shell">
        {/* ------------------------------------------------------------ Hero */}
        <header style={{ paddingTop: "3.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <WiBadge tone="demo" label="Module en construction" />
            <WiBadge tone="pending" label="Sources non branchées" />
          </div>

          <h1 className="wi-h1" style={{ marginTop: "1rem" }}>
            Water Intelligence
          </h1>

          <p className="wi-lede" style={{ marginTop: "1rem" }}>
            Le contexte hydrique — mondial, européen et français — reconstitué à partir de sources
            officielles, avec leur provenance, leur licence et leurs limites affichées. Cette page
            est la surface publique du module. Elle est aujourd&apos;hui un <strong>squelette</strong>{" "}
            : la structure et les garde-fous sont en place, les données ne le sont pas encore.
          </p>

          <p className="wi-muted" style={{ marginTop: "1rem", maxWidth: "60ch" }}>
            Vous cherchez le suivi hydrique de votre entreprise (sites, prélèvements, permis,
            screening) ?{" "}
            <Link href="/water" className="wi-link">
              Accéder au cockpit Eau &amp; stress hydrique (accès authentifié)
            </Link>
            .
          </p>

          <WiSnapshotBanner manifest={manifest} />

          {/*
            Water Pulse — état des COUCHES PUBLIÉES, jamais de l'état de l'eau.
            N'agrège aucune dimension et ne produit aucun score : il compte ce
            qui est publié et ce qui est écarté, rien d'autre.
          */}
          <div style={{ marginTop: "1.25rem" }}>
            <WiWaterPulse snapshot={snapshot} />
          </div>
        </header>

        {/* --------------------------------------------------- Vue d'ensemble */}
        <WiSection id="vue-ensemble" kicker="01 — Proposition" title="Vue d'ensemble">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Les données publiques sur l&apos;eau existent, mais elles sont dispersées entre des
            portails aux formats, aux échelles et aux licences hétérogènes. Ce module a un objectif
            précis&nbsp;: rassembler ce contexte sans jamais faire perdre de vue d&apos;où vient
            chaque chiffre.
          </p>

          <div className="wi-grid wi-grid-3" style={{ marginTop: "1.25rem" }}>
            <WiCard title="Chaque valeur porte sa preuve" accent="data">
              Source, release, empreinte, période observée, méthode et licence accompagnent toute
              valeur publiée. Une valeur sans provenance complète n&apos;est pas publiable.
            </WiCard>
            <WiCard title="Risque et confiance restent séparés" accent="water">
              Un risque élevé mesuré sur une source fragile n&apos;est pas la même chose qu&apos;un
              risque élevé bien documenté. Les deux grandeurs ne sont jamais fusionnées.
            </WiCard>
            <WiCard title="Aucun score unique opaque" accent="adapt">
              Le module ne produit pas d&apos;indice hydrique agrégé. Chaque dimension reste
              lisible, comparable et contestable séparément.
            </WiCard>
          </div>

          <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch" }}>
            Une donnée manquante est affichée comme manquante, jamais comme un zéro&nbsp;; une zone
            sans correspondance connue n&apos;est pas un risque faible. Ces règles sont celles déjà
            appliquées par le cockpit authentifié.
          </p>
        </WiSection>

        {/* --------------------------------------------- Comprendre les risques */}
        <WiSection
          id="risques"
          kicker="02 — Méthode"
          title="Comprendre les risques hydriques"
        >
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            « Risque hydrique » recouvre des réalités qui n&apos;ont ni les mêmes causes, ni les
            mêmes échelles de temps, ni les mêmes réponses. Les confondre dans un chiffre unique
            fait perdre l&apos;information utile. Le module les tient séparées.
          </p>

          <ul
            className="wi-grid wi-grid-3"
            style={{ marginTop: "1.25rem", listStyle: "none", padding: 0 }}
          >
            {DIMENSIONS.map((dimension) => (
              <li key={dimension.label}>
                <WiCard title={dimension.label} accent={dimension.accent}>
                  {dimension.body}
                </WiCard>
              </li>
            ))}
          </ul>

          <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch" }}>
            Aucune de ces dimensions n&apos;est encore alimentée par une source réelle. Leur
            définition est fixée d&apos;abord, précisément pour qu&apos;aucun connecteur ne vienne
            ensuite les réinterpréter à sa façon.
          </p>
        </WiSection>

        {/* -------------------------------------------------- Carte (absente) */}
        <WiSection id="carte" kicker="03 — Territoires" title="Carte et territoires">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            La cartographie multi-échelle (monde, Europe, France) est prévue, avec une table
            alternative accessible offrant strictement la même information que la carte.
          </p>

          {/*
            L'explorateur est livré (P11) mais ne monte la carte QUE si des
            couches sont publiées. Aucune ne l'est : `WiMapFrame` rend alors
            l'état « aucune couche publiée » plutôt qu'un fond de carte, qui
            laisserait croire à une couverture nulle au lieu d'une absence de
            publication.
          */}
          <div style={{ marginTop: "1.25rem" }}>
            <WiMapFrame
              snapshot={snapshot}
              tableColumns={[
                { key: "territoire", header: "Territoire" },
                { key: "valeur", header: "Valeur", numeric: true },
                { key: "periode", header: "Période" },
                { key: "statut", header: "Statut" },
                { key: "couverture", header: "Couverture", numeric: true },
                { key: "source", header: "Source" },
              ]}
              tableRows={[]}
            />
          </div>

          <p className="wi-muted" style={{ marginTop: "1.25rem", fontSize: "0.875rem", maxWidth: "62ch" }}>
            Trois échelles sont prévues, chacune avec ses identifiants officiels&nbsp;: monde
            (géométries très simplifiées), Europe (districts et sous-unités), France (bassins et
            sous-bassins). La localisation précise d&apos;un site d&apos;entreprise reste
            réservée au cockpit authentifié et n&apos;apparaîtra jamais ici.
          </p>
        </WiSection>

        {/* ------------------------------------------------- Sources et preuves */}
        <WiSection id="sources" kicker="04 — Provenance" title="Sources et preuves">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Le catalogue des portails candidats est versionné dans le dépôt. Aucun n&apos;est
            branché à ce stade, et aucune licence n&apos;y est vérifiée&nbsp;: toutes sont
            enregistrées comme <span className="wi-mono">unknown</span> tant qu&apos;un examen
            humain n&apos;a pas tranché. Une licence inconnue n&apos;autorise rien.
          </p>

          <div className="wi-grid wi-grid-2" style={{ marginTop: "1.25rem" }}>
            <WiCard title="Ce qui accompagne une valeur publiée" accent="data">
              Code source, clé de release, empreinte SHA-256, date de récupération, période
              observée, version de méthode, statut de donnée, licence et attribution. Sans cet
              ensemble, la valeur reste non publiable.
            </WiCard>
            <WiCard title="Ce qu'une licence restrictive implique" accent="compliance">
              Si une licence n&apos;autorise pas l&apos;affichage, la valeur est retenue côté
              serveur&nbsp;: elle ne transite pas jusqu&apos;à cette page. L&apos;absence est alors
              affichée comme telle, avec son motif.
            </WiCard>
          </div>

          {/*
            P04B — ce bloc montre la STRUCTURE d'une observation, plus aucune
            valeur : la page publique n'affiche désormais aucun chiffre issu de
            la fixture. Celle-ci reste la référence des contrats et des tests.
          */}
          <div className="wi-card wi-accent-stress" style={{ marginTop: "1.25rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <WiBadge tone="demo" label="Démonstration" />
              <h3 className="wi-h3">Exemple de rendu d&apos;une observation</h3>
            </div>

            <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
              Voici la <strong>structure</strong> d&apos;une observation publiée&nbsp;: les champs
              qui l&apos;accompagneront toujours. <strong>Aucune valeur n&apos;est affichée</strong>{" "}
              — aucune mesure réelle n&apos;existe encore, et un chiffre inventé, même étiqueté,
              serait lu comme une mesure avant d&apos;être lu comme une démonstration.
            </p>

            <dl
              className="wi-mono"
              style={{
                marginTop: "0.875rem",
                display: "grid",
                gap: "0.5rem 1.25rem",
                gridTemplateColumns: "auto 1fr",
                color: "var(--wi-muted)",
              }}
            >
              <dt>Indicateur</dt>
              <dd style={{ margin: 0 }}>{demoObservation.metric_code}</dd>

              <dt>Valeur</dt>
              <dd style={{ margin: 0 }}>
                <WiPendingValue detail="À venir avec la première release WRI Aqueduct" />
              </dd>

              <dt>Unité</dt>
              <dd style={{ margin: 0 }}>
                <WiPendingValue detail="Fixée par la source, jamais convertie en silence" />
              </dd>

              <dt>Statut</dt>
              <dd style={{ margin: 0 }}>{demoObservation.quality.data_status}</dd>

              <dt>Méthode</dt>
              <dd style={{ margin: 0 }}>
                {demoObservation.method.code} v{demoObservation.method.version}
              </dd>

              <dt>Territoire</dt>
              <dd style={{ margin: 0 }}>{demoObservation.geography.label}</dd>
            </dl>

            <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.8125rem" }}>
              Confiance et valeur sont deux champs distincts&nbsp;: la confiance affichée qualifie
              la solidité de la preuve, jamais l&apos;intensité du risque.
            </p>
          </div>

          {/*
            Sources écartées par le gate licence. Une source écartée sans
            mention donnerait une fausse impression d'exhaustivité — c'est de
            l'information réelle, pas un aveu de faiblesse.
          */}
          <div style={{ marginTop: "1.5rem" }}>
            <h3 className="wi-h3">Sources écartées</h3>
            <p className="wi-muted" style={{ marginTop: "0.375rem", maxWidth: "62ch", fontSize: "0.9375rem" }}>
              Une source n&apos;est publiable qu&apos;après une décision humaine explicite et
              revue. Identifier une licence permissive ne suffit pas&nbsp;: c&apos;est une
              condition, pas une autorisation.
            </p>
            <div style={{ marginTop: "0.75rem" }}>
              <WiExclusionList exclusions={snapshot.exclusions} />
            </div>
          </div>
        </WiSection>

        {/* ------------------------------------------------ Secteurs (absent) */}
        <WiSection id="secteurs" kicker="05 — Exposition" title="Secteurs et dépendances">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Quels secteurs dépendent le plus de l&apos;eau, à quelle étape de leur chaîne de valeur,
            et avec quelles marges d&apos;adaptation&nbsp;: ces contenus seront des enregistrements
            structurés, chacun avec ses sources et sa date de revue humaine.
          </p>

          <div style={{ marginTop: "1.25rem" }}>
            <WiPlaceholder
              what="Aucun secteur, acteur ou événement n'est présenté ici. Publier un classement sans méthode objective et sourcée reviendrait à présenter une intuition comme un fait."
              plannedIn="P12 — contenus secteurs, acteurs, événements et innovations"
            >
              <p className="wi-muted" style={{ fontSize: "0.875rem" }}>
                Les classements ne seront publiés que si une méthode objective et sourcée les
                justifie&nbsp;; sinon l&apos;écosystème sera présenté sans hiérarchie. Les
                innovations afficheront aussi leurs arbitrages (énergie, carbone, maturité), pas
                seulement leurs promesses.
              </p>
            </WiPlaceholder>
          </div>
        </WiSection>

        {/* ------------------------------------ Climat et événements (NOUVEAU) */}
        <WiSection id="evenements" kicker="06 — Observations" title="Climat et événements">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Un événement porte sa propre date, distincte de la date de publication de sa source,
            ainsi que son territoire. Aucune causalité climatique n&apos;est déduite&nbsp;: un
            événement est rapporté, jamais expliqué par cette page.
          </p>

          <div style={{ marginTop: "1.25rem" }}>
            <WiEditorialEmpty type="event" />
          </div>
        </WiSection>

        {/* ------------------------- Innovations et adaptation (NOUVEAU) */}
        <WiSection id="innovations" kicker="07 — Adaptation" title="Innovations et adaptation">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Chaque innovation affichera sa maturité, ses arbitrages (énergie, carbone, coût) et ses
            limites au même niveau que son bénéfice&nbsp;: jamais un gain net sans contrepartie, et
            aucun volume d&apos;eau économisé sans source.
          </p>

          <div style={{ marginTop: "1.25rem" }}>
            <WiEditorialEmpty type="innovation" />
          </div>
        </WiSection>

        {/* ------------------------------------------ Réglementation (absent) */}
        <WiSection
          id="reglementation"
          kicker="08 — Conformité"
          title="Réglementation et reporting"
        >
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Le registre juridique distingue les statuts réellement différents — en vigueur, adopté
            mais non applicable, en attente de transposition, dépendant de la matérialité,
            volontaire, hors périmètre, ou inconnu — plutôt que de réduire une règle à
            «&nbsp;obligatoire&nbsp;». Il distingue aussi le droit contraignant des référentiels
            volontaires, qui n&apos;obligent personne.
          </p>

          {/* P13 (Wave D) : registre RÉEL, plus un aperçu. Il ne conclut rien
              tant qu'aucun texte n'est instruit — c'est l'état correct. */}
          <div style={{ marginTop: "1.25rem" }}>
            <WiRegulatoryRegistry />
          </div>
        </WiSection>

        {/* --------------------------------------------------------- Synergies */}
        <WiSection id="synergies" kicker="09 — Articulation" title="Synergies Carbon&amp;Co">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Cette page publique explique le contexte. Le travail sur vos propres données se fait
            dans les modules authentifiés, qui restent la seule surface où apparaissent des
            informations d&apos;entreprise.
          </p>

          {/* P14 (Wave D) : les ponts viennent du registre backend, qui refuse
              toute cible paramétrée ou porteuse d'un champ tenant. */}
          <WiModuleBridges />

          {/* Aperçu non fonctionnel : aucun montant, aucune probabilité. */}
          <div style={{ marginTop: "1.25rem" }}>
            <WiFinancialBridgePreview />
          </div>
        </WiSection>

        {/* ----------------------------------------------------------- Limites */}
        <WiSection
          id="limites"
          kicker="10 — Honnêteté"
          title="Limites, données absentes et prochaines étapes"
        >
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            L&apos;état réel de ce module, sans arrondi favorable.
          </p>

          <div className="wi-grid wi-grid-2" style={{ marginTop: "1.25rem" }}>
            <WiCard title="Ce qui est en place" accent="adapt">
              La structure de la page, le vocabulaire des dimensions, les contrats de données, le
              pipeline d&apos;ingestion opérateur et ses garde-fous (licence, bornes, refus
              explicites).
            </WiCard>
            <WiCard title="Ce qui ne l'est pas" accent="absent">
              <WiAbsentValue reason="Aucun connecteur vers une source officielle n'est branché, donc aucune observation réelle n'existe encore." />
            </WiCard>
          </div>

          <div className="wi-card wi-accent-absent" style={{ marginTop: "1.25rem" }}>
            <h3 className="wi-h3">Prochaines étapes</h3>
            <ol className="wi-muted" style={{ marginTop: "0.625rem", paddingLeft: "1.25rem" }}>
              <li>
                Brancher les premiers connecteurs réels, une famille de source par livraison, avec
                vérification de licence avant toute publication (P05 à P09).
              </li>
              <li>
                Assembler un read model public compact, reproductible et mis en cache, sans jamais
                appeler une source externe au moment du rendu (P10).
              </li>
              <li>
                Ouvrir la cartographie interactive et les contenus éditoriaux et juridiques, chacun
                avec ses sources et sa revue humaine (P11 à P13).
              </li>
            </ol>
            <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
              Chaque étape passe par une revue humaine avant publication. Aucune donnée n&apos;est
              mise en ligne parce qu&apos;elle est disponible&nbsp;: elle l&apos;est parce
              qu&apos;elle est sourcée, licenciée et vérifiée.
            </p>
          </div>
        </WiSection>
      </main>

      {/* ------------------------------------------------------------- Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--wi-border)",
          background: "var(--wi-surface)",
        }}
      >
        <div
          className="wi-shell"
          style={{ paddingTop: "2rem", paddingBottom: "2.5rem" }}
        >
          <p style={{ fontWeight: 600 }}>Water Intelligence — Carbon&amp;Co</p>
          <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch", fontSize: "0.9375rem" }}>
            Module public en construction. Les valeurs affichées proviennent d&apos;un manifest de
            démonstration et ne doivent pas être utilisées comme base de décision, de reporting ou
            de conformité.
          </p>
          <p className="wi-muted" style={{ marginTop: "0.875rem", fontSize: "0.875rem" }}>
            <Link href="/water" className="wi-link">
              Cockpit Eau (authentifié)
            </Link>
            {" · "}
            <Link href="/materials" className="wi-link">
              Métaux critiques
            </Link>
            {" · "}
            <Link href="/" className="wi-link">
              Accueil Carbon&amp;Co
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
