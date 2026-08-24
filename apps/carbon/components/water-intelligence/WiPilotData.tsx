"use client";

/**
 * WiPilotData — Observed Withdrawals : les observations réellement publiées
 * (Water Intelligence v3, WI-V3-03).
 *
 * ## Ce que cette section NE produit pas, et ne peut pas produire
 *
 * Ni total, ni moyenne, ni médiane, ni variation, ni part du total, ni
 * classement, ni score, ni ratio entre ouvrages, ni extrapolation, ni
 * normalisation. `derived_use_allowed = false` au registre des décisions, et
 * la raison est concrète : la couverture BNPE est partielle par construction —
 * les volumes exonérés de redevance sont inconnus et les petits volumes ne
 * sont pas déclarés. Un total sur trois ouvrages présenterait une somme
 * partielle comme le prélèvement de la commune.
 *
 * L'ordre d'affichage est celui du DOCUMENT, jamais un tri par valeur :
 * classer trois volumes produirait un classement. Ici, la plus grande valeur
 * tombe au milieu — et c'est la meilleure preuve visuelle que rien n'est trié.
 *
 * ## L'axe commun est CONDITIONNEL, et la condition est vérifiée en code
 *
 * Un axe partagé à baseline zéro n'est honnête que si les valeurs sont
 * commensurables. `comparability()` l'exige explicitement : même unité, même
 * période, même méthode. Si l'une des trois diverge, aucune longueur n'est
 * dessinée — parce qu'une longueur comparée entre deux unités différentes est
 * un mensonge visuel, et qu'aucun avertissement en petits caractères ne le
 * rattrape.
 *
 * Ce n'est pas une précaution théorique : le jour où une deuxième source
 * publiera (hydrométrie en l/s, piézométrie en m NGF), la condition tombera
 * d'elle-même et la section se repliera sur les valeurs seules.
 *
 * ## Une absence n'est JAMAIS un zéro
 *
 * Une observation sans valeur numérique ne reçoit pas de tige de longueur
 * nulle — elle reçoit un état d'indisponibilité explicite. Une tige à zéro se
 * lirait « on a mesuré, et c'était zéro », ce qui est l'inverse de « on n'a
 * pas de valeur ».
 *
 * ## Le chiffre prime sur la forme
 *
 * La valeur exacte est rendue en texte, en graisse d'affichage, à droite de
 * chaque piste. La tige et le point illustrent ; ils ne remplacent jamais le
 * nombre, et le retirer ne retirerait aucune information.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { formatVolume, type PilotObservationRow } from "@/lib/water-intelligence/pilot-snapshot";

import { CopyButton } from "./WiProof";

/**
 * Libellés du statut de qualité. Repris du vocabulaire du contrat
 * (`WaterDataStatusEnum`) — jamais réinterprétés : « manual » dit qu'un
 * exploitant a déclaré la valeur, ni qu'elle a été observée, ni modélisée.
 */
const DATA_STATUS_LABEL: Record<string, string> = {
  observed: "Observé",
  modelled: "Modélisé",
  estimated: "Estimé",
  manual: "Déclaré",
  fixture: "Fixture",
};

interface Track {
  readonly observation: PilotObservationRow;
  /**
   * Longueur de la tige, en pourcentage de l'échelle. `null` quand la valeur
   * n'est pas un nombre — jamais 0 : voir la docstring, une absence n'est pas
   * un zéro.
   */
  readonly pct: number | null;
}

/**
 * Les trois conditions de commensurabilité. Toutes doivent tenir pour qu'un
 * axe commun ait un sens.
 */
function comparability(observations: readonly PilotObservationRow[]): {
  sharedAxis: boolean;
  reason: string | null;
} {
  const units = new Set(observations.map((o) => o.unit ?? "n.c."));
  const periods = new Set(observations.map((o) => `${o.periodStart}→${o.periodEnd}`));
  const methods = new Set(observations.map((o) => `${o.methodCode}·${o.methodVersion}`));

  if (units.size > 1) return { sharedAxis: false, reason: "les unités diffèrent d'une observation à l'autre" };
  if (periods.size > 1) return { sharedAxis: false, reason: "les périodes observées diffèrent" };
  if (methods.size > 1) return { sharedAxis: false, reason: "les méthodes d'acquisition diffèrent" };
  return { sharedAxis: true, reason: null };
}

export interface WiPilotDataProps {
  observations: readonly PilotObservationRow[];
  coverageWarnings: readonly string[];
  scopeLabel: string;
  attribution: string | null;
  sourceUrl: string | null;
  isPublished: boolean;
  reviewedOn: string;
  sourceCode: string;
  licenseLabel: string;
  methodLabel: string;
  yearLabel: string;
  /** Message expliquant l'état non généré — jamais un faux snapshot. */
  notGeneratedExplanation: string;
}

