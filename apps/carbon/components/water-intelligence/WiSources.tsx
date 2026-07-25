/**
 * components/water-intelligence/WiSources.tsx — état réel des sources
 * (P16, Wave E).
 *
 * Remplace le bandeau de manifest de fixture et la liste d'exclusions
 * indifférenciée. Le contenu vient du document canonique émis par le backend :
 * aucune chaîne de source n'est écrite dans ce fichier.
 *
 * ## Les deux axes ne sont jamais fusionnés
 *
 * `licence vérifiée` et `publication autorisée` sont affichés séparément,
 * parce que c'est la leçon centrale du chantier : identifier une licence
 * permissive ne rend rien publiable. Les sept sources ont une licence
 * vérifiée ; aucune n'est publiable. Fusionner les deux axes en un « statut »
 * unique effacerait exactement cette distinction.
 *
 * La granularité de licence est affichée aussi : la Licence Ouverte Hub'Eau a
 * été vérifiée au niveau de la **plateforme**, pas jeu par jeu.
 *
 * Server Component : aucune interactivité, aucun état, aucun appel réseau.
 */

import {
  LICENSE_SCOPE_LABELS,
  SOURCE_STATUS,
  orderedSources,
  type WiSourceStatus,
  type WiSourceStatusDocument,
} from "@/lib/water-intelligence/canonical-snapshot";
import { WiBadge } from "./WiPrimitives";

/** Ton du badge d'état. Toujours doublé du libellé texte. */
const STATE_TONE: Record<WiSourceStatus["state"], "demo" | "absent" | "pending" | "alert"> = {
  publishable: "demo",
  publication_blocked: "alert",
  decoder_deferred: "absent",
  decision_pending: "pending",
  no_decision: "absent",
};

function WiSourceRow({ source }: { source: WiSourceStatus }) {
  return (
    <li className="wi-card" style={{ listStyle: "none" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h4 className="wi-h4">{source.label}</h4>
        <WiBadge tone={STATE_TONE[source.state]} label={source.state_label} />
      </div>

      <p className="wi-muted" style={{ marginTop: "0.35rem", fontSize: "0.8125rem" }}>
        <span className="wi-mono">{source.source_code}</span>
      </p>

      <dl style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <dt className="wi-muted" style={{ fontSize: "0.8125rem" }}>
          Licence
        </dt>
        <dd style={{ margin: "0.15rem 0 0.6rem" }}>
          {source.license_code ? (
            <>
              <span className="wi-mono">{source.license_code}</span>{" "}
              <span className="wi-muted">
                — {LICENSE_SCOPE_LABELS[source.license_scope]}
                {source.license_verified_in ? ` (${source.license_verified_in})` : ""}
              </span>
            </>
          ) : (
            <span className="wi-muted">non vérifiée</span>
          )}
        </dd>

        <dt className="wi-muted" style={{ fontSize: "0.8125rem" }}>
          Ce qui manque pour publier
        </dt>
        <dd style={{ margin: "0.15rem 0 0" }}>{source.blocking_reason}</dd>
      </dl>
    </li>
  );
}

/**
 * État des sources vis-à-vis de la publication.
 *
 * Ne rend aucune observation, aucune valeur, aucun chiffre hydrique : le
 * composant décrit l'état d'autorisation, jamais la donnée.
 */
export function WiSourceStatusList({
  document = SOURCE_STATUS,
}: {
  document?: WiSourceStatusDocument;
}) {
  const sources = orderedSources(document);

  return (
    <div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}
      >
        <h3 className="wi-h3">État des sources</h3>
        <WiBadge
          tone={document.publishable_count === 0 ? "pending" : "demo"}
          label={`${document.publishable_count} source(s) autorisée(s) sur ${document.source_count}`}
        />
      </div>

      <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
        <strong>
          {document.license_verified_count} licence(s) vérifiée(s) sur {document.source_count}
        </strong>{" "}
        — et pourtant aucune donnée n’est publiée. Ce n’est pas une contradiction&nbsp;: une
        licence permissive autorise un usage, elle ne constitue pas la décision éditoriale
        de publier. Cette décision est humaine, se prend source par source, et se signe.
      </p>

      <ul
        className="wi-grid wi-grid-2"
        style={{ marginTop: "1rem", paddingLeft: 0, listStyle: "none" }}
      >
        {sources.map((source) => (
          <WiSourceRow key={source.source_code} source={source} />
        ))}
      </ul>
    </div>
  );
}
