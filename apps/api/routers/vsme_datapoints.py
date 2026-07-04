"""
routers/vsme_datapoints.py — T3.1 : exposition du référentiel VSME.

  GET /vsme/datapoints            — catalogue complet (filtre ?module=B3)
  GET /vsme/datapoints/{code}     — un datapoint

Catalogue global servi depuis le JSON (aucune dépendance DB), donc public en
lecture (référentiel public EFRAG).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from models.vsme_datapoints import VsmeCatalogResponse, VsmeDatapoint, VsmeModuleSummary
from services import vsme_catalog

router = APIRouter()


@router.get("", response_model=VsmeCatalogResponse)
def list_datapoints(
    module: str | None = Query(default=None, description="Filtre par module EFRAG (B1…C9)"),
) -> VsmeCatalogResponse:
    datapoints = vsme_catalog.by_module(module) if module else vsme_catalog.all_datapoints()
    return VsmeCatalogResponse(
        version=vsme_catalog.catalog_version(),
        standard=vsme_catalog.standard_label(),
        count=len(datapoints),
        modules=[VsmeModuleSummary(**m) for m in vsme_catalog.modules_summary()],
        datapoints=[VsmeDatapoint(**d) for d in datapoints],
    )


@router.get("/{code}", response_model=VsmeDatapoint)
def get_datapoint(code: str) -> VsmeDatapoint:
    dp = vsme_catalog.get_datapoint(code)
    if dp is None:
        raise HTTPException(404, detail=f"Datapoint VSME inconnu : {code}")
    return VsmeDatapoint(**dp)
