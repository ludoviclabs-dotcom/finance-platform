"""Tests T4.1 — 15 catégories Scope 3 (GHG Protocol).

Pur (sans DB) : catalogue, convention de code, agrégation du breakdown, endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app
from services import scope3_service as s3

client = TestClient(app)


class TestCatalog:
    def test_fifteen_categories(self) -> None:
        cats = s3.categories()
        assert len(cats) == 15
        assert [c["code"] for c in cats] == list(range(1, 16))

    def test_labels_present(self) -> None:
        assert s3.category_label(1) == "Biens et services achetés"
        assert s3.category_label(15) == "Investissements"


class TestCodeConvention:
    def test_code_for(self) -> None:
        assert s3.code_for(1) == "CC.GES.SCOPE3.1"
        assert s3.code_for(15) == "CC.GES.SCOPE3.15"

    def test_code_for_invalid(self) -> None:
        for bad in (0, 16, -1):
            with pytest.raises(ValueError):
                s3.code_for(bad)

    def test_category_of(self) -> None:
        assert s3.category_of("CC.GES.SCOPE3.4") == 4
        assert s3.category_of("CC.GES.SCOPE3") is None  # agrégat, pas une catégorie
        assert s3.category_of("CC.GES.SCOPE1") is None


class TestAggregate:
    def test_breakdown(self) -> None:
        rows = [
            {"code": "CC.GES.SCOPE3.1", "value": 100},
            {"code": "CC.GES.SCOPE3.4", "value": 50},
            {"code": "CC.GES.SCOPE3", "value": 30},      # agrégat non catégorisé
            {"code": "CC.GES.SCOPE1", "value": 999},     # ignoré (pas Scope 3)
        ]
        b = s3.aggregate_breakdown(rows)
        assert b["coverage"] == [1, 4]
        assert b["coverage_count"] == 2
        assert b["categorized_total"] == 150
        assert b["uncategorized_total"] == 30
        assert b["total_scope3"] == 180
        # Les 15 catégories sont toujours présentes
        assert len(b["categories"]) == 15
        c4 = next(c for c in b["categories"] if c["code"] == 4)
        assert c4["value"] == 50 and c4["evaluated"] is True
        c2 = next(c for c in b["categories"] if c["code"] == 2)
        assert c2["value"] == 0 and c2["evaluated"] is False

    def test_empty(self) -> None:
        b = s3.aggregate_breakdown([])
        assert b["total_scope3"] == 0
        assert b["coverage"] == []
        assert len(b["categories"]) == 15


class TestEndpoints:
    def test_categories_public(self) -> None:
        r = client.get("/scope3/categories")
        assert r.status_code == 200
        assert len(r.json()["categories"]) == 15

    def test_breakdown_requires_auth(self) -> None:
        assert client.get("/scope3/breakdown").status_code in (401, 403)
