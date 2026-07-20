"""
test_sites_geo.py — géospatial des sites (PR-08A, migration 036). DB-gated
(job `migration-tests` UNIQUEMENT — à inscrire dans .github/workflows/api.yml).

Couvre : application réelle de 036 après 035 (via les fixtures), gate de revue
de géocodage (aucune coordonnée utilisable avant `accepted`, saisie manuelle
comprise), promotion vers `sites`, append-only des candidats (trigger),
isolation tenant A/B (défense en profondeur — le superuser CI bypasse la RLS),
auth API (401/403), 404 sans fuite d'existence, non-régression de GET/POST
/sites (027).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.geo import GeocodeCandidateCreate
from services.auth_service import AuthUser, create_access_token
from services.geo import geocode_service

from ._water_fixtures import insert_site

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]


def _token_for(company_id: int, role: str = "analyst", user_id: int = 77) -> str:
    user = AuthUser(
        email=f"water-{role}-{company_id}@test.local", role=role,
        company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _propose(company_id: int, site_id: int, lat: float = 45.5, lon: float = 4.8):
    return geocode_service.propose_candidate(
        company_id=company_id, site_id=site_id,
        payload=GeocodeCandidateCreate(latitude=lat, longitude=lon, precision="manual"),
        created_by=11,
    )


# ── Migration 036 réellement appliquée (colonnes + sonde) ────────────────────


class TestMigration036Applied:
    def test_sites_has_geo_columns_and_probe_passes(self, two_companies_water):
        from db.migration_probes import MIGRATION_OBJECT_PROBES

        with get_db() as conn:
            with conn.cursor() as cur:
                assert MIGRATION_OBJECT_PROBES["036"](cur) is True

    def test_existing_sites_rows_have_pending_review_status(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site défaut pending")
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT latitude, longitude, geocode_review_status FROM sites WHERE id = %s",
                    (site_id,),
                )
                row = cur.fetchone()
        assert row["latitude"] is None
        assert row["longitude"] is None
        assert row["geocode_review_status"] == "pending"


# ── Gate de revue : rien d'utilisable avant `accepted` ───────────────────────


class TestGeocodeReviewGate:
    def test_proposed_candidate_is_not_usable(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site gate proposed")
        _propose(cid_a, site_id)
        with pytest.raises(geocode_service.GeocodeError, match="non utilisable"):
            geocode_service.get_accepted_position(company_id=cid_a, site_id=site_id)

    def test_manual_entry_goes_through_the_same_gate(self, two_companies_water):
        """La saisie manuelle n'a AUCUN raccourci : elle produit un candidat
        `proposed` avec method_code manual_coordinates_v1, jamais une écriture
        directe de sites.latitude."""
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site saisie manuelle")
        cand = _propose(cid_a, site_id)
        assert cand.status == "proposed"
        assert cand.method_code == "manual_coordinates_v1"
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT latitude FROM sites WHERE id = %s", (site_id,))
                assert cur.fetchone()["latitude"] is None, (
                    "proposer ne doit JAMAIS écrire sites.latitude"
                )

    def test_accept_promotes_position_to_site(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site promotion")
        cand = _propose(cid_a, site_id, lat=48.85, lon=2.35)
        reviewed = geocode_service.review_candidate(
            company_id=cid_a, site_id=site_id, candidate_id=cand.id,
            accept=True, reviewed_by=99,
        )
        assert reviewed.status == "accepted"
        pos = geocode_service.get_accepted_position(company_id=cid_a, site_id=site_id)
        assert pos["latitude"] == pytest.approx(48.85)
        assert pos["longitude"] == pytest.approx(2.35)
        assert pos["reviewed_by"] == 99

    def test_reject_leaves_site_untouched(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site rejet")
        cand = _propose(cid_a, site_id)
        geocode_service.review_candidate(
            company_id=cid_a, site_id=site_id, candidate_id=cand.id,
            accept=False, reviewed_by=99,
        )
        with pytest.raises(geocode_service.GeocodeError):
            geocode_service.get_accepted_position(company_id=cid_a, site_id=site_id)

    def test_flag_makes_accepted_position_unusable_again(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site flag")
        cand = _propose(cid_a, site_id)
        geocode_service.review_candidate(
            company_id=cid_a, site_id=site_id, candidate_id=cand.id,
            accept=True, reviewed_by=99,
        )
        geocode_service.flag_site_position(company_id=cid_a, site_id=site_id, reviewed_by=99)
        with pytest.raises(geocode_service.GeocodeError, match="flagged"):
            geocode_service.get_accepted_position(company_id=cid_a, site_id=site_id)

    def test_reviewed_candidate_cannot_be_reviewed_again(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site re-revue")
        cand = _propose(cid_a, site_id)
        geocode_service.review_candidate(
            company_id=cid_a, site_id=site_id, candidate_id=cand.id,
            accept=True, reviewed_by=99,
        )
        with pytest.raises(geocode_service.GeocodeError, match="déjà revu"):
            geocode_service.review_candidate(
                company_id=cid_a, site_id=site_id, candidate_id=cand.id,
                accept=False, reviewed_by=99,
            )

    def test_out_of_range_coordinates_are_refused(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site hors bornes")
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            GeocodeCandidateCreate(latitude=91.0, longitude=0.0)
        # Et la contrainte EN BASE refuse aussi (défense en profondeur).
        with pytest.raises(Exception, match="site_geocode_candidates_lat_check"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO site_geocode_candidates "
                        "(company_id, site_id, provider, latitude, longitude) "
                        "VALUES (%s, %s, 'manual', 91, 0)",
                        (cid_a, site_id),
                    )


# ── Append-only EN BASE (trigger) ────────────────────────────────────────────


class TestCandidateAppendOnly:
    def test_update_of_reviewed_candidate_coordinates_is_refused(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site append-only")
        cand = _propose(cid_a, site_id)
        geocode_service.review_candidate(
            company_id=cid_a, site_id=site_id, candidate_id=cand.id,
            accept=True, reviewed_by=99,
        )
        with pytest.raises(Exception, match="déjà revu"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE site_geocode_candidates SET latitude = 1 WHERE id = %s",
                        (cand.id,),
                    )

    def test_update_of_proposed_candidate_coordinates_is_refused(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site immuable proposed")
        cand = _propose(cid_a, site_id)
        with pytest.raises(Exception, match="immuable"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE site_geocode_candidates SET latitude = 1 WHERE id = %s",
                        (cand.id,),
                    )

    def test_delete_is_refused(self, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site delete refusé")
        cand = _propose(cid_a, site_id)
        with pytest.raises(Exception, match="append-only"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM site_geocode_candidates WHERE id = %s", (cand.id,)
                    )


# ── Isolation tenant (défense en profondeur, CI superuser) ───────────────────


class TestTenantIsolation:
    def test_candidates_of_b_invisible_to_a(self, two_companies_water):
        cid_a, cid_b = two_companies_water
        site_b = insert_site(cid_b, "Site B isolé")
        _propose(cid_b, site_b)
        # A ne peut même pas lister les candidats du site de B : 404 métier
        # (« introuvable »), jamais une liste vide qui confirmerait l'existence.
        with pytest.raises(geocode_service.GeocodeError, match="introuvable"):
            geocode_service.list_candidates(company_id=cid_a, site_id=site_b)

    def test_review_cross_tenant_is_refused(self, two_companies_water):
        cid_a, cid_b = two_companies_water
        site_b = insert_site(cid_b, "Site B revue croisée")
        cand = _propose(cid_b, site_b)
        with pytest.raises(geocode_service.GeocodeError, match="introuvable"):
            geocode_service.review_candidate(
                company_id=cid_a, site_id=site_b, candidate_id=cand.id,
                accept=True, reviewed_by=99,
            )

    def test_sites_geo_listing_is_scoped(self, two_companies_water):
        cid_a, cid_b = two_companies_water
        insert_site(cid_a, "Site A listé")
        insert_site(cid_b, "Site B non listé")
        listing = geocode_service.list_sites_geo(company_id=cid_a)
        assert all(item.company_id == cid_a for item in listing.items)


# ── API HTTP : auth, 404 sans fuite, non-régression /sites ───────────────────


class TestSitesGeoApi:
    def test_geo_listing_requires_auth(self, client):
        assert client.get("/sites/geo").status_code == 401

    def test_geo_listing_ok_and_exposes_gate(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site API geo")
        resp = client.get("/sites/geo", headers=_auth(_token_for(cid_a)))
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body and "total" in body
        mine = [i for i in body["items"] if i["id"] == site_id]
        assert mine and mine[0]["position_usable"] is False

    def test_propose_requires_analyst(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site API viewer")
        resp = client.post(
            f"/sites/{site_id}/geocode-candidates",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={"latitude": 45.0, "longitude": 4.0},
        )
        assert resp.status_code == 403

    def test_propose_and_review_via_api(self, client, two_companies_water):
        cid_a, _ = two_companies_water
        site_id = insert_site(cid_a, "Site API flux complet")
        token = _token_for(cid_a)
        created = client.post(
            f"/sites/{site_id}/geocode-candidates",
            headers=_auth(token),
            json={"latitude": 43.3, "longitude": 5.4, "precision": "street"},
        )
        assert created.status_code == 201, created.text
        cand_id = created.json()["id"]
        reviewed = client.post(
            f"/sites/{site_id}/geocode-candidates/{cand_id}/review",
            headers=_auth(token),
            json={"accept": True},
        )
        assert reviewed.status_code == 200, reviewed.text
        assert reviewed.json()["status"] == "accepted"

    def test_cross_tenant_candidate_listing_is_404_not_403(self, client, two_companies_water):
        cid_a, cid_b = two_companies_water
        site_b = insert_site(cid_b, "Site B API 404")
        resp = client.get(
            f"/sites/{site_b}/geocode-candidates", headers=_auth(_token_for(cid_a))
        )
        assert resp.status_code == 404, "jamais un 403 qui confirmerait l'existence"

    def test_legacy_sites_endpoints_unregressed(self, client, two_companies_water):
        """Non-régression 027 : GET/POST /sites fonctionnent à l'identique avec
        la table étendue (les colonnes géo sont invisibles pour la v1)."""
        cid_a, _ = two_companies_water
        token = _token_for(cid_a)
        created = client.post(
            "/sites",
            headers=_auth(token),
            json={"name": "Site legacy API", "location": "Testville"},
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["name"] == "Site legacy API"
        assert "latitude" not in body, "le contrat v1 de POST /sites ne change pas"
        listing = client.get("/sites", headers=_auth(token))
        assert listing.status_code == 200
        assert any(s["name"] == "Site legacy API" for s in listing.json()["sites"])
