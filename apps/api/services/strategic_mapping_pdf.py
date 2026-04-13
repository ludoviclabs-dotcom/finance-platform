"""
strategic_mapping_pdf.py — Génération PDF board-ready Value Mapping ESG.

Structure (6 pages) :
  1. Couverture        — titre, segment/persona/horizon, version, date
  2. Synthèse hero     — résumé + messages exécutifs par persona
  3. Investissements   — 4 piliers + chaîne de valeur
  4. Avant / Après     — 7 catégories comparatives
  5. Gains & Externalités — tableau financialGains + externalities + sources
  6. Leviers Carbon&Co — 6 capacités de la plateforme

Source de vérité unique : StrategicMappingResponse (même que JSON + Excel).
"""

from __future__ import annotations

import io
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from fpdf import FPDF  # type: ignore[import]
    _FPDF_AVAILABLE = True
except ImportError:
    _FPDF_AVAILABLE = False
    FPDF = None  # type: ignore[assignment,misc]

from models.strategic_mapping import StrategicMappingResponse


# ---------------------------------------------------------------------------
# Utilitaire encodage — fpdf2 avec polices built-in requiert latin-1
# ---------------------------------------------------------------------------

_UNICODE_MAP = str.maketrans({
    "\u2014": "-",   # em dash —
    "\u2013": "-",   # en dash –
    "\u2019": "'",   # apostrophe '
    "\u2018": "'",   # guillemet ouvrant '
    "\u201c": '"',   # guillemet ouvrant "
    "\u201d": '"',   # guillemet fermant "
    "\u2026": "...", # ellipse …
    "\u00e9": "\xe9",  # é (déjà latin-1, passthrough)
    "\u00e8": "\xe8",  # è
    "\u00ea": "\xea",  # ê
    "\u00e0": "\xe0",  # à
    "\u00e2": "\xe2",  # â
    "\u00f4": "\xf4",  # ô
    "\u00fb": "\xfb",  # û
    "\u00ee": "\xee",  # î
    "\u00ef": "\xef",  # ï
    "\u00fc": "\xfc",  # ü
    "\u00e7": "\xe7",  # ç
    "\u00f9": "\xf9",  # ù
    "\u00ab": "<<",  # «
    "\u00bb": ">>",  # »
    "\u20ac": "EUR", # €
    "\u2080": "0",   # subscript 0 (CO₂ → CO2)
    "\u2082": "2",   # subscript 2
    "\u2083": "3",   # subscript 3
    "\u2085": "5",   # subscript 5
    "\u2081": "1",   # subscript 1
    "\u2260": "!=",  # ≠
    "\u2265": ">=",  # ≥
    "\u2264": "<=",  # ≤
    "\u00b0": " deg",# °
    "\u00b2": "2",   # superscript 2
    "\u00b3": "3",   # superscript 3
    "\u2022": "*",   # bullet •
    "\u00a0": " ",   # non-breaking space
    "\u202f": " ",   # narrow no-break space
    "\u26a0": "(!)", # ⚠
})


def _t(text: str) -> str:
    """Translitère les caractères Unicode hors latin-1 pour fpdf2/Helvetica.
    Les caractères non mappés sont remplacés par '?' en dernier recours."""
    translated = text.translate(_UNICODE_MAP)
    # Fallback : encoder en latin-1 en remplaçant les caractères inconnus
    return translated.encode("latin-1", errors="replace").decode("latin-1")


# ---------------------------------------------------------------------------
# Palette — identique à pdf_service.py
# ---------------------------------------------------------------------------

EMERALD = (5, 150, 105)
DARK    = (15, 23, 42)
MUTED   = (100, 116, 139)
LIGHT   = (226, 232, 240)
WHITE   = (255, 255, 255)
RED_L   = (254, 226, 226)
GREEN_L = (209, 250, 229)
RED_D   = (185, 28, 28)
GREEN_D = (4, 120, 87)

MARGIN  = 14
LINE_H  = 6


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------

