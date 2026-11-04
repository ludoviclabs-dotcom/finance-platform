"use client";

/**
 * WiQuiz.tsx — bilan du parcours : cinq réflexes, vérifiés avec le guide NEURAL.
 *
 * Les bonnes réponses ne sont pas écrites à la main quand elles dépendent d'une
 * donnée : la part restituée vient du repère publiable, la question financière
 * vient de la règle d'affichage du pont (`financialBridgeQuestionsToInstruct`).
 * Si le repère n'est pas publiable, la question qui en dépend n'est pas posée.
 */

import { useState } from "react";

import type { WiContextFact } from "@/lib/water-intelligence/context-candidates";
import {
  FINANCIAL_BRIDGE,
  financialBridgeQuestionsToInstruct,
} from "@/lib/water-intelligence/editorial-matrices";
import { WiNeural } from "./WiNeural";

interface Question {
  readonly id: string;
  readonly text: string;
  readonly options: readonly string[];
  readonly good: number;
  readonly explain: string;
  readonly href: string;
  readonly chapter: string;
  readonly skill: string;
}

function buildQuestions(restitution: WiContextFact | undefined): readonly Question[] {
  const thirtyDays = financialBridgeQuestionsToInstruct(30, 100);
  const lit = (id: string) => thirtyDays[FINANCIAL_BRIDGE.findIndex((step) => step.id === id)];
  const insuranceFirst = lit("assurance") && !lit("provisions");

  const questions: Question[] = [
    {
      id: "absence",
      text: "Un ouvrage absent de la base des prélèvements ne prélève pas d'eau.",
      options: ["Vrai", "Faux"],
      good: 1,
      explain: "Usages exonérés et petits volumes échappent à la déclaration : une absence n'est jamais un prélèvement nul.",
      href: "#carte",
      chapter: "Revoir le territoire",
      skill: "Lire une donnée déclarative et ses angles morts",
    },
  ];
  if (restitution && typeof restitution.value === "number") {
    const value = restitution.value;
    questions.push({
      id: "restitution",
      text: "En France métropolitaine, quelle part de l'eau prélevée retourne au milieu après usage ?",
      options: [`${100 - value} %`, "50 %", `${value} %`],
      good: 2,
      explain: `${value} % sont restitués (${restitution.period}) : seule la part non restituée, consommée, manque au bassin — et l'agriculture en est la première cause.`,
      href: "#reperes",
      chapter: "Revoir les repères France",
      skill: "Distinguer prélèvement et consommation",
    });
  }
  questions.push(
    {
      id: "licence",
      text: "Une licence ouverte vérifiée suffit pour publier une valeur.",
      options: ["Vrai", "Faux"],
      good: 1,
      explain: "Sept licences vérifiées, une seule décision humaine signée : la licence autorise, elle ne décide pas.",
      href: "#sources",
      chapter: "Revoir les sources",
      skill: "Vérifier qu'une source est publiable, pas seulement licite",
    },
    {
      id: "echelle",
      text: "À quelle échelle se joue la disponibilité de l'eau ?",
      options: ["Le pays", "Le bassin", "L'entreprise"],
      good: 1,
      explain: "Deux sites d'une même entreprise peuvent vivre des situations opposées selon leur bassin.",
      href: "#risques",
      chapter: "Revoir la boussole",
      skill: "Choisir la bonne échelle d'analyse",
    },
    {
      id: "pont",
      text: "Trente jours d'arrêt complet : quelle question financière s'allume en plus de l'interruption ?",
      options: ["L'assurance", "Les provisions", "Aucune"],
      good: insuranceFirst ? 0 : 1,
      explain: "Le pont allume l'assurance à partir de trente jours, les provisions seulement plus tard : un seuil d'affichage, jamais un montant.",
      href: "#finance",
      chapter: "Revoir les correcteurs",
      skill: "Relier un événement hydrique aux questions financières",
    },
  );
  return questions;
}

export function WiQuiz({ restitution }: { restitution?: WiContextFact }) {
  const questions = buildQuestions(restitution);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const score = questions.filter((q) => answers[q.id] === q.good).length;
  const total = questions.length;

  const voice =
    answered === 0
      ? "Je reprends les idées clés du parcours. Répondez dans l'ordre que vous voulez : une réponse fausse vous renvoie au bon chapitre."
      : score === total
        ? "Sans faute. Vous lisez une donnée eau comme un auditeur : source, période, périmètre, décision."
        : answered === total
          ? "Parcours terminé. Chaque compétence « à revoir » pointe vers un seul chapitre."
          : "Bien engagé : chaque réponse juste valide une compétence.";

  return (
    <div className="wi-quiz">
      <div className="wi-frame wi-quiz-guide">
        <WiNeural size={132} plate="Bilan" />
        <dl className="wi-quiz-score">
          <div>
            <dt>Réponses données</dt>
            <dd>
              {answered} / {total}
            </dd>
          </div>
          <div>
            <dt>Compétences validées</dt>
            <dd>
              {score} / {total}
            </dd>
          </div>
        </dl>
        <span className="wi-quiz-gauge" aria-hidden="true">
          <span style={{ width: `${(score / total) * 100}%` }} />
        </span>
        <p className="wi-quiz-voice" aria-live="polite">
          <strong>NEURAL — </strong>
          {voice}
        </p>
        {answered > 0 ? (
          <button type="button" className="wi-btn" onClick={() => setAnswers({})}>
            Recommencer
          </button>
        ) : null}
      </div>

      <ol className="wi-quiz-list">
        {questions.map((q, qi) => {
          const answer = answers[q.id];
          const done = answer !== undefined;
          const right = answer === q.good;
          return (
            <li key={q.id} className="wi-frame wi-quiz-q" data-state={done ? (right ? "right" : "wrong") : "open"}>
              <span className="wi-quiz-n" aria-hidden="true">
                {String(qi + 1).padStart(2, "0")}
              </span>
              <div className="wi-quiz-body">
                <p className="wi-quiz-text" id={`wi-quiz-${q.id}`}>
                  {q.text}
                </p>
                <div className="wi-quiz-opts" role="group" aria-labelledby={`wi-quiz-${q.id}`}>
                  {q.options.map((option, oi) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={answer === oi}
                      data-good={done && oi === q.good ? "true" : undefined}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {done ? (
                  <p className="wi-quiz-explain">
                    <strong>{right ? "Juste." : "Pas tout à fait."}</strong> {q.explain}{" "}
                    <a href={q.href} className="wi-link">
                      {q.chapter} →
                    </a>
                  </p>
                ) : null}
                <p className="wi-quiz-skill" data-on={right ? "true" : "false"}>
                  {right ? "Compétence validée" : "Compétence"} : {q.skill}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
