/**
 * WiFoundations.tsx — composants de présentation de la surface publique
 * (Wave C, blueprint §5 : C08 légende, C11 table alternative, C02 Water Pulse,
 * C15/C16 previews).
 *
 * Tous Server Components : aucun hook, aucun gestionnaire d'événement, aucune
 * dépendance nouvelle. Les seuls îlots clients de la Wave C sont la barre de
 * filtres et le tiroir de provenance, qui exigent une interaction réelle.
 *
 * Règles tenues ici :
 * - thème `--wi-*` exclusivement, jamais `--mx-*` ni couleur Tailwind brute ;
 * - la couleur ne porte jamais seule l'information ;
 * - aucune valeur n'est inventée : un champ absent est rendu comme absent.
 */

import type { ReactNode } from "react";

import type {
  WaterPublicSnapshot,
  WiSourceExclusion,
} from "@/lib/water-intelligence/public-snapshot";
import { EXCLUSION_LABELS } from "@/lib/water-intelligence/public-snapshot";

import { WiBadge, WiPendingValue } from "./WiPrimitives";

/* ------------------------------------------------------------- Légende */

export interface WiLegendEntry {
  /** Libellé texte — obligatoire : jamais de couleur seule. */
  readonly label: string;
  /** Intervalle fourni par la MÉTHODE de la source, jamais par le JSX. */
  readonly range: string | null;
  /** Teinte issue des tokens `--wi-*`. */
  readonly token: string;
  /** Motif/texture, obligatoire pour l'absence. */
  readonly hatched?: boolean;
}

/**
 * Légende en paliers NOMMÉS, jamais un dégradé continu : deux paliers
 * adjacents doivent rester distinguables, y compris en niveaux de gris.
 *
 * `range` vient des métadonnées de méthode de la source. Quand elle est
 * absente, la légende l'annonce au lieu d'inventer un seuil.
 */
export function WiLegend({
  title,
  entries,
  methodNote,
}: {
  title: string;
  entries: readonly WiLegendEntry[];
  methodNote?: string | null;
}) {
  return (
    <div className="wi-card" aria-label={`Légende : ${title}`}>
      <h3 className="wi-h3">{title}</h3>
      <ul style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0, display: "grid", gap: "0.5rem" }}>
        {entries.map((entry) => (
          <li key={entry.label} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span
              aria-hidden="true"
              className={entry.hatched ? "wi-absent-fill" : undefined}
              style={{
                width: "1.25rem",
                height: "1.25rem",
                borderRadius: "0.25rem",
                background: entry.hatched ? undefined : `var(${entry.token})`,
                border: "1px solid var(--wi-border)",
                flex: "0 0 auto",
              }}
            />
            <span style={{ fontSize: "0.9375rem" }}>{entry.label}</span>
            <span className="wi-mono wi-muted" style={{ fontSize: "0.75rem" }}>
              {entry.range ?? "intervalle non communiqué"}
            </span>
          </li>
        ))}
      </ul>
      <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.8125rem" }}>
        {methodNote ??
          "Les seuils proviennent des métadonnées de méthode de la source, jamais de cette interface."}
      </p>
    </div>
  );
}

/* --------------------------------------------------- Table alternative */

export interface WiTableColumn {
  readonly key: string;
  readonly header: string;
  /** Colonne numérique : alignée en `tabular-nums`. */
  readonly numeric?: boolean;
}

export interface WiTableRow {
  readonly id: string;
  readonly cells: Readonly<Record<string, ReactNode>>;
}

/**
 * Équivalent strict de la carte, pas une dégradation (blueprint §12.6).
 *
 * Rendue au SERVEUR et présente dans le DOM initial : l'information reste
 * accessible sans souris et sans le JS de la carte. Toutes les entités de la
 * couche y figurent, y compris celles sans valeur — jamais de troncature
 * muette, jamais de « top N » silencieux.
 */
