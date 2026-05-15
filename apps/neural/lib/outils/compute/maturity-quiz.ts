import data from "@/content/outils/maturity-quiz.json";

export interface MaturityAnswers {
  [questionId: string]: number;
}

export interface MaturityAxisScore {
  id: string;
  label: string;
  description: string;
  score: number;
  max: number;
  pct: number;
}

export interface MaturityTier {
  id: string;
  label: string;
  summary: string;
  color: string;
  min: number;
  max: number;
  actions: string[];
}

export interface MaturityResult {
  totalScore: number;
  totalMax: number;
  totalPct: number;
  tier: MaturityTier;
  axisScores: MaturityAxisScore[];
}

/**
 * Compute the maturity score breakdown by axis + the global tier. The
 * `answers` payload maps each question id to its selected option score.
 */
export function computeMaturityResult(answers: MaturityAnswers): MaturityResult {
  const totalScore = Object.values(answers).reduce((acc, s) => acc + s, 0);
  const totalMax = data.questions.length * 3;
  const tier = (data.tiers.find((t) => totalScore >= t.min && totalScore <= t.max) ?? data.tiers[0]) as MaturityTier;

  const axisScores: MaturityAxisScore[] = data.axes.map((axis) => {
    const axisQuestions = data.questions.filter((q) => q.axis === axis.id);
    const score = axisQuestions.reduce((acc, q) => acc + (answers[q.id] ?? 0), 0);
    const max = axisQuestions.length * 3;
    return {
      id: axis.id,
      label: axis.label,
      description: axis.description,
      score,
      max,
      pct: max > 0 ? Math.round((score / max) * 100) : 0,
    };
  });

  return {
    totalScore,
    totalMax,
    totalPct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
    tier,
    axisScores,
  };
}

export function describeMaturityAnswers(
  answers: MaturityAnswers,
  answerIds: Record<string, string> = {},
): Array<{ question: string; answer: string; score: number }> {
  return data.questions.map((q) => {
    const score = answers[q.id] ?? 0;
    const id = answerIds[q.id];
    const opt = id ? q.options.find((o) => o.id === id) : q.options.find((o) => o.score === score);
    return {
      question: q.label,
      answer: opt?.label ?? "(non répondu)",
      score,
    };
  });
}
