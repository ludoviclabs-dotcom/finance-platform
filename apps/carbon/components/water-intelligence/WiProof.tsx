"use client";

/**
 * WiProof — « Chaque valeur porte sa preuve » (Water Intelligence v2).
 *
 * ## Ce que cette section rend copiable, et pourquoi
 *
 * Checksum, code source, clé de release et URL officielle. Ce sont les quatre
 * références qu'un lecteur qui veut VÉRIFIER doit pouvoir emporter — et une
 * chaîne de 64 caractères hexadécimaux ne se recopie pas à la main sans
 * erreur. Rendre la vérification pénible revient à la décourager.
 *
 * Le repli sur `document.execCommand` n'existe pas : `navigator.clipboard`
 * est indisponible hors contexte sécurisé, et dans ce cas la valeur reste
 * affichée en entier, sélectionnable. Un bouton qui échoue silencieusement
 * serait pire que pas de bouton.
 *
 * ## Ce qui a changé par rapport à la V1
 *
 * `WiProofTable` passe d'une liste de définitions empilée à une grille de
 * cartes — la disposition change, pas la sémantique : chaque carte reste un
 * `dt`/`dd`, la copie et l'état absent sont identiques à l'octet près.
 *
 * `WiFinancialBridge` passe d'une grille à deux colonnes à un stepper
 * horizontal. Un nouveau `WiFinancialSimulator` s'y ajoute : il pose deux
 * hypothèses qualitatives (durée d'interruption, capacité restante) et
 * affiche quelles étapes du pont DEVIENNENT des questions à instruire — sans
 * produire le moindre montant. C'est une règle d'affichage à seuils, pas un
 * calcul ; le moteur de scénarios réel reste côté authentifié.
 */

import { useCallback, useId, useMemo, useState } from "react";

import {
  FINANCIAL_BRIDGE,
  financialBridgeQuestionsToInstruct,
} from "@/lib/water-intelligence/editorial-matrices";

