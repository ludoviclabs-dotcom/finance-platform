"""
actions_export.py — exports PDF MACC (T5.1) et Plan de transition (T5.2).

PDF déterministes (creation_date figée, cf. vsme_export) : la MACC dessine les
barres triées par coût marginal croissant (largeur ∝ potentiel) ; le plan de
transition liste les actions par statut + la trajectoire projetée.
"""

from __future__ import annotations

from typing import Any

from services.vsme_export import _FIXED_META_DATE, VsmeExportError, _p


def build_macc_pdf(*, company_name: str, macc: dict[str, Any], generated_at: str) -> bytes:
    try:
        from fpdf import FPDF
    except ImportError as exc:  # pragma: no cover
        raise VsmeExportError("fpdf2 indisponible.") from exc

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.creation_date = _FIXED_META_DATE
    pdf.set_auto_page_break(True, margin=12)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 11, _p("Courbe de coût d'abattement (MACC)"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, _p(f"{company_name} — Généré le {generated_at}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, _p(f"Potentiel total : {macc['total_potential_tco2e']} tCO2e — CapEx total : {macc['total_capex']} EUR"),
             new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    bars = macc["bars"]
    if not bars:
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 8, _p("Aucune action chiffrée (CapEx, réduction et durée requis)."),
                 new_x="LMARGIN", new_y="NEXT")
        return bytes(pdf.output())

    # Repère : aire horizontale = potentiel cumulé, hauteur de barre = coût marginal.
    x0, y_base = 15.0, 175.0
    plot_w = 267.0
    total_pot = macc["total_potential_tco2e"] or 1.0
    max_cost = max((b["marginal_cost"] for b in bars), default=1.0)
    max_cost = max_cost if max_cost > 0 else 1.0
    max_h = 120.0

    for i, b in enumerate(bars):
        x = x0 + plot_w * (b["cumulative_start"] / total_pot)
        w = plot_w * (b["potential_tco2e"] / total_pot)
        h = max_h * (b["marginal_cost"] / max_cost)
        neg = b["marginal_cost"] < 0
        if neg:
            pdf.set_fill_color(16, 185, 129)   # vert : action rentable (coût négatif)
        else:
            pdf.set_fill_color(59, 130, 246)
        pdf.rect(x, y_base - h, max(w, 0.8), h, style="F")
        if i < 12:
            pdf.set_xy(x, y_base + 1)
            pdf.set_font("Helvetica", "", 6)
            pdf.set_text_color(60, 60, 60)
            pdf.multi_cell(max(w, 14), 3, _p(f"{b['title']}\n{b['marginal_cost']} EUR/t"),
                           new_x="LMARGIN", new_y="NEXT")

    pdf.set_draw_color(150, 150, 150)
    pdf.line(x0, y_base, x0 + plot_w, y_base)
    pdf.set_text_color(0, 0, 0)
    return bytes(pdf.output())


_STATUS_LABEL = {"proposed": "Proposée", "committed": "Engagée", "done": "Réalisée"}


def build_transition_pdf(*, company_name: str, actions: list[dict[str, Any]],
                         trajectory: dict[str, Any], generated_at: str) -> bytes:
    try:
        from fpdf import FPDF
    except ImportError as exc:  # pragma: no cover
        raise VsmeExportError("fpdf2 indisponible.") from exc

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.creation_date = _FIXED_META_DATE
    pdf.set_auto_page_break(True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, _p("Plan de transition"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, _p(f"{company_name} — Généré le {generated_at}"), new_x="LMARGIN", new_y="NEXT")
    red = trajectory["reductions"]
    pdf.cell(0, 6, _p(f"Baseline : {trajectory['baseline_tco2e']} tCO2e — "
                      f"Réalisé : -{red['done']} / Engagé : -{red['committed']} / "
                      f"Potentiel total : -{red['total']} tCO2e"),
             new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    for status in ("done", "committed", "proposed"):
        group = [a for a in actions if a.get("status") == status]
        if not group:
            continue
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_fill_color(226, 232, 240)
        pdf.cell(0, 8, _p(f"{_STATUS_LABEL[status]} ({len(group)})"), new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.set_font("Helvetica", "", 9)
        for a in group:
            owner = f" — {a['owner']}" if a.get("owner") else ""
            milestone = f" — jalon {a['milestone']}" if a.get("milestone") else ""
            red_a = f" — -{a['reduction_tco2e']} tCO2e/an" if a.get("reduction_tco2e") else ""
            pdf.multi_cell(0, 5, _p(f"   {a['title']}{owner}{milestone}{red_a}"),
                           new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
    return bytes(pdf.output())
