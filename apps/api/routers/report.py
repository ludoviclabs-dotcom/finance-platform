from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from db.tenant import get_company_id
from services.audit_service import log_event
from services.pdf_service import TEMPLATE_GENERATORS, generate_pdf_by_template
from services.snapshot_cache import read_snapshot

router = APIRouter()

_VALID_TEMPLATES = list(TEMPLATE_GENERATORS.keys())


@router.post("/generate")
async def generate_report(
    domain: str = "esg-synthesis",
    company_id: int = Depends(get_company_id),
) -> Response:
    """
    Génère un rapport PDF depuis les snapshots en cache.
    Retourne les octets PDF en application/pdf.

    Templates supportés :
      - esg-synthesis (défaut) : Synthèse ESG multi-domaine avec graphiques
      - csrd                    : Rapport CSRD structuré par ESRS (E1, S1, G1)
      - vsme                    : Rapport VSME PME complet
    """
    if domain not in _VALID_TEMPLATES:
        raise HTTPException(
            status_code=400,
            detail=f"Template '{domain}' non supporté. Disponibles : {_VALID_TEMPLATES}",
        )

    # Charger les snapshots depuis le cache
    carbon = read_snapshot("carbon", company_id=company_id)
    vsme   = read_snapshot("vsme", company_id=company_id)
    esg    = read_snapshot("esg", company_id=company_id)

    # Pour esg-synthesis et csrd : au moins un snapshot requis
    if domain in ("esg-synthesis", "csrd") and not any([carbon, vsme, esg]):
        raise HTTPException(
            status_code=422,
            detail="Aucun snapshot disponible. Déclenchez d'abord un ingest via /ingest.",
        )

    # Pour vsme : uniquement le snapshot VSME requis
    if domain == "vsme" and not vsme:
        raise HTTPException(
            status_code=422,
            detail="Snapshot VSME non disponible. Déclenchez d'abord un ingest via /ingest.",
        )

    try:
        pdf_bytes = generate_pdf_by_template(domain, carbon=carbon, vsme=vsme, esg=esg)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        log_event("error", "Échec génération PDF", detail=str(exc), status="error")
        raise HTTPException(status_code=500, detail=f"Erreur génération PDF : {exc}") from exc

    # Construire le nom de fichier
    company = (
        (carbon or {}).get("company", {}) or {}
    ).get("name") or (
        (vsme or {}).get("profile", {}) or {}
    ).get("raisonSociale") or "rapport"
    year = (
        (carbon or {}).get("company", {}) or {}
    ).get("reportingYear") or (
        (vsme or {}).get("profile", {}) or {}
    ).get("anneeReporting") or "2025"
    safe_name = str(company).replace(" ", "_").replace("/", "-")[:40]
    filename = f"carbonco-{domain}-{safe_name}-{year}.pdf"

    log_event(
        "export",
        f"Rapport PDF généré — {domain}",
        detail=f"Entreprise : {company} · Année : {year}",
        status="ok",
        meta={"filename": filename, "sizeBytes": len(pdf_bytes), "template": domain},
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/templates")
async def list_templates() -> dict:
    """Liste les templates PDF disponibles."""
    return {
        "templates": [
            {
                "id": "esg-synthesis",
                "name": "Synthèse ESG",
                "description": "Rapport multi-domaine Carbon + VSME + ESG avec graphiques",
            },
            {
                "id": "csrd",
                "name": "Rapport CSRD",
                "description": "Structuré par ESRS : E1 Changement climatique, S1 Effectifs, G1 Éthique",
            },
            {
                "id": "vsme",
                "name": "Rapport VSME",
                "description": "Standard Volontaire PME (EFRAG) — profil, environnement, social, gouvernance",
            },
        ]
    }