/* ---------------------------------------------------------- Copie */

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Contexte non sécurisé ou permission refusée : la valeur reste
         affichée en entier et sélectionnable — rien n'est perdu. */
    }
  }, [value]);

  return (
    <button
      type="button"
      className="wi-copy"
      onClick={copy}
      /* Le libellé nomme CE QUI est copié : « Copier » seul, répété six fois
         dans la page, ne dit rien à un lecteur d'écran qui parcourt les
         boutons. */
      aria-label={`Copier ${label}`}
      data-testid={`wi-copy-${label.replace(/\s+/g, "-")}`}
    >
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

export interface ProofField {
  readonly label: string;
  readonly value: string | null;
  readonly copyable?: boolean;
  readonly mono?: boolean;
  readonly href?: string;
  /** Précision affichée sous la valeur — jamais à la place. */
  readonly note?: string;
}

export function WiProofTable({ fields }: { fields: readonly ProofField[] }) {
  return (
    <dl className="wi-proof-cards" data-testid="wi-proof">
      {fields.map((field) => (
        <div key={field.label} className="wi-proof-card">
          <div className="wi-proof-card-head">
            <dt
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--wi-subtle)",
                fontWeight: 650,
              }}
            >
              {field.label}
            </dt>
            {field.value !== null && field.copyable && (
              <CopyButton value={field.value} label={field.label} />
            )}
          </div>
          <dd style={{ margin: 0 }}>
            {field.value === null ? (
              /* Une absence est rendue COMME une absence, avec son motif, et
                 jamais comme une chaîne vide ou un tiret sans explication. */
              <span className="wi-proof-absent">
                <span className="wi-badge wi-badge-absent">
                  <span aria-hidden="true">◇</span> Non relevé
                </span>
              </span>
            ) : (
              <span className="wi-proof-value">
                {field.href ? (
                  <a
                    href={field.href}
                    className={`wi-link ${field.mono ? "wi-mono" : ""}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {field.value}
                  </a>
                ) : (
                  <span className={field.mono ? "wi-mono" : undefined}>{field.value}</span>
                )}
              </span>
            )}
            {field.note && <span className="wi-proof-note">{field.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------- Passerelle financière */

const KIND_LABELS: Record<string, string> = {
  exposition: "Exposition",
  cout: "Coût",
  comptable: "Signal comptable",
};

const KIND_BORDER: Record<string, string> = {
  exposition: "var(--wi-stress)",
  cout: "var(--wi-data)",
  comptable: "var(--wi-compliance)",
};

/**
 * Financial Water Bridge — dix étapes, aucune écriture comptable.
 *
 * Chaque étape est une QUESTION à instruire. Le module ne génère aucune
 * écriture, ne produit aucun montant et n'invente aucun taux : le calcul se
 * fait côté authentifié, sur des données d'entreprise, avec des hypothèses
 * explicites — et un taux d'actualisation FOURNI, jamais par défaut.
 *
 * `activeSteps`, si fourni, vient du simulateur ci-dessous : une étape
 * inactive n'est pas cachée — elle reste une question légitime à instruire —
 * mais l'accent visuel indique laquelle les deux hypothèses posées rendent
 * concrète EN PLUS des huit qui le sont déjà par défaut.
 */
export function WiFinancialBridge({
  activeSteps,
}: {
  activeSteps?: readonly boolean[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div data-testid="wi-financial-bridge">
      <div className="wi-bridge-stepper" role="list">
        {FINANCIAL_BRIDGE.map((step, index) => {
          const isOpen = open === step.id;
          const isActive = activeSteps ? activeSteps[index] : true;
          return (
            <div key={step.id} className="wi-bridge-stepper-item" role="listitem">
              <button
                type="button"
                className="wi-bridge-stepper-btn"
                style={{
                  borderTopColor: KIND_BORDER[step.kind],
                  opacity: isActive ? 1 : 0.5,
                }}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : step.id)}
                data-testid={`wi-bridge-${step.id}`}
                data-open={isOpen ? "true" : "false"}
              >
                <span className="wi-bridge-stepper-rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="wi-bridge-stepper-label">{step.label}</span>
              </button>
              {index < FINANCIAL_BRIDGE.length - 1 && (
                <span className="wi-bridge-stepper-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      {open &&
        FINANCIAL_BRIDGE.filter((s) => s.id === open).map((step) => (
          <div className="wi-bridge-panel" key={step.id} style={{ marginTop: "0.5rem" }}>
            <p className="wi-muted">
              <strong>{step.question}</strong>
            </p>
            <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
              {step.note}
            </p>
          </div>
        ))}

      <div className="wi-bridge-legend">
        {(["exposition", "cout", "comptable"] as const).map((kind) => (
          <span key={kind} className="wi-bridge-legend-item">
            <span style={{ background: KIND_BORDER[kind] }} />
            {KIND_LABELS[kind]}
          </span>
        ))}
      </div>

      <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
        Aucune écriture comptable n&apos;est générée, aucun montant n&apos;apparaît sur
        cette page et aucun taux n&apos;est encodé. Une entrée absente rend un résultat
        absent <em>avec son motif</em>, jamais zéro&nbsp;: un montant manquant traité
        comme <span className="wi-mono">0</span> se lit « pas d&apos;exposition ».
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- Simulateur */

/**
 * Simulateur qualitatif — deux curseurs, aucun montant.
 *
 * Les deux hypothèses (jours d'interruption, capacité restante) ne
 * déclenchent qu'un affichage à seuils via `financialBridgeQuestionsToInstruct`
 * — une fonction pure, testée pour rester alignée avec l'ordre de
 * `FINANCIAL_BRIDGE`. Aucune valeur numérique n'en sort : seulement quelles
 * questions deviennent concrètes.
 */
export function WiFinancialSimulator() {
  const [days, setDays] = useState(0);
  const [capacityPct, setCapacityPct] = useState(100);
  const daysId = useId();
  const capacityId = useId();

  const active = useMemo(
    () => financialBridgeQuestionsToInstruct(days, capacityPct),
    [days, capacityPct],
  );
  const activeCount = active.filter(Boolean).length;

  return (
    <div className="wi-sim" data-testid="wi-financial-simulator">
      <div className="wi-sim-head">
        <div>
          <p className="wi-kicker" style={{ margin: 0 }}>
            Simulateur qualitatif
          </p>
          <h3 className="wi-h3" style={{ marginTop: "0.25rem" }}>
            Deux hypothèses, aucun montant
          </h3>
        </div>
        <span className="wi-badge wi-badge-pending">
          <span aria-hidden="true">◷</span> Affichage à seuils, pas un calcul
        </span>
      </div>

      <div className="wi-sim-grid">
        <div className="wi-sim-field">
          <label htmlFor={daysId}>
            Jours d&apos;interruption <output htmlFor={daysId}>{days}</output>
          </label>
          <input
            id={daysId}
            type="range"
            min={0}
            max={90}
            step={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            data-testid="wi-sim-days"
          />
        </div>
        <div className="wi-sim-field">
          <label htmlFor={capacityId}>
            Capacité restante <output htmlFor={capacityId}>{capacityPct}%</output>
          </label>
          <input
            id={capacityId}
            type="range"
            min={0}
            max={100}
            step={5}
            value={capacityPct}
            onChange={(e) => setCapacityPct(Number(e.target.value))}
            data-testid="wi-sim-capacity"
          />
        </div>
      </div>

      <p className="wi-sim-summary" style={{ marginTop: "1.5rem" }}>
        {activeCount} / {FINANCIAL_BRIDGE.length} questions à instruire avec ces hypothèses
      </p>
      <div className="wi-sim-steps" data-testid="wi-sim-steps">
        {FINANCIAL_BRIDGE.map((step, index) => (
          <span key={step.id} className="wi-sim-step" data-active={active[index] ? "true" : "false"}>
            {step.label}
          </span>
        ))}
      </div>

      <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch", fontSize: "0.8125rem" }}>
        Ces seuils décident quelle carte s&apos;allume, rien de plus&nbsp;: aucun
        montant, aucun taux, aucune écriture n&apos;en sort. Le calcul réel exige des
        données d&apos;entreprise et un taux d&apos;actualisation fourni, côté
        authentifié.
      </p>
    </div>
  );
}
