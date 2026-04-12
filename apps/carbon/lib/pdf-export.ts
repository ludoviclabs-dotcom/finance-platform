/**
 * PDF export V1 — client-side synthesis generator.
 *
 * Builds a multi-page PDF from CarbonSnapshot, VsmeSnapshot and EsgSnapshot
 * using jsPDF. No canvas rasterization — everything is drawn as vector text
 * so the output stays small and text is selectable.
 */

import jsPDF from "jspdf";
import type { CarbonSnapshot, VsmeSnapshot, EsgSnapshot } from "./api";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN = 14; // mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5.5;
const FOOTER_Y = PAGE_HEIGHT - 10;

const EMERALD: [number, number, number] = [5, 150, 105];
const DARK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [226, 232, 240];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNum(v: unknown, unit = "", decimals = 1): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    return `${v.toLocaleString("fr-FR", { maximumFractionDigits: decimals })}${unit ? " " + unit : ""}`;
  }
  if (typeof v === "string" && v.trim() !== "") return v;
  return "—";
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("fr-FR") : "—";
  return String(v);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return new Date().toLocaleDateString("fr-FR");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR");
}

// ---------------------------------------------------------------------------
// Snapshot input bundle
// ---------------------------------------------------------------------------

export interface PdfExportBundle {
  carbon: CarbonSnapshot | null;
  vsme: VsmeSnapshot | null;
  esg: EsgSnapshot | null;
}

// ---------------------------------------------------------------------------
// PDF builder
// ---------------------------------------------------------------------------

