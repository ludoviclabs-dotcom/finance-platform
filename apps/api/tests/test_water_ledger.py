"""
test_water_ledger.py — ledger eau (PR-08A, migration 036). DB-gated (job
`migration-tests` UNIQUEMENT — inscrit dans .github/workflows/api.yml).

Couvre : import CSV idempotent (contenu sha256 ET ligne — rejouer = zéro
doublon), gates de revue (import, activité, permis), permis + preuve Evidence
Kernel, référentiel de zones (refus sans release, refus licence allow_store,
catégorie retirée si affichage interdit, portée mixte tenant/globale),
isolation tenant, API (auth, pagination, 404 sans fuite).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.water import WaterPermitCreate
from services.auth_service import AuthUser, create_access_token
from services.water import activities_service, permits_service, risk_areas_service

from ._water_fixtures import (
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


def _token_for(company_id: int, role: str = "analyst", user_id: int = 88) -> str:
    user = AuthUser(
        email=f"waterledger-{role}-{company_id}@test.local", role=role,
        company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _csv(site_id: int, *, quantity: str = "1200.5") -> bytes:
    return (
        "site_id,activity_type,source_type,quantity_m3,period_start,period_end\n"
        f"{site_id},withdrawal,surface,{quantity},2026-01-01,2026-01-31\n"
        f"{site_id},consumption,municipal,300,2026-01-01,2026-01-31\n"
        f"{site_id},discharge,other,800,2026-01-01,2026-01-31\n"
    ).encode("utf-8")


# ── Parsing pur (aucune base requise, mais co-localisé avec le ledger) ───────


def test_parse_water_csv_flags_invalid_lines_with_reasons():
    content = (
        "site_id,activity_type,source_type,quantity_m3,period_start,period_end\n"
        "12,withdrawal,surface,100,2026-01-01,2026-01-31\n"
        "abc,withdrawal,surface,100,2026-01-01,2026-01-31\n"
        "12,teleportation,surface,100,2026-01-01,2026-01-31\n"
        "12,withdrawal,surface,-5,2026-01-01,2026-01-31\n"
        "12,withdrawal,surface,100,2026-02-01,2026-01-01\n"
    ).encode("utf-8")
    lines = activities_service.parse_water_csv(content)
    assert lines[0]["error"] is None
    assert "non numérique" in lines[1]["error"]
    assert "teleportation" in lines[2]["error"]
    assert "négative" in lines[3]["error"]
    assert "antérieure" in lines[4]["error"]


# ── Import idempotent ────────────────────────────────────────────────────────


class TestWaterImportIdempotence:
    def test_import_creates_pending_activities(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site import eau")
        result = activities_service.create_import(
            company_id=cid_a, filename="eau.csv", content=_csv(site_id), imported_by=7,
        )
        assert result.already_imported is False
        assert result.row_count == 3
        assert result.accepted_count == 3
        assert result.status == "pending"
        listing = activities_service.list_activities(company_id=cid_a, site_id=site_id)
        assert listing.total == 3
        assert all(a.review_status == "pending" for a in listing.items)

    def test_reimport_same_bytes_is_noop(self, two_companies_water):
        """Idempotence de CONTENU : rejouer le même fichier ne crée AUCUNE
        nouvelle ligne et renvoie l'import existant."""
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site réimport eau")
        content = _csv(site_id)
        first = activities_service.create_import(
            company_id=cid_a, filename="eau.csv", content=content,
        )
        before = activities_service.list_activities(company_id=cid_a, site_id=site_id).total
        second = activities_service.create_import(
            company_id=cid_a, filename="renommé.csv", content=content,
        )
        assert second.already_imported is True
        assert second.id == first.id
        after = activities_service.list_activities(company_id=cid_a, site_id=site_id).total
        assert after == before, "réimporter les mêmes octets ne crée aucun doublon"

    def test_line_level_idempotence_on_different_file(self, two_companies_water):
        """Idempotence de LIGNE : un fichier DIFFÉRENT (octets différents) qui
        recontient les mêmes flux ne les duplique pas (ON CONFLICT), et le
        rejet est COMPTÉ et expliqué — jamais silencieux."""
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site doublon ligne")
        activities_service.create_import(
            company_id=cid_a, filename="v1.csv", content=_csv(site_id),
        )
        # Mêmes flux + un espace en fin de fichier → sha différent, lignes identiques.
        result = activities_service.create_import(
            company_id=cid_a, filename="v2.csv", content=_csv(site_id) + b"\n",
        )
        assert result.already_imported is False
        assert result.accepted_count == 0
        assert result.rejected_count == 3
        assert any("doublon" in e for e in result.errors)

    def test_unknown_site_line_is_rejected_with_reason(self, two_companies_water):
        cid_a, _ = two_companies_water
        result = activities_service.create_import(
            company_id=cid_a, filename="orphelin.csv", content=_csv(99999999),
        )
        assert result.accepted_count == 0
        assert result.rejected_count == 3
        assert any("introuvable" in e for e in result.errors)

    def test_site_of_other_tenant_is_rejected(self, two_companies_water):
        """Défense en profondeur : un site de B cité dans le CSV de A est
        « introuvable dans le périmètre », jamais rattaché."""
        cid_a, cid_b = two_companies_water
        site_b = insert_site(cid_b, "Site B pour CSV de A")
        result = activities_service.create_import(
            company_id=cid_a, filename="croisé.csv", content=_csv(site_b),
        )
        assert result.accepted_count == 0
        assert result.rejected_count == 3


