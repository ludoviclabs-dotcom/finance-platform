import data from "@/content/outils/ai-act-classifier.json";

export type AiActResultClass = "interdit" | "haut" | "limite" | "minimal";

export interface AiActAnswers {
  [questionId: string]: string;
}

export interface AiActResult {
  class: AiActResultClass;
  label: string;
  color: string;
  summary: string;
  obligations: string[];
  neuralAgent: string | null;
}

/**
 * Decide the AI Act risk class from a set of answers. Priority is interdit >
 * haut > limite > minimal — any single answer with a higher-priority weight
 * overrides the rest.
 */
export function computeAiActResult(answers: AiActAnswers): AiActResult {
  const cls = pickClass(answers);
  const raw = data.results[cls] as Omit<AiActResult, "class">;
  return {
    class: cls,
    label: raw.label,
    color: raw.color,
    summary: raw.summary,
    obligations: [...raw.obligations],
    neuralAgent: raw.neuralAgent ?? null,
  };
}

function pickClass(answers: AiActAnswers): AiActResultClass {
  const weights = data.questions.map((q) => {
    const optId = answers[q.id];
    const opt = q.options.find((o) => o.id === optId);
    return opt?.weight as string | undefined;
  });

  if (weights.some((w) => w === "interdit")) return "interdit";
  if (weights.some((w) => w === "haut" || w === "haut_aggrave" || w === "annexe_iii")) {
    return "haut";
  }
  if (weights.some((w) => w === "limite")) return "limite";
  return "minimal";
}

/**
 * Human-readable Q/A snapshot used to render the PDF section. Returns one row
 * per *answered* question, ordered by the questionnaire flow.
 */
export function describeAnswers(answers: AiActAnswers): Array<{ question: string; answer: string }> {
  return data.questions
    .map((q) => {
      const optId = answers[q.id];
      if (!optId) return null;
      const opt = q.options.find((o) => o.id === optId);
      return {
        question: q.label,
        answer: opt?.label ?? "(non répondu)",
      };
    })
    .filter((row): row is { question: string; answer: string } => row !== null);
}
