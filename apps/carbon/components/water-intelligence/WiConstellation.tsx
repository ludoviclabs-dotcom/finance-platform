"use client";

/**
 * WiConstellation — les sept sources, leur état réel et ce qui les bloque
 * (Water Intelligence v2).
 *
 * ## Ce qui a changé par rapport à la V1
 *
 * La disposition passe d'une liste-accordéon à un graphe en orbite : un nœud
 * central « Publication » relié à sept sources disposées autour de lui,
 * chacune un bouton. Cliquer une source affiche son détail dans le panneau de
 * droite plutôt que de déplier une carte parmi d'autres — un seul détail est
 * visible à la fois, ce qui correspond à ce que la maquette montre.
 *
 * Ce que cette disposition NE change PAS : `PROFILES`, `DEFERRAL_LABELS` et
 * `DEFERRAL_MARKS` sont identiques à la V1, à l'octet près. L'état, le motif
 * de blocage et le périmètre viennent toujours du document backend
 * (`WiSourceStatus`) — jamais réécrits ici, où ils dériveraient.
 *
 * ## Accessibilité
 *
 * Les lignes SVG reliant les nœuds sont décoratives (`aria-hidden`). Chaque
 * nœud est un vrai `<button>` positionné en absolu ; l'ordre du DOM suit
 * l'ordre de `sources`, donc la navigation au clavier (Tab) reste cohérente
 * indépendamment de la disposition visuelle.
 */

import { useId, useState } from "react";

import type { WiSourceStatus } from "@/lib/water-intelligence/canonical-snapshot";

interface SourceProfile {
  readonly role: string;
  readonly coverage: string;
  readonly method: string;
  readonly nextAction: string;
}

/**
 * Rôle, couverture, méthode et prochaine action par source — ÉDITORIAUX,
 * identiques à la V1. L'état, le motif de blocage et le périmètre viennent du
 * document backend et ne sont jamais réécrits ici.
 */
const PROFILES: Record<string, SourceProfile> = {
  HUBEAU_BNPE_PRELEVEMENTS: {
    role: "Volumes prélevés déclarés, par ouvrage et par année.",
    coverage: "France — ouvrages soumis à déclaration au titre de la redevance.",
    method: "Reprise verbatim des volumes déclarés, sans conversion d'unité.",
    nextAction:
      "Élargir le périmètre exigerait une nouvelle décision humaine : la signature couvre une commune et une année.",
  },
  HUBEAU_ADES: {
    role: "Niveaux et profondeurs de nappe, par point de mesure officiel.",
    coverage: "France — points du réseau piézométrique.",
    method:
      "Niveau (m NGF) et profondeur (m) restent DEUX métriques distinctes : elles varient en sens opposé et ne sont jamais agrégées.",
    nextAction:
      "Restreindre le périmètre jusqu'à tenir sous 100 000 octets, puis faire signer une décision.",
  },
  HUBEAU_QUALITE_SURFACE: {
    role: "Paramètres physico-chimiques des cours d'eau.",
    coverage: "France — stations Naïades, paramètres SANDRE sur allowlist.",
    method:
      "Codes de remarque transportés verbatim ; aucune censure déduite, aucune conclusion de conformité.",
    nextAction:
      "Réduire le périmètre sous le budget et faire valider explicitement l'allowlist de paramètres.",
  },
  HUBEAU_HYDROMETRIE: {
    role: "Débits et hauteurs d'eau, en temps réel.",
    coverage: "France — stations hydrométriques.",
    method:
      "Unités natives conservées (l/s, mm) : aucune conversion, un facteur 1 000 invisible ne peut pas s'introduire.",
    nextAction:
      "Trancher entre étendre le contrat d'identité au sous-journalier ou retenir une lecture canonique par jour. Les deux sont des décisions de fond, aucune n'est un correctif.",
  },
  EEA_WEI_PLUS: {
    role: "Indice d'exploitation de la ressource en eau, à l'échelle européenne.",
    coverage: "Europe — unités spatiales de l'AEE.",
    method: "Reprise de l'indice publié, sans recalcul.",
    nextAction:
      "Obtenir l'artefact officiel : le format publié n'est pas décodable par le connecteur en l'état.",
  },
  WRI_AQUEDUCT: {
    role: "Indicateurs de stress hydrique et d'aléas, à l'échelle mondiale.",
    coverage: "Monde — bassins hydrographiques.",
    method: "Vocabulaire de catégories conservé tel quel, jamais réinterprété.",
    nextAction:
      "Effectuer l'enregistrement exigé par WRI pour partager ou adapter les données. C'est une démarche humaine, pas un réglage.",
  },
  COPERNICUS_EDO: {
    role: "Indice combiné de sécheresse, par grille.",
    coverage: "Europe — grille de l'observatoire européen de la sécheresse.",
    method:
      "Aucune valeur décodée : le portail ne distribue que du raster, et le décodage a été reporté plutôt que simulé.",
    nextAction:
      "Trancher par une décision d'architecture : dépendance raster assumée, service officiel vérifié, ou renoncement documenté.",
  },
};

