/**
 * components/water-decision/WdStates.tsx — rendu des six états d'une facette
 * (Wave E-Interface, commit F2).
 *
 * Composants de PRÉSENTATION purs : ils reçoivent un état déjà décidé par
 * `lib/water-decision/facets.ts` et n'appellent rien. Chaque état est donc
 * rendu statiquement dans les tests, y compris ceux qu'une page en marche ne
 * montrerait qu'en panne.
 *
 * Règle d'accessibilité tenue ici : **la couleur ne porte jamais seule
 * l'information**. Chaque état affiche un libellé texte explicite ; la teinte
 * ne fait que le doubler.
 */

import type { ReactNode } from "react";

import {
  FACET_HINTS,
  FACET_LABELS,
  absenceText,
  mixedVocabularyWarning,
  type WdFacetState,
} from "@/lib/water-decision/facets";
import type { WiFacetKind } from "@/lib/api/water-decision";

/* ------------------------------------------------------------- Primitives */

/** Bandeau d'état d'une facette. `label` est toujours du texte. */
function StateNotice({
  tone,
  label,
  children,
  testId,
}: {
  tone: "neutral" | "warning" | "danger";
  label: string;
  children: ReactNode;
  testId: string;
}) {
  const toneClass = {
    neutral:
      "border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)]",
    warning:
      "border-[var(--color-warning)]/40 bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
    danger:
      "border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  }[tone];

  return (
    <div className={`rounded-[var(--radius)] border p-3 text-sm ${toneClass}`} data-testid={testId}>
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed">{children}</p>
    </div>
  );
}

/* ------------------------------------------------------- Corps d'une facette */

/**
 * Rend l'intérieur d'une facette selon son état.
 *
 * Les six branches sont exhaustives et distinctes : une erreur ne retombe
 * jamais sur « aucune donnée », et une absence n'emprunte jamais le rendu d'une
 * valeur nulle.
 */
export function WdFacetBody({ facet, state }: { facet: WiFacetKind; state: WdFacetState }) {
  switch (state.kind) {
    case "loading":
      return (
        <StateNotice tone="neutral" label="Chargement" testId={`wd-facet-${facet}-loading`}>
          Interrogation de la synthèse en cours. Rien n’est affiché tant que la réponse n’est pas
          arrivée.
        </StateNotice>
      );

    case "schema_unavailable":
      return (
        <StateNotice
          tone="warning"
          label="Schéma non disponible"
          testId={`wd-facet-${facet}-schema-unavailable`}
        >
          Les migrations de base de données du module ne sont pas encore appliquées sur cet
          environnement. Cette facette n’a pas pu être interrogée — ce n’est pas une absence de
          données.
        </StateNotice>
      );

    case "access_denied":
      return (
        <StateNotice
          tone="warning"
          label="Accès refusé"
          testId={`wd-facet-${facet}-access-denied`}
        >
          {state.status === 401
            ? "La session n’est plus authentifiée. Reconnectez-vous pour interroger cette facette."
            : "Ce compte n’est pas autorisé à consulter cette facette. Le périmètre est résolu côté serveur."}
        </StateNotice>
      );

    case "unexpected_error":
      return (
        <StateNotice
          tone="danger"
          label="Erreur inattendue"
          testId={`wd-facet-${facet}-unexpected-error`}
        >
          {state.message} — la question n’a pas pu être posée. Cet état n’est pas une absence de
          données&nbsp;: il n’autorise aucune conclusion sur le périmètre.
        </StateNotice>
      );

    case "empty":
      return (
        <StateNotice tone="neutral" label="Aucune donnée" testId={`wd-facet-${facet}-empty`}>
          {state.reason === "declared"
            ? "La synthèse a été obtenue et ne contient aucune entrée pour cette facette. Aucune donnée n’est différent de zéro, et différent d’un risque faible."
            : "Le moteur n’a pas renvoyé cette facette. Elle reste affichée pour qu’aucune facette ne disparaisse silencieusement de la page."}
        </StateNotice>
      );

    case "available":
      return <WdFacetEntries state={state} />;
  }
}

/* ------------------------------------------------------------- Entrées */

function WdFacetEntries({
  state,
}: {
  state: Extract<WdFacetState, { kind: "available" }>;
}) {
  const { summary } = state;
  const warning = mixedVocabularyWarning(summary);

  return (
    <div data-testid={`wd-facet-${summary.facet}-available`}>
      {warning && (
        <p
          className="mb-3 rounded-[var(--radius)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-bg)] p-2 text-[0.8125rem] text-[var(--color-warning)]"
          data-testid={`wd-facet-${summary.facet}-mixed-vocabularies`}
        >
          {warning}
        </p>
      )}

      <ul className="space-y-2">
        {summary.entries.map((entry, index) => (
          <li
            key={`${entry.source_module}-${entry.label}-${index}`}
            className="rounded-[var(--radius)] border border-[var(--color-border)] p-3"
            data-testid="wd-facet-entry"
          >
            <p className="text-sm font-medium text-[var(--color-foreground)]">{entry.label}</p>

            <p className="mt-1 text-sm">
              {entry.value === null ? (
                <span
                  className="text-[var(--color-foreground-muted)]"
                  data-testid="wd-entry-absent"
                >
                  <span className="font-semibold">Donnée absente</span> — {absenceText(entry.absence_reason)}
                </span>
              ) : (
                <span className="font-mono text-[var(--color-foreground)]">{entry.value}</span>
              )}
            </p>

            {/*
              Vocabulaire et module d'origine voyagent AVEC la valeur : « high »
              ne veut rien dire tant qu'on ignore de quelle échelle il vient.
            */}
            <p className="mt-1 text-xs text-[var(--color-foreground-muted)]">
              Module&nbsp;: <span className="font-mono">{entry.source_module}</span> · vocabulaire&nbsp;:{" "}
              <span className="font-mono">{entry.vocabulary}</span>
              {entry.evidence_ref && (
                <>
                  {" "}
                  · preuve&nbsp;: <span className="font-mono">{entry.evidence_ref}</span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- Carte */

/** Une facette complète : titre, rappel de sa nature, corps selon l'état. */
export function WdFacetCard({ facet, state }: { facet: WiFacetKind; state: WdFacetState }) {
  const headingId = `wd-facet-${facet}-titre`;
  return (
    <section
      aria-labelledby={headingId}
      data-testid={`wd-facet-${facet}`}
      data-facet-state={state.kind}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <h3 id={headingId} className="text-base font-semibold text-[var(--color-foreground)]">
        {FACET_LABELS[facet]}
      </h3>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-[var(--color-foreground-muted)]">
        {FACET_HINTS[facet]}
      </p>
      <WdFacetBody facet={facet} state={state} />
    </section>
  );
}
