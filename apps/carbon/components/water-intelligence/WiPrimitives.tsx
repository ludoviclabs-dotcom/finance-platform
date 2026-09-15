/**
 * WiPrimitives.tsx — primitives du shell public Water Intelligence (P04).
 *
 * Tous ces composants sont des Server Components (aucun `"use client"`,
 * aucun hook, aucun gestionnaire d'événement) : la page publique est rendue
 * intégralement côté serveur, sans îlot client ni bailout CSR.
 *
 * Règle d'accessibilité tenue ici : la couleur n'est JAMAIS le seul vecteur
 * d'information. Chaque badge et chaque zone « donnée absente » porte un
 * libellé texte explicite en plus de sa teinte et, le cas échéant, de sa
 * texture (hachures).
 *
 * ## Grammaire de statut centralisée (WI-V3-01)
 *
 * Trois axes existent dans le modèle canonique, et ne se déduisent JAMAIS l'un
 * de l'autre — les fusionner effacerait exactement la distinction que chacun
 * existe pour garder lisible :
 *
 * 1. **Publication State** (`PulseFacetPublicationState`, dans
 *    `editorial-matrices.ts`) — publié / qualitatif / différé / non
 *    instrumenté. Rendu par `WiStatusChip`, sur les classes `.wi-pubstate-*`
 *    déjà présentes dans la feuille de style v2.
 * 2. **Evidence State** (`EvidenceLevel`, même fichier) — contexte
 *    institutionnel / description qualitative / exige une mesure / valeur
 *    sourcée. Rendu par `WiEvidenceChip`. Avant WI-V3-01, les quatre niveaux
 *    partageaient TOUS le même badge (sablier ambre, ton « pending ») : deux
 *    niveaux de preuve différents étaient donc visuellement indiscernables.
 *    `WiEvidenceChip` leur donne quatre tons et quatre icônes distincts, tirés
 *    des classes `.wi-badge-*` déjà déclarées mais jusque-là inutilisées
 *    (`.wi-badge-published`, `.wi-badge-ok`) ou jamais référencées
 *    (`.wi-badge-demo`, réemployée ici pour son SENS chromatique — ambre,
 *    vigilance — sous l'alias de ton `vigilance`).
 * 3. **Source/Permission State** (`WiSourceStatus["state"]`, dans
 *    `canonical-snapshot.ts`) — publiable / bloquée / décodage différé /
 *    décision en attente / aucune décision. `SOURCE_STATE_TONE` centralise ici
 *    le mapping que `WiSources.tsx` définissait seul en local ; il l'importe
 *    désormais d'ici plutôt que de le redéfinir.
 *
 * Un quatrième système existe, plus bas niveau et volontairement SÉPARÉ de ces
 * trois axes : `WiDataStateKind` (`data-state.ts`) décrit comment RENDRE une
 * valeur selon sa disponibilité technique (fixture/erreur/bloqué/absent/
 * chargement/nominal) — une machine à états de rendu, pas un statut métier.
 * Son composant, `WiDataState.tsx`, garde son propre mapping : le fusionner
 * ici confondrait deux préoccupations différentes.
 */

import type { ReactNode } from "react";

import type {
  EvidenceLevel,
  PulseFacetPublicationState,
} from "@/lib/water-intelligence/editorial-matrices";
import {
  EVIDENCE_LABELS,
  PUBLICATION_STATE_LABELS,
} from "@/lib/water-intelligence/editorial-matrices";
import type { WiSourceStatus } from "@/lib/water-intelligence/canonical-snapshot";

/* -------------------------------------------------------------- Section */

