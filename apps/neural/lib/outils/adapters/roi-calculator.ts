import type { PdfBuildInput, PdfSection } from "../pdf-builder";
import { signReceipt, type SignedReceipt } from "../sign";
import {
  computeRoi,
  describeRoiInputs,
  ETP_HOURLY_LOADED,
  type RoiInputs,
  type RoiResult,
} from "../compute/roi-calculator";

export interface RoiReceiptPayload {
  inputs: RoiInputs;
  result: RoiResult;
}

const ROI_DISCLAIMER =
  "Cette estimation est indicative et calculée à partir d'hypothèses standardisées (coût horaire ETP chargé 38 €/h mid-cap français, adoption initiale 35%, setup ~2× le coût mensuel). Le ROI réel dépend du périmètre de déploiement, du sponsorship interne et de la qualité des données existantes. Le hash de signature et l'URL de vérification au pied de chaque page assurent la traçabilité de cette estimation.";

const EURO = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function buildRoiPdfInput(
  inputs: RoiInputs,
  generatedAt?: string,
): { input: PdfBuildInput<RoiReceiptPayload>; receipt: SignedReceipt<RoiReceiptPayload> } {
  const result = computeRoi(inputs);
  const receipt = signReceipt<RoiReceiptPayload>(
    "roi-calculator",
    { inputs, result },
    generatedAt,
  );

  const inputsSection: PdfSection = {
    heading: "Paramètres",
    rows: describeRoiInputs(inputs),
  };

  const resultRows: Array<{ key: string; value: string }> = [
    { key: "Forfait recommandé", value: result.tier.label },
    { key: "Coût NEURAL mensuel", value: EURO.format(result.neuralMonthly) },
    {
      key: "Heures économisées / mois",
      value: `${new Intl.NumberFormat("fr-FR").format(result.hoursSavedMonth)} h`,
    },
    {
      key: "Économies mensuelles",
      value: EURO.format(result.monthlySavings),
    },
    { key: "ROI mensuel net", value: EURO.format(result.monthlyRoi) },
    {
      key: "Payback",
      value: result.paybackMonths === Number.POSITIVE_INFINITY ? "Non atteint à ces paramètres" : `${result.paybackMonths} mois`,
    },
    { key: "ROI annuel", value: `${result.roiPct > 0 ? "+" : ""}${result.roiPct} %` },
    {
      key: "ETP équivalents libérés",
      value: `${result.etpEquivalent} ETP-mois`,
    },
    {
      key: "Utilisateurs actifs (35 % adoption)",
      value: new Intl.NumberFormat("fr-FR").format(result.activeUsers),
    },
  ];

  const sections: PdfSection[] = [
    inputsSection,
    {
      heading: "Estimation",
      rows: resultRows,
    },
    {
      heading: "Hypothèses",
      bullets: [
        `Coût horaire ETP chargé : ${ETP_HOURLY_LOADED} €/h (mid-cap français).`,
        "Taux d'adoption initial : 35 % des utilisateurs sur les branches activées.",
        "Setup one-shot estimé à 2 × le coût mensuel NEURAL.",
        "Estimation conservatrice — ROI réel souvent supérieur en année 2+ (effet d'apprentissage et élargissement du périmètre).",
      ],
    },
    {
      heading: "Prochaines étapes",
      bullets: [
        "Confirmer le périmètre d'usage avec les responsables des branches activées.",
        "Lancer un POC ciblé sur 30 à 50 utilisateurs pour valider le taux d'adoption.",
        "Ajuster les hypothèses avec les données réelles avant le déploiement complet.",
      ],
    },
  ];

  return {
    receipt,
    input: {
      receipt,
      title: "ROI Calculator — Estimation",
      resultHeadline: `ROI annuel net : ${result.roiPct > 0 ? "+" : ""}${result.roiPct} %`,
      resultLead: `Forfait ${result.tier.label} · ${EURO.format(result.monthlyRoi * 12)} d'économies nettes estimées sur 12 mois.`,
      sections,
      disclaimer: ROI_DISCLAIMER,
    },
  };
}
