"""
test_resources_assessment.py — Module 2, expositions & moteur d'assessment
(PR-M2B). DB-gated (job `migration-tests` UNIQUEMENT).

Couvre : sonde 043, lecture globale des observations, isolation tenant A/B,
source obligatoire, licence bloquante (dégrade la confiance, pas le risque),
run reproductible (input_hash), immutabilité du run EN BASE (trigger),
supersession, anti-IDOR du pont d'exposition, et le flux API.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.resources import (
    ResourceCatalogCreate,
    ResourceExposureLinkCreate,
    ResourceSupplyObservationCreate,
)
from services.auth_service import AuthUser, create_access_token
from services.resources import (
    assessment_service,
    catalog_service,
    exposure_link_service,
    supply_service,
)

from ._resources_fixtures import (
    GLOBAL_SLUG,
    insert_source_with_license,
    seed_global_supply,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(
    not db_available(), reason="psycopg2/PostgreSQL non disponible"
)


def _token_for(company_id: int, role: str = "analyst", user_id: int = 88) -> str:
    user = AuthUser(email=f"m2b-{role}-{company_id}@test.local", role=role,
                    company_id=company_id, user_id=user_id)
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _resource(cid: int, slug: str) -> None:
    catalog_service.create_resource(company_id=cid, payload=ResourceCatalogCreate(slug=slug, name=slug))


def _supply(cid: int, slug: str, country: str, share: float, *, stage: str = "extraction",
            status: str = "estimated", release: int | None = None) -> None:
    supply_service.create_observation(
        company_id=cid, slug=slug,
        payload=ResourceSupplyObservationCreate(
            stage_code=stage, country_code=country, share_pct=share, reference_year=2025,
            data_status=status, source_release_id=release,
        ),
    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestMigration043Applied:
    def test_probe_043_passes(self, two_companies_resources):
        from db.migration_probes import MIGRATION_OBJECT_PROBES
        with get_db() as conn:
            with conn.cursor() as cur:
                assert MIGRATION_OBJECT_PROBES["043"](cur) is True


@_skip_no_db_url
@_skip_no_psycopg2
class TestSupplyObservations:
    def test_global_supply_is_readable_by_both_tenants(self, two_companies_resources):
        cid_a, cid_b = two_companies_resources
        seed_global_supply(GLOBAL_SLUG, [
            {"stage_code": "extraction", "country_code": "US", "share_pct": 60, "reference_year": 2025},
            {"stage_code": "extraction", "country_code": "QA", "share_pct": 40, "reference_year": 2025},
        ])
        a = supply_service.list_observations(company_id=cid_a, slug=GLOBAL_SLUG)
        b = supply_service.list_observations(company_id=cid_b, slug=GLOBAL_SLUG)
        assert a.total >= 2
        assert b.total >= 2

    def test_verified_without_source_rejected(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-sup-nosrc")
        with pytest.raises(supply_service.ResourceSupplyError, match="requiert une release"):
            _supply(cid_a, "res-sup-nosrc", "CN", 50.0, status="verified")

    def test_supply_is_tenant_isolated(self, two_companies_resources):
        cid_a, cid_b = two_companies_resources
        _resource(cid_a, "res-sup-iso")
        _supply(cid_a, "res-sup-iso", "CN", 100.0)
        # B ne voit pas la ressource tenant de A → résolution 404.
        with pytest.raises(catalog_service.ResourceCatalogError, match="introuvable"):
            supply_service.list_observations(company_id=cid_b, slug="res-sup-iso")


@_skip_no_db_url
@_skip_no_psycopg2
class TestExposureLinks:
    def test_manual_link_created(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-exp-manual")
        link = exposure_link_service.create_link(
            company_id=cid_a,
            payload=ResourceExposureLinkCreate(
                resource_slug="res-exp-manual", role="feedstock", link_kind="manual",
                manual_note="Approvisionnement direct", share_of_supply_pct=80.0,
            ),
        )
        assert link.link_kind == "manual"
        assert link.linked_ref == "manual"

    def test_manual_link_requires_note(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-exp-note")
        with pytest.raises(exposure_link_service.ResourceExposureError, match="note"):
            exposure_link_service.create_link(
                company_id=cid_a,
                payload=ResourceExposureLinkCreate(
                    resource_slug="res-exp-note", role="material", link_kind="manual",
                ),
            )

    def test_link_to_foreign_target_is_rejected(self, two_companies_resources):
        """Anti-IDOR : un purchase_line qui n'appartient pas au tenant → introuvable."""
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-exp-idor")
        with pytest.raises(exposure_link_service.ResourceExposureError, match="introuvable"):
            exposure_link_service.create_link(
                company_id=cid_a,
                payload=ResourceExposureLinkCreate(
                    resource_slug="res-exp-idor", role="material", link_kind="purchase_line",
                    purchase_line_id=999999999,
                ),
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestAssessmentRuns:
    def test_run_computes_hhi_and_separates_risk_confidence(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-run-1")
        _supply(cid_a, "res-run-1", "CN", 100.0)
        run = assessment_service.create_run(company_id=cid_a, slug="res-run-1", assessment_year=2026)
        assert run.observed_hhi == 10000.0
        assert run.risk_score == 100.0
        assert run.confidence is not None
        # risque et confiance sont deux champs distincts, jamais fusionnés.
        assert run.risk_score != run.confidence
        codes = {d.dimension_code for d in run.dimensions}
        assert "stage_concentration" in codes
        assert "evidence_coverage" in codes

    def test_no_observations_gives_no_index(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-run-empty")
        run = assessment_service.create_run(company_id=cid_a, slug="res-run-empty", assessment_year=2026)
        assert run.risk_score is None
        assert run.confidence is not None

    def test_run_is_reproducible(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-run-repro")
        _supply(cid_a, "res-run-repro", "CN", 60.0)
        _supply(cid_a, "res-run-repro", "US", 40.0)
        r1 = assessment_service.create_run(company_id=cid_a, slug="res-run-repro", assessment_year=2026)
        r2 = assessment_service.create_run(company_id=cid_a, slug="res-run-repro", assessment_year=2026)
        assert r1.input_hash == r2.input_hash  # mêmes entrées -> même empreinte
        assert r1.risk_score == r2.risk_score

    def test_recompute_supersedes_previous(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-run-supersede")
        _supply(cid_a, "res-run-supersede", "CN", 100.0)
        r1 = assessment_service.create_run(company_id=cid_a, slug="res-run-supersede", assessment_year=2026)
        r2 = assessment_service.create_run(company_id=cid_a, slug="res-run-supersede", assessment_year=2026)
        assert r2.run_id != r1.run_id
        old = assessment_service.get_run(company_id=cid_a, run_id=r1.run_id)
        assert old.status == "superseded"
        current = assessment_service.list_runs(company_id=cid_a, slug="res-run-supersede", current_only=True)
        assert current.total == 1
        assert current.items[0].run_id == r2.run_id

    def test_run_is_immutable_in_db(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-run-immutable")
        _supply(cid_a, "res-run-immutable", "CN", 100.0)
        run = assessment_service.create_run(company_id=cid_a, slug="res-run-immutable", assessment_year=2026)
        with pytest.raises(Exception):  # trigger d'immutabilité (erreur psycopg2)
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE resource_assessment_runs SET risk_score = 1 WHERE id = %s",
                        (run.run_id,),
                    )

    def test_run_is_tenant_isolated(self, two_companies_resources):
        cid_a, cid_b = two_companies_resources
        _resource(cid_a, "res-run-iso")
        _supply(cid_a, "res-run-iso", "CN", 100.0)
        run = assessment_service.create_run(company_id=cid_a, slug="res-run-iso", assessment_year=2026)
        with pytest.raises(assessment_service.ResourceAssessmentError, match="introuvable"):
            assessment_service.get_run(company_id=cid_b, run_id=run.run_id)


@_skip_no_db_url
@_skip_no_psycopg2
class TestLicenseGating:
    def test_blocked_license_degrades_confidence_not_risk(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _resource(cid_a, "res-lic")
        _, blocked_release = insert_source_with_license(cid_a, "M2B-BLOCK", derived_use_allowed=False)
        # Observation dont la source interdit l'usage dérivé → exclue du calcul.
        _supply(cid_a, "res-lic", "CN", 70.0, status="verified", release=blocked_release)
        # Observation utilisable (sans source) → porte le HHI.
        _supply(cid_a, "res-lic", "US", 30.0)
        run = assessment_service.create_run(company_id=cid_a, slug="res-lic", assessment_year=2026)
        # Le risque repose sur la seule observation utilisable (US, 100 % de l'observé).
        assert run.observed_hhi == 10000.0
        lic = next(d for d in run.dimensions if d.dimension_code == "license_access")
        # Une donnée de marché sur une bloquée → confiance licence dégradée (< 1).
        assert lic.raw_value is not None and lic.raw_value < 1.0


@_skip_no_db_url
@_skip_no_psycopg2
class TestApiFlow:
    def test_full_flow_via_api(self, client, two_companies_resources):
        cid_a, _ = two_companies_resources
        headers = _auth(_token_for(cid_a))
        # Ressource + observation via l'API.
        catalog_service.create_resource(company_id=cid_a, payload=ResourceCatalogCreate(slug="res-api-run", name="API run"))
        obs = client.post(
            "/resources/catalog/res-api-run/supply", headers=headers,
            json={"stage_code": "extraction", "country_code": "CN", "share_pct": 100, "reference_year": 2025},
        )
        assert obs.status_code == 201, obs.text
        run = client.post(
            "/resources/assessments", headers=headers,
            json={"resource_slug": "res-api-run", "assessment_year": 2026},
        )
        assert run.status_code == 201, run.text
        body = run.json()
        assert body["observed_hhi"] == 10000.0
        run_id = body["run_id"]
        dims = client.get(f"/resources/assessments/{run_id}/dimensions", headers=headers)
        assert dims.status_code == 200
        assert set(dims.json()) == {"items", "total", "limit", "offset"}
        alerts = client.get("/resources/alerts", headers=headers)
        assert alerts.status_code == 200

    def test_assessments_require_auth(self, client, two_companies_resources):
        assert client.get("/resources/assessments").status_code in (401, 403)