const DEFERRAL_LABELS: Record<string, string> = {
  published_limited_scope: "Publié — pilote limité",
  deferred_over_budget: "Validé — reporté pour budget",
  subdaily_identity_collision: "Collision d'identité sous-journalière",
  manual_artifact_required: "Artefact manuel requis",
  blocked_registration_required: "Enregistrement requis",
  source_verified_decoder_deferred: "Décodage différé",
};

const DEFERRAL_MARKS: Record<string, { icon: string; color: string }> = {
  published_limited_scope: { icon: "●", color: "var(--wi-water)" },
  deferred_over_budget: { icon: "▮", color: "var(--wi-stress)" },
  subdaily_identity_collision: { icon: "◆", color: "var(--wi-stress)" },
  manual_artifact_required: { icon: "▲", color: "var(--wi-absent)" },
  blocked_registration_required: { icon: "■", color: "var(--wi-alert)" },
  source_verified_decoder_deferred: { icon: "◇", color: "var(--wi-absent)" },
};

const FALLBACK_MARK = { icon: "○", color: "var(--wi-absent)" };

/**
 * Positions en orbite (%, %) — reprises telles quelles de la maquette v2.
 * Non uniformes délibérément : espacées pour que les libellés ne se
 * recouvrent pas, pas calculées géométriquement.
 */
const ORBIT_POSITIONS: Record<string, readonly [number, number]> = {
  HUBEAU_BNPE_PRELEVEMENTS: [50, 10],
  HUBEAU_ADES: [79, 24],
  HUBEAU_QUALITE_SURFACE: [91, 55],
  HUBEAU_HYDROMETRIE: [72, 86],
  EEA_WEI_PLUS: [28, 86],
  WRI_AQUEDUCT: [9, 55],
  COPERNICUS_EDO: [21, 24],
};
const FALLBACK_POSITIONS: readonly (readonly [number, number])[] = [
  [50, 10],
  [85, 30],
  [85, 70],
  [50, 90],
  [15, 70],
  [15, 30],
  [50, 50],
];

/**
 * Libellé COURT affiché sur le nœud — le libellé complet (`source.label`,
 * ex. « Hub'Eau — prélèvements (BNPE) ») ne tient pas dans un nœud circulaire.
 * Un raccourci mécanique (premier mot) donnerait quatre nœuds « Hub'Eau »
 * indiscernables ; celui-ci nomme le JEU DE DONNÉES, pas le point d'accès.
 */
const SHORT_LABELS: Record<string, string> = {
  HUBEAU_BNPE_PRELEVEMENTS: "Prélèvements",
  HUBEAU_ADES: "Piézométrie",
  HUBEAU_QUALITE_SURFACE: "Qualité",
  HUBEAU_HYDROMETRIE: "Hydrométrie",
  EEA_WEI_PLUS: "WEI+",
  WRI_AQUEDUCT: "Aqueduct",
  COPERNICUS_EDO: "Copernicus",
};

