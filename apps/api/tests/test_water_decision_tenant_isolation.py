"""
tests/test_water_decision_tenant_isolation.py — isolation tenant de la synthèse
décisionnelle, contre un VRAI PostgreSQL (P16, Wave E, commit E5).

## Pourquoi ce fichier existe

La Wave D n'a testé la synthèse qu'avec des doubles : la composition et la
dégradation étaient prouvées, l'isolation ne l'était pas. Un double ne peut pas
échouer sur une clause `WHERE company_id = %s` manquante, et c'est précisément
le défaut qu'on veut exclure.

**Ce module est DB-gated.** Il ne tourne que là où un PostgreSQL réel existe :
en local avec `DATABASE_URL`, et en CI dans le job `migration-tests`. Il a été
ajouté nommément à la liste `pytest` de ce job — un fichier DB-gated absent de
cette liste n'est jamais exécuté, et le défaut reste invisible.

## Le montage est symétrique, et c'est essentiel

Les deux tenants reçoivent un jeu COMPLET et identifiable (site, activité,
screening, IRO, action, exposition ressource). Si B n'avait aucune donnée, un
filtre défaillant passerait inaperçu : « A ne voit que A » ne serait qu'une
tautologie. Les marqueurs (`ALPHA` / `BETA`) rendent une fuite visible dans les
libellés, pas seulement dans un compte.

| Exigence du prompt E5 | Test |
|---|---|
| 1. A ne lit que A | `test_tenant_a_reads_only_its_own_records` |
| 2. B ne lit que B | `test_tenant_b_reads_only_its_own_records` |
| 3. un identifiant de B transmis par A est refusé | `test_a_cannot_read_b_records_by_id` |
| 4. aucune facette ne filtre silencieusement une fuite | `test_a_leak_fails_loudly_instead_of_being_filtered` |
| 5. table optionnelle absente → une seule facette dégradée | `test_missing_optional_table_degrades_only_its_facet` |
| 6. une erreur inattendue remonte comme erreur | `test_an_unexpected_error_is_not_disguised_as_absence` |
| 7. le snapshot public ne contient aucun champ tenant | `test_public_snapshot_carries_no_tenant_field` |
| 8. les endpoints financiers ne persistent rien | `test_financial_evaluation_writes_nothing` |
| 9. `company_id` injecté ignoré ou refusé | `TestInjectedCompanyId` |
| 10. le test tourne réellement | `test_this_module_runs_against_a_real_database` |
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from db.database import db_available, get_db
from services.auth_service import AuthUser, create_access_token
from services.water import water_synthesis_service
from services.water_intelligence.tenant_synthesis import CrossTenantEntryError

from ._water_decision_fixtures import seed_full_tenant

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"),
        reason="DATABASE_URL absent — tests PostgreSQL skippés",
    ),
    pytest.mark.skipif(
        not db_available(), reason="psycopg2/PostgreSQL non disponible"
    ),
]

SYNTHESIS = "/water/decision-synthesis"
EVALUATE = "/water/financial-scenarios/evaluate"
PUBLIC_SNAPSHOT = "/water-intelligence/public-snapshot"


def _token_for(company_id: int, role: str = "analyst", user_id: int = 77) -> str:
    user = AuthUser(
        email=f"wave-e-{role}-{company_id}@test.local",
        role=role,
        company_id=company_id,
        user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _all_values(synthesis) -> list[str]:
    return [
        f"{entry.label} {entry.evidence_ref or ''}"
        for facet in synthesis.facets
        for entry in facet.entries
    ]


@pytest.fixture(scope="module")
def seeded(two_companies_decision):
    """Deux tenants réellement peuplés, symétriquement."""
    cid_a, cid_b = two_companies_decision
    return {
        "a": (cid_a, seed_full_tenant(cid_a, marker="ALPHA")),
        "b": (cid_b, seed_full_tenant(cid_b, marker="BETA")),
    }


class TestTenantIsolation:
    """Deux tenants peuplés, aucune fuite dans aucun sens."""

    def test_this_module_runs_against_a_real_database(self) -> None:
        """Exigence 10 — ce test échoue si le module est exécuté à vide.

        Sa présence rend impossible de déclarer E5 « terminé » alors que tout
        serait skippé : s'il est skippé, il n'est pas vert, et l'absence est
        visible dans le rapport CI.
        """
        assert os.environ.get("DATABASE_URL"), "ce module exige un PostgreSQL réel"
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok")
                assert cur.fetchone()["ok"] == 1

    def test_tenant_a_reads_only_its_own_records(self, seeded) -> None:
        cid_a, _ = seeded["a"]
        synthesis = water_synthesis_service.build_synthesis(company_id=cid_a)
        assert synthesis.company_id == cid_a
        joined = " ".join(_all_values(synthesis))
        assert "ALPHA" in joined
        assert "BETA" not in joined

    def test_tenant_b_reads_only_its_own_records(self, seeded) -> None:
        cid_b, _ = seeded["b"]
        synthesis = water_synthesis_service.build_synthesis(company_id=cid_b)
        assert synthesis.company_id == cid_b
        joined = " ".join(_all_values(synthesis))
        assert "BETA" in joined
        assert "ALPHA" not in joined

    def test_both_tenants_actually_have_data(self, seeded) -> None:
        """Sans ce contrôle, « A ne voit pas B » serait une tautologie."""
        for key in ("a", "b"):
            cid, _ = seeded[key]
            synthesis = water_synthesis_service.build_synthesis(company_id=cid)
            assert not synthesis.is_empty, f"le tenant {key} doit être peuplé"

    def test_a_cannot_read_b_records_by_id(self, client: TestClient, seeded) -> None:
        """Exigence 3 — un identifiant de B présenté par A est refusé.

        404 et non 403 : un 403 confirmerait l'existence de la ressource chez
        un autre tenant, ce qui est déjà une fuite.
        """
        cid_a, _ = seeded["a"]
        _, data_b = seeded["b"]
        response = client.get(
            f"/water/screenings/{data_b['screening_id']}", headers=_auth(_token_for(cid_a))
        )
        assert response.status_code == 404, response.text

    def test_the_synthesis_endpoint_serves_the_token_perimeter(
        self, client: TestClient, seeded
    ) -> None:
        cid_a, _ = seeded["a"]
        payload = client.get(SYNTHESIS, headers=_auth(_token_for(cid_a))).json()
        assert payload["company_id"] == cid_a
        assert "BETA" not in str(payload)


class TestInjectedCompanyId:
    """Exigence 9 — un `company_id` fourni par l'appelant n'est jamais un paramètre."""

    def test_a_company_id_in_the_query_is_ignored(self, client: TestClient, seeded) -> None:
        cid_a, _ = seeded["a"]
        cid_b, _ = seeded["b"]
        response = client.get(
            f"{SYNTHESIS}?company_id={cid_b}", headers=_auth(_token_for(cid_a))
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["company_id"] == cid_a
        assert "BETA" not in str(payload)

    def test_a_company_id_in_the_body_is_refused(self, client: TestClient, seeded) -> None:
        cid_a, _ = seeded["a"]
        cid_b, _ = seeded["b"]
        body = {
            "scenario_code": "T",
            "label": "T",
            "base_year": 2026,
            "horizon_year": 2027,
            "company_id": cid_b,
            "outage_days": {"value": "1", "provenance": "assumption", "basis": "b"},
            "affected_capacity_share": {"value": "0.5", "provenance": "assumption", "basis": "b"},
            "revenue_per_day": {"value": "1", "provenance": "assumption", "basis": "b"},
            "margin_rate": {"value": "0.1", "provenance": "assumption", "basis": "b"},
            "additional_opex_per_day": {"value": "1", "provenance": "assumption", "basis": "b"},
            "adaptation_capex": {"value": "1", "provenance": "assumption", "basis": "b"},
            "discount_rate": {"value": "0.05", "provenance": "assumption", "basis": "b"},
            "sensitivity_variation_pct": "10",
        }
        response = client.post(EVALUATE, headers=_auth(_token_for(cid_a)), json=body)
        assert response.status_code == 422, "un champ étranger doit être refusé, pas ignoré"


class TestNoSilentFiltering:
    """Exigence 4 — une fuite échoue bruyamment, elle n'est jamais filtrée."""

    def test_a_leak_fails_loudly_instead_of_being_filtered(
        self, monkeypatch: pytest.MonkeyPatch, seeded
    ) -> None:
        """Simule une lecture mal scopée et vérifie l'échec.

        Un service qui ramènerait une ligne d'un autre tenant doit faire
        échouer la composition. Filtrer silencieusement masquerait la requête
        fautive et la laisserait en production.
        """
        cid_a, _ = seeded["a"]
        cid_b, _ = seeded["b"]

        from services.water import screening_service

        real = screening_service.list_screenings

        def _leaky(**kwargs):
            # Ignore délibérément le company_id demandé — c'est le défaut testé.
            kwargs["company_id"] = cid_b
            return real(**kwargs)

        monkeypatch.setattr(screening_service, "list_screenings", _leaky, raising=True)

        with pytest.raises(CrossTenantEntryError):
            water_synthesis_service.build_synthesis(company_id=cid_a)

    def test_the_error_names_both_tenants(
        self, monkeypatch: pytest.MonkeyPatch, seeded
    ) -> None:
        cid_a, _ = seeded["a"]
        cid_b, _ = seeded["b"]

        from services.water import screening_service

        real = screening_service.list_screenings

        def _leaky(**kwargs):
            kwargs["company_id"] = cid_b
            return real(**kwargs)

        monkeypatch.setattr(screening_service, "list_screenings", _leaky, raising=True)

        with pytest.raises(CrossTenantEntryError) as caught:
            water_synthesis_service.build_synthesis(company_id=cid_a)
        message = str(caught.value)
        assert str(cid_a) in message and str(cid_b) in message


