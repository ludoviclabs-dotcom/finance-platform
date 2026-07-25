/**
 * components/water-intelligence/WiRegulatory.tsx — surface P13 du registre
 * juridique (Wave D).
 *
 * Remplace `WiCompliancePreview`. Ce n'est plus un aperçu : le composant rend
 * le contenu RÉEL du registre versionné, émis par le backend
 * (`services/water_intelligence/regulatory_registry.py`) et miroité à l'octet
 * près dans `lib/water-intelligence/regulatory-registry.json`.
 *
 * ## Ce que « réel » veut dire ici
 *
 * Le registre livré ne contient AUCUNE date, AUCUN statut normatif : aucune
 * règle n'a de source officielle relevée ni de revue juridique signée. Le
 * composant rend donc, honnêtement, un registre de textes À INSTRUIRE, avec la
 * liste exacte des champs manquants par texte. C'est la même honnêteté que le
 * snapshot public vide de la Wave C : l'état est correct, pas inachevé.
 *
 * Aucune date n'est écrite dans ce fichier — c'est l'interdiction explicite du
 * MACRO-PROMPT D (« registre versionné, pas de dates dans JSX »). Le jour où
 * un réviseur renseignera une échéance, elle viendra du registre, et ce
 * composant n'aura pas à changer.
 *
 * Server Component : aucune interactivité, aucun état, aucun appel réseau.
 */

import {
  MISSING_FIELD_LABELS,
  OUTCOME_LABELS,
  REGULATORY_REGISTRY,
  groupedRules,
  registryIsUnverified,
  type WiRegulatoryRegistry as WiRegistry,
  type WiRegulatoryRule,
} from "@/lib/water-intelligence/regulatory-registry";
import { WiBadge } from "./WiPrimitives";

const JURISDICTION_LABELS: Record<string, string> = {
  EU: "Union européenne",
  FR: "France",
  INTERNATIONAL: "International",
};

const INSTRUMENT_LABELS: Record<string, string> = {
  regulation: "Règlement",
  directive: "Directive",
  delegated_act: "Acte délégué",
  national_law: "Texte national",
  voluntary_framework: "Référentiel volontaire",
};

function missingLabel(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? field;
}

/** Une entrée du registre : ce qu'elle est, et ce qui manque pour l'instruire. */
function WiRuleRow({ rule }: { rule: WiRegulatoryRule }) {
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
        <h4 className="wi-h4">{rule.title}</h4>
        <WiBadge
          tone={rule.is_binding ? "pending" : "absent"}
          label={
            rule.is_binding
              ? INSTRUMENT_LABELS[rule.instrument_kind]
              : "Volontaire — n’oblige personne"
          }
        />
      </div>

      <p className="wi-muted" style={{ marginTop: "0.35rem", fontSize: "0.8125rem" }}>
        <span className="wi-mono">{rule.rule_id}</span> ·{" "}
        {JURISDICTION_LABELS[rule.jurisdiction] ?? rule.jurisdiction} · version{" "}
        <span className="wi-mono">{rule.text_version}</span>
      </p>

      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>{rule.text_reference}</p>

      {rule.notes ? (
        <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
          {rule.notes}
        </p>
      ) : null}

      <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.8125rem" }}>
        Verdict actuel : <strong>{OUTCOME_LABELS.unknown}</strong> — à instruire :{" "}
        {rule.missing_fields.map(missingLabel).join(", ")}.
      </p>
    </li>
  );
}

/**
 * Registre juridique P13.
 *
 * Rend le registre réel. Lorsque rien n'est vérifié — l'état actuel — il le
 * dit en toutes lettres au lieu d'afficher un tableau de statuts inexistants.
 */
export function WiRegulatoryRegistry({
  registry = REGULATORY_REGISTRY,
}: {
  registry?: WiRegistry;
}) {
  const { binding, voluntary } = groupedRules(registry);
  const unverified = registryIsUnverified(registry);

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <h3 className="wi-h3">Registre juridique</h3>
        <WiBadge
          tone={unverified ? "absent" : "pending"}
          label={
            unverified
              ? "Aucun texte instruit — aucune conclusion rendue"
              : `${registry.verified_rule_count} texte(s) instruit(s)`
          }
        />
      </div>

      <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
        Registre versionné{" "}
        <span className="wi-mono">{registry.registry_version}</span>. Chaque texte n’entre
        dans le registre qu’avec une <strong>source officielle relevée</strong> et une{" "}
        <strong>revue humaine signée</strong>. Sans les deux, le moteur répond{" "}
        <span className="wi-mono">unknown</span> — jamais une conclusion favorable par
        défaut, jamais un conseil juridique.
      </p>

      {unverified ? (
        <p className="wi-muted" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
          Aucune règle n’est aujourd’hui instruite : ni source officielle, ni réviseur
          désigné. Ce que vous lisez ci-dessous est donc la <strong>liste des textes à
          instruire</strong> et, pour chacun, les champs qu’un réviseur doit renseigner —
          pas un état du droit.
        </p>
      ) : null}

      <p className="wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
        Verdicts possibles du moteur :{" "}
        {(Object.keys(OUTCOME_LABELS) as (keyof typeof OUTCOME_LABELS)[])
          .map((key) => `${OUTCOME_LABELS[key]} (${key})`)
          .join(" · ")}
        .
      </p>

      <h4 className="wi-h4" style={{ marginTop: "1.25rem" }}>
        Droit contraignant
      </h4>
      <ul
        className="wi-grid"
        style={{ marginTop: "0.5rem", paddingLeft: 0, listStyle: "none" }}
      >
        {binding.map((rule) => (
          <WiRuleRow key={`${rule.rule_id}-${rule.text_version}`} rule={rule} />
        ))}
      </ul>

      <h4 className="wi-h4" style={{ marginTop: "1.25rem" }}>
        Référentiels volontaires
      </h4>
      <p className="wi-muted" style={{ marginTop: "0.35rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
        Ces référentiels ne sont pas du droit. Une demande contractuelle d’un donneur
        d’ordre ou d’un investisseur n’est pas une obligation légale : la distinction est
        portée par le registre, pas par la mise en page.
      </p>
      <ul
        className="wi-grid"
        style={{ marginTop: "0.5rem", paddingLeft: 0, listStyle: "none" }}
      >
        {voluntary.map((rule) => (
          <WiRuleRow key={`${rule.rule_id}-${rule.text_version}`} rule={rule} />
        ))}
      </ul>
    </div>
  );
}