export function WiConstellation({ sources }: { sources: readonly WiSourceStatus[] }) {
  const bnpeIndex = sources.findIndex((s) => s.source_code === "HUBEAU_BNPE_PRELEVEMENTS");
  const [selected, setSelected] = useState(bnpeIndex >= 0 ? bnpeIndex : 0);
  const panelId = useId();

  const authorizedCount = sources.filter((s) => s.deferral_code === "published_limited_scope").length;

  const selectedSource = sources[selected];
  const selectedMark = selectedSource
    ? (DEFERRAL_MARKS[selectedSource.deferral_code] ?? FALLBACK_MARK)
    : FALLBACK_MARK;
  const selectedProfile = selectedSource ? PROFILES[selectedSource.source_code] : undefined;

  return (
    <div data-testid="wi-constellation">
    <div className="wi-grid wi-grid-2" style={{ alignItems: "stretch" }}>
      {/* -------------------------------------------------------- Graphe */}
      <div className="wi-orbit">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="wi-orbit-lines"
        >
          {sources.map((source, index) => {
            const [x, y] = ORBIT_POSITIONS[source.source_code] ??
              FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length];
            const on = index === selected;
            const mark = DEFERRAL_MARKS[source.deferral_code] ?? FALLBACK_MARK;
            return (
              <line
                key={source.source_code}
                x1={50}
                y1={50}
                x2={x}
                y2={y}
                stroke={on ? mark.color : "rgba(165,243,252,.14)"}
                strokeWidth={on ? 0.5 : 0.3}
                strokeDasharray="2 2"
              />
            );
          })}
        </svg>

        <div className="wi-orbit-center">
          <strong>Publication</strong>
          <span>
            {authorizedCount} / {sources.length} autorisée{authorizedCount > 1 ? "s" : ""}
          </span>
        </div>

        {sources.map((source, index) => {
          const [x, y] = ORBIT_POSITIONS[source.source_code] ??
            FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length];
          const on = index === selected;
          const mark = DEFERRAL_MARKS[source.deferral_code] ?? FALLBACK_MARK;
          const stateLabel = DEFERRAL_LABELS[source.deferral_code] ?? source.state_label;
          return (
            <button
              key={source.source_code}
              type="button"
              className="wi-orbit-node"
              data-selected={on ? "true" : "false"}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                background: on ? "var(--wi-raised)" : "var(--wi-card)",
                border: `1px solid ${on ? mark.color : "var(--wi-border)"}`,
                padding: on ? "0.8125rem 1.125rem" : "0.625rem 0.875rem",
                boxShadow: on ? `0 0 0 3px color-mix(in srgb, ${mark.color} 20%, transparent)` : "none",
                zIndex: on ? 3 : 2,
              }}
              aria-expanded={on}
              aria-controls={panelId}
              title={stateLabel}
              onClick={() => setSelected(index)}
              data-testid={`wi-source-trigger-${source.source_code}`}
            >
              <span style={{ color: mark.color, fontSize: on ? "1.0625rem" : "0.875rem" }} aria-hidden="true">
                {mark.icon}
              </span>
              <span>
                {SHORT_LABELS[source.source_code] ?? source.label}
                {/* Texte réel, jamais peint : sept sources qui n'afficheraient
                    à l'écran qu'une icône et un nom court seraient
                    indiscernables sans survol — le libellé d'état DISTINCT de
                    chaque source reste dans le DOM, pas seulement au clic. */}
                <span className="wi-visually-hidden"> — {stateLabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------- Détail source */}
      <div className="wi-orbit-detail" id={panelId} data-testid="wi-source-detail">
        <div className="wi-orbit-detail-head">
          <h3 className="wi-h3" style={{ fontSize: "1.125rem" }}>
            {selectedSource?.label}
          </h3>
          {selectedSource && (
            <span
              className="wi-badge"
              style={{ color: selectedMark.color }}
              data-testid="wi-source-badge"
            >
              <span aria-hidden="true">{selectedMark.icon}</span>
              {DEFERRAL_LABELS[selectedSource.deferral_code] ?? selectedSource.state_label}
            </span>
          )}
        </div>

        {selectedProfile && (
          <dl className="wi-orbit-facts">
            <div>
              <dt>Rôle</dt>
              <dd>{selectedProfile.role}</dd>
            </div>
            <div>
              <dt>Couverture</dt>
              <dd>{selectedProfile.coverage}</dd>
            </div>
            <div>
              <dt>Méthode</dt>
              <dd>{selectedProfile.method}</dd>
            </div>
            <div>
              <dt data-warn="true">Prochaine action</dt>
              <dd>{selectedProfile.nextAction}</dd>
            </div>
          </dl>
        )}

        {selectedSource && (
          <p className="wi-muted" style={{ marginTop: "1rem", fontSize: "0.8125rem" }}>
            {selectedSource.blocking_reason}
            {selectedSource.authorized_scope && (
              <>
                {" "}
                Périmètre signé&nbsp;:{" "}
                <span className="wi-mono">
                  {selectedSource.authorized_scope.geography_type}{" "}
                  {selectedSource.authorized_scope.geography_code}
                </span>
                , du {selectedSource.authorized_scope.period_start} au{" "}
                {selectedSource.authorized_scope.period_end}.
              </>
            )}
          </p>
        )}

        <p className="wi-orbit-foot">
          L&apos;état, le motif et le périmètre viennent du document backend — jamais
          réécrits ici.
        </p>
      </div>
    </div>

      <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
        Sept licences vérifiées, une publication autorisée. L&apos;écart entre ces deux
        nombres est le sujet de cette section&nbsp;: identifier une licence permissive
        n&apos;autorise rien. La décision est humaine, se prend source par source, et
        se signe.
      </p>
    </div>
  );
}