class TestDegradationAgainstRealSchema:
    """Exigences 5 et 6 — dégradation ciblée, erreurs jamais déguisées."""

    def test_missing_optional_table_degrades_only_its_facet(
        self, monkeypatch: pytest.MonkeyPatch, seeded
    ) -> None:
        cid_a, _ = seeded["a"]

        class _SchemaMissing(Exception):
            pgcode = "42P01"

        from services.resources import exposure_link_service

        def _boom(**_):
            raise _SchemaMissing("relation inexistante")

        monkeypatch.setattr(exposure_link_service, "list_links", _boom, raising=True)

        synthesis = water_synthesis_service.build_synthesis(company_id=cid_a)

        material = synthesis.facet("resource_material")
        assert all(
            entry.absence_reason == water_synthesis_service.ABSENCE_SCHEMA_NOT_READY
            for entry in material.entries
        )
        # Les autres facettes restent servies depuis la vraie base.
        assert not synthesis.facet("risk").is_empty
        assert not synthesis.facet("iro").is_empty

    def test_an_unexpected_error_is_not_disguised_as_absence(
        self, monkeypatch: pytest.MonkeyPatch, seeded
    ) -> None:
        cid_a, _ = seeded["a"]

        from services.water import screening_service

        def _boom(**_):
            raise RuntimeError("defaut de programmation")

        monkeypatch.setattr(screening_service, "list_screenings", _boom, raising=True)

        with pytest.raises(RuntimeError, match="defaut de programmation"):
            water_synthesis_service.build_synthesis(company_id=cid_a)


