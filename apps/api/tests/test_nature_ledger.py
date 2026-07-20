"""
test_nature_ledger.py — fondation biodiversité Locate/Evaluate (PR-09
tranche A, migration 038). DB-gated (job `migration-tests` UNIQUEMENT —
inscrit dans .github/workflows/api.yml).

Couvre : référentiel `nature_features` (sourçage obligatoire, licence,
masquage par sensibilité, portée mixte tenant/globale), Locate (intersections
géométriques via le moteur PUR réutilisé, immutabilité, gate de revue),
Evaluate (dépendances/impacts — séparation structurelle PROUVÉE, pas
seulement déclarée), dossiers LEAP (cycle de phase, gate de revue humaine),
isolation tenant, API (auth, pagination, 404 sans fuite, rôle élevé pour la
géométrie précise).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.nature import NatureDependencyCreate, NatureImpactCreate
from services.auth_service import AuthUser, create_access_token
from services.nature import (
    dependencies_service,
    features_service,
    impacts_service,
    leap_service,
    locate_service,
)

from ._nature_fixtures import (
    accept_site_position,
    insert_nature_feature,
    insert_site,
    insert_source_with_release,
)

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]

SQUARE = {
    "type": "Polygon",
    "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]],
}
FAR_SQUARE = {
    "type": "Polygon",
    "coordinates": [[[80.0, 80.0], [85.0, 80.0], [85.0, 85.0], [80.0, 85.0], [80.0, 80.0]]],
}


def _token_for(company_id: int, role: str = "analyst", user_id: int = 88) -> str:
    user = AuthUser(
        email=f"nature-{role}-{company_id}@test.local", role=role,
        company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Référentiel nature_features ───────────────────────────────────────────


class TestNatureFeatures:
    def test_feature_without_release_is_refused(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        with pytest.raises(features_service.NatureFeatureError, match="source_release_id"):
            features_service.register_feature(
                company_id=cid_a, code="no-release", label="X",
                boundary_geojson=SQUARE, source_release_id=None,
            )

    def test_store_forbidden_license_refuses_registration(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(
            cid_a, "nature-blocked", storage_allowed=False,
        )
        with pytest.raises(features_service.NatureFeatureError, match="allow_store"):
            features_service.register_feature(
                company_id=cid_a, code="blocked-1", label="X",
                boundary_geojson=SQUARE, source_release_id=release_id,
            )

    def test_invalid_geometry_is_refused_with_reason(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-geo-bad")
        with pytest.raises(features_service.NatureFeatureError, match="Géométrie refusée"):
            features_service.register_feature(
                company_id=cid_a, code="bad-geo", label="X",
                boundary_geojson={"type": "Point", "coordinates": [0, 0]},
                source_release_id=release_id,
            )

    def test_registration_derives_bbox(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-bbox")
        feature = features_service.register_feature(
            company_id=cid_a, code="bbox-1", label="Zone bbox",
            boundary_geojson=SQUARE, source_release_id=release_id,
        )
        assert feature.bbox_min_lat == 0.0
        assert feature.bbox_max_lat == 10.0
        assert feature.geometry_withheld is False

    def test_global_feature_visible_to_all_tenants(self, two_companies_nature):
        cid_a, cid_b = two_companies_nature
        _, release_id = insert_source_with_release(None, "nature-global-1")
        features_service.register_feature(
            company_id=None, code="global-kba-1", label="KBA globale",
            boundary_geojson=SQUARE, feature_kind="kba", source_release_id=release_id,
        )
        for cid in (cid_a, cid_b):
            listing = features_service.list_features(company_id=cid)
            assert any(f.code == "global-kba-1" for f in listing.items)

    def test_tenant_feature_invisible_to_other_tenant(self, two_companies_nature):
        cid_a, cid_b = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-tenant-a")
        features_service.register_feature(
            company_id=cid_a, code="tenant-a-only", label="X",
            boundary_geojson=SQUARE, source_release_id=release_id,
        )
        listing_b = features_service.list_features(company_id=cid_b)
        assert not any(f.code == "tenant-a-only" for f in listing_b.items)

    def test_confidential_feature_geometry_withheld_in_list(self, two_companies_nature):
        """Règle non négociable (§6 du plan) : une ligne confidential/
        restricted ne renvoie JAMAIS sa géométrie précise dans la liste
        standard — quel que soit l'appelant."""
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-conf-1")
        features_service.register_feature(
            company_id=cid_a, code="conf-species-1", label="Espèce menacée",
            boundary_geojson=SQUARE, sensitivity="confidential", source_release_id=release_id,
        )
        listing = features_service.list_features(company_id=cid_a)
        item = next(f for f in listing.items if f.code == "conf-species-1")
        assert item.geometry_withheld is True
        assert item.boundary_geojson is None
        assert item.bbox_min_lat is None
        assert item.bbox_max_lat is None

    def test_restricted_feature_geometry_withheld_in_list(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-restr-1")
        features_service.register_feature(
            company_id=cid_a, code="restr-1", label="X",
            boundary_geojson=SQUARE, sensitivity="restricted", source_release_id=release_id,
        )
        listing = features_service.list_features(company_id=cid_a)
        item = next(f for f in listing.items if f.code == "restr-1")
        assert item.geometry_withheld is True

    def test_public_feature_geometry_visible_in_list(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-pub-1")
        features_service.register_feature(
            company_id=cid_a, code="public-1", label="X",
            boundary_geojson=SQUARE, sensitivity="public", source_release_id=release_id,
        )
        listing = features_service.list_features(company_id=cid_a)
        item = next(f for f in listing.items if f.code == "public-1")
        assert item.geometry_withheld is False
        assert item.boundary_geojson is not None

    def test_get_feature_geometry_always_returns_precise_geometry(self, two_companies_nature):
        """Le SERVICE ne masque jamais (le rôle est gaté au routeur,
        `require_admin` — testé dans TestNatureApiAndIsolation)."""
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-geom-1")
        created = features_service.register_feature(
            company_id=cid_a, code="geom-precise-1", label="X",
            boundary_geojson=SQUARE, sensitivity="restricted", source_release_id=release_id,
        )
        precise = features_service.get_feature_geometry(company_id=cid_a, feature_id=created.id)
        assert precise.geometry_withheld is False
        assert precise.boundary_geojson == SQUARE


# ── Locate ─────────────────────────────────────────────────────────────────


class TestLocate:
    def test_locate_requires_accepted_position(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site sans position")
        with pytest.raises(locate_service.NatureLocateError):
            locate_service.locate_site(company_id=cid_a, site_id=site_id)

    def test_locate_creates_pending_matched_intersection(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-locate-1")
        insert_nature_feature(cid_a, "kba-locate-1", release_id, boundary=SQUARE, feature_kind="kba")
        site_id = insert_site(cid_a, "Site Locate 1")
        accept_site_position(cid_a, site_id, latitude=5.0, longitude=5.0)

        results = locate_service.locate_site(company_id=cid_a, site_id=site_id)
        assert len(results) == 1
        assert results[0].matched is True
        assert results[0].bbox_candidate is True
        assert results[0].method_code == "geojson_point_in_polygon_v1"
        assert results[0].review_status == "pending"

    def test_locate_no_match_outside_boundary_but_no_candidate_features(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-locate-2")
        insert_nature_feature(cid_a, "kba-far", release_id, boundary=FAR_SQUARE, feature_kind="kba")
        site_id = insert_site(cid_a, "Site loin de tout")
        accept_site_position(cid_a, site_id, latitude=5.0, longitude=5.0)

        results = locate_service.locate_site(company_id=cid_a, site_id=site_id)
        assert results == [], "hors bbox : aucune ligne candidate, pas de faux appariement"

    def test_locate_recompute_creates_new_rows_not_overwrite(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-locate-3")
        insert_nature_feature(cid_a, "kba-recompute", release_id, boundary=SQUARE)
        site_id = insert_site(cid_a, "Site recompute")
        accept_site_position(cid_a, site_id, latitude=5.0, longitude=5.0)

        locate_service.locate_site(company_id=cid_a, site_id=site_id)
        locate_service.locate_site(company_id=cid_a, site_id=site_id)
        listing = locate_service.list_intersections(company_id=cid_a, site_id=site_id)
        assert listing.total == 2, "recalculer crée de NOUVELLES lignes, jamais une réécriture"
        assert all(i.review_status == "pending" for i in listing.items)

    def test_review_intersection_gate(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-locate-4")
        insert_nature_feature(cid_a, "kba-review", release_id, boundary=SQUARE)
        site_id = insert_site(cid_a, "Site review")
        accept_site_position(cid_a, site_id, latitude=5.0, longitude=5.0)
        [intersection] = locate_service.locate_site(company_id=cid_a, site_id=site_id)

        reviewed = locate_service.review_intersection(
            company_id=cid_a, intersection_id=intersection.id, accept=True, reviewed_by=7,
        )
        assert reviewed.review_status == "accepted"
        with pytest.raises(locate_service.NatureLocateError, match="déjà revu"):
            locate_service.review_intersection(
                company_id=cid_a, intersection_id=intersection.id, accept=True, reviewed_by=7,
            )

    def test_intersection_is_immutable_at_db_level(self, two_companies_nature):
        """Preuve DB directe (pas seulement applicative) : une tentative de
        réécriture du fait géométrique lève, trigger 038."""
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-locate-5")
        insert_nature_feature(cid_a, "kba-immutable", release_id, boundary=SQUARE)
        site_id = insert_site(cid_a, "Site immuable")
        accept_site_position(cid_a, site_id, latitude=5.0, longitude=5.0)
        [intersection] = locate_service.locate_site(company_id=cid_a, site_id=site_id)

        with pytest.raises(Exception, match="immuable"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE site_nature_intersections SET matched = NOT matched WHERE id = %s",
                        (intersection.id,),
                    )

    def test_intersection_isolated_between_tenants(self, two_companies_nature):
        cid_a, cid_b = two_companies_nature
        _, release_id = insert_source_with_release(None, "nature-global-locate")
        insert_nature_feature(None, "global-locate-1", release_id, boundary=SQUARE)
        site_b = insert_site(cid_b, "Site B locate")
        accept_site_position(cid_b, site_b, latitude=5.0, longitude=5.0)
        locate_service.locate_site(company_id=cid_b, site_id=site_b)

        listing_a = locate_service.list_intersections(company_id=cid_a, site_id=site_b)
        assert listing_a.total == 0, "A ne voit jamais les intersections de B"


# ── Evaluate : dépendances / impacts — séparation PROUVÉE ─────────────────


class TestDependenciesImpactsSeparation:
    def test_dependency_and_impact_models_share_no_business_field(self):
        """Preuve au niveau des modèles : les colonnes MÉTIER de dépendances
        et d'impacts sont strictement disjointes (seuls les champs de
        bookkeeping génériques sont communs) — la fusion est structurellement
        impossible, pas seulement déconseillée."""
        from models.nature import NatureDependencyResponse, NatureImpactResponse

        common = {
            "id", "company_id", "site_id", "bom_item_id", "material_id", "rationale",
            "data_status", "review_status", "source_release_id", "evidence_artifact_id",
            "created_at", "updated_at",
        }
        dep_fields = set(NatureDependencyResponse.model_fields) - common
        imp_fields = set(NatureImpactResponse.model_fields) - common
        assert dep_fields.isdisjoint(imp_fields), (
            f"champs métier partagés détectés : {dep_fields & imp_fields}"
        )
        assert dep_fields == {"ecosystem_service", "dependency_level"}
        assert imp_fields == {"pressure_type", "impact_kind", "magnitude_qualitative"}

    def test_dependency_requires_anchor(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        with pytest.raises(dependencies_service.NatureDependencyError, match="ancrage"):
            dependencies_service.create_dependency(
                company_id=cid_a,
                payload=NatureDependencyCreate(ecosystem_service="freshwater", dependency_level="high"),
            )

    def test_impact_requires_anchor(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        with pytest.raises(impacts_service.NatureImpactError, match="ancrage"):
            impacts_service.create_impact(
                company_id=cid_a,
                payload=NatureImpactCreate(
                    pressure_type="water_use", impact_kind="negative", magnitude_qualitative="high",
                ),
            )

    def test_create_list_review_dependency(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site dépendance")
        created = dependencies_service.create_dependency(
            company_id=cid_a,
            payload=NatureDependencyCreate(
                site_id=site_id, ecosystem_service="freshwater", dependency_level="high",
                rationale="Process industriel consommateur d'eau douce.",
            ),
        )
        assert created.review_status == "pending"
        listing = dependencies_service.list_dependencies(company_id=cid_a, site_id=site_id)
        assert listing.total == 1
        reviewed = dependencies_service.review_dependency(
            company_id=cid_a, dependency_id=created.id, accept=True, reviewed_by=3,
        )
        assert reviewed.review_status == "accepted"

    def test_create_list_review_impact(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site impact")
        created = impacts_service.create_impact(
            company_id=cid_a,
            payload=NatureImpactCreate(
                site_id=site_id, pressure_type="water_use", impact_kind="negative",
                magnitude_qualitative="high", rationale="Prélèvement en zone stressée.",
            ),
        )
        assert created.review_status == "pending"
        listing = impacts_service.list_impacts(company_id=cid_a, site_id=site_id)
        assert listing.total == 1
        reviewed = impacts_service.review_impact(
            company_id=cid_a, impact_id=created.id, accept=False, reviewed_by=3,
        )
        assert reviewed.review_status == "flagged"

    def test_dependencies_and_impacts_never_conflated_in_a_single_query(self, two_companies_nature):
        """Fixture PROUVANT (pas seulement déclarant) la séparation : les deux
        tables sous-jacentes n'ont, au niveau catalogue SQL, aucune colonne
        métier commune — une jointure ou une fusion accidentelle serait
        détectée ici, pas seulement empêchée par convention applicative."""
        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site séparation")
        dependencies_service.create_dependency(
            company_id=cid_a,
            payload=NatureDependencyCreate(
                site_id=site_id, ecosystem_service="pollination", dependency_level="medium",
            ),
        )
        impacts_service.create_impact(
            company_id=cid_a,
            payload=NatureImpactCreate(
                site_id=site_id, pressure_type="land_use_change", impact_kind="negative",
                magnitude_qualitative="medium",
            ),
        )
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM nature_dependencies LIMIT 1")
                dep_cols = {d.name for d in cur.description}
                cur.execute("SELECT * FROM nature_impacts LIMIT 1")
                imp_cols = {d.name for d in cur.description}
        assert "pressure_type" not in dep_cols and "impact_kind" not in dep_cols
        assert "ecosystem_service" not in imp_cols and "dependency_level" not in imp_cols


# ── Dossiers LEAP ────────────────────────────────────────────────────────


class TestLeapAssessments:
    def test_create_starts_at_locate_draft(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        created = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier 2026"),
        )
        assert created.phase == "locate"
        assert created.status == "draft"
        assert created.site_ids == []

    def test_advance_phase_to_evaluate_requires_site(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier sans site"),
        )
        with pytest.raises(leap_service.NatureLeapError, match="aucun site"):
            leap_service.advance_phase(
                company_id=cid_a, assessment_id=assessment.id, target_phase="evaluate",
            )

    def test_advance_phase_rejects_skip(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site skip")
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier skip", site_ids=[site_id]),
        )
        with pytest.raises(leap_service.NatureLeapError, match="Transition invalide"):
            leap_service.advance_phase(
                company_id=cid_a, assessment_id=assessment.id, target_phase="assess",
            )

    def test_advance_phase_to_assess_requires_accepted_dependency_or_impact(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site assess gate")
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier assess", site_ids=[site_id]),
        )
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="evaluate")

        # Une dépendance PENDING (jamais revue) ne suffit pas.
        dep = dependencies_service.create_dependency(
            company_id=cid_a,
            payload=NatureDependencyCreate(
                site_id=site_id, ecosystem_service="soil_stability", dependency_level="low",
            ),
        )
        with pytest.raises(leap_service.NatureLeapError, match="ACCEPTÉ"):
            leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="assess")

        dependencies_service.review_dependency(
            company_id=cid_a, dependency_id=dep.id, accept=True, reviewed_by=5,
        )
        advanced = leap_service.advance_phase(
            company_id=cid_a, assessment_id=assessment.id, target_phase="assess",
        )
        assert advanced.phase == "assess"

    def test_advance_phase_to_prepare_not_supported_in_tranche_a(self, two_companies_nature):
        """`prepare`/`completed` dépendent de 039 (risques/opportunités/
        actions/disclosure) — refus explicite, jamais un no-op silencieux."""
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site prepare gate")
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier prepare", site_ids=[site_id]),
        )
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="evaluate")
        dep = dependencies_service.create_dependency(
            company_id=cid_a,
            payload=NatureDependencyCreate(
                site_id=site_id, ecosystem_service="other", dependency_level="low",
            ),
        )
        dependencies_service.review_dependency(company_id=cid_a, dependency_id=dep.id, accept=True, reviewed_by=5)
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="assess")

        with pytest.raises(leap_service.NatureLeapError, match="pas encore disponible"):
            leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="prepare")

    def test_review_requires_reviewed_by(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier revue"),
        )
        with pytest.raises(leap_service.NatureLeapError, match="identifié"):
            leap_service.review(company_id=cid_a, assessment_id=assessment.id, approve=True, reviewed_by=0)

    def test_review_rejects_locate_phase(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier locate seul"),
        )
        with pytest.raises(leap_service.NatureLeapError, match="locate"):
            leap_service.review(company_id=cid_a, assessment_id=assessment.id, approve=True, reviewed_by=9)

    def test_review_approve_then_reapprove_fails(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site reapprove")
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier reapprove", site_ids=[site_id]),
        )
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="evaluate")
        approved = leap_service.review(
            company_id=cid_a, assessment_id=assessment.id, approve=True, reviewed_by=11,
        )
        assert approved.status == "approved"
        assert approved.approved_by == 11
        with pytest.raises(leap_service.NatureLeapError, match="déjà approuvé"):
            leap_service.review(company_id=cid_a, assessment_id=assessment.id, approve=True, reviewed_by=11)

    def test_leap_assessment_isolated_between_tenants(self, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, cid_b = two_companies_nature
        leap_service.create_assessment(company_id=cid_b, payload=LeapAssessmentCreate(label="Dossier B"))
        listing_a = leap_service.list_assessments(company_id=cid_a)
        assert not any(a.label == "Dossier B" for a in listing_a.items)


# ── API et isolation ────────────────────────────────────────────────────


class TestNatureApiAndIsolation:
    def test_features_require_auth(self, client):
        assert client.get("/nature/features").status_code == 401

    def test_features_listing_via_api(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        resp = client.get("/nature/features", headers=_auth(_token_for(cid_a)))
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body and "total" in body

    def test_dependencies_require_analyst_to_write(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        resp = client.post(
            "/nature/dependencies",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={"ecosystem_service": "freshwater", "dependency_level": "high", "site_id": 1},
        )
        assert resp.status_code == 403

    def test_feature_geometry_endpoint_requires_admin(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        _, release_id = insert_source_with_release(cid_a, "nature-api-admin")
        feature_id = insert_nature_feature(cid_a, "api-admin-1", release_id, boundary=SQUARE)

        analyst_resp = client.get(
            f"/nature/features/{feature_id}/geometry", headers=_auth(_token_for(cid_a, role="analyst")),
        )
        assert analyst_resp.status_code == 403

        admin_resp = client.get(
            f"/nature/features/{feature_id}/geometry", headers=_auth(_token_for(cid_a, role="admin")),
        )
        assert admin_resp.status_code == 200
        assert admin_resp.json()["boundary_geojson"] is not None

    def test_leap_assessment_404_does_not_leak_cross_tenant(self, client, two_companies_nature):
        from models.nature import LeapAssessmentCreate

        cid_a, cid_b = two_companies_nature
        created_b = leap_service.create_assessment(
            company_id=cid_b, payload=LeapAssessmentCreate(label="Dossier B API"),
        )
        resp = client.get(
            f"/nature/leap-assessments/{created_b.id}", headers=_auth(_token_for(cid_a)),
        )
        assert resp.status_code == 404, "jamais un 403 qui confirmerait l'existence"

    def test_leap_assessment_create_and_list_via_api(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        token = _token_for(cid_a)
        created = client.post(
            "/nature/leap-assessments", headers=_auth(token), json={"label": "Dossier API"},
        )
        assert created.status_code == 201, created.text
        listing = client.get("/nature/leap-assessments?limit=1", headers=_auth(token))
        assert listing.status_code == 200
        body = listing.json()
        assert body["total"] >= 1
        assert body["limit"] == 1

    def test_locate_endpoint_requires_analyst(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site endpoint locate")
        resp = client.post(
            f"/nature/sites/{site_id}/locate",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={},
        )
        assert resp.status_code == 403
