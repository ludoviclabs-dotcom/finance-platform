import type { PdfBuildInput, PdfSection } from "../pdf-builder";
import { signReceipt, type SignedReceipt } from "../sign";
import {
  computeAiActResult,
  describeAnswers,
  type AiActAnswers,
  type AiActResult,
} from "../compute/ai-act-classifier";

export interface AiActReceiptPayload {
  answers: AiActAnswers;
  result: AiActResult;
}

const AI_ACT_DISCLAIMER =
  "Ce document est une synthèse indicative produite à partir de vos réponses. Il ne constitue pas un avis juridique. Le classement définitif d'un système IA selon le règlement (UE) 2024/1689 dépend du contexte de déploiement et doit être validé par votre conseil juridique. La traçabilité est garantie par le hash de signature et l'URL de vérification au pied de chaque page.";

/**
 * Build the AI Act Classifier PDF input from raw user answers. Recomputes the
 * result server-side so the signed receipt is canonical.
 */
export function buildAiActPdfInput(
  answers: AiActAnswers,
  generatedAt?: string,
): { input: PdfBuildInput<AiActReceiptPayload>; receipt: SignedReceipt<AiActReceiptPayload> } {
  const result = computeAiActResult(answers);
  const receipt = signReceipt<AiActReceiptPayload>(
    "ai-act-classifier",
    { answers, result },
    generatedAt,
  );

  const answersSection: PdfSection = {
    heading: "Vos réponses",
    rows: describeAnswers(answers).map((row, idx) => ({
      key: `${idx + 1}. ${row.question}`,
      value: row.answer,
    })),
  };

  const obligationsSection: PdfSection = {
    heading: "Obligations applicables",
    bullets: result.obligations,
  };

  const sections: PdfSection[] = [answersSection, obligationsSection];

  if (result.neuralAgent) {
    sections.push({
      heading: "Agent NEURAL recommandé",
      intro: result.neuralAgent,
    });
  }

  sections.push({
    heading: "Prochaines étapes",
    bullets: nextSteps(result.class),
  });

  return {
    receipt,
    input: {
      receipt,
      title: "AI Act Classifier — Synthèse",
      resultHeadline: result.label,
      resultLead: result.summary,
      sections,
      disclaimer: AI_ACT_DISCLAIMER,
    },
  };
}

function nextSteps(cls: AiActResult["class"]): string[] {
  switch (cls) {
    case "interdit":
      return [
        "Suspendre tout déploiement du système concerné dans l'UE.",
        "Documenter la décision de non-déploiement (registre des risques).",
        "Reformuler le besoin métier pour éviter les pratiques visées par l'Article 5.",
      ];
    case "haut":
      return [
        "Constituer un dossier de conformité Annexe IV (description du système, données, validation, supervision humaine).",
        "Enregistrer le système dans la base de données UE prévue à l'Article 49 avant mise sur le marché.",
        "Mettre en place le système de gestion des risques (Article 9) et le système de management de la qualité (Article 17).",
        "Documenter la traçabilité et l'audit trail des décisions IA (Article 12).",
      ];
    case "limite":
      return [
        "Mettre en place une information utilisateur claire : indiquer qu'il interagit avec une IA.",
        "Documenter la classification dans votre registre AI Act interne.",
        "Préparer une revue annuelle au cas où le contexte d'usage évolue vers haut risque.",
      ];
    case "minimal":
    default:
      return [
        "Adhérer volontairement à un code de conduite sectoriel (recommandé Article 95).",
        "Documenter la classification pour audit interne, même si non-obligatoire réglementairement.",
        "Surveiller l'évolution du règlement et des actes d'exécution.",
      ];
  }
}