export function WiPilotData({
  observations,
  coverageWarnings,
  scopeLabel,
  attribution,
  sourceUrl,
  isPublished,
  reviewedOn,
  sourceCode,
  licenseLabel,
  methodLabel,
  yearLabel,
  notGeneratedExplanation,
}: WiPilotDataProps) {
  const reduce = useReducedMotion();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const listRef = useRef<HTMLOListElement | null>(null);
  const panelPrefix = useId();

  /*
   * Entrée dans le viewport, UNE SEULE FOIS.
   *
   * L'observateur se déconnecte au premier passage : l'animation ne rejoue ni
   * au défilement inverse, ni à un changement d'état. L'état de base en CSS
   * est l'état FINAL — sans JavaScript, les tiges sont dessinées à leur
   * longueur, et rien n'attend ce code pour être lisible.
   */
  useEffect(() => {
    if (reduce) return undefined;
    const node = listRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-40px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduce]);

  const { sharedAxis, reason } = useMemo(() => comparability(observations), [observations]);

  /* La plus grande valeur sert d'ÉCHELLE au graphique, pas de référence
     éditoriale : elle n'est ni un maximum communal, ni un total. Elle borne
     l'axe, et c'est tout ce qu'elle fait. */
  const numericValues = useMemo(
    () =>
      observations
        .filter((o): o is PilotObservationRow & { value: number } => typeof o.value === "number")
        .map((o) => o.value),
    [observations],
  );
  const scale = numericValues.length > 0 ? Math.max(...numericValues) : null;

  const tracks: readonly Track[] = useMemo(
    () =>
      observations.map((observation) => {
        if (typeof observation.value !== "number" || scale === null || !sharedAxis) {
          return { observation, pct: null };
        }
        /*
         * Un zéro MESURÉ — distinct d'une absence — va à l'origine exacte de
         * l'axe, jamais au plancher. Le schéma des métriques l'autorise :
         * une observation peut légitimement valoir 0, y compris à côté
         * d'observations non nulles (`scale` alors non nul). Le plancher
         * existe pour garder VISIBLE une valeur réelle mais MINUSCULE, pas
         * pour déplacer un zéro loin de son origine — un zéro affublé d'un
         * plancher de 1,5 % se lirait comme « une petite valeur positive »,
         * l'inverse de ce qu'il est.
         *
         * Ce contrôle précède celui de `scale`, et le couvre par construction
         * : `scale` est le maximum des valeurs numériques (jamais négatives
         * pour un volume), donc `scale === 0` implique que CETTE observation
         * vaut aussi 0 quand elle est numérique. Diviser par un `scale` nul
         * produirait sinon `NaN`, qu'aucun plancher ne rattrape (`Math.max`
         * avec un `NaN` renvoie `NaN`).
         */
        if (observation.value === 0) {
          return { observation, pct: 0 };
        }
        /* Plancher à 1,5 % : une valeur réelle mais minuscule doit rester
           visible. Le plancher ne s'applique JAMAIS à une absence, qui n'a
           pas de tige du tout, ni à un zéro mesuré, traité ci-dessus. */
        return { observation, pct: Math.max(1.5, (observation.value / scale) * 100) };
      }),
    [observations, scale, sharedAxis],
  );

  const toggle = useCallback((code: string) => {
    setOpenCode((current) => (current === code ? null : code));
  }, []);

  if (!isPublished || observations.length === 0) {
    return (
      <div className="wi-card wi-accent-absent wi-absent-fill" data-testid="wi-pilot-not-generated">
        <div className="wi-badge wi-badge-pending">
          <span aria-hidden="true">◷</span> Document pilote non généré
        </div>
        <h3 className="wi-h3" style={{ marginTop: "0.75rem" }}>
          La décision est signée, le document ne l&apos;est pas encore
        </h3>
        <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
          {notGeneratedExplanation}
        </p>
        <p className="wi-muted" style={{ marginTop: "0.75rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
          Rien n&apos;est affiché à la place. Un snapshot d&apos;attente, même étiqueté,
          se lirait comme une donnée — et cette page n&apos;en publie aucune qu&apos;elle
          n&apos;ait pas acquise, vérifiée et signée.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="wi-pilot-data">
      <div className="wi-grid wi-grid-2" style={{ alignItems: "stretch" }}>
        {/* -------------------------------------------------- Décision signée */}
        <div className="wi-card wi-accent-water" data-testid="wi-pilot-decision">
          <p className="wi-kicker">Décision signée</p>
          <p style={{ marginTop: "0.75rem", fontSize: "0.9375rem" }}>
            Une décision humaine signée le <strong>{reviewedOn}</strong> autorise la
            publication de <strong>{observations.length} observations</strong> de
            prélèvements déclarés, sur la {scopeLabel}. Rien d&apos;autre.
          </p>
          <dl className="wi-pilot-facts">
            <div>
              <dt>Source</dt>
              <dd className="wi-mono">{sourceCode}</dd>
            </div>
            <div>
              <dt>Licence</dt>
              <dd>{licenseLabel}</dd>
            </div>
            <div>
              <dt>Méthode</dt>
              <dd>{methodLabel}</dd>
            </div>
          </dl>

          {/* Tous les avertissements obligatoires — la maquette n'en illustre
              qu'un, cette page les porte tous, dans l'ordre du document. */}
          <ul
            className="wi-limit-list"
            style={{
              marginTop: "1.125rem",
              paddingTop: "0.875rem",
              borderTop: "1px solid var(--wi-border)",
              color: "var(--wi-stress)",
            }}
            data-testid="wi-pilot-warnings"
          >
            {coverageWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>

        {/* ------------------------------------------- Observed Withdrawals */}
        <div className="wi-card wi-lolli-card">
          <div className="wi-lolli-head">
            <h3 className="wi-h3">Volumes annuels par ouvrage — {yearLabel}</h3>
            <span className="wi-mono wi-lolli-unit-note">
              unité&nbsp;: {observations[0]?.unit ?? "n.c."}
            </span>
          </div>

          <ol
            className={entered ? "wi-lolli wi-lolli-animate" : "wi-lolli"}
            ref={listRef}
            data-testid="wi-pilot-tracks"
          >
            {tracks.map(({ observation, pct }, index) => {
              const panelId = `${panelPrefix}-${observation.ouvrageCode}`;
              const isOpen = openCode === observation.ouvrageCode;
              return (
                <li
                  key={observation.ouvrageCode}
                  className="wi-lolli-row"
                  style={{ "--wi-i": index } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className="wi-lolli-trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(observation.ouvrageCode)}
                    data-testid={`wi-observation-${observation.ouvrageCode}`}
                  >
                    <span className="wi-lolli-ident">
                      <span className="wi-lolli-code wi-mono">{observation.ouvrageCode}</span>
                      <span className="wi-lolli-meta">
                        {DATA_STATUS_LABEL[observation.dataStatus] ?? observation.dataStatus}
                        {" · "}
                        {observation.periodStart.slice(0, 4)}
                      </span>
                    </span>

                    {/* Tracé : décoratif. Le nombre à droite porte
                        l'information, et il est rendu quoi qu'il arrive. */}
                    {pct === null ? (
                      <span className="wi-lolli-absent">
                        <span className="wi-badge wi-badge-absent">
                          <span aria-hidden="true">◇</span> Valeur non disponible
                        </span>
                      </span>
                    ) : (
                      <span className="wi-lolli-track" aria-hidden="true">
                        <span className="wi-lolli-stem" style={{ width: `${pct}%` }} />
                        <span className="wi-lolli-dot" style={{ left: `${pct}%` }} />
                      </span>
                    )}

                    <span className="wi-lolli-value">
                      <span className="wi-num">{formatVolume(observation.value)}</span>
                      <span className="wi-lolli-unit">{observation.unit ?? ""}</span>
                    </span>

                    <span className="wi-lolli-chevron" aria-hidden="true">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <dl className="wi-lolli-panel" id={panelId} data-testid="wi-observation-detail">
                      <InspectionRow label="Observation">
                        <span className="wi-num">{formatVolume(observation.value)}</span>{" "}
                        {observation.unit ?? ""}
                      </InspectionRow>
                      <InspectionRow label="Source">
                        <span className="wi-mono">{sourceCode}</span>
                      </InspectionRow>
                      <InspectionRow label="Géographie">
                        <span className="wi-mono">{observation.ouvrageCode}</span> — ouvrage déclaré
                      </InspectionRow>
                      <InspectionRow label="Période observée">
                        {observation.periodStart} → {observation.periodEnd}
                      </InspectionRow>
                      <InspectionRow label="Date de consultation">
                        {observation.retrievedAt}
                      </InspectionRow>
                      <InspectionRow label="Méthode">
                        <span className="wi-mono">
                          {observation.methodCode} · {observation.methodVersion}
                        </span>
                      </InspectionRow>
                      <InspectionRow label="Statut de qualité">
                        {DATA_STATUS_LABEL[observation.dataStatus] ?? observation.dataStatus} (
                        <span className="wi-mono">{observation.dataStatus}</span>)
                      </InspectionRow>
                      <InspectionRow label="Clé de release">
                        <span className="wi-mono">{observation.releaseKey}</span>
                      </InspectionRow>
                      {/* Douze caractères par défaut, pour ne pas encombrer la
                          lecture ; le bouton « Afficher en entier » rend les
                          soixante-quatre sans dépendre du presse-papiers —
                          voir la docstring de `ChecksumField`. */}
                      <InspectionRow label="Empreinte du payload">
                        <ChecksumField
                          checksum={observation.checksum}
                          ouvrageCode={observation.ouvrageCode}
                        />
                      </InspectionRow>
                      <InspectionRow label="Décision de publication">
                        Approuvée le {reviewedOn} — aucun usage dérivé autorisé.
                      </InspectionRow>
                    </dl>
                  )}
                </li>
              );
            })}
          </ol>

          {/*
            L'axe et sa condition. Le lecteur doit pouvoir savoir CE QUE la
            longueur mesure, et ce qu'elle ne mesure pas.
          */}
          {sharedAxis && scale !== null ? (
            <p className="wi-lolli-axis" data-testid="wi-pilot-axis">
              Axe commun, origine zéro&nbsp;: 0 →{" "}
              <span className="wi-num">{formatVolume(scale)}</span>{" "}
              {observations[0]?.unit ?? ""}. La borne est la plus grande valeur publiée
              — <strong>ni un maximum communal, ni un total</strong>. Les trois
              observations partagent unité, période et méthode&nbsp;: c&apos;est ce qui
              rend un axe commun légitime.
            </p>
          ) : (
            <p className="wi-lolli-axis" data-testid="wi-pilot-axis-absent">
              Aucune longueur n&apos;est dessinée&nbsp;: {reason}. Comparer des barres
              dans ce cas produirait une image fausse qu&apos;aucune note ne
              rattraperait. Les valeurs restent affichées, chacune avec son unité.
            </p>
          )}

          <p className="wi-lolli-foot wi-muted">
            Valeurs indépendantes. Aucun total, aucune moyenne, aucun classement&nbsp;:
            la décision de publication interdit tout usage dérivé, et l&apos;ordre
            d&apos;affichage est celui du document — pas un tri.
          </p>
        </div>
      </div>

      {/* -------------------------------- Ce que ces données ne disent pas */}
      <div className="wi-card wi-accent-stress" style={{ marginTop: "1.5rem" }} data-testid="wi-pilot-limits">
        <h3 className="wi-h3">Ce que ces données ne disent pas</h3>
        <ul className="wi-limit-list">
          <li>
            Trois ouvrages ne décrivent pas une commune. Le périmètre est exhaustif
            <em> pour ce que la BNPE déclare</em>, ce qui n&apos;est pas la même chose
            qu&apos;exhaustif pour ce qui est prélevé.
          </li>
          <li>
            Un volume annuel ne dit rien de sa répartition dans l&apos;année&nbsp;: un
            prélèvement concentré sur l&apos;été et un prélèvement régulier produisent
            le même nombre et pas la même pression sur la ressource.
          </li>
          <li>
            Aucune conclusion de conformité n&apos;est tirée de ces valeurs. La
            conformité relève exclusivement du registre juridique, qui n&apos;instruit
            aujourd&apos;hui aucun texte.
          </li>
        </ul>

        {(attribution || sourceUrl) && (
          <p className="wi-muted wi-pilot-attribution">
            {attribution}
            {sourceUrl && (
              <>
                {" "}
                <a href={sourceUrl} className="wi-link" target="_blank" rel="noreferrer noopener">
                  Page officielle de la source
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function InspectionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wi-lolli-panel-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Empreinte de payload — 12 caractères par défaut, 64 sur demande.
 *
 * `CopyButton` échoue silencieusement hors contexte sécurisé ou si la
 * permission est refusée (voir sa docstring dans `WiProof.tsx`) : son propre
 * commentaire promet qu'« la valeur reste affichée en entier et
 * sélectionnable », promesse que cette section ne tenait pas — seuls les 12
 * premiers caractères atteignaient jamais le DOM, et les 52 restants
 * n'existaient que comme argument du presse-papiers. Un lecteur dont le
 * presse-papiers échoue n'avait alors aucun moyen d'obtenir l'empreinte
 * complète, malgré la promesse.
 *
 * Le repli n'est donc pas le presse-papiers : c'est ce bouton, qui ne dépend
 * d'aucune permission ni d'aucun contexte sécurisé.
 */
function ChecksumField({ checksum, ouvrageCode }: { checksum: string; ouvrageCode: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
      <span className="wi-mono" style={{ overflowWrap: "anywhere" }}>
        {expanded ? checksum : `${checksum.slice(0, 12)}…`}
      </span>
      <button
        type="button"
        className="wi-copy"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        data-testid={`wi-checksum-expand-${ouvrageCode}`}
      >
        {expanded ? "Réduire" : "Afficher en entier"}
      </button>
      <CopyButton value={checksum} label={`l'empreinte de ${ouvrageCode}`} />
    </span>
  );
}
