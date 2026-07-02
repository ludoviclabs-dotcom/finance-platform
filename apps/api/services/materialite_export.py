"""
materialite_export.py — T7.4 : export auditable d'une évaluation de double matérialité.

ZIP déterministe (pattern beges_export/vsme_export) contenant :
  - materialite.pdf : démarche, règle de matérialité (ESRS 1 : impact OU
    financier ≥ seuil), tableau des enjeux scorés avec les deux dimensions,
    justifications, standards ESRS à couvrir, narratif
  - manifest.json + CHECKSUMS.sha256 (vérifiables sur /verify sans outil
    propriétaire)

Enregistré dans export_packages (domaine 'materialite') pour la résolution
publique par hash.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from db.database import db_available, get_db
from services.materialite_service import AssessmentOut
from services.vsme_export import _FIXED_META_DATE, _p, _sha, write_zip

logger = logging.getLogger(__name__)


class MaterialiteExportError(Exception):
    """Erreur de génération de l'export matérialité."""


def build_materialite_pdf(assessment: AssessmentOut, *, company_name: str, generated_at: str) -> bytes:
    try:
        from fpdf import FPDF
    except ImportError as exc:  # pragma: no cover
        raise MaterialiteExportError("fpdf2 indisponible.") from exc

    result = assessment.result
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.creation_date = _FIXED_META_DATE
    pdf.set_auto_page_break(True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, _p("Analyse de double matérialité"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 7, _p(f"{company_name} — {assessment.label}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, _p(f"Généré le {generated_at} — seuil de matérialité : {assessment.threshold}"),
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, _p(
        "Règle appliquée (ESRS 1) : un enjeu est matériel si sa matérialité d'impact OU sa "
        "matérialité financière atteint le seuil."), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, _p(
        f"{result.total_materiel} enjeux matériels sur {result.total_issues} évalués "
        f"({result.total_materiel_impact} côté impact, {result.total_materiel_financier} côté financier)."),
        new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # Tableau des enjeux — les deux dimensions sont TOUJOURS présentées
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(226, 232, 240)
    pdf.cell(58, 7, _p("Enjeu"), border=1, fill=True)
    pdf.cell(22, 7, _p("Impact"), border=1, fill=True, align="C")
    pdf.cell(22, 7, _p("Financier"), border=1, fill=True, align="C")
    pdf.cell(24, 7, _p("Matériel"), border=1, fill=True, align="C")
    pdf.cell(0, 7, _p("Standard"), border=1, fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    for issue in result.issues:
        verdict = "Oui" if issue.materiel else "Non"
        detail = []
        if issue.materiel_impact:
            detail.append("impact")
        if issue.materiel_financier:
            detail.append("financier")
        verdict_full = f"{verdict}" + (f" ({', '.join(detail)})" if detail else "")
        pdf.cell(58, 6, _p(f"[{issue.code}] {issue.label}")[:52], border=1)
        pdf.cell(22, 6, f"{issue.y:.1f}", border=1, align="C")
        pdf.cell(22, 6, f"{issue.x:.1f}", border=1, align="C")
        pdf.cell(24, 6, _p(verdict_full)[:20], border=1, align="C")
        pdf.cell(0, 6, _p(issue.esrs or "—"), border=1, new_x="LMARGIN", new_y="NEXT")

    # Standards à couvrir
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, _p("Standards ESRS à couvrir (enjeux matériels)"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, _p(", ".join(result.esrs_to_activate) or "Aucun enjeu matériel identifié."),
             new_x="LMARGIN", new_y="NEXT")

    # Justifications par enjeu matériel
    justified = [i for i in result.issues if i.materiel and (i.justification or "").strip()]
    if justified:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, _p("Justifications documentées"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for issue in justified:
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, _p(f"[{issue.code}] {issue.label}"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            pdf.multi_cell(0, 5, _p(issue.justification or ""))
            pdf.ln(1)

    # Narratif
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, _p("Narratif"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    narrative_plain = result.narrative.replace("**", "").replace("## ", "").replace("---", "")
    pdf.multi_cell(0, 5, _p(narrative_plain))

    return bytes(pdf.output())


def build_materialite_export(assessment: AssessmentOut, *, company_id: int,
                             company_name: str,
                             generated_at: datetime | None = None) -> dict[str, Any]:
    now = generated_at or datetime.now(tz=timezone.utc)
    pdf_bytes = build_materialite_pdf(
        assessment, company_name=company_name, generated_at=now.strftime("%d/%m/%Y"),
    )

    manifest = {
        "manifest_version": "v1",
        "report": "MATERIALITE",
        "assessment_label": assessment.label,
        "threshold": assessment.threshold,
        "company_name": company_name,
        "total_issues": assessment.total_issues,
        "total_materiel": assessment.total_materiel,
        "files": {
            "materialite.pdf": {"sha256": _sha(pdf_bytes), "size": len(pdf_bytes)},
        },
    }
    manifest_bytes = json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False).encode("utf-8")
    manifest_hash = _sha(manifest_bytes)
    readme = (
        "Analyse de double materialite - CarbonCo\n========================================\n\n"
        f"Organisation : {company_name}\nEvaluation : {assessment.label}\n"
        f"Enjeux materiels : {assessment.total_materiel}/{assessment.total_issues}\n"
        f"Hash manifest : {manifest_hash}\n\n"
        "Verification : sha256sum -c CHECKSUMS.sha256\n"
        f"Enregistrement : https://carbon-snowy-nine.vercel.app/verify/{manifest_hash}\n"
    ).encode("utf-8")

    embedded = {"manifest.json": manifest_bytes, "materialite.pdf": pdf_bytes, "README.txt": readme}
    checksums = ("\n".join(f"{_sha(d)}  {n}" for n, d in sorted(embedded.items())) + "\n").encode("utf-8")
    zip_bytes = write_zip({**embedded, "CHECKSUMS.sha256": checksums})
    package_hash = _sha(zip_bytes)
    filename = f"materialite-{company_id}-{now.strftime('%Y%m%d-%H%M%S')}-{package_hash[:12]}.zip"

    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO export_packages
                            (company_id, package_hash, manifest_hash, domain, filename,
                             size_bytes, event_count, frozen_count, meta)
                        VALUES (%s, %s, %s, 'materialite', %s, %s, 0, 0, %s)
                        ON CONFLICT (package_hash) DO NOTHING
                        """,
                        (company_id, package_hash, manifest_hash, filename, len(zip_bytes),
                         json.dumps({"company_name": company_name, "assessment_id": assessment.id})),
                    )
        except Exception as exc:  # pragma: no cover
            logger.warning("Persist export_packages (materialite) échoué: %s", exc)

    return {
        "zip_bytes": zip_bytes, "filename": filename,
        "package_hash": package_hash, "manifest_hash": manifest_hash,
    }
