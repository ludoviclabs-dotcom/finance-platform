"""
models/geo.py — géospatial des sites (PR-08 tranche A) : candidats de
géocodage et exposition géo d'un site.

Champs snake_case alignés sur les colonnes SQL de la migration 036 (même
convention que models/energy.py). Invariants portés par les types :

- `GeocodeReviewStatus` reprend EXACTEMENT le vocabulaire de revue établi
  (pending|accepted|flagged — supplier_sites 030, energy_activities 031),
  jamais un 4e vocabulaire.
- `method_code` d'un candidat est un vocabulaire FERMÉ (contrainte 036) ; la
  saisie manuelle est `manual_coordinates_v1` — le MÊME gate que tout
  adaptateur, aucun raccourci « la saisie manuelle est de confiance ».
- Aucune coordonnée n'est « utilisable » tant que `geocode_review_status`
  n'est pas `accepted` — règle appliquée par geocode_service, reflétée ici
  par `SiteGeoResponse.position_usable`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

GeocodeReviewStatus = Literal["pending", "accepted", "flagged"]
CandidateStatus = Literal["proposed", "accepted", "rejected"]
GeocodePrecision = Literal["exact", "street", "city", "country", "manual"]


class GeocodeCandidateCreate(BaseModel):
    """Proposition d'un candidat de géocodage — saisie manuelle ou résultat
    d'un fournisseur enregistré comme MÉTADONNÉE (aucun appel réseau réel :
    provider/provider_ref documentent la provenance, ils ne déclenchent rien)."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    precision: GeocodePrecision = "manual"
    provider: str = Field(default="manual", min_length=1, max_length=100)
    provider_ref: str | None = Field(default=None, max_length=300)
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class GeocodeCandidateResponse(BaseModel):
    id: int
    company_id: int
    site_id: int
    provider: str
    provider_ref: str | None
    latitude: float
    longitude: float
    precision: GeocodePrecision | None
    method_code: str
    source_release_id: int | None
    evidence_artifact_id: int | None
    status: CandidateStatus
    review_note: str | None
    reviewed_by: int | None
    reviewed_at: datetime | None
    created_by: int | None
    created_at: datetime


class GeocodeCandidateListResponse(BaseModel):
    items: list[GeocodeCandidateResponse]
    total: int
    limit: int
    offset: int


class GeocodeCandidateReviewRequest(BaseModel):
    """Revue humaine d'un candidat : accepter (promeut sites.latitude/longitude)
    ou rejeter. Le réviseur est TOUJOURS l'utilisateur du JWT, jamais un champ
    libre du payload."""

    accept: bool
    note: str | None = Field(default=None, max_length=1000)


class SiteGeoResponse(BaseModel):
    """Vue géo d'un site : la position COURANTE et son état de revue.

    `position_usable` est dérivé côté service : True UNIQUEMENT si le statut
    de revue est `accepted` (aucune analyse géospatiale sur un site pending/
    flagged — gate non négociable)."""

    id: int
    company_id: int
    name: str
    location: str | None
    latitude: float | None
    longitude: float | None
    geocode_precision: GeocodePrecision | None
    geocode_provider: str | None
    geocode_provider_ref: str | None
    geocode_review_status: GeocodeReviewStatus
    geocode_reviewed_by: int | None
    geocode_reviewed_at: datetime | None
    position_usable: bool


class SiteGeoListResponse(BaseModel):
    items: list[SiteGeoResponse]
    total: int
    limit: int
    offset: int
