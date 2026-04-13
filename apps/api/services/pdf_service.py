"""
pdf_service.py — Génération PDF serveur via fpdf2.

Construit un rapport de synthèse ESG multi-pages à partir des snapshots
Carbon, VSME et ESG. Retourne les octets du PDF en mémoire.
"""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any

try:
    from fpdf import FPDF, FPDFException  # type: ignore[import]
    _FPDF_AVAILABLE = True
except ImportError:
    _FPDF_AVAILABLE = False
    FPDF = None  # type: ignore[assignment,misc]
    FPDFException = Exception

# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------
EMERALD  = (5, 150, 105)
DARK     = (15, 23, 42)
MUTED    = (100, 116, 139)
LIGHT    = (226, 232, 240)
WHITE    = (255, 255, 255)

MARGIN   = 14
LINE_H   = 6


def _fmt(v: Any, unit: str = "", decimals: int = 1) -> str:
    if v is None:
        return "—"
    if isinstance(v, bool):
        return "Oui" if v else "Non"
    if isinstance(v, (int, float)):
        try:
            formatted = f"{v:,.{decimals}f}".replace(",", "\u202f").replace(".", ",")
            return f"{formatted} {unit}".strip() if unit else formatted
        except Exception:
            return str(v)
    return str(v).strip() or "—"


def _fmtdate(iso: str | None) -> str:
    if not iso:
        return datetime.now().strftime("%d/%m/%Y")
    try:
        return datetime.fromisoformat(iso).strftime("%d/%m/%Y")
    except Exception:
        return iso


# ---------------------------------------------------------------------------
# PDF builder
# ---------------------------------------------------------------------------

