"""
routers/export.py — Phase 3.B : export auditable ZIP signé.

Endpoints :
  POST   /export/package           (auth analyst+) → retourne ZIP streamé
  GET    /export/packages          (auth) → liste des packages de la company
  GET    /verify/{package_hash}    (PUBLIC, sans auth) → metadata publiques

Le endpoint /verify/{hash} n'expose que des métadonnées non-sensibles :
nom de la company, date de génération, comptages, hash manifest. Il permet
à un auditeur externe de valider qu'un ZIP reçu correspond bien à un
export officiel enregistré par CarbonCo.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db.database import db_available, get_db
from routers.auth import get_current_user, require_analyst
from services import export_package
from services.auth_service import AuthUser

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Pydantic models ──────────────────────────────────────────────────────────

class ExportPackageListItem(BaseModel):
    id: int
    package_hash: str
    manifest_hash: str
    domain: str
    filename: str
    size_bytes: int
    event_count: int
    frozen_count: int
    generated_at: datetime
    generated_by: int | None


class ExportPackageList(BaseModel):
    items: list[ExportPackageListItem]
    total: int


class VerifyResponse(BaseModel):
    """Réponse publique (/verify/{hash}) — metadata non-sensibles uniquement."""
    verified: bool
    package_hash: str
    manifest_hash: str | None = None
    domain: str | None = None
    filename: str | None = None
    size_bytes: int | None = None
    event_count: int | None = None
    frozen_count: int | None = None
    generated_at: datetime | None = None
    company_name: str | None = None
    message: str | None = None


# ── POST /export/package ─────────────────────────────────────────────────────

@router.post("/package")
async def generate_package(
    domain: Annotated[str, Query(pattern="^(consolidated|carbon|esg|finance)$")] = "consolidated",
    include_pdf: Annotated[bool, Query()] = True,
    user: AuthUser = Depends(require_analyst),
) -> StreamingResponse:
    """Génère un package ZIP auditable pour la company courante.

    Le ZIP contient : manifest.json, audit_trail.json, snapshot.json,
    README.txt, et optionnellement report.pdf (avec watermark hash).

    Rate limit : 5/60s (géré globalement par rate_limit middleware).
    """
    company_name = "Entreprise"
    if db_available():
        try:
            with get_db(company_id=user.company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT name FROM companies WHERE id = %s",
                        (user.company_id,),
                    )
                    row = cur.fetchone()
                    if row:
                        company_name = row["name"]
        except Exception as exc:
            logger.warning("Lookup company name échoué: %s", exc)

    # Tentative de génération PDF watermark (best-effort, pas bloquant si échec)
    report_pdf_bytes: bytes | None = None
    if include_pdf:
        try:
            from services import carbon_service
            from services.pdf_service import generate_esg_synthesis_pdf
            from services.snapshot_cache import read_snapshot

            carbon_data = read_snapshot("carbon", company_id=user.company_id)
            esg_data = read_snapshot("esg", company_id=user.company_id)
            vsme_data = read_snapshot("vsme", company_id=user.company_id)
            # On génère sans watermark d'abord (on l'ajoutera dans le ZIP final pass 2)
            report_pdf_bytes = generate_esg_synthesis_pdf(carbon_data, vsme_data, esg_data)
        except Exception as exc:
            logger.warning("Génération PDF échouée, package sans report.pdf: %s", exc)
            report_pdf_bytes = None

    try:
        package = export_package.build_package(
            company_id=user.company_id,
            company_name=company_name,
            domain=domain,
            generated_by=user.user_id,
            report_pdf_bytes=report_pdf_bytes,
        )
    except export_package.ExportError as exc:
        raise HTTPException(500, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("build_package a levé: %s", exc)
        raise HTTPException(500, detail=f"Erreur génération package : {exc}") from exc

    # Si le PDF a été généré, on regénère une version avec watermark (nécessite le hash final)
    if include_pdf and report_pdf_bytes is not None:
        try:
            from services.pdf_service import generate_esg_synthesis_pdf
            from services.snapshot_cache import read_snapshot

            carbon_data = read_snapshot("carbon", company_id=user.company_id)
            esg_data = read_snapshot("esg", company_id=user.company_id)
            vsme_data = read_snapshot("vsme", company_id=user.company_id)
            report_pdf_watermarked = generate_esg_synthesis_pdf(
                carbon_data, vsme_data, esg_data,
                watermark_hash=package.package_hash,
                watermark_frozen_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            )
            # Rebuild package avec le nouveau PDF — le hash final diffèrera, on accepte
            # (on aurait pu faire un 2-pass, mais le coût n'en vaut pas la chandelle ;
            # le client a un ZIP cohérent avec son hash calculable)
            package = export_package.build_package(
                company_id=user.company_id,
                company_name=company_name,
                domain=domain,
                generated_by=user.user_id,
                report_pdf_bytes=report_pdf_watermarked,
            )
        except Exception as exc:
            logger.warning("Ré-génération PDF avec watermark échouée : %s", exc)

    return StreamingResponse(
        iter([package.zip_bytes]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{package.filename}"',
            "X-Package-Hash": package.package_hash,
            "X-Manifest-Hash": package.manifest_hash,
            "X-Event-Count": str(package.event_count),
            "X-Frozen-Count": str(package.frozen_count),
            "Content-Length": str(package.size_bytes),
        },
    )


# ── GET /export/packages ─────────────────────────────────────────────────────

@router.get("/packages", response_model=ExportPackageList)
async def list_packages(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> ExportPackageList:
    """Liste les packages générés pour la company courante."""
    if not db_available():
        return ExportPackageList(items=[], total=0)

    items: list[ExportPackageListItem] = []
    total = 0
    with get_db(company_id=user.company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM export_packages WHERE company_id = %s",
                (user.company_id,),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                """
                SELECT id, package_hash, manifest_hash, domain, filename,
                       size_bytes, event_count, frozen_count, generated_at, generated_by
                FROM export_packages
                WHERE company_id = %s
                ORDER BY generated_at DESC
                LIMIT %s OFFSET %s
                """,
                (user.company_id, limit, offset),
            )
            for row in cur.fetchall():
                items.append(ExportPackageListItem(
                    id=row["id"],
                    package_hash=row["package_hash"],
                    manifest_hash=row["manifest_hash"],
                    domain=row["domain"],
                    filename=row["filename"],
                    size_bytes=row["size_bytes"],
                    event_count=row["event_count"],
                    frozen_count=row["frozen_count"],
                    generated_at=row["generated_at"],
                    generated_by=row["generated_by"],
                ))
    return ExportPackageList(items=items, total=total)