class _ValueMappingBuilder:
    def __init__(self) -> None:
        if not _FPDF_AVAILABLE:
            raise RuntimeError("fpdf2 n'est pas installe - pip install fpdf2")
        self.pdf = FPDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=18)
        self.pdf.set_margins(MARGIN, MARGIN, MARGIN)
        self._page_num = 0

    # ------------------------------------------------------------------ helpers

    def _new_page(self) -> None:
        self.pdf.add_page()
        self._page_num += 1

    def _footer(self, left: str = "Carbon & Co - Value Mapping ESG") -> None:
        self.pdf.set_y(-13)
        self.pdf.set_font("Helvetica", "I", 7)
        self.pdf.set_text_color(*MUTED)
        self.pdf.cell(0, 5, _t(left), align="L")
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 5, f"Page {self._page_num}", align="R")

    def _section(self, title: str) -> None:
        self.pdf.ln(3)
        self.pdf.set_fill_color(*EMERALD)
        self.pdf.set_text_color(*WHITE)
        self.pdf.set_font("Helvetica", "B", 10)
        self.pdf.cell(0, 6, f"  {_t(title).upper()}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(1)

    def _label(self, text: str) -> None:
        self.pdf.set_font("Helvetica", "B", 8)
        self.pdf.set_text_color(*MUTED)
        self.pdf.cell(0, 5, _t(text), new_x="LMARGIN", new_y="NEXT")

    def _body(self, text: str, size: int = 9) -> None:
        self.pdf.set_font("Helvetica", "", size)
        self.pdf.set_text_color(*DARK)
        self.pdf.multi_cell(0, LINE_H - 1, _t(text), new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(1)

    def _divider(self) -> None:
        self.pdf.set_draw_color(*LIGHT)
        self.pdf.set_line_width(0.2)
        self.pdf.line(MARGIN, self.pdf.get_y(), 210 - MARGIN, self.pdf.get_y())
        self.pdf.ln(2)

    def _badge(self, text: str, x: float, y: float,
                bg: tuple[int, int, int] = EMERALD,
                fg: tuple[int, int, int] = WHITE) -> None:
        self.pdf.set_xy(x, y)
        self.pdf.set_fill_color(*bg)
        self.pdf.set_text_color(*fg)
        self.pdf.set_font("Helvetica", "B", 7)
        self.pdf.cell(len(text) * 1.9 + 4, 5, text, fill=True, align="C")

    # ------------------------------------------------------------------ pages

    def build_cover(self, data: StrategicMappingResponse) -> None:
        self._new_page()

        # Bandeau vert haut
        self.pdf.set_fill_color(*EMERALD)
        self.pdf.rect(0, 0, 210, 50, style="F")

        # Logo / brand
        self.pdf.set_text_color(*WHITE)
        self.pdf.set_font("Helvetica", "B", 8)
        self.pdf.set_xy(MARGIN, 12)
        self.pdf.cell(0, 5, "CARBON & CO - PLATEFORME ESG & CSRD", new_x="LMARGIN", new_y="NEXT")

        # Titre principal
        self.pdf.set_font("Helvetica", "B", 22)
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 12, "Value Mapping ESG", new_x="LMARGIN", new_y="NEXT")

        # Sous-titre
        self.pdf.set_font("Helvetica", "", 10)
        self.pdf.set_x(MARGIN)
        self.pdf.cell(0, 6, _t("Adhesion volontaire - logique economique de la demarche"), new_x="LMARGIN", new_y="NEXT")

        # Zone infos — sur fond blanc
        self.pdf.set_y(65)
        self.pdf.set_text_color(*DARK)
        self.pdf.set_font("Helvetica", "B", 14)
        # Titre du hero (tronqué + translitéré)
        title_short = _t(data.hero.title[:70] + ("..." if len(data.hero.title) > 70 else ""))
        self.pdf.multi_cell(0, 8, title_short, new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(2)

        # Filtres appliqués
        self.pdf.set_font("Helvetica", "", 9)
        self.pdf.set_text_color(*MUTED)
        seg_label = {"pme": "PME", "eti": "ETI", "grand_groupe": "Grand groupe", "generic": "Generique"}
        per_label = {
            "dg": "Direction Generale", "daf": "DAF",
            "investisseur": "Investisseur", "donneur_ordre": "Donneur d'ordre",
            "generic": "Tous personas",
        }
        self.pdf.cell(0, 5,
                      f"Segment : {seg_label.get(data.filters.segment, data.filters.segment)}"
                      f"  -  Persona : {per_label.get(data.filters.persona, data.filters.persona)}",
                      new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(4)

        self._divider()

        # Sommaire
        self.pdf.set_font("Helvetica", "B", 10)
        self.pdf.set_text_color(*DARK)
        self.pdf.cell(0, 6, "Contenu du rapport", new_x="LMARGIN", new_y="NEXT")
        self.pdf.set_font("Helvetica", "", 9)
        self.pdf.set_text_color(*MUTED)
        toc = [
            "1. Resume & messages executifs",
            "2. Investissements & chaine de valeur",
            "3. Avant / Apres l'adhesion volontaire",
            "4. Gains financiers & externalites positives",
            "5. Comment Carbon & Co active ces benefices",
        ]
        for line in toc:
            self.pdf.cell(0, 6, line, new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(4)

        self._divider()

        # Méta
        self.pdf.set_font("Helvetica", "", 8)
        self.pdf.set_text_color(*MUTED)
        self.pdf.cell(0, 5,
                      f"Version {data.meta.version}  -  "
                      f"Revise le {data.meta.lastReviewedAt}  -  "
                      f"Prochaine revision {data.meta.nextReviewScheduled}",
                      new_x="LMARGIN", new_y="NEXT")
        self.pdf.cell(0, 5,
                      "Gains formules en potentiel conditionnel - sources verifiees.",
                      new_x="LMARGIN", new_y="NEXT")
        self._footer()

    def build_hero_and_messages(self, data: StrategicMappingResponse) -> None:
        self._new_page()
        self._section("1. Resume & messages executifs")

        # Résumé hero
        self._body(data.hero.summary)
        self._divider()

        if not data.executiveMessages:
            self._body("Aucun message executif pour les filtres selectionnes.")
        else:
            for msg in data.executiveMessages:
                # Label persona
                self.pdf.set_font("Helvetica", "B", 8)
                self.pdf.set_text_color(*EMERALD)
                self.pdf.cell(0, 5, _t(msg.personaLabel).upper(), new_x="LMARGIN", new_y="NEXT")

                # Headline
                self.pdf.set_font("Helvetica", "B", 10)
                self.pdf.set_text_color(*DARK)
                self.pdf.multi_cell(0, 6, _t(msg.headline), new_x="LMARGIN", new_y="NEXT")
                self.pdf.ln(1)

                # Bullets
                self.pdf.set_font("Helvetica", "", 9)
                self.pdf.set_text_color(*MUTED)
                for point in msg.supporting:
                    self.pdf.cell(0, LINE_H, "- " + _t(point), new_x="LMARGIN", new_y="NEXT")
                self.pdf.ln(3)
                self._divider()

        # KPIs grounded si disponibles
        if data.groundedKpis and data.groundedKpis.dataAvailable:
            g = data.groundedKpis
            self.pdf.ln(2)
            self.pdf.set_font("Helvetica", "B", 9)
            self.pdf.set_text_color(*EMERALD)
            company_str = f" - {_t(g.companyName)}" if g.companyName else ""
            self.pdf.cell(0, 5, f"Donnees entreprise{company_str}", new_x="LMARGIN", new_y="NEXT")
            self.pdf.set_font("Helvetica", "", 9)
            self.pdf.set_text_color(*DARK)
            if g.totalS123Tco2e is not None:
                self.pdf.cell(0, 5, f"Emissions S1+2+3 : {g.totalS123Tco2e:,.1f} tCO2e", new_x="LMARGIN", new_y="NEXT")
            if g.esgScoreGlobal is not None:
                self.pdf.cell(0, 5, f"Score ESG global : {g.esgScoreGlobal:.1f}/100", new_x="LMARGIN", new_y="NEXT")
            if g.vsmeCompletion is not None:
                self.pdf.cell(0, 5, f"Completion VSME : {g.vsmeCompletion:.1f} %", new_x="LMARGIN", new_y="NEXT")

        self._footer()

    def build_investments(self, data: StrategicMappingResponse) -> None:
        self._new_page()
        self._section("2. Investissements & chaine de valeur")

        # Investissements — tableau compact
        seg = data.filters.segment
        for pilier in data.investments:
            self.pdf.set_font("Helvetica", "B", 9)
            self.pdf.set_text_color(*DARK)
            self.pdf.cell(0, 5, _t(pilier.label), new_x="LMARGIN", new_y="NEXT")
            self._body(pilier.description, size=9)

            # Budget pour le segment courant (ou premier disponible)
            budget_ranges = [br for br in pilier.budgetRanges if br.segment == seg]
            if not budget_ranges and pilier.budgetRanges:
                budget_ranges = pilier.budgetRanges[:1]
            if budget_ranges:
                br = budget_ranges[0]
                note_str = f" - {_t(br.note)}" if br.note else ""
                self.pdf.set_font("Helvetica", "I", 8)
                self.pdf.set_text_color(*MUTED)
                self.pdf.cell(0, 5,
                              f"Budget indicatif : {br.low:,} - {br.high:,} {br.unit}{note_str}",
                              new_x="LMARGIN", new_y="NEXT")
            self.pdf.ln(2)

        self._divider()
        self.pdf.ln(1)

        # Chaîne de valeur — liste numérotée
        self.pdf.set_font("Helvetica", "B", 9)
        self.pdf.set_text_color(*DARK)
        self.pdf.cell(0, 5, "Chaine de valeur", new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(1)

        for step in data.valueChain:
            self.pdf.set_font("Helvetica", "B", 9)
            self.pdf.set_text_color(*EMERALD)
            self.pdf.cell(8, LINE_H, str(step.order))
            self.pdf.set_text_color(*DARK)
            self.pdf.cell(0, LINE_H, _t(step.label), new_x="LMARGIN", new_y="NEXT")
            self.pdf.set_font("Helvetica", "", 8)
            self.pdf.set_text_color(*MUTED)
            self.pdf.multi_cell(0, 5, _t(step.description), new_x="LMARGIN", new_y="NEXT")
            if step.precisionNote:
                self.pdf.set_font("Helvetica", "I", 7)
                self.pdf.set_text_color(*MUTED)
                self.pdf.multi_cell(0, 4, _t(f"(!) {step.precisionNote}"), new_x="LMARGIN", new_y="NEXT")
            self.pdf.ln(2)

        self._footer()

    def build_before_after(self, data: StrategicMappingResponse) -> None:
        self._new_page()
        self._section("3. Avant / Apres l'adhesion volontaire")

        # En-têtes colonnes
        col_w = (210 - 2 * MARGIN - 40) / 2
        self.pdf.set_font("Helvetica", "B", 8)
        self.pdf.set_text_color(*WHITE)

        self.pdf.set_fill_color(185, 28, 28)
        self.pdf.cell(40, 6, "  Categorie", fill=True)
        self.pdf.set_fill_color(185, 28, 28)
        self.pdf.cell(col_w, 6, "Sans demarche (avant)", fill=True, align="C")
        self.pdf.set_fill_color(4, 120, 87)
        self.pdf.cell(col_w, 6, "Avec demarche (apres)", fill=True, align="C",
                      new_x="LMARGIN", new_y="NEXT")

        for item in data.beforeAfter:
            row_h = max(10, min(20, len(item.before) // 5 + 6))

            self.pdf.set_font("Helvetica", "B", 8)
            self.pdf.set_text_color(*DARK)
            x_start = self.pdf.get_x()
            y_start = self.pdf.get_y()

            # Catégorie
            self.pdf.set_xy(x_start, y_start)
            self.pdf.set_fill_color(*LIGHT)
            self.pdf.cell(40, row_h, f"  {_t(item.category)}", fill=True, border=1)

            # Avant (rouge clair)
            self.pdf.set_xy(x_start + 40, y_start)
            self.pdf.set_fill_color(254, 226, 226)
            self.pdf.set_font("Helvetica", "", 8)
            self.pdf.set_text_color(*DARK)
            self.pdf.cell(col_w, row_h, _t(item.before), fill=True, border=1)

            # Après (vert clair)
            self.pdf.set_xy(x_start + 40 + col_w, y_start)
            self.pdf.set_fill_color(209, 250, 229)
            self.pdf.set_font("Helvetica", "B", 8)
            self.pdf.cell(col_w, row_h, _t(item.after), fill=True, border=1,
                          new_x="LMARGIN", new_y="NEXT")

        self._footer()

    def build_gains(self, data: StrategicMappingResponse) -> None:
        self._new_page()
        self._section("4. Gains financiers & externalites positives")

        # Gains financiers
        self.pdf.set_font("Helvetica", "B", 9)
        self.pdf.set_text_color(*DARK)
        self.pdf.cell(0, 5, "Gains financiers", new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(1)

        usable_w = 210 - 2 * MARGIN  # ~182 mm
        badge_w = 22
        label_w = usable_w - badge_w

        for gain in data.financialGains:
            self.pdf.set_font("Helvetica", "B", 9)
            self.pdf.set_text_color(*DARK)
            self.pdf.cell(label_w, 5, _t(gain.label))
            if gain.qualitative:
                self.pdf.set_fill_color(*LIGHT)
                self.pdf.set_text_color(*MUTED)
            else:
                self.pdf.set_fill_color(*EMERALD)
                self.pdf.set_text_color(*WHITE)
            self.pdf.set_font("Helvetica", "B", 7)
            self.pdf.cell(badge_w, 5,
                          "Qualitatif" if gain.qualitative else "Chiffre",
                          fill=True, align="C",
                          new_x="LMARGIN", new_y="NEXT")

            self.pdf.set_font("Helvetica", "", 8)
            self.pdf.set_text_color(*MUTED)
            self.pdf.multi_cell(0, 5, _t(gain.description), new_x="LMARGIN", new_y="NEXT")

            if gain.magnitude:
                self.pdf.set_font("Helvetica", "I", 8)
                self.pdf.set_text_color(*EMERALD)
                self.pdf.multi_cell(0, 5, _t(gain.magnitude), new_x="LMARGIN", new_y="NEXT")

            if gain.sources:
                self.pdf.set_font("Helvetica", "", 7)
                self.pdf.set_text_color(*MUTED)
                src_str = "  ".join(f"{_t(s.publisher)} ({s.year})" for s in gain.sources)
                self.pdf.cell(0, 4, src_str, new_x="LMARGIN", new_y="NEXT")
            self.pdf.ln(2)

        self._divider()

        if data.externalities:
            self.pdf.set_font("Helvetica", "B", 9)
            self.pdf.set_text_color(*DARK)
            self.pdf.cell(0, 5, "Externalites positives", new_x="LMARGIN", new_y="NEXT")
            self.pdf.ln(1)

            for ext in data.externalities:
                self.pdf.set_font("Helvetica", "B", 9)
                self.pdf.set_text_color(*DARK)
                cat_w = 30
                self.pdf.cell(cat_w, 5, _t(ext.category))
                self.pdf.set_font("Helvetica", "", 9)
                self.pdf.cell(0, 5, _t(ext.label), new_x="LMARGIN", new_y="NEXT")
                self.pdf.set_font("Helvetica", "", 8)
                self.pdf.set_text_color(*MUTED)
                self.pdf.multi_cell(0, 5, _t(ext.description), new_x="LMARGIN", new_y="NEXT")
                self.pdf.ln(1)

        self._footer()

    def build_levers(self, data: StrategicMappingResponse) -> None:
        self._new_page()
        self._section("5. Comment Carbon & Co active ces benefices")

        self.pdf.set_font("Helvetica", "", 9)
        self.pdf.set_text_color(*MUTED)
        self.pdf.multi_cell(0, 5,
            "La plateforme ne produit pas le discours - elle produit les donnees "
            "qui le rendent credible et opposable.",
            new_x="LMARGIN", new_y="NEXT")
        self.pdf.ln(3)

        for i, lever in enumerate(data.carbonCoLevers):
            if i % 2 == 0 and i > 0:
                self.pdf.ln(2)
                self._divider()
            self.pdf.set_font("Helvetica", "B", 8)
            self.pdf.set_text_color(*EMERALD)
            self.pdf.cell(0, 5, _t(lever.benefit).upper(), new_x="LMARGIN", new_y="NEXT")
            self.pdf.set_font("Helvetica", "", 9)
            self.pdf.set_text_color(*DARK)
            self.pdf.multi_cell(0, 5, _t(lever.capability), new_x="LMARGIN", new_y="NEXT")
            if lever.moduleRef:
                self.pdf.set_font("Helvetica", "I", 7)
                self.pdf.set_text_color(*MUTED)
                self.pdf.cell(0, 4, f"Module : {lever.moduleRef}", new_x="LMARGIN", new_y="NEXT")
            self.pdf.ln(2)

        self._divider()

        self.pdf.set_font("Helvetica", "I", 8)
        self.pdf.set_text_color(*MUTED)
        self.pdf.multi_cell(0, 5,
            "Sources verifiees : BCE, Banque de France, LMA, CSRD (UE) 2022/2464, "
            "EcoVadis, ADEME, CDP, Deloitte, PwC, Eurosif, GHG Protocol, TCFD, OCDE. "
            "Gains formules en potentiel conditionnel.",
            new_x="LMARGIN", new_y="NEXT")
        self._footer()

    def output_bytes(self) -> bytes:
        buf = io.BytesIO()
        self.pdf.output(buf)
        return buf.getvalue()


# ---------------------------------------------------------------------------
# Point d'entrée public
# ---------------------------------------------------------------------------

def build_strategic_mapping_pdf(data: StrategicMappingResponse) -> bytes:
    """
    Génère le PDF board-ready Value Mapping ESG et retourne les bytes.

    Raises:
        RuntimeError: si fpdf2 n'est pas installé.
    """
    if not _FPDF_AVAILABLE:
        raise RuntimeError("fpdf2 n'est pas installe - pip install fpdf2")

    builder = _ValueMappingBuilder()
    builder.build_cover(data)
    builder.build_hero_and_messages(data)
    builder.build_investments(data)
    builder.build_before_after(data)
    builder.build_gains(data)
    builder.build_levers(data)
    return builder.output_bytes()