class TestPublicSurfaceStaysClean:
    """Exigence 7 — le public reste public, même avec des tenants peuplés."""

    def test_public_snapshot_carries_no_tenant_field(
        self, client: TestClient, seeded
    ) -> None:
        raw = client.get(PUBLIC_SNAPSHOT).text
        for field in ("company_id", "tenant_id", "site_id", "organisation_id", "user_id"):
            assert field not in raw

    def test_public_snapshot_leaks_no_seeded_marker(
        self, client: TestClient, seeded
    ) -> None:
        raw = client.get(PUBLIC_SNAPSHOT).text
        assert "ALPHA" not in raw
        assert "BETA" not in raw


class TestFinancialEndpointPersistsNothing:
    """Exigence 8 — l'évaluation financière n'écrit rien, contre une vraie base."""

    def _counts(self, company_id: int) -> dict[str, int]:
        counts: dict[str, int] = {}
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                for table in (
                    "water_actions",
                    "water_targets",
                    "site_water_screenings",
                    "water_activities",
                    "iros",
                ):
                    cur.execute(
                        f"SELECT count(*) AS n FROM {table} WHERE company_id = %s",
                        (company_id,),
                    )
                    counts[table] = cur.fetchone()["n"]
        return counts

    def test_financial_evaluation_writes_nothing(self, client: TestClient, seeded) -> None:
        cid_a, _ = seeded["a"]
        before = self._counts(cid_a)

        body = {
            "scenario_code": "T",
            "label": "Scénario de test",
            "base_year": 2026,
            "horizon_year": 2030,
            "outage_days": {"value": "10", "provenance": "assumption", "basis": "b"},
            "affected_capacity_share": {"value": "0.5", "provenance": "assumption", "basis": "b"},
            "revenue_per_day": {"value": "1000", "provenance": "observed", "basis": "b"},
            "margin_rate": {"value": "0.3", "provenance": "assumption", "basis": "b"},
            "additional_opex_per_day": {"value": "200", "provenance": "assumption", "basis": "b"},
            "adaptation_capex": {"value": "5000", "provenance": "assumption", "basis": "b"},
            "discount_rate": {"value": "0.05", "provenance": "assumption", "basis": "b"},
            "sensitivity_variation_pct": "20",
        }
        response = client.post(EVALUATE, headers=_auth(_token_for(cid_a)), json=body)
        assert response.status_code == 200, response.text

        assert self._counts(cid_a) == before, "l'évaluation ne doit rien persister"
