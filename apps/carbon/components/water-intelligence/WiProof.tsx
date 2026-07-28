"use client";

/**
 * WiProof — « Chaque valeur porte sa preuve ».
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
 */

import { useCallback, useState } from "react";

import { FINANCIAL_BRIDGE } from "@/lib/water-intelligence/editorial-matrices";

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
    <dl className="wi-proof" data-testid="wi-proof">
      {fields.map((field) => (
        <div key={field.label} className="wi-proof-row">
          <dt>{field.label}</dt>
          <dd>
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
                {field.copyable && <CopyButton value={field.value} label={field.label} />}
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

const KIND_ACCENTS: Record<string, string> = {
  exposition: "wi-accent-stress",
  cout: "wi-accent-data",
  comptable: "wi-accent-compliance",
};

/**
 * Financial Water Bridge — dix étapes, aucune écriture comptable.
 *
 * Chaque étape est une QUESTION à instruire. Le module ne génère aucune
 * écriture, ne produit aucun montant et n'invente aucun taux : le calcul se
 * fait côté authentifié, sur des données d'entreprise, avec des hypothèses
 * explicites — et un taux d'actualisation FOURNI, jamais par défaut.
 */
export function WiFinancialBridge() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div data-testid="wi-financial-bridge">
      <ol className="wi-bridge">
        {FINANCIAL_BRIDGE.map((step, index) => (
          <li key={step.id} className={`wi-bridge-step ${KIND_ACCENTS[step.kind]}`}>
            <button
              type="button"
              className="wi-bridge-trigger"
              aria-expanded={open === step.id}
              onClick={() => setOpen(open === step.id ? null : step.id)}
              data-testid={`wi-bridge-${step.id}`}
            >
              <span className="wi-bridge-rank wi-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="wi-bridge-body">
                <span className="wi-bridge-label">{step.label}</span>
                <span className="wi-bridge-kind">{KIND_LABELS[step.kind]}</span>
              </span>
            </button>
            {open === step.id && (
              <div className="wi-bridge-panel">
                <p className="wi-muted">
                  <strong>{step.question}</strong>
                </p>
                <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                  {step.note}
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>

      <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
        Aucune écriture comptable n&apos;est générée, aucun montant n&apos;apparaît sur
        cette page et aucun taux n&apos;est encodé. Une entrée absente rend un résultat
        absent <em>avec son motif</em>, jamais zéro&nbsp;: un montant manquant traité
        comme <span className="wi-mono">0</span> se lit « pas d&apos;exposition ».
      </p>
    </div>
  );
}
