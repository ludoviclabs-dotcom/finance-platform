/**
 * app/water/page.tsx — vitrine PUBLIQUE du domaine hydrique (P04, réalignée en
 * Wave E, promue sur `/water` par la refonte des routes — Phase A).
 *
 * ## Où cette page vit, et pourquoi elle a changé d'URL
 *
 * Elle répondait sur `/water-intelligence` pendant que `/water` servait le
 * cockpit d'entreprise : l'URL la plus courte et la plus mémorisable du
 * domaine était réservée à une page que seuls les clients authentifiés
 * pouvaient voir, et la surface publique portait un nom de projet interne.
 *
 * `/water` est désormais cette vitrine, `/water-intelligence` y redirige
 * définitivement (`next.config.ts`), et les deux cockpits sont descendus d'un
 * cran sous `/water/cockpit` et `/water/decision`.
 *
 * Cette page reste hors du groupe authentifié : elle est le VOISIN du groupe
 * `app/water/(authenticated)`, pas son enfant, et ne traverse donc ni son
 * layout ni sa garde. Aucune donnée d'entreprise n'atteint ce fichier.
 *
 * Server Component intégral : aucun `"use client"`, aucun hook, aucun
 * `useSearchParams`, donc aucun bailout CSR. Le seul JavaScript embarqué est
 * celui du framework.
 *
 * ## Ce que la Wave E a corrigé ici
 *
 * Cette page décrivait un produit qui n'existait plus. Elle annonçait un
 * « squelette » aux « connecteurs non branchés », affichait le manifest de
 * FIXTURE P02 avec ses identifiants (`FIXTURE_SOURCE`, `fixture-release-v1`,
 * `fixture.stress_index`) et listait comme futures des étapes P05 à P13 déjà
 * livrées. Chacun de ces énoncés était faux après les Waves A à D.
 *
 * Le correctif ne consiste pas à retoucher des phrases : tout ce que la page
 * affiche vient désormais de documents ÉMIS PAR LE BACKEND — le snapshot vide
 * canonique (assemblé par le même assembleur que la production), l'état des
 * sources, le registre juridique, la carte des ponts et le contrat du moteur
 * financier. Aucune fixture n'atteint le rendu public ; elles restent dans les
 * contrats et les tests, où elles ont leur place.
 *
 * L'état affiché est donc exact : l'infrastructure fonctionne, et rien n'est
 * publié parce qu'aucune décision humaine de publication n'a été signée.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { WiEditorialEmpty } from "@/components/water-intelligence/WiEditorial";
import { WiWaterPulse } from "@/components/water-intelligence/WiFoundations";
import { WiSourceStatusList } from "@/components/water-intelligence/WiSources";
import { WiFinancialEngineContract } from "@/components/water-intelligence/WiFinancialEngine";
import { WiModuleBridges } from "@/components/water-intelligence/WiBridges";
import { WiMapFrame } from "@/components/water-intelligence/WiMapFrame";
import { WiNav, type WiNavItem } from "@/components/water-intelligence/WiNav";
import { WiRegulatoryRegistry } from "@/components/water-intelligence/WiRegulatory";
import {
  WiAbsentValue,
  WiBadge,
  WiCard,
  WiPendingValue,
  WiPlaceholder,
  WiSection,
} from "@/components/water-intelligence/WiPrimitives";
import {
  CANONICAL_EMPTY_SNAPSHOT,
  SOURCE_STATUS,
  nothingIsPublishable,
} from "@/lib/water-intelligence/canonical-snapshot";

import "./water-intelligence.css";

export const metadata: Metadata = {
  title: "Water Intelligence — contexte hydrique sourcé | Carbon&Co",
  description:
    "Module public de contexte hydrique de Carbon&Co : méthode, sources officielles et provenance. Infrastructure opérationnelle ; aucune observation publiée tant qu'une décision humaine de publication n'est pas signée.",
  alternates: { canonical: "/water" },
  openGraph: {
    title: "Water Intelligence — Carbon&Co",
    description:
      "Comprendre le risque hydrique à partir de sources officielles traçables. Infrastructure opérationnelle ; données publiques en attente de validation humaine.",
    type: "website",
    url: "/water",
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
  /*
    Snapshot public canonique, assemblé par le backend depuis le registre de
    décisions de publication. Il est VIDE — aucune décision humaine signée —
    mais il n'est pas creux : il porte les sept exclusions, leurs motifs, les
    décisions rendues et une couverture à zéro. C'est de l'information réelle
    et vérifiable, même quand zéro valeur est publiée.
  */
  const snapshot = CANONICAL_EMPTY_SNAPSHOT;
  const nothingPublished = nothingIsPublishable(SOURCE_STATUS);

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
            <WiBadge tone="demo" label="Infrastructure opérationnelle" />
            <WiBadge tone="pending" label="Données publiques en attente de validation" />
          </div>

          <h1 className="wi-h1" style={{ marginTop: "1rem" }}>
            Water Intelligence
          </h1>

          <p className="wi-lede" style={{ marginTop: "1rem" }}>
            Les connecteurs, les contrats, le registre de provenance et les moteurs de décision
            sont <strong>opérationnels</strong>. Aucune observation n&apos;est rendue publique tant
            qu&apos;une décision humaine de publication n&apos;a pas été signée, source par source.
          </p>

          <p className="wi-muted" style={{ marginTop: "1rem", maxWidth: "60ch" }}>
            Vous cherchez le suivi hydrique de votre entreprise (sites, prélèvements, permis,
            screening) ?{" "}
            <Link href="/water/cockpit" className="wi-link">
              Accéder au cockpit Eau &amp; stress hydrique (accès authentifié)
            </Link>
            .
          </p>

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
            définition a été fixée AVANT les connecteurs, précisément pour qu&apos;aucune source
            ne vienne ensuite les réinterpréter à sa façon.
          </p>
        </WiSection>

        {/* -------------------------------------------------- Carte (absente) */}
        <WiSection id="carte" kicker="03 — Territoires" title="Carte et territoires">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            L&apos;explorateur cartographique multi-échelle (monde, Europe, France) est livré, avec
            une table alternative accessible offrant strictement la même information que la carte.
            Il ne monte la carte que si une couche est autorisée à la publication&nbsp;: aucune ne
            l&apos;est aujourd&apos;hui.
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
            Sept sources officielles sont instrumentées et leurs licences ont été vérifiées.
            Aucune n&apos;est publiée. Ce n&apos;est pas un défaut d&apos;avancement&nbsp;: c&apos;est
            le résultat du gate de publication, qui exige une décision humaine explicite et
            signée pour chaque source.
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

          {/* État réel des sources, dérivé du document canonique émis par le
              backend. Licence vérifiée et publication autorisée restent deux
              axes distincts — les fusionner effacerait la leçon du gate. */}
          <div style={{ marginTop: "1.5rem" }}>
            <WiSourceStatusList />
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
              plannedIn="rédaction et revue humaine des contenus sourcés"
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

          {/* P15 (Wave D) : contrat RÉEL du moteur, plus un aperçu. Aucun
              montant — le calcul se fait côté authentifié. */}
          <div style={{ marginTop: "1.25rem" }}>
            <WiFinancialEngineContract />
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
              Sept connecteurs officiels instrumentés et bornés, les contrats de données, le
              registre de provenance et de décisions de publication, le registre juridique
              versionné, les ponts vers les modules authentifiés et le moteur de scénarios
              financiers. Les licences des sept sources sont vérifiées.
            </WiCard>
            <WiCard title="Ce qui ne l'est pas" accent="absent">
              Aucune décision humaine de publication n&apos;a été signée, donc aucune observation
              n&apos;est rendue publique. Aucun texte juridique n&apos;est instruit&nbsp;: le
              registre nomme les textes à examiner, il n&apos;énonce pas le droit. Aucun contenu
              éditorial n&apos;a été rédigé ni revu.
            </WiCard>
          </div>

          <div className="wi-card wi-accent-absent" style={{ marginTop: "1.25rem" }}>
            <h3 className="wi-h3">Ce qui débloquerait une publication</h3>
            <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch", fontSize: "0.9375rem" }}>
              Aucune de ces étapes n&apos;est technique&nbsp;: ce sont des décisions et des
              démarches humaines.
            </p>
            <ol className="wi-muted" style={{ marginTop: "0.625rem", paddingLeft: "1.25rem" }}>
              <li>
                Rendre et signer une décision de publication, source par source — la licence
                vérifiée en est la condition, jamais l&apos;autorisation.
              </li>
              <li>
                Effectuer l&apos;enregistrement exigé par WRI, seul obstacle restant pour Aqueduct.
              </li>
              <li>
                Trancher le décodage raster Copernicus&nbsp;: dépendance géospatiale assumée,
                service officiel vérifié, ou renoncement documenté.
              </li>
              <li>
                Désigner un réviseur juridique, sans lequel chaque règle du registre reste{" "}
                <span className="wi-mono">unknown</span>.
              </li>
            </ol>
            <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
              Aucune donnée n&apos;est mise en ligne parce qu&apos;elle est disponible&nbsp;: elle
              l&apos;est parce qu&apos;elle est sourcée, licenciée, et qu&apos;un humain a signé sa
              publication.
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
            Module opérationnel en mode contrôlé. Les données publiques restent retenues tant que
            leurs décisions de publication ne sont pas signées.
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
            <Link href="/" className="wi-link">
              Accueil Carbon&amp;Co
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
