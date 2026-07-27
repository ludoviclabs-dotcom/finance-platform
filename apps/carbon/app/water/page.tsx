/**
 * app/water/page.tsx — Water Intelligence, surface publique autonome.
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
 * - le registre juridique, la carte des ponts et le contrat du moteur
 *   financier, tous assemblés côté backend.
 *
 * Les seuls contenus rédigés ici sont ÉDITORIAUX et qualitatifs
 * (`editorial-matrices.ts`) : ils ne portent aucun chiffre, et ce fichier-là
 * explique pourquoi.
 *
 * ## Aucun appel réseau client
 *
 * Rien n'est fetché : les documents sont importés au build. Aucune requête
 * vers Hub'Eau n'est émise depuis le navigateur — une surface publique ne doit
 * pas faire porter au lecteur des appels vers un service tiers.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { WiFinancialEngineContract } from "@/components/water-intelligence/WiFinancialEngine";
import { WiModuleBridges } from "@/components/water-intelligence/WiBridges";
import { WiRegulatoryRegistry } from "@/components/water-intelligence/WiRegulatory";
import { WiHero } from "@/components/water-intelligence/WiHero";
import { WiPilotData } from "@/components/water-intelligence/WiPilotData";
import { WiConstellation } from "@/components/water-intelligence/WiConstellation";
import {
  WiInnovations,
  WiSectors,
  WiTerritory,
  WiTimeline,
} from "@/components/water-intelligence/WiMatrices";
import { WiFinancialBridge, WiProofTable } from "@/components/water-intelligence/WiProof";
import { WiNav, type WiNavItem } from "@/components/water-intelligence/WiNav";
import { WiSection } from "@/components/water-intelligence/WiPrimitives";
import {
  IntelligenceThemeProvider,
  IntelligenceThemeToggle,
} from "@/components/intelligence/IntelligenceThemeProvider";
import { EVIDENCE_LABELS, PULSE_FACETS } from "@/lib/water-intelligence/editorial-matrices";
import { SOURCE_STATUS, orderedSources } from "@/lib/water-intelligence/canonical-snapshot";
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
 * Ancres. Les historiques sont CONSERVÉES — elles existent en production
 * publique et des liens externes peuvent les viser. La refonte réorganise ce
 * qu'elles contiennent, elle n'en renomme ni n'en supprime aucune.
 */
