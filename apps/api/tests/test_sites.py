"""Tests /sites — sites physiques v1 (list + create) + rattachement MACC.

Sans DB : gardes d'auth, validation du nom, passthrough site_id dans les
schémas actions, signature list_actions(site_id). Le roundtrip DB (RLS,
contrainte UNIQUE, filtre MACC réel) se rejoue manuellement sur Neon.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app
from routers.actions import ActionCreate, ActionPatch
from services import actions_service as act
from services import sites_service

client = TestClient(app)


class TestAuthGuards:
    def test_list_requires_auth(self) -> None:
        assert client.get("/sites").status_code == 401

    def test_create_requires_auth(self) -> None:
        r = client.post("/sites", json={"name": "Usine de Dunkerque"})
        assert r.status_code == 401


class TestSiteValidation:
    def test_empty_name_rejected_before_db(self) -> None:
        # La validation du nom précède tout accès DB — testable sans DATABASE_URL.
        with pytest.raises(sites_service.SiteError):
            sites_service.create_site(1, name="   ")


class TestActionSitePassthrough:
    def test_action_create_accepts_site_id(self) -> None:
        body = ActionCreate(title="Four électrique", site_id=3)
        assert body.site_id == 3

    def test_action_create_defaults_to_company_wide(self) -> None:
        # NULL = entreprise entière : le comportement historique est le défaut.
        assert ActionCreate(title="LED").site_id is None

    def test_action_patch_accepts_site_id(self) -> None:
        assert ActionPatch(site_id=7).site_id == 7

    def test_list_actions_site_filter_optional(self) -> None:
        # Sans DB : les deux formes retournent [] sans lever (défaut = rollup).
        assert act.list_actions(1) == []
        assert act.list_actions(1, site_id=42) == []

    def test_site_id_exposed_in_columns(self) -> None:
        # Le champ doit traverser _row/_COLS pour atteindre l'UI (badge kanban).
        assert "site_id" in act._COLS
