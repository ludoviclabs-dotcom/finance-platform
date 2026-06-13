from __future__ import annotations

from pydantic import BaseModel


class VsmeDatapoint(BaseModel):
    """Un datapoint du référentiel VSME (catalogue global EFRAG)."""
    code: str
    module: str
    label: str
    type: str
    unit: str | None = None
    snapshot: str | None = None
    fact_code: str | None = None
    collect: str


class VsmeModuleSummary(BaseModel):
    module: str
    total: int
    mandatory: int


class VsmeCatalogResponse(BaseModel):
    version: str
    standard: str
    count: int
    modules: list[VsmeModuleSummary]
    datapoints: list[VsmeDatapoint]
