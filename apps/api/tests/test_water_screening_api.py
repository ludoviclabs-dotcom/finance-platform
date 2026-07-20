"""
test_water_screening_api.py — screening hydrique bout-en-bout (PR-08B,
migration 037). DB-gated (job `migration-tests` UNIQUEMENT — inscrit dans
.github/workflows/api.yml AVANT test_water_schema_not_ready.py).

Couvre : 037 réellement appliquée (sonde), flux complet API (position acceptée
→ screening → risque/confiance séparés → signal IRO justifié), refus
explicites via l'API (gate géocodage, licence, référentiel vide), immutabilité
du run EN BASE (trigger), reproductibilité de l'empreinte, cibles/actions,
isolation tenant, 404 sans fuite.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from services.auth_service import AuthUser, create_access_token
from services.water import screening_service, targets_actions_service

from ._water_fixtures import (
    accept_site_position,
    insert_risk_area,
    insert_site,
    insert_source_with_release,
)

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]

# « L » : bbox [0,10]² mais (8,8) hors du polygone — le piège bbox.
L_SHAPE = {
    "type": "Polygon",
    "coordinates": [[
        [0.0, 0.0], [10.0, 0.0], [10.0, 4.0], [4.0, 4.0],
        [4.0, 10.0], [0.0, 10.0], [0.0, 0.0],
    ]],
}


def _token_for(company_id: int, role: str = "analyst", user_id: int = 66) -> str:
    user = AuthUser(
        email=f"screen-{role}-{company_id}@test.local", role=role,
        company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _accepted_site(cid: int, name: str, *, lat=5.0, lon=5.0, precision="exact") -> int:
    site_id = insert_site(cid, name)
    accept_site_position(cid, site_id, latitude=lat, longitude=lon, precision=precision)
    return site_id


class TestMigration037Applied:
    def test_probe_037_passes(self, two_companies_water):
        from db.migration_probes import MIGRATION_OBJECT_PROBES

        with get_db() as conn:
            with conn.cursor() as cur:
                assert MIGRATION_OBJECT_PROBES["037"](cur) is True


class TestScreeningFlow:
    def test_full_flow_with_risk_and_confidence_separated(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"screen-src-{cid_a}")
        insert_risk_area(cid_a, f"screen-basin-{cid_a}", release_id, stress="extremely_high")
        site_id = _accepted_site(cid_a, "Site screening OK")
        token = _token_for(cid_a)

        resp = client.post(
            "/water/screenings/calculate",
            headers=_auth(token),
            json={"site_id": site_id},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # Enveloppe analytique partagée {data, meta, evidence}.
        assert set(body) >= {"data", "meta", "evidence"}
        data = body["data"]
        assert data["risk_category"] == "extremely_high"
        assert data["method_code"] == "geojson_point_in_polygon_v1"
        assert data["matched_area_count"] == 1
        # Risque et confiance ne partagent JAMAIS un champ : la confiance vit
        # dans meta.quality, le risque dans data — aucun champ combiné.
        assert "confidence" not in data
        assert body["meta"]["quality"]["confidence"] is not None
        assert body["meta"]["method"]["code"] == "CC-WATER-SCREENING"
        # La trace d'appariement nomme le pré-filtre ET la méthode exacte.
        area_trace = data["matched_areas"][0]
        assert area_trace["prefilter_code"] == "geojson_bbox_prefilter_v1"
        assert area_trace["matched"] is True

    def test_screening_refused_on_pending_position(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"screen-pend-{cid_a}")
        insert_risk_area(cid_a, f"pend-basin-{cid_a}", release_id)
        site_id = insert_site(cid_a, "Site position pending")  # jamais acceptée
        resp = client.post(
            "/water/screenings/calculate",
            headers=_auth(_token_for(cid_a)),
            json={"site_id": site_id},
        )
        assert resp.status_code == 409, resp.text
        assert "ACCEPTÉE" in resp.json()["detail"] or "non utilisable" in resp.json()["detail"]

    def test_screening_refused_on_empty_referential(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = _accepted_site(cid_a, "Site sans référentiel")
        resp = client.post(
            "/water/screenings/calculate",
            headers=_auth(_token_for(cid_a)),
            json={"site_id": site_id, "scenario_code": "scenario-vide"},
        )
        assert resp.status_code == 409
        assert "référentiel vide" in resp.json()["detail"]

    def test_screening_refused_on_blocked_license(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(
            cid_a, f"screen-noderiv-{cid_a}", derived_use_allowed=False,
        )
        insert_risk_area(
            cid_a, f"noderiv-basin-{cid_a}", release_id, scenario="lic-blocked",
        )
        site_id = _accepted_site(cid_a, "Site licence bloquée")
        resp = client.post(
            "/water/screenings/calculate",
            headers=_auth(_token_for(cid_a)),
            json={"site_id": site_id, "scenario_code": "lic-blocked"},
        )
        assert resp.status_code == 409
        assert "allow_derived_use" in resp.json()["detail"]

    def test_bbox_false_positive_eliminated_end_to_end(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"screen-lshape-{cid_a}")
        insert_risk_area(
            cid_a, f"lshape-{cid_a}", release_id, boundary=L_SHAPE, scenario="lshape",
        )
        site_id = _accepted_site(cid_a, "Site coin du L", lat=8.0, lon=8.0)
        resp = client.post(
            "/water/screenings/calculate",
            headers=_auth(_token_for(cid_a)),
            json={"site_id": site_id, "scenario_code": "lshape"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["candidate_area_count"] == 1, "la zone a bien passé le pré-filtre bbox"
        assert data["matched_area_count"] == 0, "le point-dans-polygone exact l'élimine"
        assert data["risk_category"] is None
        warnings = resp.json()["meta"]["quality"]["warnings"]
        assert any("risque nul" in w for w in warnings)

    def test_reproducibility_same_fingerprint(self, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"screen-repro-{cid_a}")
        insert_risk_area(cid_a, f"repro-basin-{cid_a}", release_id, scenario="repro")
        site_id = _accepted_site(cid_a, "Site reproductible")
        first = screening_service.calculate(
            company_id=cid_a, site_id=site_id, scenario_code="repro",
        )
        second = screening_service.calculate(
            company_id=cid_a, site_id=site_id, scenario_code="repro",
        )
        assert first.data.input_fingerprint == second.data.input_fingerprint
        assert first.data.risk_category == second.data.risk_category
        assert first.data.screening_id != second.data.screening_id, (
            "recalculer = un NOUVEAU run, jamais une réécriture"
        )


class TestScreeningImmutability:
    def test_run_result_cannot_be_rewritten(self, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"screen-immu-{cid_a}")
        insert_risk_area(cid_a, f"immu-basin-{cid_a}", release_id, scenario="immu")
        site_id = _accepted_site(cid_a, "Site immuable")
        env = screening_service.calculate(
            company_id=cid_a, site_id=site_id, scenario_code="immu",
        )
        with pytest.raises(Exception, match="immuable"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE site_water_screenings SET risk_category = 'low' WHERE id = %s",
                        (env.data.screening_id,),
                    )

    def test_iro_signal_update_is_allowed_and_gated(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"screen-iro-{cid_a}")
        insert_risk_area(cid_a, f"iro-basin-{cid_a}", release_id, scenario="iro")
        site_id = _accepted_site(cid_a, "Site signal IRO")
        env = screening_service.calculate(
            company_id=cid_a, site_id=site_id, scenario_code="iro",
        )
        token = _token_for(cid_a)
        # Justification vide -> 422 (modèle) ; justification posée -> signal.
        bad = client.post(
            f"/water/screenings/{env.data.screening_id}/flag-for-iro",
            headers=_auth(token), json={"rationale": ""},
        )
        assert bad.status_code == 422
        ok = client.post(
            f"/water/screenings/{env.data.screening_id}/flag-for-iro",
            headers=_auth(token),
            json={"rationale": "Stress extrême sur le bassin fictif — à examiner."},
        )
        assert ok.status_code == 200, ok.text
        body = ok.json()
        assert body["iro_signal"] is True
        assert body["iro_signal_by"] == 66
        # Le signal ne se réécrit pas.
        again = client.post(
            f"/water/screenings/{env.data.screening_id}/flag-for-iro",
            headers=_auth(token), json={"rationale": "autre raison"},
        )
        assert again.status_code == 409

    def test_iro_signal_requires_analyst(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        resp = client.post(
            "/water/screenings/1/flag-for-iro",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={"rationale": "x"},
        )
        assert resp.status_code == 403


class TestTargetsAndActions:
    def test_target_and_action_flow(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = _accepted_site(cid_a, "Site cibles")
        token = _token_for(cid_a)
        target = client.post(
            "/water/targets",
            headers=_auth(token),
            json={
                "target_type": "withdrawal_reduction",
                "title": "Réduire les prélèvements de 20 %",
                "site_id": site_id, "baseline_year": 2025, "target_year": 2030,
                "baseline_value_m3": 100000, "target_value_m3": 80000,
            },
        )
        assert target.status_code == 201, target.text
        target_id = target.json()["id"]
        assert target.json()["review_status"] == "pending"

        action = client.post(
            "/water/actions",
            headers=_auth(token),
            json={
                "action_type": "reuse",
                "title": "Boucle de réutilisation des eaux de process",
                "site_id": site_id, "target_id": target_id,
                "expected_reduction_m3": 15000,
            },
        )
        assert action.status_code == 201, action.text
        reviewed = client.post(
            f"/water/targets/{target_id}/review",
            headers=_auth(token), json={"accept": True},
        )
        assert reviewed.status_code == 200
        assert reviewed.json()["review_status"] == "accepted"

    def test_action_with_cross_tenant_screening_is_refused(self, two_companies_water):
        from models.water import WaterActionCreate

        cid_a, cid_b = two_companies_water
        _sid, release_id = insert_source_with_release(cid_b, f"screen-cross-{cid_b}")
        insert_risk_area(cid_b, f"cross-basin-{cid_b}", release_id, scenario="cross")
        site_b = _accepted_site(cid_b, "Site B screening croisé")
        env_b = screening_service.calculate(
            company_id=cid_b, site_id=site_b, scenario_code="cross",
        )
        with pytest.raises(targets_actions_service.WaterPlanError, match="introuvable"):
            targets_actions_service.create_action(
                company_id=cid_a,
                payload=WaterActionCreate(
                    action_type="monitoring", title="Action croisée interdite",
                    screening_id=env_b.data.screening_id,
                ),
            )


class TestScreeningIsolationAndLeaks:
    def test_screenings_isolated_between_tenants(self, client, two_companies_water):
        cid_a, cid_b = two_companies_water
        listing = client.get("/water/screenings", headers=_auth(_token_for(cid_a)))
        assert listing.status_code == 200
        assert all(item["company_id"] == cid_a for item in listing.json()["items"])

    def test_screening_404_does_not_leak(self, client, two_companies_water):
        cid_a, cid_b = two_companies_water
        _sid, release_id = insert_source_with_release(cid_b, f"screen-leak-{cid_b}")
        insert_risk_area(cid_b, f"leak-basin-{cid_b}", release_id, scenario="leak")
        site_b = _accepted_site(cid_b, "Site B fuite")
        env_b = screening_service.calculate(
            company_id=cid_b, site_id=site_b, scenario_code="leak",
        )
        resp = client.get(
            f"/water/screenings/{env_b.data.screening_id}",
            headers=_auth(_token_for(cid_a)),
        )
        assert resp.status_code == 404, "jamais un 403 qui confirmerait l'existence"

    def test_screening_of_cross_tenant_site_is_refused(self, client, two_companies_water):
        cid_a, cid_b = two_companies_water
        site_b = _accepted_site(cid_b, "Site B calcul croisé")
        resp = client.post(
            "/water/screenings/calculate",
            headers=_auth(_token_for(cid_a)),
            json={"site_id": site_b},
        )
        assert resp.status_code == 404