export function WiSection({
  id,
  title,
  kicker,
  children,
}: {
  id: string;
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-titre`;
  return (
    <section id={id} className="wi-section" aria-labelledby={headingId}>
      {kicker ? (
        <p className="wi-mono" style={{ color: "var(--wi-data)", marginBottom: "0.375rem" }}>
          {kicker}
        </p>
      ) : null}
      <h2 id={headingId} className="wi-h2">
        {title}
      </h2>
      <div style={{ marginTop: "1rem" }}>{children}</div>
    </section>
  );
}

/* --------------------------------------------------------------- Badges */

export type BadgeTone = "demo" | "absent" | "pending" | "alert" | "published" | "ok" | "vigilance";

const BADGE_CLASS: Record<BadgeTone, string> = {
  demo: "wi-badge wi-badge-demo",
  absent: "wi-badge wi-badge-absent",
  pending: "wi-badge wi-badge-pending",
  alert: "wi-badge wi-badge-alert",
  /* `.wi-badge-published`/`.wi-badge-ok` existaient dans la feuille de style
     depuis la v2 mais n'étaient référencés par aucun composant — WI-V3-01 les
     câble ici. */
  published: "wi-badge wi-badge-published",
  ok: "wi-badge wi-badge-ok",
  /* Alias de `demo` : MÊME classe CSS (ambre), nom de ton qui dit son SENS
     plutôt que son historique — voir la docstring de fichier, axe 2. */
  vigilance: "wi-badge wi-badge-demo",
};

/**
 * Pastille d'état. `label` est toujours rendu en texte : un lecteur d'écran
 * comme un lecteur daltonien reçoit la même information que la couleur.
 */
export function WiBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <span className={BADGE_CLASS[tone]}>{label}</span>;
}

/**
 * Axe 3 — Source/Permission State. Centralisé ici pour que `WiSources.tsx`
 * (et tout futur composant qui rendrait ce même axe) n'en redéfinisse pas sa
 * propre copie. `WiSourceStatus["state"]` est le champ COARSE (cinq valeurs) ;
 * `WiConstellation` continue de rendre séparément le `deferral_code`, plus
 * fin — les deux ne sont pas le même axe et l'un ne remplace pas l'autre.
 */
export const SOURCE_STATE_TONE: Record<WiSourceStatus["state"], BadgeTone> = {
  publishable: "demo",
  publication_blocked: "alert",
  decoder_deferred: "absent",
  decision_pending: "pending",
  no_decision: "absent",
};

/* ---------------------------------------------------- Axe 1 — Publication */

const PUBSTATE_ICON: Record<PulseFacetPublicationState, string> = {
  published: "●",
  qualitative: "◆",
  deferred: "◷",
  not_instrumented: "○",
};

/**
 * Puce d'état de publication (axe 1). Rend `.wi-pubstate-*`, déjà défini par
 * la feuille de style v2 — ce composant n'ajoute aucune classe, il centralise
 * un JSX qui vivait en dur dans `page.tsx`.
 */
export function WiStatusChip({
  state,
  testId,
}: {
  state: PulseFacetPublicationState;
  testId?: string;
}) {
  return (
    <span className={`wi-pubstate wi-pubstate-${state}`} data-testid={testId}>
      <span aria-hidden="true">{PUBSTATE_ICON[state]}</span>
      {PUBLICATION_STATE_LABELS[state]}
    </span>
  );
}

/* -------------------------------------------------------- Axe 2 — Evidence */

/**
 * Ton et icône par niveau de preuve — DISTINCTS de ceux de `WiStatusChip`
 * (axe 1) pour qu'un lecteur ne confonde jamais les deux axes quand ils
 * apparaissent côte à côte. `institutional_context` (le plus faible) au ton
 * `absent` ; `sourced_figure` (le plus fort, inemployé à ce jour) au ton
 * `published` — c'est la seule place où ce ton sert un sens de FORCE de
 * preuve plutôt que de publication réelle, ce que le libellé texte accolé
 * clarifie toujours.
 */
const EVIDENCE_TONE: Record<EvidenceLevel, BadgeTone> = {
  institutional_context: "absent",
  qualitative_consensus: "pending",
  requires_measurement: "vigilance",
  sourced_figure: "published",
};

const EVIDENCE_ICON: Record<EvidenceLevel, string> = {
  institutional_context: "▨",
  qualitative_consensus: "✦",
  requires_measurement: "△",
  sourced_figure: "✓",
};

/**
 * Puce de niveau de preuve (axe 2). Remplace le badge unique
 * (`wi-badge-pending`, sablier) que les quatre niveaux partageaient avant
 * WI-V3-01 — un niveau « exige une mesure » et un niveau « valeur sourcée »
 * rendaient alors la même pastille.
 *
 * N'utilise pas `WiBadge` directement : son `label` est un texte opaque, et
 * l'icône y serait donc lue par un lecteur d'écran au lieu de rester
 * décorative — même règle que `WiStatusChip`, l'icône est `aria-hidden`,
 * jamais le seul vecteur de l'information ni un bruit supplémentaire pour la
 * synthèse vocale.
 */
export function WiEvidenceChip({ level }: { level: EvidenceLevel }) {
  return (
    <span className={BADGE_CLASS[EVIDENCE_TONE[level]]}>
      <span aria-hidden="true">{EVIDENCE_ICON[level]}</span>
      {EVIDENCE_LABELS[level]}
    </span>
  );
}

/* -------------------------------------------------------------- Scope Chip */

/**
 * Puce de périmètre — centralise le balisage `.wi-chip` que `WiHero.tsx`
 * dupliquait deux fois en JSX local (« Pilote public vérifié », « Périmètre
 * limité — … »). Sert tout fait géographique/temporel VÉRIFIÉ, jamais une
 * mesure — la distinction avec `WiStatusChip`/`WiEvidenceChip` est délibérée :
 * un périmètre n'est ni un état de publication ni un niveau de preuve.
 */
export function WiScopeChip({
  icon,
  label,
  testId,
}: {
  icon: string;
  label: string;
  testId?: string;
}) {
  return (
    <span className="wi-chip" data-testid={testId}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

/* ------------------------------------------------- Placeholder honnête */

/**
 * Bloc d'une section dont la donnée n'est PAS encore branchée.
 *
 * N'invente rien : annonce explicitement ce qui manque, quelle mission le
 * livrera, et ne montre aucun chiffre. La texture hachurée double le libellé
 * « Non branché » — elle ne le remplace pas.
 */
export function WiPlaceholder({
  what,
  plannedIn,
  children,
}: {
  what: string;
  plannedIn: string;
  children?: ReactNode;
}) {
  return (
    <div className="wi-absent-fill" style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <WiBadge tone="pending" label="Non branché" />
        <span className="wi-mono" style={{ color: "var(--wi-muted)" }}>
          Prévu&nbsp;: {plannedIn}
        </span>
      </div>
      <p className="wi-muted" style={{ marginTop: "0.75rem" }}>
        {what}
      </p>
      {children ? <div style={{ marginTop: "0.75rem" }}>{children}</div> : null}
    </div>
  );
}

/* ------------------------------------- Valeur en attente de branchement */

/**
 * Remplace, sur la surface PUBLIQUE, toute valeur qui serait fabriquée : une
 * mesure, une date de récupération, une empreinte de release.
 *
 * P04B : la fixture P02 reste la référence des contrats et des tests, mais ses
 * valeurs ne sont plus affichées ici. Montrer « 42 » ou une empreinte
 * plausible, même sous un badge « Démonstration », donne à un chiffre inventé
 * l'apparence d'une mesure — le badge est lu après le chiffre, quand il est lu.
 * Le champ est donc rendu comme non communiqué, avec la raison et l'échéance.
 */
export function WiPendingValue({ detail }: { detail?: string }) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.375rem", alignItems: "baseline" }}>
      <span style={{ fontWeight: 600, color: "var(--wi-absent)" }}>n.c.</span>
      <span className="wi-muted" style={{ fontSize: "0.8125rem" }}>
        {detail ?? "Source non encore branchée"}
      </span>
    </span>
  );
}

/* ------------------------------------------------------- Donnée absente */

/**
 * Marqueur d'une valeur absente. Rend littéralement « Donnée absente », jamais
 * `0`, jamais un tiret muet : donnée manquante ≠ zéro (invariant du dépôt).
 */
export function WiAbsentValue({ reason }: { reason: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
      <WiBadge tone="absent" label="Donnée absente" />
      <span className="wi-muted" style={{ fontSize: "0.8125rem" }}>
        {reason}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ Carte info */

export function WiCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: "water" | "data" | "stress" | "compliance" | "adapt" | "absent";
  children: ReactNode;
}) {
  const accentClass = accent ? ` wi-accent-${accent}` : "";
  return (
    <div className={`wi-card${accentClass}`}>
      <h3 className="wi-h3">{title}</h3>
      <div className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
        {children}
      </div>
    </div>
  );
}
