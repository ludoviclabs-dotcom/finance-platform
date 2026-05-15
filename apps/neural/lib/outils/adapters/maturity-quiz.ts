import type { PdfBuildInput, PdfSection } from "../pdf-builder";
import { signReceipt, type SignedReceipt } from "../sign";
import {
  computeMaturityResult,
  describeMaturityAnswers,
  type MaturityAnswers,
  type MaturityResult,
} from "../compute/maturity-quiz";

export interface MaturityReceiptPayload {
  answers: MaturityAnswers;
  answerIds: Record<string, string>;
  result: MaturityResult;
}

const MATURITY_DISCLAIMER =
  "Cette synthèse résulte d'une auto-évaluation à 4 niveaux par axe. Elle ne remplace pas un audit AI maturity formel mené par un tiers. Le hash de signature et l'URL de vérification au pied de chaque page assurent la traçabilité de cette synthèse.";

export function buildMaturityPdfInput(
  answers: MaturityAnswers,
  answerIds: Record<string, string>,
  generatedAt?: string,
): {
  input: PdfBuildInput<MaturityReceiptPayload>;
  receipt: SignedReceipt<MaturityReceiptPayload>;
} {
  const result = computeMaturityResult(answers);
  const receipt = signReceipt<MaturityReceiptPayload>(
    "maturity-quiz",
    { answers, answerIds, result },
    generatedAt,
  );

  const axisSection: PdfSection = {
    heading: "Détail par axe",
    rows: result.axisScores.map((axis) => ({
      key: `${axis.label} (${axis.score}/${axis.max})`,
      value: `${axis.pct}% — ${axis.description}`,
    })),
  };

  const answersSection: PdfSection = {
    heading: "Vos réponses",
    rows: describeMaturityAnswers(answers, answerIds).map((row, idx) => ({
      key: `${idx + 1}. ${row.question}`,
      value: `${row.answer} (score ${row.score}/3)`,
    })),
  };

  const sections: PdfSection[] = [
    {
      heading: "Score global",
      rows: [
        { key: "Niveau", value: result.tier.label },
        {
          key: "Score total",
          value: `${result.totalScore} / ${result.totalMax} (${result.totalPct}%)`,
        },
        { key: "Synthèse", value: result.tier.summary },
      ],
    },
    axisSection,
    {
      heading: "Plan d'action 90 jours",
      bullets: result.tier.actions,
    },
    answersSection,
    {
      heading: "Priorités complémentaires",
      bullets: nextSteps(result.tier.id, result.axisScores),
    },
  ];

  return {
    receipt,
    input: {
      receipt,
      title: "Maturity Quiz — Synthèse",
      resultHeadline: result.tier.label,
      resultLead: `Score global ${result.totalPct}% (${result.totalScore}/${result.totalMax}). ${result.tier.summary}`,
      sections,
      disclaimer: MATURITY_DISCLAIMER,
    },
  };
}

function nextSteps(tierId: string, axes: Array<{ label: string; pct: number }>): string[] {
  const weakest = [...axes].sort((a, b) => a.pct - b.pct).slice(0, 2);
  const weakestLabels = weakest.map((a) => `${a.label} (${a.pct}%)`).join(" et ");
  const base: string[] = [];

  switch (tierId) {
    case "explorer":
      base.push("Cadrer une vision IA à 12 mois avec un sponsor exécutif identifié.");
      base.push("Sécuriser deux cas d'usage à fort signal métier (ROI rapide, faible risque réglementaire).");
      break;
    case "builder":
      base.push("Formaliser une politique IA interne (registre AI Act, supervision humaine, gestion des risques).");
      base.push("Industrialiser le déploiement sur les branches matures avant d'élargir le périmètre.");
      break;
    case "operator":
      base.push("Documenter et publier vos Model Cards pour les agents prioritaires.");
      base.push("Renforcer l'audit trail signé et la traçabilité bout-en-bout des décisions IA.");
      break;
    case "leader":
    default:
      base.push("Préparer une certification (ISO 27001, SOC 2 Type II, ou ISO/IEC 42001) cohérente avec vos risques.");
      base.push("Partager publiquement votre roadmap de gouvernance IA (trust-first leadership).");
  }

  base.push(`Priorité de remédiation : renforcer ${weakestLabels}.`);
  return base;
}