const NAV_ITEMS: readonly WiNavItem[] = [
  { id: "vue-ensemble", label: "Vue d'ensemble" },
  { id: "risques", label: "Comprendre les risques" },
  { id: "pilote", label: "Données pilotes" },
  { id: "carte", label: "Carte et territoires" },
  { id: "sources", label: "Sources et preuves" },
  { id: "secteurs", label: "Secteurs et dépendances" },
  { id: "evenements", label: "Climat et événements" },
  { id: "innovations", label: "Innovations et adaptation" },
  { id: "reglementation", label: "Réglementation" },
  { id: "synergies", label: "Synergies Carbon&Co" },
  { id: "preuves", label: "Preuves et provenance" },
  { id: "limites", label: "Limites et suite" },
];

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
  const warnings = pilotCoverageWarnings(PILOT_FILE);
  const sources = orderedSources(SOURCE_STATUS);
  const scopeLabel = `commune ${scope.geographyCode}, année ${scope.periodStart.slice(0, 4)}`;

  return (
    <IntelligenceThemeProvider scope="wi">
      <a href="#contenu" className="wi-skip">
        Aller au contenu principal
      </a>

      <WiNav items={NAV_ITEMS} />

      <main id="contenu" className="wi-shell">
        <div id="vue-ensemble" className="wi-section" style={{ paddingTop: 0 }}>
          <WiHero
            observationCount={observations.length}
            isPublished={published}
            snapshotDate={pilotDocument ? pilotDocument.generated_at.slice(0, 10) : null}
            scopeLabel={scopeLabel}
            sourceCount={SOURCE_STATUS.source_count}
            publishableCount={SOURCE_STATUS.publishable_count}
          />
        </div>

        {/* ---------------------------------------------- 1 — Water Pulse */}
        <WiSection
          id="risques"
          kicker="01 — Water Pulse"
          title="Comprendre les risques : huit facettes, tenues séparées"
        >
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            «&nbsp;Risque hydrique&nbsp;» recouvre des réalités qui n&apos;ont ni les
            mêmes causes, ni les mêmes échelles de temps, ni les mêmes réponses. Le
            module les tient séparées et ne produit aucun indice composite&nbsp;: chaque
            facette reste lisible, comparable et contestable seule.
          </p>

          <div className="wi-grid wi-grid-4" style={{ marginTop: "1.5rem" }}>
            {PULSE_FACETS.map((facet) => (
              <article key={facet.id} className={`wi-card wi-accent-${facet.accent}`}>
                <h3 className="wi-h3">{facet.label}</h3>
                <p
                  className="wi-muted"
                  style={{ marginTop: "0.375rem", fontSize: "0.8125rem", fontStyle: "italic" }}
                >
                  {facet.question}
                </p>
                <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
                  {facet.body}
                </p>
                <p
                  style={{
                    marginTop: "0.875rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--wi-border)",
                    fontSize: "0.8125rem",
                    color: "var(--wi-muted)",
                  }}
                >
                  <strong style={{ color: "var(--wi-fg)" }}>
                    Publié aujourd&apos;hui&nbsp;:
                  </strong>{" "}
                  {facet.published}
                </p>
                <span className="wi-badge wi-badge-pending" style={{ marginTop: "0.625rem" }}>
                  <span aria-hidden="true">◷</span>
                  {EVIDENCE_LABELS[facet.evidenceLevel]}
                </span>
              </article>
            ))}
          </div>

          <p
            className="wi-muted"
            style={{ marginTop: "1.5rem", maxWidth: "62ch", fontSize: "0.875rem" }}
          >
            Chaque chiffre affiché sur cette page porte sa source, sa période, son
            territoire, sa date de consultation et son statut. Une valeur sans cet
            ensemble n&apos;est pas publiable — c&apos;est une règle du gate de
            publication, pas une intention éditoriale.
          </p>
        </WiSection>

        {/* ------------------------------------------- 2 — Données pilotes */}
        <WiSection id="pilote" kicker="02 — Publication" title="Première publication pilote">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Une décision humaine signée le {scope.reviewedOn} par{" "}
            <span className="wi-mono">{scope.reviewedBy}</span> autorise la publication
            de <strong>{scope.expectedObservationCount} observations</strong> de
            prélèvements déclarés, sur la {scopeLabel}. Elle n&apos;autorise rien
            d&apos;autre&nbsp;: tout autre territoire et toute autre année exigeraient
            une nouvelle décision.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiPilotData
              observations={observations}
              coverageWarnings={warnings}
                scopeLabel={scopeLabel}
              attribution={pilot?.attribution ?? null}
              sourceUrl={pilot?.source_information_url ?? null}
                isPublished={published}
              notGeneratedExplanation="Le document canonique est produit par un workflow de génération : il réacquiert le périmètre signé, vérifie le checksum, le nombre d'observations, la pagination exhaustive et le budget, puis écrit le document et son miroir. Tant qu'il n'a pas été déclenché, aucune observation n'est publiée."
            />
          </div>
        </WiSection>

        {/* -------------------------------------------- 3 — Territoires */}
        <WiSection id="carte" kicker="03 — Territoires" title="Territory Readiness">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Les couches géographiques sont différées. Plutôt qu&apos;une carte vide —
            qui se lirait comme une couverture nulle — cette section dit ce qui est
            prêt, ce qui manque, et quelle jointure sera possible le jour où une couche
            sera validée.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiTerritory
              geographyType={scope.geographyType}
              geographyCode={scope.geographyCode}
              periodLabel={scope.periodStart.slice(0, 4)}
              ouvrageCount={observations.length}
                isPublished={published}
            />
          </div>
        </WiSection>

        {/* ----------------------------------------------- 4 — Sources */}
        <WiSection id="sources" kicker="04 — Provenance" title="Constellation des sources">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Sept sources officielles instrumentées, sept licences vérifiées, une seule
            publication autorisée. Chacune ouvre son état réel&nbsp;: son rôle, sa
            couverture, sa méthode, ce qui la bloque et la prochaine action.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiConstellation sources={sources} />
          </div>
        </WiSection>

        {/* ---------------------------------------------- 5 — Secteurs */}
        <WiSection id="secteurs" kicker="05 — Exposition" title="Secteurs et dépendances">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Où l&apos;eau est-elle une contrainte de procédé, et où est-elle un risque
            d&apos;approvisionnement&nbsp;? Cette matrice décrit la <strong>nature</strong>{" "}
            d&apos;une dépendance, qui se vérifie par lecture — pas son ampleur, qui se
            mesure sur site.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiSectors />
          </div>
        </WiSection>

        {/* ------------------------------------ 6 — Climat et événements */}
        <WiSection id="evenements" kicker="06 — Observations" title="Climat et événements">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Sécheresses, restrictions, inondations, pollutions, tensions sur nappes et
            interruptions opérationnelles. Un événement est rapporté avec sa source,
            jamais expliqué par cette page.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiTimeline />
          </div>
        </WiSection>

        {/* -------------------------------- 7 — Innovations et adaptation */}
        <WiSection id="innovations" kicker="07 — Adaptation" title="Innovations et adaptation">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Chaque famille porte sa contrepartie au même niveau que son bénéfice&nbsp;:
            énergie, carbone, coût, maturité. Une solution présentée par son seul gain
            hydrique est une promesse, pas une option.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiInnovations />
          </div>
        </WiSection>

        {/* ------------------------------ 8 — Réglementation et finance */}
        <WiSection id="reglementation" kicker="08 — Conformité" title="Compliance Cockpit">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Le registre distingue les statuts réellement différents — en vigueur, adopté
            mais non applicable, en attente de transposition, dépendant de la
            matérialité, volontaire, hors périmètre, inconnu — plutôt que de réduire une
            règle à «&nbsp;obligatoire&nbsp;». Il sépare aussi le droit contraignant des
            référentiels volontaires, qui n&apos;obligent personne.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiRegulatoryRegistry />
          </div>

          <h3 className="wi-h2" style={{ marginTop: "3rem" }}>
            Financial Water Bridge
          </h3>
          <p className="wi-muted" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
            Dix étapes, d&apos;une interruption d&apos;usage à un signal comptable.
            Chacune est une <strong>question à instruire</strong>, jamais un calcul — le
            moteur de scénarios vit côté authentifié et exige des hypothèses explicites.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiFinancialBridge />
          </div>

          <div style={{ marginTop: "2rem" }}>
            <WiFinancialEngineContract />
          </div>
        </WiSection>

        {/* --------------------------------------------- 9 — Synergies */}
        <WiSection id="synergies" kicker="09 — Articulation" title="Synergies Carbon&amp;Co">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Cette page explique le contexte. Le travail sur vos propres données se fait
            dans les modules authentifiés, seule surface où apparaissent des informations
            d&apos;entreprise.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <WiModuleBridges />
          </div>
        </WiSection>

        {/* ------------------------------------------ 10 — Preuves */}
        <WiSection id="preuves" kicker="10 — Vérification" title="Chaque valeur porte sa preuve">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            Ce qu&apos;il faut pouvoir emporter pour vérifier par soi-même. Les
            références techniques sont copiables&nbsp;: une empreinte de 64 caractères ne
            se recopie pas à la main sans erreur, et rendre la vérification pénible
            revient à la décourager.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
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
                  value: pilot
                    ? `${pilot.license_code} — portée ${pilot.license_scope}`
                    : "ETALAB-2.0 — portée platform",
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
                  value: observations[0]
                    ? `${observations[0].methodCode} · ${observations[0].methodVersion}`
                    : null,
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

        </WiSection>

        {/* ------------------------------------------ 11 — Limites et suite */}
        <WiSection id="limites" kicker="11 — Honnêteté" title="Limites et prochaines étapes">
          <p className="wi-muted" style={{ maxWidth: "62ch" }}>
            L&apos;état réel de ce module, sans arrondi favorable. Aucune de ces étapes
            n&apos;est technique&nbsp;: ce sont des décisions et des démarches humaines.
          </p>

          <div className="wi-card wi-accent-absent" style={{ marginTop: "1.5rem" }}>
            <h3 className="wi-h3">Ce qui reste dû</h3>
            <ul className="wi-limit-list">
              <li>
                Le relevé direct de la date de dernière mise à jour de chaque source. Il
                reste <strong>bloquant</strong> pour la piézométrie et la qualité,
                qu&apos;aucune signature ne couvre.
              </li>
              <li>
                Les couches géographiques validées, sans lesquelles aucune carte ne monte.
              </li>
              <li>
                Un réviseur juridique, sans lequel chaque règle du registre reste{" "}
                <span className="wi-mono">unknown</span>.
              </li>
              <li>
                L&apos;enregistrement exigé par WRI, et l&apos;arbitrage sur le décodage
                raster Copernicus. Deux démarches humaines, pas des réglages.
              </li>
            </ul>
          </div>
        </WiSection>
      </main>

      {/* ------------------------------------------------------------ Footer */}
      <footer
        style={{ borderTop: "1px solid var(--wi-border)", background: "var(--wi-surface)" }}
      >
        <div className="wi-shell" style={{ paddingTop: "2rem", paddingBottom: "2.5rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ fontWeight: 650, margin: 0 }}>Water Intelligence — Carbon&amp;Co</p>
            <IntelligenceThemeToggle />
          </div>
          <p
            className="wi-muted"
            style={{ marginTop: "0.75rem", maxWidth: "62ch", fontSize: "0.9375rem" }}
          >
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
            <Link href="/" className="wi-link">
              Accueil Carbon&amp;Co
            </Link>
          </p>
        </div>
      </footer>
    </IntelligenceThemeProvider>
  );
}
