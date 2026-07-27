"use client";

/**
 * WiConstellation — les sept sources, leur état réel et ce qui les bloque.
 *
 * ## Ce que cette section remplace
 *
 * Une liste de blocs hachurés qui disaient tous « non branché ». C'était
 * exact et inutile : sept sources y avaient l'air d'échouer de la même façon,
 * alors qu'aucune n'échoue pour la même raison — et que l'une d'elles publie.
 *
 * Chaque source ouvre un panneau qui nomme son rôle, sa couverture, sa
 * méthode, son blocage et sa prochaine action. Un état produit lisible, pas
 * un carré vide.
 *
 * ## La couleur ne dit rien seule
 *
 * Chaque état porte une icône, un libellé et un motif de bordure distincts.
 * Un lecteur qui ne perçoit pas la différence entre le turquoise et l'ambre
 * lit « Publié — pilote limité » et « Validé — reporté pour budget ».
 */

import { useId, useState } from "react";

import type { WiSourceStatus } from "@/lib/water-intelligence/canonical-snapshot";

/** Fiche éditoriale d'une source — ce que le registre backend ne porte pas. */
interface SourceProfile {
  readonly role: string;
  readonly coverage: string;
  readonly method: string;
  readonly nextAction: string;
}

/**
 * Rôle, couverture, méthode et prochaine action par source.
 *
 * Ces quatre champs sont ÉDITORIAUX : ils expliquent à un lecteur ce que la
 * source apporte. L'état, le motif de blocage et le périmètre viennent du
 * document backend — ils ne sont jamais réécrits ici, où ils dériveraient.
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

/** Libellé public de chaque motif normalisé. */
const DEFERRAL_LABELS: Record<string, string> = {
  published_limited_scope: "Publié — pilote limité",
  deferred_over_budget: "Validé — reporté pour budget",
  subdaily_identity_collision: "Collision d'identité sous-journalière",
  manual_artifact_required: "Artefact manuel requis",
  blocked_registration_required: "Enregistrement requis",
  source_verified_decoder_deferred: "Décodage différé",
};

/** Icône ET classe d'accent : deux signaux, jamais la couleur seule. */
const DEFERRAL_MARKS: Record<string, { icon: string; accent: string; badge: string }> = {
  published_limited_scope: { icon: "●", accent: "wi-accent-water", badge: "wi-badge-published" },
  deferred_over_budget: { icon: "▮", accent: "wi-accent-stress", badge: "wi-badge-demo" },
  subdaily_identity_collision: { icon: "◆", accent: "wi-accent-stress", badge: "wi-badge-demo" },
  manual_artifact_required: { icon: "▲", accent: "wi-accent-absent", badge: "wi-badge-absent" },
  blocked_registration_required: { icon: "■", accent: "wi-accent-alert", badge: "wi-badge-alert" },
  source_verified_decoder_deferred: { icon: "◇", accent: "wi-accent-absent", badge: "wi-badge-absent" },
};

const FALLBACK_MARK = { icon: "○", accent: "wi-accent-absent", badge: "wi-badge-absent" };

export function WiConstellation({ sources }: { sources: readonly WiSourceStatus[] }) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const panelBaseId = useId();

  return (
    <div data-testid="wi-constellation">
      <ul className="wi-constellation">
        {sources.map((source) => {
          const mark = DEFERRAL_MARKS[source.deferral_code] ?? FALLBACK_MARK;
          const isOpen = openCode === source.source_code;
          const panelId = `${panelBaseId}-${source.source_code}`;
          const profile = PROFILES[source.source_code];

          return (
            <li key={source.source_code} className={`wi-constellation-node ${mark.accent}`}>
              <button
                type="button"
                className="wi-constellation-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenCode(isOpen ? null : source.source_code)}
                data-testid={`wi-source-trigger-${source.source_code}`}
              >
                <span className="wi-constellation-head">
                  <span className={`wi-badge ${mark.badge}`}>
                    <span aria-hidden="true">{mark.icon}</span>
                    {DEFERRAL_LABELS[source.deferral_code] ?? source.state_label}
                  </span>
                  <span className="wi-constellation-toggle" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </span>
                <span className="wi-constellation-title">{source.label}</span>
                <span className="wi-mono wi-constellation-code">{source.source_code}</span>
              </button>

              {isOpen && (
                <div id={panelId} className="wi-constellation-panel" data-testid={`wi-source-panel-${source.source_code}`}>
                  {profile && (
                    <dl className="wi-constellation-facts">
                      <div>
                        <dt>Rôle</dt>
                        <dd>{profile.role}</dd>
                      </div>
                      <div>
                        <dt>Couverture</dt>
                        <dd>{profile.coverage}</dd>
                      </div>
                      <div>
                        <dt>Méthode</dt>
                        <dd>{profile.method}</dd>
                      </div>
                    </dl>
                  )}

                  <div className="wi-constellation-block">
                    <p className="wi-kicker">Ce qui bloque, ou ce qui limite</p>
                    <p className="wi-muted">{source.blocking_reason}</p>
                  </div>

                  {profile && (
                    <div className="wi-constellation-block">
                      <p className="wi-kicker">Prochaine action</p>
                      <p className="wi-muted">{profile.nextAction}</p>
                    </div>
                  )}

                  <div className="wi-constellation-block">
                    <p className="wi-kicker">Provenance</p>
                    <p className="wi-muted" style={{ fontSize: "0.875rem" }}>
                      Licence <span className="wi-mono">{source.license_code ?? "non vérifiée"}</span>
                      {source.license_verified_in && <> — vérifiée en {source.license_verified_in}</>}
                      {source.license_scope === "platform" && (
                        <>
                          {" "}
                          <strong>au niveau de la plateforme</strong>, pas jeu par jeu.
                        </>
                      )}
                      {source.authorized_scope && (
                        <>
                          {" "}
                          Périmètre signé&nbsp;:{" "}
                          <span className="wi-mono">
                            {source.authorized_scope.geography_type}{" "}
                            {source.authorized_scope.geography_code}
                          </span>
                          , du {source.authorized_scope.period_start} au{" "}
                          {source.authorized_scope.period_end}.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
        Sept licences vérifiées, une publication autorisée. L&apos;écart entre ces deux
        nombres est le sujet de cette section&nbsp;: identifier une licence permissive
        n&apos;autorise rien. La décision est humaine, se prend source par source, et
        se signe.
      </p>
    </div>
  );
}