class PdfBuilder {
  doc: jsPDF;
  y: number;
  pageNumber: number;

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    this.y = MARGIN;
    this.pageNumber = 1;
  }

  private setFill(color: [number, number, number]) {
    this.doc.setFillColor(color[0], color[1], color[2]);
  }
  private setText(color: [number, number, number]) {
    this.doc.setTextColor(color[0], color[1], color[2]);
  }
  private setDraw(color: [number, number, number]) {
    this.doc.setDrawColor(color[0], color[1], color[2]);
  }

  ensureSpace(needed: number) {
    if (this.y + needed > PAGE_HEIGHT - 20) this.newPage();
  }

  newPage() {
    this.drawFooter();
    this.doc.addPage();
    this.pageNumber += 1;
    this.y = MARGIN;
  }

  drawFooter() {
    this.setText(MUTED);
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(
      `CarbonCo — Synthèse ESG · Page ${this.pageNumber}`,
      MARGIN,
      FOOTER_Y,
    );
    this.doc.text(
      formatDate(new Date().toISOString()),
      PAGE_WIDTH - MARGIN,
      FOOTER_Y,
      { align: "right" },
    );
  }

  title(text: string) {
    this.setText(DARK);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(22);
    this.doc.text(text, MARGIN, this.y);
    this.y += 10;
  }

  sectionHeader(text: string) {
    this.ensureSpace(14);
    this.setFill(EMERALD);
    this.doc.rect(MARGIN, this.y - 4, CONTENT_WIDTH, 7, "F");
    this.setText([255, 255, 255]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text(text.toUpperCase(), MARGIN + 2, this.y + 0.8);
    this.y += 9;
  }

  paragraph(text: string, size = 9) {
    this.setText(MUTED);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH);
    this.ensureSpace(lines.length * LINE_HEIGHT);
    for (const line of lines) {
      this.doc.text(line, MARGIN, this.y);
      this.y += LINE_HEIGHT;
    }
    this.y += 1;
  }

  row(label: string, value: string) {
    this.ensureSpace(LINE_HEIGHT + 1);
    this.setDraw(LIGHT);
    this.doc.setLineWidth(0.1);
    this.doc.line(MARGIN, this.y + 2, PAGE_WIDTH - MARGIN, this.y + 2);

    this.setText(MUTED);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.text(label, MARGIN, this.y);

    this.setText(DARK);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(value, PAGE_WIDTH - MARGIN, this.y, { align: "right" });

    this.y += LINE_HEIGHT + 1;
  }

  kpiGrid(kpis: { label: string; value: string }[]) {
    const cols = 3;
    const colWidth = CONTENT_WIDTH / cols;
    const rowHeight = 16;
    const rows = Math.ceil(kpis.length / cols);
    this.ensureSpace(rows * rowHeight + 2);

    for (let i = 0; i < kpis.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MARGIN + col * colWidth;
      const y = this.y + row * rowHeight;

      this.setDraw(LIGHT);
      this.doc.setLineWidth(0.2);
      this.doc.roundedRect(x + 1, y, colWidth - 2, rowHeight - 2, 1.5, 1.5, "S");

      this.setText(MUTED);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.text(kpis[i].label.toUpperCase(), x + 3, y + 4);

      this.setText(DARK);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      this.doc.text(kpis[i].value, x + 3, y + 10.5);
    }

    this.y += rows * rowHeight + 2;
  }

  coverPage(companyName: string, year: number | string, generatedAt: string) {
    // Emerald band at top
    this.setFill(EMERALD);
    this.doc.rect(0, 0, PAGE_WIDTH, 60, "F");

    this.setText([255, 255, 255]);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.text("CARBONCO · PLATEFORME ESG & CSRD", MARGIN, 18);

    this.doc.setFontSize(28);
    this.doc.text("Synthèse ESG", MARGIN, 35);

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(12);
    this.doc.text("Rapport de synthèse — Carbone · VSME · ESRS", MARGIN, 48);

    // Body
    this.y = 85;
    this.setText(DARK);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.text(companyName, MARGIN, this.y);
    this.y += 8;

    this.setText(MUTED);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(11);
    this.doc.text(`Année de reporting : ${year}`, MARGIN, this.y);
    this.y += 6;
    this.doc.text(`Généré le : ${formatDate(generatedAt)}`, MARGIN, this.y);
    this.y += 15;

    this.setDraw(LIGHT);
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 8;

    this.setText(DARK);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text("Contenu du rapport", MARGIN, this.y);
    this.y += 7;

    this.setText(MUTED);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    const toc = [
      "1. Indicateurs carbone — Scopes 1, 2 et 3",
      "2. Taxonomie européenne & SBTi",
      "3. VSME — Standard volontaire PME",
      "4. Double matérialité & ESRS",
      "5. Avertissements et points d'attention",
    ];
    for (const line of toc) {
      this.doc.text(line, MARGIN, this.y);
      this.y += 6;
    }

    this.newPage();
  }

  save(filename: string) {
    this.drawFooter();
    this.doc.save(filename);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function exportEsgSynthesisPdf(bundle: PdfExportBundle): void {
  const { carbon, vsme, esg } = bundle;
  const builder = new PdfBuilder();

  const companyName =
    carbon?.company.name ??
    (typeof vsme?.profile.raisonSociale === "string"
      ? (vsme.profile.raisonSociale as string)
      : "Entreprise");
  const year =
    carbon?.company.reportingYear ??
    (typeof vsme?.profile.anneeReporting === "number"
      ? String(vsme.profile.anneeReporting as number)
      : "—");
  const generatedAt = carbon?.generatedAt ?? esg?.generatedAt ?? vsme?.generatedAt ?? "";

  builder.coverPage(companyName, year, generatedAt);

  // ------------------------------------------------------------------
  // Section 1 — Carbone
  // ------------------------------------------------------------------
  if (carbon) {
    builder.sectionHeader("1. Indicateurs carbone");
    builder.paragraph(
      `Bilan GES multi-scope pour l'exercice ${year}. Les données sont issues du workbook Carbone maître et validées selon le protocole GHG.`,
    );
    builder.kpiGrid([
      { label: "Scope 1", value: fmtNum(carbon.carbon.scope1Tco2e, "tCO₂e", 0) },
      { label: "Scope 2 (LB)", value: fmtNum(carbon.carbon.scope2LbTco2e, "tCO₂e", 0) },
      { label: "Scope 3", value: fmtNum(carbon.carbon.scope3Tco2e, "tCO₂e", 0) },
      { label: "Total S1+S2+S3", value: fmtNum(carbon.carbon.totalS123Tco2e, "tCO₂e", 0) },
      { label: "Intensité / CA", value: fmtNum(carbon.carbon.intensityRevenueTco2ePerMEur, "tCO₂e/M€") },
      { label: "Intensité / ETP", value: fmtNum(carbon.carbon.intensityFteTco2ePerFte, "tCO₂e/ETP") },
    ]);
    builder.y += 3;

    builder.sectionHeader("2. Taxonomie européenne & SBTi");
    builder.row("CA aligné taxonomie", fmtNum(carbon.taxonomy.turnoverAlignedPct, "%"));
    builder.row("CapEx aligné", fmtNum(carbon.taxonomy.capexAlignedPct, "%"));
    builder.row("OpEx aligné", fmtNum(carbon.taxonomy.opexAlignedPct, "%"));
    builder.row("Baseline SBTi (année)", fmt(carbon.sbti.baselineYear));
    builder.row("Objectif réduction S1+S2", fmtNum(carbon.sbti.targetReductionS12Pct, "%"));
    builder.row("Objectif réduction S3", fmtNum(carbon.sbti.targetReductionS3Pct, "%"));
    builder.row("Énergie totale", fmtNum(carbon.energy.consumptionMWh, "MWh", 0));
    builder.row("Part ENR", fmtNum(carbon.energy.renewableSharePct, "%"));
    builder.row("Coût CBAM estimé", fmtNum(carbon.cbam.estimatedCostEur, "€", 0));
  }

  // ------------------------------------------------------------------
  // Section 3 — VSME
  // ------------------------------------------------------------------
  if (vsme) {
    builder.newPage();
    builder.sectionHeader("3. VSME — Standard volontaire PME");
    builder.paragraph(
      `Complétude : ${vsme.completude.scorePct.toFixed(0)}% — ${vsme.completude.indicateursCompletes} / ${vsme.completude.totalIndicateurs} indicateurs. Statut : ${vsme.completude.statut}.`,
    );

    builder.row("Raison sociale", fmt(vsme.profile.raisonSociale));
    builder.row("Secteur NAF", fmt(vsme.profile.secteurNaf));
    builder.row("Effectif (ETP)", fmtNum(vsme.profile.etp, "", 0));
    builder.row("CA net", fmtNum(vsme.profile.caNet, "k€", 0));

    builder.y += 2;
    builder.sectionHeader("Environnement");
    builder.row("Total GES", fmtNum(vsme.environnement.totalGesTco2e, "tCO₂e"));
    builder.row("Énergie totale", fmtNum(vsme.environnement.energieMwh, "MWh"));
    builder.row("Part ENR", fmtNum(vsme.environnement.partEnrPct, "%"));
    builder.row("Eau", fmtNum(vsme.environnement.eauM3, "m³", 0));
    builder.row("Déchets", fmtNum(vsme.environnement.dechetsTonnes, "t"));
    builder.row("Taux valorisation déchets", fmtNum(vsme.environnement.valorisationDechetsPct, "%"));

    builder.y += 2;
    builder.sectionHeader("Social");
    builder.row("Effectif total", fmtNum(vsme.social.effectifTotal, "pers.", 0));
    builder.row("Part CDI", fmtNum(vsme.social.pctCdi, "%"));
    builder.row("LTIR", fmtNum(vsme.social.ltir, "", 2));
    builder.row("Formation (h/ETP)", fmtNum(vsme.social.formationHEtp, "h"));
    builder.row("Écart salarial H/F", fmtNum(vsme.social.ecartSalaireHf, "%"));
    builder.row("Femmes en management", fmtNum(vsme.social.pctFemmesMgmt, "%"));

    builder.y += 2;
    builder.sectionHeader("Gouvernance");
    builder.row("Anti-corruption", fmt(vsme.gouvernance.antiCorruption));
    builder.row("Formation éthique", fmt(vsme.gouvernance.formationEthique));
    builder.row("Whistleblowing", fmt(vsme.gouvernance.whistleblowing));
    builder.row("CA indépendants", fmtNum(vsme.gouvernance.pctCaIndependants, "%"));
  }

  // ------------------------------------------------------------------
  // Section 4 — Double matérialité / ESRS
  // ------------------------------------------------------------------
  if (esg) {
    builder.newPage();
    builder.sectionHeader("4. Double matérialité & ESRS");
    builder.paragraph(
      `Analyse de matérialité IRO : ${esg.materialite.enjeuxEvalues} enjeux évalués, dont ${esg.materialite.enjeuxMateriels} matériels (${esg.materialite.enjeuxMaterielsE} E, ${esg.materialite.enjeuxMaterielsS} S, ${esg.materialite.enjeuxMaterielsG} G).`,
    );

    builder.row("Score ESG global", fmt(esg.scores.scoreGlobal));
    builder.row("Score Environnement", fmt(esg.scores.scoreE));
    builder.row("Score Social", fmt(esg.scores.scoreS));
    builder.row("Score Gouvernance", fmt(esg.scores.scoreG));
    builder.row("Statut ESG", fmt(esg.scores.statut));

    // Top material issues
    const materiels = (esg.materialite.issues ?? [])
      .filter((i) => i.materiel === true)
      .slice(0, 10);
    if (materiels.length > 0) {
      builder.y += 3;
      builder.sectionHeader("Top 10 enjeux matériels");
      for (const issue of materiels) {
        const score =
          typeof issue.scoreImpactTotal === "number"
            ? issue.scoreImpactTotal.toFixed(1)
            : "—";
        builder.row(`${issue.code} — ${issue.label}`, score);
      }
    }
  }

  // ------------------------------------------------------------------
  // Section 5 — Warnings
  // ------------------------------------------------------------------
  const warnings: string[] = [
    ...(carbon?.validation.warnings ?? []),
    ...(vsme?.warnings ?? []),
    ...(esg?.warnings ?? []),
  ];
  if (warnings.length > 0) {
    builder.newPage();
    builder.sectionHeader("5. Avertissements et points d'attention");
    for (const w of warnings) builder.paragraph(`• ${w}`);
  }

  // Save
  const safeName = companyName.replace(/[^a-zA-Z0-9-_]/g, "_");
  builder.save(`carbonco-synthese-${safeName}-${year}.pdf`);
}
