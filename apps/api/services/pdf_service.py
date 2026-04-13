"""
pdf_service.py — Génération PDF serveur via fpdf2 + matplotlib.

Templates disponibles :
  - esg-synthesis : Synthèse ESG multi-pages (Carbon + VSME + ESG)
  - csrd          : Rapport CSRD structuré par ESRS (E1, S1, G1…)
  - vsme          : Rapport VSME PME complet avec graphiques

Chaque template peut inclure des graphiques matplotlib embeddes.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

try:
    from fpdf import FPDF, FPDFException  # type: ignore[import]
    _FPDF_AVAILABLE = True
except ImportError:
    _FPDF_AVAILABLE = False
    FPDF = None  # type: ignore[assignment,misc]
    FPDFException = Exception

try:
    import matplotlib
    matplotlib.use("Agg")  # backend non-interactif pour serveur
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    _MPL_AVAILABLE = True
except ImportError:
    _MPL_AVAILABLE = False
    plt = None  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------
EMERALD  = (5, 150, 105)
CYAN     = (8, 145, 178)
PURPLE   = (124, 58, 237)
DARK     = (15, 23, 42)
MUTED    = (100, 116, 139)
LIGHT    = (226, 232, 240)
WHITE    = (255, 255, 255)
ORANGE   = (249, 115, 22)
RED      = (239, 68, 68)

MARGIN   = 14
LINE_H   = 6


# ---------------------------------------------------------------------------
# Matplotlib chart helpers
# ---------------------------------------------------------------------------

def _mpl_scope_bar(scope1: float, scope2: float, scope3: float) -> bytes | None:
    """Graphique barre empilée Scope 1+2+3 — retourne PNG bytes."""
    if not _MPL_AVAILABLE:
        return None
    try:
        fig, ax = plt.subplots(figsize=(5, 2.2), dpi=110)
        fig.patch.set_facecolor("#0f172a")
        ax.set_facecolor("#1e293b")

        total = scope1 + scope2 + scope3 or 1
        bars = [scope1, scope2, scope3]
        labels = ["Scope 1", "Scope 2", "Scope 3"]
        colors = ["#059669", "#0891b2", "#7c3aed"]
        bottom = 0.0
        for val, label, color in zip(bars, labels, colors):
            ax.barh(0, val, left=bottom, color=color, label=f"{label}: {val:,.0f} t")
            bottom += val

        ax.set_xlim(0, total * 1.05)
        ax.set_yticks([])
        ax.tick_params(axis="x", colors="#64748b", labelsize=8)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_visible(False)
        ax.spines["bottom"].set_color("#334155")
        ax.legend(
            loc="upper right", fontsize=7, framealpha=0,
            labelcolor="white", ncol=3,
        )
        ax.set_title("Répartition GES (tCO₂e)", color="white", fontsize=9, pad=6)

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Graphique scope bar échoué : %s", exc)
        return None


def _mpl_esg_radar(score_e: float, score_s: float, score_g: float) -> bytes | None:
    """Radar chart E/S/G — retourne PNG bytes."""
    if not _MPL_AVAILABLE:
        return None
    try:
        import numpy as np
        categories = ["Environnement", "Social", "Gouvernance"]
        values = [score_e, score_s, score_g]
        N = len(categories)
        angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
        angles += angles[:1]
        values_plot = values + values[:1]

        fig, ax = plt.subplots(figsize=(2.8, 2.8), dpi=110, subplot_kw=dict(polar=True))
        fig.patch.set_facecolor("#0f172a")
        ax.set_facecolor("#1e293b")

        ax.plot(angles, values_plot, color="#059669", linewidth=1.5)
        ax.fill(angles, values_plot, color="#059669", alpha=0.25)
        ax.set_ylim(0, 100)
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories, color="white", fontsize=8)
        ax.tick_params(axis="y", colors="#64748b", labelsize=7)
        ax.spines["polar"].set_color("#334155")
        ax.yaxis.grid(color="#334155")
        ax.xaxis.grid(color="#334155")

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Graphique radar ESG échoué : %s", exc)
        return None


def _mpl_vsme_completion(score_pct: float) -> bytes | None:
    """Graphique anneau de complétude VSME — retourne PNG bytes."""
    if not _MPL_AVAILABLE:
        return None
    try:
        fig, ax = plt.subplots(figsize=(2.5, 2.5), dpi=110)
        fig.patch.set_facecolor("#0f172a")
        ax.set_facecolor("#0f172a")

        done = score_pct
        remaining = 100 - done
        colors = ["#059669", "#1e293b"]
        wedges, _ = ax.pie(
            [done, remaining],
            colors=colors,
            startangle=90,
            wedgeprops=dict(width=0.4, edgecolor="#0f172a", linewidth=2),
        )
        ax.text(0, 0, f"{done:.0f}%", ha="center", va="center",
                fontsize=16, fontweight="bold", color="white")

        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Graphique anneau VSME échoué : %s", exc)
        return None


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

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
# Base PDF Builder
# ---------------------------------------------------------------------------

class _BaseBuilder:
    """Classe de base avec helpers communs à tous les templates."""

    def __init__(self, template_name: str = "CarbonCo ESG") -> None:
        if not _FPDF_AVAILABLE:
            raise RuntimeError("fpdf2 n'est pas installé — ajoutez fpdf2 dans requirements.txt")

        self.pdf = FPDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=20)
        self.pdf.set_margins(MARGIN, MARGIN, MARGIN)
        self.page_num = 0
        self.template_name = template_name

    def _new_page(self) -> None:
        self.pdf.add_page()
        self.page_num += 1

    def _footer(self) -> None:
        self.pdf.set_y(-14)
        self.pdf.set_font("Helvetica", "I", 8)
        self.pdf.set_text_color(*MUTED)
        self.pdf.cell(0, 5, f"CarbonCo · {self.template_name} · Page {self.page_num}", align="L")
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 5, datetime.now().strftime("%d/%m/%Y"), align="R")

    def _section(self, title: str, color: tuple[int, int, int] = EMERALD) -> None:
        self.pdf.ln(4)
        self.pdf.set_fill_color(*color)
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

    def _embed_chart(self, png_bytes: bytes | None, w: float = 120, h: float = 40) -> None:
        """Embed un PNG matplotlib dans le PDF."""
        if not png_bytes:
            return
        try:
            buf = io.BytesIO(png_bytes)
            x = self.pdf.get_x()
            y = self.pdf.get_y()
            self.pdf.image(buf, x=x, y=y, w=w, h=h, type="PNG")
            self.pdf.set_y(y + h + 3)
        except Exception as exc:
            logger.warning("Embed chart échoué : %s", exc)

    def cover(
        self,
        company: str,
        year: Any,
        generated_at: str,
        subtitle: str = "Rapport de synthèse ESG",
        toc_lines: list[str] | None = None,
        badge_color: tuple[int, int, int] = EMERALD,
    ) -> None:
        self._new_page()
        self.pdf.set_fill_color(*badge_color)
        self.pdf.rect(0, 0, 210, 55, style="F")
        self.pdf.set_text_color(*WHITE)
        self.pdf.set_font("Helvetica", "B", 9)
        self.pdf.set_xy(MARGIN, 12)
        self.pdf.cell(0, 6, "CARBONCO · PLATEFORME ESG & CSRD", ln=True)
        self.pdf.set_font("Helvetica", "B", 26)
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 14, self.template_name, ln=True)
        self.pdf.set_font("Helvetica", "", 11)
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 7, subtitle, ln=True)

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

        if toc_lines:
            self.pdf.set_text_color(*DARK)
            self.pdf.set_font("Helvetica", "B", 11)
            self.pdf.cell(0, 7, "Contenu du rapport", ln=True)
            self.pdf.set_font("Helvetica", "", 10)
            self.pdf.set_text_color(*MUTED)
            for line in toc_lines:
                self.pdf.cell(0, 7, line, ln=True)
        self._footer()

    def output_bytes(self) -> bytes:
        buf = io.BytesIO()
        self.pdf.output(buf)
        return buf.getvalue()


# ---------------------------------------------------------------------------
# Template 1 : ESG Synthesis (existant, enrichi)
# ---------------------------------------------------------------------------

class _SynthesisBuilder(_BaseBuilder):
    def __init__(self) -> None:
        super().__init__(template_name="Synthèse ESG")

    def build_carbon(self, carbon: dict[str, Any]) -> None:
        self._new_page()
        c = carbon.get("carbon", {}) or {}
        tax = carbon.get("taxonomy", {}) or {}
        sbti = carbon.get("sbti", {}) or {}
        energy = carbon.get("energy", {}) or {}
        cbam = carbon.get("cbam", {}) or {}

        self._section("1. Indicateurs carbone")
        self._paragraph(
            "Bilan GES multi-scope. Données issues du workbook Carbone maître, "
            "validées selon le protocole GHG."
        )

        # Graphique barre scoples
        s1 = float(c.get("scope1Tco2e") or 0)
        s2 = float(c.get("scope2LbTco2e") or 0)
        s3 = float(c.get("scope3Tco2e") or 0)
        if s1 + s2 + s3 > 0:
            chart = _mpl_scope_bar(s1, s2, s3)
            self._embed_chart(chart, w=160, h=38)

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

        # Radar chart ESG
        se = float(scores.get("scoreE") or 0)
        ss = float(scores.get("scoreS") or 0)
        sg = float(scores.get("scoreG") or 0)
        if se + ss + sg > 0:
            radar = _mpl_esg_radar(se, ss, sg)
            if radar:
                x_save = self.pdf.get_x()
                y_save = self.pdf.get_y()
                buf = io.BytesIO(radar)
                self.pdf.image(buf, x=x_save + 110, y=y_save, w=72, h=60, type="PNG")

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


# ---------------------------------------------------------------------------
# Template 2 : CSRD / ESRS
# ---------------------------------------------------------------------------

class _CsrdBuilder(_BaseBuilder):
    def __init__(self) -> None:
        super().__init__(template_name="Rapport CSRD")

    def build_e1(self, carbon: dict[str, Any]) -> None:
        self._new_page()
        c = carbon.get("carbon", {}) or {}
        energy = carbon.get("energy", {}) or {}
        sbti = carbon.get("sbti", {}) or {}
        tax = carbon.get("taxonomy", {}) or {}

        self._section("ESRS E1 — Changement climatique", color=EMERALD)
        self._paragraph(
            "Standard ESRS E1 : Gestion et performance en matière de changement climatique. "
            "Données validées selon le protocole GHG Corporation — Scopes 1, 2 et 3."
        )

        # Graphique Scopes
        s1 = float(c.get("scope1Tco2e") or 0)
        s2 = float(c.get("scope2LbTco2e") or 0)
        s3 = float(c.get("scope3Tco2e") or 0)
        if s1 + s2 + s3 > 0:
            chart = _mpl_scope_bar(s1, s2, s3)
            self._embed_chart(chart, w=160, h=38)

        self._section("E1-1 — Transition et atténuation")
        for label, value in [
            ("Réduction objectif S1+S2 (SBTi)", _fmt(sbti.get("targetReductionS12Pct"), "%")),
            ("Réduction objectif S3 (SBTi)", _fmt(sbti.get("targetReductionS3Pct"), "%")),
            ("Année baseline SBTi", _fmt(sbti.get("baselineYear"), "", 0)),
        ]:
            self._row(label, value)

        self.pdf.ln(2)
        self._section("E1-5 — Énergie")
        for label, value in [
            ("Consommation totale", _fmt(energy.get("consumptionMWh"), "MWh", 0)),
            ("Part ENR", _fmt(energy.get("renewableSharePct"), "%")),
        ]:
            self._row(label, value)

        self.pdf.ln(2)
        self._section("E1-6 — Émissions brutes Scope 1, 2, 3")
        for label, value in [
            ("Scope 1 (direct)", _fmt(c.get("scope1Tco2e"), "tCO\u2082e", 0)),
            ("Scope 2 (location-based)", _fmt(c.get("scope2LbTco2e"), "tCO\u2082e", 0)),
            ("Scope 2 (market-based)", _fmt(c.get("scope2MbTco2e"), "tCO\u2082e", 0)),
            ("Scope 3 (total)", _fmt(c.get("scope3Tco2e"), "tCO\u2082e", 0)),
            ("Total S1+S2+S3", _fmt(c.get("totalS123Tco2e"), "tCO\u2082e", 0)),
            ("Intensité carbone / CA", _fmt(c.get("intensityRevenueTco2ePerMEur"), "tCO\u2082e/M\u20ac")),
            ("Intensité carbone / ETP", _fmt(c.get("intensityFteTco2ePerFte"), "tCO\u2082e/ETP")),
        ]:
            self._row(label, value)

        self.pdf.ln(2)
        self._section("E1 — Taxonomie européenne")
        for label, value in [
            ("CA aligné", _fmt(tax.get("turnoverAlignedPct"), "%")),
            ("CapEx aligné", _fmt(tax.get("capexAlignedPct"), "%")),
            ("OpEx aligné", _fmt(tax.get("opexAlignedPct"), "%")),
        ]:
            self._row(label, value)
        self._footer()

    def build_s1(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        social = vsme.get("social", {}) or {}
        self._section("ESRS S1 — Effectifs propres", color=CYAN)
        self._paragraph(
            "Standard ESRS S1 : Propres effectifs de l'entreprise. "
            "Inclut les indicateurs sociaux clés (effectif, conditions de travail, égalité)."
        )
        for label, value in [
            ("Effectif total (ETP)", _fmt(social.get("effectifTotal"), "pers.", 0)),
            ("Part CDI", _fmt(social.get("pctCdi"), "%")),
            ("Taux de rotation", _fmt(social.get("tauxRotation"), "%")),
            ("LTIR (accidents)", _fmt(social.get("ltir"), "", 2)),
            ("Formation (h/ETP/an)", _fmt(social.get("formationHEtp"), "h")),
            ("Écart salarial H/F", _fmt(social.get("ecartSalaireHf"), "%")),
            ("Femmes en management", _fmt(social.get("pctFemmesMgmt"), "%")),
            ("Diversité & inclusion", _fmt(social.get("diversite"))),
        ]:
            self._row(label, value)
        self._footer()

    def build_g1(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        gouv = vsme.get("gouvernance", {}) or {}
        self._section("ESRS G1 — Éthique et conduite des affaires", color=PURPLE)
        self._paragraph(
            "Standard ESRS G1 : Comportement en matière d'affaires. "
            "Inclut les politiques anti-corruption, éthique et protection des données."
        )
        for label, value in [
            ("Politique anti-corruption", _fmt(gouv.get("antiCorruption"))),
            ("Formation à l'éthique", _fmt(gouv.get("formationEthique"))),
            ("Dispositif whistleblowing", _fmt(gouv.get("whistleblowing"))),
            ("Administrateurs indépendants", _fmt(gouv.get("pctCaIndependants"), "%")),
            ("Protection des données (RGPD)", _fmt(gouv.get("protectionDonnees"))),
        ]:
            self._row(label, value)
        self._footer()

    def build_materiality(self, esg: dict[str, Any]) -> None:
        self._new_page()
        mat = esg.get("materialite", {}) or {}
        issues = mat.get("issues", []) or []
        scores = esg.get("scores", {}) or {}

        self._section("Double matérialité IRO")
        evalues = mat.get("enjeuxEvalues", 0)
        materiels = mat.get("enjeuxMateriels", 0)
        self._paragraph(
            f"{evalues} enjeux évalués · {materiels} matériels · "
            f"Score ESG global : {_fmt(scores.get('scoreGlobal'), '/100', 0)}"
        )

        top = sorted(
            [i for i in issues if i.get("materiel") is True],
            key=lambda x: float(x.get("scoreImpactTotal") or 0),
            reverse=True,
        )[:15]
        for issue in top:
            score_val = issue.get("scoreImpactTotal")
            score_str = f"{score_val:.1f}" if isinstance(score_val, (int, float)) else "—"
            cat = issue.get("categorie", "?")
            self._row(f"[{cat[:1]}] {issue.get('code', '?')} — {issue.get('label', '?')}", score_str)
        self._footer()


# ---------------------------------------------------------------------------
# Template 3 : VSME PME
# ---------------------------------------------------------------------------

class _VsmeBuilder(_BaseBuilder):
    def __init__(self) -> None:
        super().__init__(template_name="Rapport VSME")

    def build_completude(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        completude = vsme.get("completude", {}) or {}
        score = float(completude.get("scorePct") or 0)
        done = completude.get("indicateursCompletes", 0)
        total = completude.get("totalIndicateurs", 0)
        statut = completude.get("statut", "—")

        self._section("Score de complétude VSME")

        # Graphique anneau
        if score > 0:
            donut = _mpl_vsme_completion(score)
            if donut:
                x_save = self.pdf.get_x()
                y_save = self.pdf.get_y()
                buf = io.BytesIO(donut)
                self.pdf.image(buf, x=x_save + 130, y=y_save, w=52, h=52, type="PNG")

        self._paragraph(
            f"Score de complétude : {score:.0f}% · {done} indicateurs complétés sur {total}.\n"
            f"Statut : {statut}"
        )

        for label, value in [
            ("Indicateurs complétés", str(done)),
            ("Total indicateurs", str(total)),
            ("Statut global", statut),
            ("Score de complétude", f"{score:.0f}%"),
        ]:
            self._row(label, value)
        self._footer()

    def build_profile(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        profile = vsme.get("profile", {}) or {}
        self._section("A — Profil de l'entreprise")
        for label, value in [
            ("Raison sociale", _fmt(profile.get("raisonSociale"))),
            ("Secteur NAF", _fmt(profile.get("secteurNaf"))),
            ("Pays", _fmt(profile.get("pays"))),
            ("Effectif (ETP)", _fmt(profile.get("etp"), "", 0)),
            ("CA net", _fmt(profile.get("caNet"), "k\u20ac", 0)),
            ("Année de reporting", _fmt(profile.get("anneeReporting"), "", 0)),
            ("Périmètre", _fmt(profile.get("perimetre"))),
        ]:
            self._row(label, value)
        self._footer()

    def build_environnement(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        env = vsme.get("environnement", {}) or {}
        self._section("B — Informations environnementales")
        self._paragraph(
            "Indicateurs environnementaux clés selon le standard VSME — Voluntary "
            "SME Reporting Standard (base EFRAG)."
        )

        s1 = float(env.get("scope1Tco2e") or 0)
        s2 = float(env.get("scope2LbTco2e") or 0)
        s3 = float(env.get("scope3Tco2e") or 0)
        if s1 + s2 + s3 > 0:
            chart = _mpl_scope_bar(s1, s2, s3)
            self._embed_chart(chart, w=160, h=38)

        for label, value in [
            ("GES Scope 1", _fmt(env.get("scope1Tco2e"), "tCO\u2082e")),
            ("GES Scope 2 (LB)", _fmt(env.get("scope2LbTco2e"), "tCO\u2082e")),
            ("GES Scope 3", _fmt(env.get("scope3Tco2e"), "tCO\u2082e")),
            ("Total GES", _fmt(env.get("totalGesTco2e"), "tCO\u2082e")),
            ("Énergie totale", _fmt(env.get("energieMwh"), "MWh")),
            ("Part ENR", _fmt(env.get("partEnrPct"), "%")),
            ("Consommation eau", _fmt(env.get("eauM3"), "m\u00b3", 0)),
            ("Production déchets", _fmt(env.get("dechetsTonnes"), "t")),
            ("Taux valorisation déchets", _fmt(env.get("valorisationDechetsPct"), "%")),
            ("Plan de réduction GES", _fmt(env.get("planReductionGes"))),
        ]:
            self._row(label, value)
        self._footer()

    def build_social(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        social = vsme.get("social", {}) or {}
        self._section("C — Informations sociales")
        for label, value in [
            ("Effectif total", _fmt(social.get("effectifTotal"), "pers.", 0)),
            ("Part CDI", _fmt(social.get("pctCdi"), "%")),
            ("Taux de rotation", _fmt(social.get("tauxRotation"), "%")),
            ("LTIR (taux accidents)", _fmt(social.get("ltir"), "", 2)),
            ("Heures de formation / ETP", _fmt(social.get("formationHEtp"), "h")),
            ("Écart salarial H/F", _fmt(social.get("ecartSalaireHf"), "%")),
            ("Femmes en management", _fmt(social.get("pctFemmesMgmt"), "%")),
            ("Diversité & inclusion", _fmt(social.get("diversite"))),
            ("Dialogue social", _fmt(social.get("dialogueSocial"))),
            ("Litiges sociaux", _fmt(social.get("litigesSociaux"), "", 0)),
        ]:
            self._row(label, value)
        self._footer()

    def build_gouvernance(self, vsme: dict[str, Any]) -> None:
        self._new_page()
        gouv = vsme.get("gouvernance", {}) or {}
        self._section("D — Informations de gouvernance")
        for label, value in [
            ("Politique anti-corruption", _fmt(gouv.get("antiCorruption"))),
            ("Formation à l'éthique", _fmt(gouv.get("formationEthique"))),
            ("Dispositif whistleblowing", _fmt(gouv.get("whistleblowing"))),
            ("Administrateurs indépendants", _fmt(gouv.get("pctCaIndependants"), "%")),
            ("Protection données (RGPD)", _fmt(gouv.get("protectionDonnees"))),
        ]:
            self._row(label, value)
        self._footer()


# ---------------------------------------------------------------------------
# Public API — 3 fonctions de génération + compatibilité legacy
# ---------------------------------------------------------------------------


def generate_esg_synthesis_pdf(
    carbon: dict[str, Any] | None,
    vsme: dict[str, Any] | None,
    esg: dict[str, Any] | None,
) -> bytes:
    """Generate an ESG synthesis PDF and return its raw bytes. (Legacy + Template 1)"""
    if not _FPDF_AVAILABLE:
        raise RuntimeError("fpdf2 n'est pas installé. Exécutez : pip install fpdf2")

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

    builder = _SynthesisBuilder()
    builder.cover(
        str(company), year, generated_at,
        toc_lines=[
            "1. Indicateurs carbone — Scopes 1, 2 et 3",
            "2. Taxonomie européenne & SBTi",
            "3. VSME — Standard volontaire PME",
            "4. Double matérialité & ESRS",
            "5. Avertissements et points d'attention",
        ],
    )

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


def generate_csrd_pdf(
    carbon: dict[str, Any] | None,
    vsme: dict[str, Any] | None,
    esg: dict[str, Any] | None,
) -> bytes:
    """Generate a CSRD/ESRS structured PDF report and return its raw bytes."""
    if not _FPDF_AVAILABLE:
        raise RuntimeError("fpdf2 n'est pas installé. Exécutez : pip install fpdf2")

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
        (carbon or {}).get("generatedAt") or (esg or {}).get("generatedAt") or ""
    )

    builder = _CsrdBuilder()
    builder.cover(
        str(company), year, generated_at,
        subtitle="Rapport CSRD — ESRS E1, S1, G1 + Double matérialité",
        badge_color=CYAN,
        toc_lines=[
            "ESRS E1 — Changement climatique",
            "ESRS S1 — Effectifs propres",
            "ESRS G1 — Éthique et conduite des affaires",
            "Analyse de double matérialité IRO",
        ],
    )

    if carbon:
        builder.build_e1(carbon)
    if vsme:
        builder.build_s1(vsme)
        builder.build_g1(vsme)
    if esg:
        builder.build_materiality(esg)

    return builder.output_bytes()


def generate_vsme_pdf(
    vsme: dict[str, Any] | None,
) -> bytes:
    """Generate a VSME PME report and return its raw bytes."""
    if not _FPDF_AVAILABLE:
        raise RuntimeError("fpdf2 n'est pas installé. Exécutez : pip install fpdf2")

    profile = (vsme or {}).get("profile", {}) or {}
    company = profile.get("raisonSociale") or "Entreprise"
    year = profile.get("anneeReporting") or "—"
    generated_at = (vsme or {}).get("generatedAt") or ""

    builder = _VsmeBuilder()
    builder.cover(
        str(company), year, generated_at,
        subtitle="Rapport VSME — Standard Volontaire PME (EFRAG)",
        badge_color=PURPLE,
        toc_lines=[
            "Score de complétude VSME",
            "A — Profil de l'entreprise",
            "B — Informations environnementales",
            "C — Informations sociales",
            "D — Informations de gouvernance",
        ],
    )

    if vsme:
        builder.build_completude(vsme)
        builder.build_profile(vsme)
        builder.build_environnement(vsme)
        builder.build_social(vsme)
        builder.build_gouvernance(vsme)

    return builder.output_bytes()


# ---------------------------------------------------------------------------
# Template router — dispatche vers le bon générateur
# ---------------------------------------------------------------------------

TEMPLATE_GENERATORS = {
    "esg-synthesis": lambda carbon, vsme, esg: generate_esg_synthesis_pdf(carbon, vsme, esg),
    "csrd": lambda carbon, vsme, esg: generate_csrd_pdf(carbon, vsme, esg),
    "vsme": lambda carbon, vsme, esg: generate_vsme_pdf(vsme),
}


def generate_pdf_by_template(
    template: str,
    carbon: dict[str, Any] | None,
    vsme: dict[str, Any] | None,
    esg: dict[str, Any] | None,
) -> bytes:
    """Dispatche vers le générateur approprié selon le template."""
    gen = TEMPLATE_GENERATORS.get(template)
    if gen is None:
        raise ValueError(f"Template inconnu : {template}. Disponibles : {list(TEMPLATE_GENERATORS)}")
    return gen(carbon, vsme, esg)