# ── Gates de revue ───────────────────────────────────────────────────────────


class TestReviewGates:
    def test_import_review_rejects_flags_activities(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site rejet import")
        imported = activities_service.create_import(
            company_id=cid_a, filename="rejet.csv", content=_csv(site_id),
        )
        reviewed = activities_service.review_import(
            company_id=cid_a, import_id=imported.id, accept=False,
        )
        assert reviewed.status == "rejected"
        listing = activities_service.list_activities(company_id=cid_a, site_id=site_id)
        assert all(a.review_status == "flagged" for a in listing.items)

    def test_import_review_is_single_shot(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site re-revue import")
        imported = activities_service.create_import(
            company_id=cid_a, filename="double.csv", content=_csv(site_id),
        )
        activities_service.review_import(company_id=cid_a, import_id=imported.id, accept=True)
        with pytest.raises(activities_service.WaterActivityError, match="pending"):
            activities_service.review_import(
                company_id=cid_a, import_id=imported.id, accept=False
            )

    def test_activity_review_transitions(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site revue activité")
        from datetime import date

        activity = activities_service.create_activity(
            company_id=cid_a, site_id=site_id, activity_type="withdrawal",
            source_type="groundwater", quantity_m3=42.0,
            period_start=date(2026, 3, 1), period_end=date(2026, 3, 31),
        )
        assert activity.review_status == "pending"
        accepted = activities_service.review_activity(
            company_id=cid_a, activity_id=activity.id, accept=True,
        )
        assert accepted.review_status == "accepted"
        with pytest.raises(activities_service.WaterActivityError, match="déjà revue"):
            activities_service.review_activity(
                company_id=cid_a, activity_id=activity.id, accept=False,
            )


# ── Permis ───────────────────────────────────────────────────────────────────


class TestWaterPermits:
    def test_permit_requires_site_in_scope(self, two_companies_water):
        cid_a, cid_b = two_companies_water
        site_b = insert_site(cid_b, "Site B permis")
        with pytest.raises(permits_service.WaterPermitError, match="introuvable"):
            permits_service.create_permit(
                company_id=cid_a,
                payload=WaterPermitCreate(site_id=site_b, permit_type="withdrawal"),
            )

    def test_permit_with_unknown_evidence_is_refused(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site permis preuve")
        with pytest.raises(permits_service.WaterPermitError, match="introuvable"):
            permits_service.create_permit(
                company_id=cid_a,
                payload=WaterPermitCreate(
                    site_id=site_id, permit_type="withdrawal",
                    evidence_artifact_id=98765432,
                ),
            )

    def test_permit_crud_and_review(self, two_companies_water):
        from datetime import date

        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site permis CRUD")
        permit = permits_service.create_permit(
            company_id=cid_a,
            payload=WaterPermitCreate(
                site_id=site_id, permit_type="withdrawal",
                permit_reference="PREF-2026-042", authorized_volume_m3=50000,
                valid_from=date(2026, 1, 1), valid_to=date(2030, 12, 31),
                issuing_authority="Préfecture fictive",
            ),
        )
        assert permit.review_status == "pending"
        listed = permits_service.list_permits(company_id=cid_a, site_id=site_id)
        assert listed.total == 1
        reviewed = permits_service.review_permit(
            company_id=cid_a, permit_id=permit.id, accept=True,
        )
        assert reviewed.review_status == "accepted"


# ── Référentiel de zones — sourçage et licence ───────────────────────────────


class TestWaterRiskAreas:
    SQUARE = {
        "type": "Polygon",
        "coordinates": [[[0.0, 40.0], [10.0, 40.0], [10.0, 50.0], [0.0, 50.0], [0.0, 40.0]]],
    }

    def test_area_without_release_is_refused(self, two_companies_water):
        cid_a, _ = two_companies_water
        with pytest.raises(risk_areas_service.WaterRiskAreaError, match="source_release_id requis"):
            risk_areas_service.register_area(
                company_id=cid_a, code="no-release", label="Sans source",
                boundary_geojson=self.SQUARE, baseline_stress_category="high",
                source_release_id=None,
            )

    def test_area_not_null_constraint_in_db(self, two_companies_water):
        """La règle vit AUSSI en base : source_release_id NOT NULL."""
        cid_a, _ = two_companies_water
        with pytest.raises(Exception, match="source_release_id"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO water_risk_areas
                            (company_id, code, label, baseline_stress_category,
                             bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon,
                             boundary_geojson, source_release_id)
                        VALUES (%s, 'raw', 'Brut', 'high', 0, 1, 0, 1, '{}', NULL)
                        """,
                        (cid_a,),
                    )

    def test_store_forbidden_license_refuses_registration(self, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(
            cid_a, f"water-nostore-{cid_a}", storage_allowed=False,
        )
        with pytest.raises(risk_areas_service.WaterRiskAreaError, match="allow_store"):
            risk_areas_service.register_area(
                company_id=cid_a, code="nostore", label="Stockage interdit",
                boundary_geojson=self.SQUARE, baseline_stress_category="high",
                source_release_id=release_id,
            )

    def test_invalid_geometry_is_refused_with_reason(self, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"water-geom-{cid_a}")
        with pytest.raises(risk_areas_service.WaterRiskAreaError, match="Géométrie refusée"):
            risk_areas_service.register_area(
                company_id=cid_a, code="badgeom", label="Géométrie invalide",
                boundary_geojson={"type": "Point", "coordinates": [0, 0]},
                baseline_stress_category="high", source_release_id=release_id,
            )

    def test_registration_derives_bbox_and_lists_with_license(self, two_companies_water):
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"water-ok-{cid_a}")
        area = risk_areas_service.register_area(
            company_id=cid_a, code=f"ok-{cid_a}", label="Zone valide",
            boundary_geojson=self.SQUARE, baseline_stress_category="medium_high",
            source_release_id=release_id,
        )
        assert area.bbox_min_lat == 40.0 and area.bbox_max_lat == 50.0
        assert area.display_allowed is True
        assert area.value_withheld is False
        listing = risk_areas_service.list_areas(company_id=cid_a)
        assert any(i.code == f"ok-{cid_a}" for i in listing.items)

    def test_display_forbidden_withholds_stress_category(self, two_companies_water):
        """Licence display=false : la catégorie de stress ne quitte JAMAIS le
        serveur (value_withheld=True), la zone reste listée (existence)."""
        cid_a, _ = two_companies_water
        _sid, release_id = insert_source_with_release(
            cid_a, f"water-nodisplay-{cid_a}", display_allowed=False,
        )
        risk_areas_service.register_area(
            company_id=cid_a, code=f"hidden-{cid_a}", label="Affichage interdit",
            boundary_geojson=self.SQUARE, baseline_stress_category="extremely_high",
            source_release_id=release_id,
        )
        listing = risk_areas_service.list_areas(company_id=cid_a)
        hidden = [i for i in listing.items if i.code == f"hidden-{cid_a}"]
        assert hidden
        assert hidden[0].value_withheld is True
        assert hidden[0].baseline_stress_category is None
        assert hidden[0].display_allowed is False

    def test_global_area_visible_to_all_tenants(self, two_companies_water):
        cid_a, cid_b = two_companies_water
        _sid, release_id = insert_source_with_release(None, "water-global-src")
        insert_risk_area(None, "global-basin", release_id, stress="high")
        for cid in (cid_a, cid_b):
            listing = risk_areas_service.list_areas(company_id=cid)
            assert any(i.code == "global-basin" and i.company_id is None for i in listing.items)

    def test_tenant_area_invisible_to_other_tenant(self, two_companies_water):
        cid_a, cid_b = two_companies_water
        _sid, release_id = insert_source_with_release(cid_a, f"water-privzone-{cid_a}")
        insert_risk_area(cid_a, f"priv-{cid_a}", release_id)
        listing_b = risk_areas_service.list_areas(company_id=cid_b)
        assert not any(i.code == f"priv-{cid_a}" for i in listing_b.items)


# ── Isolation activités/permis + API ─────────────────────────────────────────


class TestWaterApiAndIsolation:
    def test_activities_isolated_between_tenants(self, two_companies_water):
        cid_a, cid_b = two_companies_water
        site_b = insert_site(cid_b, "Site B activités")
        activities_service.create_import(
            company_id=cid_b, filename="b.csv", content=_csv(site_b),
        )
        listing_a = activities_service.list_activities(company_id=cid_a, site_id=site_b)
        assert listing_a.total == 0, "A ne voit jamais les activités de B"

    def test_activities_require_auth(self, client):
        assert client.get("/water/activities").status_code == 401

    def test_import_requires_analyst(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        resp = client.post(
            "/water/activities/import",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={"filename": "x.csv", "csv_text": "site_id\n1\n"},
        )
        assert resp.status_code == 403

    def test_import_and_list_via_api(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site API eau")
        token = _token_for(cid_a)
        resp = client.post(
            "/water/activities/import",
            headers=_auth(token),
            json={"filename": "api.csv", "csv_text": _csv(site_id).decode("utf-8")},
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["accepted_count"] == 3
        listing = client.get(
            f"/water/activities?site_id={site_id}&limit=2", headers=_auth(token)
        )
        assert listing.status_code == 200
        body = listing.json()
        assert body["total"] == 3
        assert len(body["items"]) == 2
        assert body["limit"] == 2

    def test_permit_404_does_not_leak_cross_tenant(self, client, two_companies_water):
        cid_a, cid_b = two_companies_water
        site_b = insert_site(cid_b, "Site B permis API")
        permit_b = permits_service.create_permit(
            company_id=cid_b,
            payload=WaterPermitCreate(site_id=site_b, permit_type="discharge"),
        )
        resp = client.get(
            f"/water/permits/{permit_b.id}", headers=_auth(_token_for(cid_a))
        )
        assert resp.status_code == 404, "jamais un 403 qui confirmerait l'existence"

    def test_risk_areas_listing_via_api(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        resp = client.get("/water/risk-areas", headers=_auth(_token_for(cid_a)))
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body and "total" in body

    def test_risk_areas_have_no_user_write_endpoint(self, client, two_companies_water):
        """L'ingestion du référentiel est CLI/admin uniquement : POST
        /water/risk-areas n'existe pas (405), même pour un analyste."""
        cid_a, _ = two_companies_water
        resp = client.post(
            "/water/risk-areas", headers=_auth(_token_for(cid_a)), json={},
        )
        assert resp.status_code == 405
