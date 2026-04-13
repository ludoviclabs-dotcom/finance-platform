from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from services.audit_service import log_event
from services.esg_service import build_esg_snapshot
from services.carbon_service import build_carbon_snapshot
from services.esg_service import build_vsme_snapshot
from services.finance_service import build_finance_snapshot
from services.pdf_service import generate_esg_synthesis_pdf
from services.snapshot_cache import read_snapshot

router = APIRouter()


@router.post("/generate")
async def generate_report(domain: str = "esg-synthesis") -> Response:
    """
    Generate a PDF report from the latest cached snapshots.
    Returns the PDF binary as application/pdf.
    Supported domains: esg-synthesis (default)
    """
    if domain != "esg-synthesis":
        raise HTTPException(status_code=400, detail=f"Domain '{domain}' non supporté. Utilisez 'esg-synthesis'.")

    # Load snapshots from cache (or recalculate if missing)
    def _load(key: str, builder):  # type: ignore[no-untyped-def]
        cached = read_snapshot(key)
        if cached:
            return cached
        try:
            result = builder()
            return result.model_dump() if hasattr(result, "model_dump") else result
        except Exception:
            return None

    carbon = _load("carbon", build_carbon_snapshot)
    vsme   = _load("vsme", build_vsme_snapshot)
    esg    = _load("esg", build_esg_snapshot)

    try:
        pdf_bytes = generate_esg_synthesis_pdf(carbon=carbon, vsme=vsme, esg=esg)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        log_event("error", "Échec génération PDF", detail=str(exc), status="error")
        raise HTTPException(status_code=500, detail=f"Erreur génération PDF : {exc}") from exc

    company = (
        (carbon or {}).get("company", {}) or {}
    ).get("name") or "rapport"
    year = (
        (carbon or {}).get("company", {}) or {}
    ).get("reportingYear") or "2025"
    safe_name = str(company).replace(" ", "_").replace("/", "-")[:40]
    filename = f"carbonco-synthese-{safe_name}-{year}.pdf"

    log_event(
        "export",
        f"Rapport PDF généré — {domain}",
        detail=f"Entreprise : {company} · Année : {year}",
        status="ok",
        meta={"filename": filename, "sizeBytes": len(pdf_bytes)},
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