export function WiAccessibleDataTable({
  caption,
  columns,
  rows,
  emptyLabel,
}: {
  caption: string;
  columns: readonly WiTableColumn[];
  rows: readonly WiTableRow[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="wi-absent-fill" style={{ padding: "1.25rem" }}>
        <WiBadge tone="absent" label="Aucune ligne" />
        <p className="wi-muted" style={{ marginTop: "0.5rem" }}>
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
        <caption className="wi-muted" style={{ captionSide: "top", textAlign: "left", paddingBottom: "0.5rem" }}>
          {caption} — {rows.length} ligne{rows.length > 1 ? "s" : ""} au total
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{
                  textAlign: column.numeric ? "right" : "left",
                  padding: "0.5rem 0.625rem",
                  borderBottom: "1px solid var(--wi-border-2)",
                  whiteSpace: "nowrap",
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.numeric ? "wi-num" : undefined}
                  style={{
                    textAlign: column.numeric ? "right" : "left",
                    padding: "0.5rem 0.625rem",
                    borderBottom: "1px solid var(--wi-border)",
                    verticalAlign: "top",
                  }}
                >
                  {row.cells[column.key] ?? <WiPendingValue detail="Champ non communiqué" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------- Water Pulse */

/**
 * État des COUCHES PUBLIÉES — jamais un indice de l'état de l'eau.
 *
 * Ne calcule aucune moyenne et n'agrège aucune dimension : il compte ce qui
 * est publié, ce qui est exclu, et rien d'autre. Le composant ne « bat » pas :
 * « Pulse » nomme un état, pas une animation (blueprint §11.7).
 */
export function WiWaterPulse({ snapshot }: { snapshot: WaterPublicSnapshot }) {
  const { coverage } = snapshot;
  const published = coverage.source_count > 0;

  return (
    <div className="wi-card wi-accent-data" aria-label="État de la donnée publiée">
      {/*
        `h2` et non `h3` : ce bloc vit dans le hero, avant la première section.
        Le niveau suit la structure du document, la classe `wi-h3` n'en règle
        que la taille — un titre visuellement petit ne doit pas creuser un saut
        de niveau dans la hiérarchie.
      */}
      <h2 className="wi-h3">État de la donnée</h2>
      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>
        Cet indicateur décrit l’état des <strong>couches publiées</strong>, pas l’état de la
        ressource en eau. Il n’agrège aucune dimension et ne produit aucun score.
      </p>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
          gap: "0.75rem",
          margin: "1rem 0 0",
        }}
      >
        <WiPulseStat label="Sources publiées" value={coverage.source_count} />
        <WiPulseStat label="Sources écartées" value={coverage.excluded_source_count} />
        <WiPulseStat label="Couches" value={coverage.layer_count} />
        <WiPulseStat label="Périodes" value={coverage.period_count} />
      </dl>
      <div style={{ marginTop: "1rem" }}>
        {published ? (
          <WiBadge tone="pending" label="Couches publiées" />
        ) : (
          <WiBadge tone="absent" label="Aucune couche publiée" />
        )}
      </div>
      {!published ? (
        <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
          Aucune source n’est autorisée à la publication : le gate licence exige une décision
          humaine explicite et revue, source par source. Aucune n’est active à ce jour.
        </p>
      ) : null}
    </div>
  );
}

function WiPulseStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="wi-muted" style={{ fontSize: "0.8125rem" }}>
        {label}
      </dt>
      <dd className="wi-num" style={{ margin: "0.125rem 0 0", fontSize: "1.25rem", fontWeight: 650 }}>
        {value}
      </dd>
    </div>
  );
}

/* --------------------------------------------------- Sources écartées */

/**
 * Liste des sources écartées, avec leur motif. Une source écartée sans
 * mention donnerait une fausse impression d'exhaustivité (blueprint §7.5) —
 * c'est de l'information réelle, pas un aveu de faiblesse.
 */
export function WiExclusionList({ exclusions }: { exclusions: readonly WiSourceExclusion[] }) {
  if (exclusions.length === 0) {
    return (
      <p className="wi-muted">
        Aucune source écartée n’est déclarée dans ce snapshot.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}>
      {exclusions.map((exclusion) => (
        <li key={exclusion.source_code} className="wi-card">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <span className="wi-mono" style={{ fontSize: "0.8125rem" }}>
              {exclusion.source_code}
            </span>
            <WiBadge tone="pending" label={EXCLUSION_LABELS[exclusion.reason]} />
          </div>
          <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
            {exclusion.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ Previews */

/**
 * Previews non fonctionnelles de la Wave D.
 *
 * Ne rendent AUCUN chiffre, AUCUNE date, AUCUN statut juridique et AUCUN
 * montant — un test l'impose. Elles décrivent la forme de ce que P13 et P15
 * livreront, sans en préempter le contenu.
 */
export function WiPreviewCard({
  title,
  kicker,
  describes,
  deliveredBy,
}: {
  title: string;
  kicker: string;
  describes: readonly string[];
  deliveredBy: string;
}) {
  return (
    <div className="wi-card wi-accent-compliance">
      <p className="wi-mono" style={{ color: "var(--wi-compliance)", fontSize: "0.75rem" }}>
        {kicker}
      </p>
      <h3 className="wi-h3" style={{ marginTop: "0.25rem" }}>
        {title}
      </h3>
      <div style={{ marginTop: "0.5rem" }}>
        <WiBadge tone="pending" label={`Aperçu — livré par ${deliveredBy}`} />
      </div>
      <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
        Cet aperçu décrit la <strong>forme</strong> de ce qui sera livré. Il n’affiche
        volontairement aucune valeur, aucune date et aucun statut juridique.
      </p>
      <ul className="wi-muted" style={{ marginTop: "0.5rem", paddingLeft: "1.1rem", fontSize: "0.875rem" }}>
        {describes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/*
 * `WiCompliancePreview` a été SUPPRIMÉE par la Wave D (commit D1), pas
 * complétée : la consigne du MACRO-PROMPT D est explicite — les previews
 * C15/C16 doivent être remplacées. Le registre juridique réel est rendu par
 * `WiRegulatory.tsx::WiRegulatoryRegistry`, alimenté par le registre versionné
 * du backend. Les tests qui interdisaient à cet aperçu de rendre un chiffre ou
 * une date ont été retirés en connaissance de cause : ils décrivaient un
 * composant qui n'existe plus, et le composant qui le remplace affiche
 * légitimement une version de registre.
 */

export function WiFinancialBridgePreview() {
  return (
    <WiPreviewCard
      kicker="Aperçu"
      title="Passerelle financière"
      deliveredBy="P15 (Wave D)"
      describes={[
        "Moteur d’hypothèses explicites, séparant observé, hypothèse et dérivé",
        "Sensibilité affichée plutôt que certitude",
        "Aucune écriture comptable, aucun taux fiscal supposé",
        "Aucune probabilité produite par un modèle de langage",
      ]}
    />
  );
}