class _Builder:
    def __init__(self) -> None:
        if not _FPDF_AVAILABLE:
            raise RuntimeError("fpdf2 n'est pas installé — ajoutez fpdf2 dans requirements.txt")

        self.pdf = FPDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=20)
        self.pdf.set_margins(MARGIN, MARGIN, MARGIN)
        self.page_num = 0

    def _new_page(self) -> None:
        self.pdf.add_page()
        self.page_num += 1

    def _footer(self) -> None:
        self.pdf.set_y(-14)
        self.pdf.set_font("Helvetica", "I", 8)
        self.pdf.set_text_color(*MUTED)
        self.pdf.cell(0, 5, f"CarbonCo — Synthèse ESG · Page {self.page_num}", align="L")
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 5, datetime.now().strftime("%d/%m/%Y"), align="R")

    def _section(self, title: str) -> None:
        self.pdf.ln(4)
        self.pdf.set_fill_color(*EMERALD)
        self.pdf.set_text_color(*WHITE)
        self.pdf.set_font("Helvetica", "B", 11)
        self.pdf.cell(0, 7, f"  {title.upper()}", fill=True, ln=True)
        self.pdf.ln(1)

    def _row(self, label: str, value: str) -> None:
        self.pdf.set_draw_color(*LIGHT)
        self.pdf.set_line_width(0.1)
        self.pdf.set_font("Helvetica", "", 9)
        self.pdf.set_text_color(*MUTED)
        self.pdf.cell(100, LINE_H, label, border="B")
        self.pdf.set_font("Helvetica", "B", 9)
        self.pdf.set_text_color(*DARK)
        self.pdf.cell(0, LINE_H, value, border="B", align="R", ln=True)

    def _paragraph(self, text: str, size: int = 9) -> None:
        self.pdf.set_font("Helvetica", "", size)
        self.pdf.set_text_color(*MUTED)
        self.pdf.multi_cell(0, LINE_H - 1, text)
        self.pdf.ln(1)

    def cover(self, company: str, year: Any, generated_at: str) -> None:
        self._new_page()
        # Header band
        self.pdf.set_fill_color(*EMERALD)
        self.pdf.rect(0, 0, 210, 55, style="F")
        self.pdf.set_text_color(*WHITE)
        self.pdf.set_font("Helvetica", "B", 9)
        self.pdf.set_xy(MARGIN, 12)
        self.pdf.cell(0, 6, "CARBONCO · PLATEFORME ESG & CSRD", ln=True)
        self.pdf.set_font("Helvetica", "B", 26)
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 14, "Synthèse ESG", ln=True)
        self.pdf.set_font("Helvetica", "", 11)
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 7, "Rapport de synthèse — Carbone · VSME · ESRS", ln=True)

        # Body
        self.pdf.set_y(70)
        self.pdf.set_text_color(*DARK)
        self.pdf.set_font("Helvetica", "B", 16)
        self.pdf.cell(0, 9, company, ln=True)
        self.pdf.set_font("Helvetica", "", 11)
        self.pdf.set_text_color(*MUTED)
        self.pdf.cell(0, 6, f"Année de reporting : {year}", ln=True)
        self.pdf.cell(0, 6, f"Généré le : {_fmtdate(generated_at)}", ln=True)
        self.pdf.ln(6)
        self.pdf.set_draw_color(*LIGHT)
        self.pdf.set_line_width(0.3)
        self.pdf.line(MARGIN, self.pdf.get_y(), 210 - MARGIN, self.pdf.get_y())
        self.pdf.ln(6)

        self.pdf.set_text_color(*DARK)
        self.pdf.set_font("Helvetica", "B", 11)
        self.pdf.cell(0, 7, "Contenu du rapport", ln=True)
        toc = [
            "1. Indicateurs carbone — Scopes 1, 2 et 3",
            "2. Taxonomie européenne & SBTi",
            "3. VSME — Standard volontaire PME",
            "4. Double matérialité & ESRS",
            "5. Avertissements et points d'attention",
        ]
        self.pdf.set_font("Helvetica", "", 10)
        self.pdf.set_text_color(*MUTED)
        for line in toc:
            self.pdf.cell(0, 7, line, ln=True)
        self._footer()

    def build_carbon(self, carbon: dict[str, Any]) -> None:
        self._new_page()
        c = carbon.get("carbon", {}) or {}
        tax = carbon.get("taxonomy", {}) or {}
        sbti = carbon.get("sbti", {}) or {}
        energy = carbon.get("energy", {}) or {}
        cbam = carbon.get("cbam", {}) or {}

        self._section("1. Indicateurs carbone")
        self._paragraph(
            f"Bilan GES multi-scope. Données issues du workbook Carbone maître, "
            f"validées selon le protocole GHG."
        )
        kpis = [
            ("Scope 1", _fmt(c.get("scope1Tco2e"), "tCO\u2082e", 0)),
            ("Scope 2 (LB)", _fmt(c.get("scope2LbTco2e"), "tCO\u2082e", 0)),
            ("Scope 3", _fmt(c.get("scope3Tco2e"), "tCO\u2082e", 0)),
            ("Total S1+S2+S3", _fmt(c.get("totalS123Tco2e"), "tCO\u2082e", 0)),
            ("Intensité / CA", _fmt(c.get("intensityRevenueTco2ePerMEur"), "tCO\u2082e/M\u20ac")),
            ("Intensité / ETP", _fmt(c.get("intensityFteTco2ePerFte"), "tCO\u2082e/ETP")),
        ]
        for label, value in kpis:
            self._row(label, value)

        self.pdf.ln(3)
        self._section("2. Taxonomie européenne & SBTi")
        for label, value in [
            ("CA aligné taxonomie", _fmt(tax.get("turnoverAlignedPct"), "%")),
            ("CapEx aligné", _fmt(tax.get("capexAlignedPct"), "%")),
            ("OpEx aligné", _fmt(tax.get("opexAlignedPct"), "%")),
            ("Baseline SBTi (année)", _fmt(sbti.get("baselineYear"), "", 0)),
            ("Objectif réduction S1+S2", _fmt(sbti.get("targetReductionS12Pct"), "%")),
            ("Objectif réduction S3", _fmt(sbti.get("targetReductionS3Pct"), "%")),
            ("Énergie totale", _fmt(energy.get("consumptionMWh"), "MWh", 0)),
            ("Part ENR", _fmt(energy.get("renewableSharePct"), "%")),
            ("Coût CBAM estimé", _fmt(cbam.get("estimatedCostEur"), "\u20ac", 0)),
        ]:
            self._row(label, value)
        self._footer()

    def build_vsme(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        profile = vsme.get("profile", {}) or {}
        env = vsme.get("environnement", {}) or {}
        social = vsme.get("social", {}) or {}
        gouv = vsme.get("gouvernance", {}) or {}
        completude = vsme.get("completude", {}) or {}

        self._section("3. VSME — Standard volontaire PME")
        score = completude.get("scorePct", 0) or 0
        done = completude.get("indicateursCompletes", 0)
        total = completude.get("totalIndicateurs", 0)
        statut = completude.get("statut", "—")
        self._paragraph(f"Complétude : {score:.0f}% — {done} / {total} indicateurs. Statut : {statut}.")

        for label, value in [
            ("Raison sociale", _fmt(profile.get("raisonSociale"))),
            ("Secteur NAF", _fmt(profile.get("secteurNaf"))),
            ("Effectif (ETP)", _fmt(profile.get("etp"), "", 0)),
            ("CA net", _fmt(profile.get("caNet"), "k\u20ac", 0)),
        ]:
            self._row(label, value)

        self.pdf.ln(2)
        self._section("Environnement")
        for label, value in [
            ("Total GES", _fmt(env.get("totalGesTco2e"), "tCO\u2082e")),
            ("Énergie totale", _fmt(env.get("energieMwh"), "MWh")),
            ("Part ENR", _fmt(env.get("partEnrPct"), "%")),
            ("Eau", _fmt(env.get("eauM3"), "m\u00b3", 0)),
            ("Déchets", _fmt(env.get("dechetsTonnes"), "t")),
            ("Taux valorisation", _fmt(env.get("valorisationDechetsPct"), "%")),
        ]:
            self._row(label, value)

        self.pdf.ln(2)
        self._section("Social")
        for label, value in [
            ("Effectif total", _fmt(social.get("effectifTotal"), "pers.", 0)),
            ("Part CDI", _fmt(social.get("pctCdi"), "%")),
            ("LTIR", _fmt(social.get("ltir"), "", 2)),
            ("Formation (h/ETP)", _fmt(social.get("formationHEtp"), "h")),
            ("Écart salarial H/F", _fmt(social.get("ecartSalaireHf"), "%")),
            ("Femmes en management", _fmt(social.get("pctFemmesMgmt"), "%")),
        ]:
            self._row(label, value)

        self.pdf.ln(2)
        self._section("Gouvernance")
        for label, value in [
            ("Anti-corruption", _fmt(gouv.get("antiCorruption"))),
            ("Formation éthique", _fmt(gouv.get("formationEthique"))),
            ("Whistleblowing", _fmt(gouv.get("whistleblowing"))),
            ("CA indépendants", _fmt(gouv.get("pctCaIndependants"), "%")),
        ]:
            self._row(label, value)
        self._footer()

    def build_esg(self, esg: dict[str, Any]) -> None:
        self._new_page()
        scores = esg.get("scores", {}) or {}
        mat = esg.get("materialite", {}) or {}
        issues = mat.get("issues", []) or []

        self._section("4. Double matérialité & ESRS")
        evalues = mat.get("enjeuxEvalues", 0)
        materiels = mat.get("enjeuxMateriels", 0)
        e_count = mat.get("enjeuxMaterielsE", 0)
        s_count = mat.get("enjeuxMaterielsS", 0)
        g_count = mat.get("enjeuxMaterielsG", 0)
        self._paragraph(
            f"Analyse de matérialité IRO : {evalues} enjeux évalués, dont "
            f"{materiels} matériels ({e_count} E, {s_count} S, {g_count} G)."
        )

        for label, value in [
            ("Score ESG global", _fmt(scores.get("scoreGlobal"), "/100", 0)),
            ("Score Environnement", _fmt(scores.get("scoreE"), "/100", 0)),
            ("Score Social", _fmt(scores.get("scoreS"), "/100", 0)),
            ("Score Gouvernance", _fmt(scores.get("scoreG"), "/100", 0)),
            ("Statut ESG", str(scores.get("statut") or "—")),
        ]:
            self._row(label, value)

        top_issues = [i for i in issues if i.get("materiel") is True][:10]
        if top_issues:
            self.pdf.ln(2)
            self._section("Top 10 enjeux matériels")
            for issue in top_issues:
                score_val = issue.get("scoreImpactTotal")
                score_str = f"{score_val:.1f}" if isinstance(score_val, (int, float)) else "—"
                self._row(f"{issue.get('code', '?')} — {issue.get('label', '?')}", score_str)
        self._footer()

    def build_warnings(self, warnings: list[str]) -> None:
        if not warnings:
            return
        self._new_page()
        self._section("5. Avertissements et points d'attention")
        for w in warnings:
            self._paragraph(f"• {w}")
        self._footer()

    def output_bytes(self) -> bytes:
        buf = io.BytesIO()
        self.pdf.output(buf)
        return buf.getvalue()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_esg_synthesis_pdf(
    carbon: dict[str, Any] | None,
    vsme: dict[str, Any] | None,
    esg: dict[str, Any] | None,
) -> bytes:
    """Generate a PDF synthesis report and return its raw bytes."""
    if not _FPDF_AVAILABLE:
        raise RuntimeError(
            "fpdf2 n'est pas installé. Exécutez : pip install fpdf2"
        )

    company = (
        (carbon or {}).get("company", {}) or {}
    ).get("name") or (
        (vsme or {}).get("profile", {}) or {}
    ).get("raisonSociale") or "Entreprise"

    year = (
        (carbon or {}).get("company", {}) or {}
    ).get("reportingYear") or (
        (vsme or {}).get("profile", {}) or {}
    ).get("anneeReporting") or "—"

    generated_at = (
        (carbon or {}).get("generatedAt")
        or (esg or {}).get("generatedAt")
        or (vsme or {}).get("generatedAt")
        or ""
    )

    builder = _Builder()
    builder.cover(str(company), year, generated_at)

    if carbon:
        builder.build_carbon(carbon)
    if vsme:
        builder.build_vsme(vsme)
    if esg:
        builder.build_esg(esg)

    warnings: list[str] = [
        *((carbon or {}).get("validation", {}) or {}).get("warnings", []),
        *((vsme or {}).get("warnings", [])),
        *((esg or {}).get("warnings", [])),
    ]
    builder.build_warnings(warnings)

    return builder.output_bytes()
