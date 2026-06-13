"""
routers/verify.py — Phase 3.B : vérification PUBLIQUE de packages d'export.

Endpoint :
  GET /verify/{package_hash}  (PUBLIC, aucune auth requise)

Permet à un auditeur externe de valider qu'un ZIP reçu correspond à un export
officiel enregistré par CarbonCo. N'expose QUE des métadonnées non-sensibles
(pas de contenu, pas de PII détaillée).

Ce router est monté SANS dépendance d'authentification — il est crucial qu'il
ne divulgue aucune info sensible au-delà de : nom de la company (public),
date, comptages de base, hashs. Pas de données financières, pas d'emails,
pas de détail des KPIs.
"""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from services import export_package

router = APIRouter()
logger = logging.getLogger(__name__)

# Aligné sur main.MAX_BODY_SIZE (16 Mo) : le middleware de taille de corps rejette
# toute requête plus grande AVANT ce handler, donc un cap supérieur serait inatteignable.
MAX_VERIFY_ZIP = 16 * 1024 * 1024  # 16 Mo


class VerifyPublicResponse(BaseModel):
    """Réponse du verify public — metadata non-sensibles uniquement."""
    verified: bool
    package_hash: str
    manifest_hash: str | None = None
    matched_on: str | None = None  # "package" | "manifest"
    domain: str | None = None
    filename: str | None = None
    size_bytes: int | None = None
    event_count: int | None = None
    frozen_count: int | None = None
    generated_at: datetime | None = None
    company_name: str | None = None
    message: str


class RecomputeResponse(BaseModel):
    """Résultat du recompute serveur d'un ZIP : authentic | altered | unknown | invalid."""
    status: str
    package_hash: str | None = None
    manifest_hash: str | None = None
    self_consistent: bool | None = None
    company_name: str | None = None
    generated_at: datetime | None = None
    message: str


@router.get("/{package_hash}", response_model=VerifyPublicResponse)
async def verify_package(package_hash: str) -> VerifyPublicResponse:
    """Endpoint PUBLIC — vérifie qu'un hash correspond à un export officiel.

    Réponse :
      - verified=True + metadata  si le hash est enregistré
      - verified=False sinon (404 pour retourner aussi un message structuré)

    Le package_hash est un SHA-256 hex (64 chars). Tout autre format → 400.
    """
    if not package_hash or len(package_hash) != 64:
        raise HTTPException(
            400,
            detail="package_hash invalide — attendu : SHA-256 hex (64 caractères)",
        )
    if not all(c in "0123456789abcdef" for c in package_hash.lower()):
        raise HTTPException(400, detail="package_hash invalide — caractères non-hex")

    metadata = export_package.lookup_by_hash(package_hash.lower())
    if not metadata:
        # 404 avec structure plutôt que throw — permet au client de différencier
        # "mauvais hash" de "erreur serveur"
        return VerifyPublicResponse(
            verified=False,
            package_hash=package_hash.lower(),
            message="Aucun package officiel ne correspond à ce hash.",
        )

    generated_at = metadata.get("generated_at")
    if isinstance(generated_at, str):
        try:
            generated_at = datetime.fromisoformat(generated_at)
        except ValueError:
            generated_at = None

    return VerifyPublicResponse(
        verified=True,
        package_hash=metadata["package_hash"],
        manifest_hash=metadata.get("manifest_hash"),
        matched_on=metadata.get("matched_on"),
        domain=metadata.get("domain"),
        filename=metadata.get("filename"),
        size_bytes=metadata.get("size_bytes"),
        event_count=metadata.get("event_count"),
        frozen_count=metadata.get("frozen_count"),
        generated_at=generated_at,
        company_name=metadata.get("company_name"),
        message=(
            f"Package officiel vérifié. Généré le "
            f"{generated_at.strftime('%d/%m/%Y %H:%M') if generated_at else '—'} "
            f"pour {metadata.get('company_name') or 'une entreprise'}."
        ),
    )


_RECOMPUTE_MESSAGES = {
    "authentic": "Pack authentique — identique à l'export officiel enregistré.",
    "altered": "Pack ALTÉRÉ — un export officiel correspond, mais les octets diffèrent (fichier modifié).",
    "unknown": "Aucun export officiel ne correspond à ce fichier.",
}


@router.post("/recompute", response_model=RecomputeResponse)
async def verify_recompute(file: UploadFile = File(...)) -> RecomputeResponse:
    """Endpoint PUBLIC — recompute serveur d'un ZIP reçu → authentic|altered|unknown.

    L'auditeur dépose le pack ; le serveur recalcule package_hash + manifest_hash,
    vérifie la cohérence interne et compare à l'enregistrement officiel. Détecte une
    modification d'1 octet du ZIP (→ altered). Aucune donnée métier n'est exposée.
    """
    data = await file.read()
    if not data:
        raise HTTPException(400, detail="Fichier vide.")
    if len(data) > MAX_VERIFY_ZIP:
        raise HTTPException(413, detail=f"Archive trop volumineuse (max {MAX_VERIFY_ZIP // 1024 // 1024} Mo).")

    result = export_package.verify_zip(data)
    status_value = result["status"]
    meta = result.get("metadata") or {}

    generated_at = meta.get("generated_at")
    if isinstance(generated_at, str):
        try:
            generated_at = datetime.fromisoformat(generated_at)
        except ValueError:
            generated_at = None

    message = (
        result.get("reason") or "Fichier non reconnu comme pack CarbonCo."
        if status_value == "invalid"
        else _RECOMPUTE_MESSAGES.get(status_value, "")
    )
    return RecomputeResponse(
        status=status_value,
        package_hash=result.get("package_hash"),
        manifest_hash=result.get("manifest_hash"),
        self_consistent=result.get("self_consistent"),
        company_name=meta.get("company_name"),
        generated_at=generated_at,
        message=message,
    )
