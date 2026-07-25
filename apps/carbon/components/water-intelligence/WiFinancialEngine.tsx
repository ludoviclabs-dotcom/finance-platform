/**
 * components/water-intelligence/WiFinancialEngine.tsx — surface P15 du moteur
 * de scénarios financiers hydriques (Wave D).
 *
 * Remplace `WiFinancialBridgePreview`. Ce n'est plus un aperçu : le composant
 * rend le CONTRAT RÉEL du moteur, émis depuis le code Python et miroité à
 * l'octet près.
 *
 * Aucun montant n'est affiché, et c'est délibéré : le moteur calcule sur des
 * données d'entreprise, qui n'apparaissent jamais sur une surface publique. Un
 * montant d'exemple, même étiqueté, se lirait comme un ordre de grandeur
 * validé — la même erreur que les valeurs de fixture retirées en P04B.
 *
 * Server Component : aucune interactivité, aucun état, aucun appel réseau.
 */

import {
  FINANCIAL_ENGINE,
  UNIT_LABELS,
  driverLabel,
  type WiFinancialEngine,
} from "@/lib/water-intelligence/financial-engine";
import { WiBadge } from "./WiPrimitives";

export function WiFinancialEngineContract({
  engine = FINANCIAL_ENGINE,
}: {
  engine?: WiFinancialEngine;
}) {
  const required = engine.parameters.filter((parameter) => parameter.required);
  const optional = engine.parameters.filter((parameter) => !parameter.required);

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
        <h3 className="wi-h3">Passerelle financière</h3>
        <WiBadge tone="absent" label="Aucun montant sur cette page" />
      </div>

      <p className="wi-muted" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
        Le moteur calcule une exposition à partir d’hypothèses <strong>explicites</strong>,
        sur des données d’entreprise. Ces données n’apparaissent jamais ici&nbsp;: cette
        page décrit la mécanique, le calcul se fait côté authentifié.
      </p>

      <h4 className="wi-h4" style={{ marginTop: "1.25rem" }}>
        Ce que le moteur exige
      </h4>
      <ul
        className="wi-grid wi-grid-2"
        style={{ marginTop: "0.5rem", paddingLeft: 0, listStyle: "none" }}
      >
        {required.map((parameter) => (
          <li key={parameter.name} className="wi-card wi-accent-data" style={{ listStyle: "none" }}>
            <p className="wi-mono" style={{ fontSize: "0.8125rem" }}>
              {parameter.name}
            </p>
            <p className="wi-muted" style={{ marginTop: "0.25rem", fontSize: "0.8125rem" }}>
              Unité&nbsp;: {UNIT_LABELS[parameter.unit]}
            </p>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>{parameter.description}</p>
          </li>
        ))}
      </ul>

      {optional.length > 0 ? (
        <>
          <h4 className="wi-h4" style={{ marginTop: "1.25rem" }}>
            Paramètre facultatif
          </h4>
          <ul style={{ marginTop: "0.5rem", paddingLeft: 0, listStyle: "none" }}>
            {optional.map((parameter) => (
              <li
                key={parameter.name}
                className="wi-card wi-accent-absent"
                style={{ listStyle: "none" }}
              >
                <p className="wi-mono" style={{ fontSize: "0.8125rem" }}>
                  {parameter.name}
                </p>
                <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                  {parameter.description}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h4 className="wi-h4" style={{ marginTop: "1.25rem" }}>
        Sensibilité plutôt que certitude
      </h4>
      <p className="wi-muted" style={{ marginTop: "0.35rem", maxWidth: "62ch", fontSize: "0.875rem" }}>
        Une valeur centrale n’est jamais rendue seule. Chaque inducteur est
        <em> varié séparément</em> — croiser les variations produirait un intervalle qui
        ressemble à un intervalle de confiance sans en être un. Inducteurs suivis&nbsp;:{" "}
        {engine.sensitivity_drivers.map(driverLabel).join(" · ")}. Arrondi monétaire&nbsp;:{" "}
        {engine.money_rounding}.
      </p>

      <h4 className="wi-h4" style={{ marginTop: "1.25rem" }}>
        Signaux comptables — des questions, jamais des conclusions
      </h4>
      <ul
        className="wi-muted"
        style={{ marginTop: "0.5rem", paddingLeft: "1.1rem", fontSize: "0.875rem" }}
      >
        {engine.accounting_signals.map((signal) => (
          <li key={signal.reference} style={{ marginTop: "0.35rem" }}>
            <strong>{signal.reference}</strong> — {signal.question}
          </li>
        ))}
      </ul>

      <h4 className="wi-h4" style={{ marginTop: "1.25rem" }}>
        Ce que le moteur refuse de faire
      </h4>
      <ul
        style={{ marginTop: "0.5rem", paddingLeft: "1.1rem", fontSize: "0.875rem" }}
      >
        {engine.refusals.map((refusal) => (
          <li key={refusal} style={{ marginTop: "0.35rem" }}>
            {refusal}
          </li>
        ))}
      </ul>
    </div>
  );
}
