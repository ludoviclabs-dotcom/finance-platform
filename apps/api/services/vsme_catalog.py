"""
vsme_catalog.py — T3.1 : référentiel VSME (catalogue global des datapoints).

Le catalogue est statique (standard EFRAG, identique pour toutes les
organisations) : il est servi directement depuis data/vsme_datapoints.json, sans
DB. La table `vsme_datapoints` (migration 014) n'est qu'une copie persistée pour
les jointures ; les lectures applicatives passent par ce module.
Source de vérité : docs/carbonco/VSME_DATAPOINT_MAPPING.md.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "vsme_datapoints.json")

# Modules EFRAG attendus (Basic B1-B11 + Comprehensive C1-C9).
BASIC_MODULES = [f"B{i}" for i in range(1, 12)]
COMPREHENSIVE_MODULES = [f"C{i}" for i in range(1, 10)]
ALL_MODULES = BASIC_MODULES + COMPREHENSIVE_MODULES

VALID_TYPES = {"quantitatif", "narratif", "booleen"}
VALID_COLLECT = {"mandatory", "optional"}


@lru_cache(maxsize=1)
def _load() -> dict[str, Any]:
    with open(_DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def catalog_version() -> str:
    return _load()["version"]


def standard_label() -> str:
    return _load()["standard"]


def all_datapoints() -> list[dict[str, Any]]:
    return list(_load()["datapoints"])


def get_datapoint(code: str) -> dict[str, Any] | None:
    return next((d for d in all_datapoints() if d["code"] == code), None)


def by_module(module: str) -> list[dict[str, Any]]:
    m = module.upper()
    return [d for d in all_datapoints() if d["module"] == m]


def modules_summary() -> list[dict[str, Any]]:
    """Compte de datapoints par module (mandatory/optional), ordre EFRAG."""
    out: list[dict[str, Any]] = []
    for m in ALL_MODULES:
        dps = by_module(m)
        if not dps:
            continue
        out.append({
            "module": m,
            "total": len(dps),
            "mandatory": sum(1 for d in dps if d["collect"] == "mandatory"),
        })
    return out
