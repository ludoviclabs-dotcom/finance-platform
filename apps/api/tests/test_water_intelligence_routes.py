"""
tests/test_water_intelligence_routes.py — surfaces HTTP Water Intelligence
(P16, Wave E, commit E3).

AUCUNE base requise pour la majorité des contrôles : les endpoints publics sont
purs, et la synthèse tenant est exercée ici avec des doubles. La preuve contre
un vrai PostgreSQL est le commit E5, pas celui-ci.

| Exigence du prompt E3 | Classe de test |
|---|---|
| snapshot public sans authentification | `TestPublicSnapshotIsPublic` |
| ETag et 304 `If-None-Match` | `TestEtagAndConditionalGet` |
| aucun tenant dans le public | `TestPublicSurfacesCarryNoTenant` |
| registre juridique sans conclusion | `TestPublicRegulatoryRegistry` |
| auth requise pour synthèse et finance | `TestAuthenticationRequired` |
| `company_id` injecté refusé/ignoré | `TestCompanyIdComesOnlyFromTheToken` |
| scénario sans hypothèses refusé | `TestFinancialScenarioRefusesGuesswork` |
| aucune écriture DB | `TestFinancialEndpointIsStateless` |
| rate limit déclaré | `TestRateLimitRulesDeclared` |
| aucun appel externe | `TestNoExternalCall` |
"""

from __future__ import annotations

import ast
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from services.auth_service import AuthUser, create_access_token

PUBLIC_SNAPSHOT = "/water-intelligence/public-snapshot"
PUBLIC_REGISTRY = "/water-intelligence/regulatory-registry"
SYNTHESIS = "/water/decision-synthesis"
EVALUATE = "/water/financial-scenarios/evaluate"

COMPANY_A = 4101
COMPANY_B = 4202

_ROUTER = Path(__file__).resolve().parents[1] / "routers" / "water_intelligence.py"


def _token_for(company_id: int, role: str = "analyst", user_id: int = 91) -> str:
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


def _quantity(value: str | None, provenance: str = "assumption") -> dict:
    return {"value": value, "provenance": provenance, "basis": "hypothèse de test"}


def _scenario_body(**overrides: object) -> dict:
    body: dict = {
        "scenario_code": "TEST",
        "label": "Scénario de test",
        "base_year": 2026,
        "horizon_year": 2030,
        "outage_days": _quantity("10"),
        "affected_capacity_share": _quantity("0.5"),
        "revenue_per_day": _quantity("1000", "observed"),
        "margin_rate": _quantity("0.3"),
        "additional_opex_per_day": _quantity("200"),
        "adaptation_capex": _quantity("5000"),
        "discount_rate": _quantity("0.05"),
        "sensitivity_variation_pct": "20",
    }
    body.update(overrides)
    return body


@pytest.fixture()
def empty_synthesis(monkeypatch: pytest.MonkeyPatch) -> None:
    """Toutes les sources tenant répondent « aucun enregistrement ».

    La synthèse est ainsi exercée sans base, ce qui teste la ROUTE (auth,
    périmètre, forme) sans dupliquer les tests du service.
    """
    from services.iro import iro_service
    from services.resources import exposure_link_service
    from services.water import (
        activities_service,
        screening_service,
        targets_actions_service,
    )

    listing = SimpleNamespace(items=[], total=0, limit=50, offset=0)
    for module, name in (
        (screening_service, "list_screenings"),
        (activities_service, "list_activities"),
        (exposure_link_service, "list_links"),
        (iro_service, "list_iros"),
        (targets_actions_service, "list_actions"),
    ):
        monkeypatch.setattr(module, name, lambda **_: listing, raising=True)
    monkeypatch.setattr("routers.water.require_db", lambda: None, raising=True)


class TestPublicSnapshotIsPublic:
    """Le snapshot public se lit sans jeton."""

    def test_anonymous_access_succeeds(self, client: TestClient) -> None:
        response = client.get(PUBLIC_SNAPSHOT)
        assert response.status_code == 200, response.text

    def test_it_serves_the_canonical_empty_snapshot(self, client: TestClient) -> None:
        payload = client.get(PUBLIC_SNAPSHOT).json()
        assert payload["is_empty"] is True
        assert payload["snapshot"]["manifest"] is None
        assert payload["snapshot"]["coverage"]["observation_count"] == 0

    def test_it_carries_the_real_exclusions(self, client: TestClient) -> None:
        snapshot = client.get(PUBLIC_SNAPSHOT).json()["snapshot"]
        assert len(snapshot["exclusions"]) == 7
        codes = {exclusion["source_code"] for exclusion in snapshot["exclusions"]}
        assert "WRI_AQUEDUCT" in codes
        assert "COPERNICUS_EDO" in codes

    def test_it_exposes_no_observation(self, client: TestClient) -> None:
        snapshot = client.get(PUBLIC_SNAPSHOT).json()["snapshot"]
        assert snapshot["coverage"]["observation_count"] == 0
        assert snapshot["included_source_codes"] == []


class TestEtagAndConditionalGet:
    """Premier validateur HTTP du dépôt — faible, sur les octets canoniques."""

    def test_a_weak_etag_is_returned(self, client: TestClient) -> None:
        etag = client.get(PUBLIC_SNAPSHOT).headers.get("etag")
        assert etag is not None
        assert etag.startswith('W/"wi-')

    def test_the_etag_is_stable_across_calls(self, client: TestClient) -> None:
        first = client.get(PUBLIC_SNAPSHOT).headers["etag"]
        second = client.get(PUBLIC_SNAPSHOT).headers["etag"]
        assert first == second, "réassembler le même snapshot ne doit pas changer l'ETag"

    def test_if_none_match_returns_304_without_a_body(self, client: TestClient) -> None:
        etag = client.get(PUBLIC_SNAPSHOT).headers["etag"]
        response = client.get(PUBLIC_SNAPSHOT, headers={"If-None-Match": etag})
        assert response.status_code == 304
        assert response.content == b""
        assert response.headers["etag"] == etag

    def test_a_stale_etag_returns_the_full_body(self, client: TestClient) -> None:
        response = client.get(PUBLIC_SNAPSHOT, headers={"If-None-Match": 'W/"wi-obsolete"'})
        assert response.status_code == 200

    def test_a_wildcard_matches(self, client: TestClient) -> None:
        assert client.get(PUBLIC_SNAPSHOT, headers={"If-None-Match": "*"}).status_code == 304

    def test_a_comma_separated_list_matches(self, client: TestClient) -> None:
        etag = client.get(PUBLIC_SNAPSHOT).headers["etag"]
        response = client.get(
            PUBLIC_SNAPSHOT, headers={"If-None-Match": f'W/"wi-autre", {etag}'}
        )
        assert response.status_code == 304

    def test_the_registry_has_its_own_etag(self, client: TestClient) -> None:
        snapshot_etag = client.get(PUBLIC_SNAPSHOT).headers["etag"]
        registry_etag = client.get(PUBLIC_REGISTRY).headers["etag"]
        assert registry_etag.startswith('W/"wi-legal-')
        assert registry_etag != snapshot_etag

    def test_a_snapshot_etag_does_not_satisfy_the_registry(self, client: TestClient) -> None:
        snapshot_etag = client.get(PUBLIC_SNAPSHOT).headers["etag"]
        response = client.get(PUBLIC_REGISTRY, headers={"If-None-Match": snapshot_etag})
        assert response.status_code == 200


class TestPublicSurfacesCarryNoTenant:
    """Aucune donnée d'entreprise ne sort d'une surface publique."""

    @pytest.mark.parametrize("path", [PUBLIC_SNAPSHOT, PUBLIC_REGISTRY])
    def test_no_tenant_field_in_the_payload(self, client: TestClient, path: str) -> None:
        raw = client.get(path).text
        for field in ("company_id", "tenant_id", "site_id", "organisation_id", "user_id"):
            assert field not in raw

    @pytest.mark.parametrize("path", [PUBLIC_SNAPSHOT, PUBLIC_REGISTRY])
    def test_a_token_does_not_change_the_public_payload(
        self, client: TestClient, path: str
    ) -> None:
        """Un lecteur authentifié voit exactement la même chose qu'un anonyme."""
        anonymous = client.get(path).json()
        authenticated = client.get(path, headers=_auth(_token_for(COMPANY_A))).json()
        assert anonymous == authenticated


class TestPublicRegulatoryRegistry:
    """Le registre expose des textes à instruire, pas du droit."""

    def test_anonymous_access_succeeds(self, client: TestClient) -> None:
        assert client.get(PUBLIC_REGISTRY).status_code == 200

    def test_no_rule_is_verified(self, client: TestClient) -> None:
        payload = client.get(PUBLIC_REGISTRY).json()
        assert payload["verified_rule_count"] == 0
        assert len(payload["rules"]) == 9

    def test_every_rule_is_unknown(self, client: TestClient) -> None:
        for rule in client.get(PUBLIC_REGISTRY).json()["rules"]:
            assert rule["legal_status"] == "unknown"
            assert rule["public_legal_status"] == "unknown"

    def test_no_entity_determination_is_exposed(self, client: TestClient) -> None:
        """Contrôle STRUCTUREL, pas lexical.

        Une recherche de sous-chaîne échouerait à tort : les notes du registre
        expliquent en prose le comportement du moteur (« jamais `in_scope` par
        défaut »), et ce texte est de la documentation, pas une détermination.
        Ce qui compte est qu'aucune CLÉ de détermination n'existe.
        """
        allowed_keys = {
            "rule_id",
            "text_version",
            "jurisdiction",
            "instrument_kind",
            "is_binding",
            "title",
            "text_reference",
            "legal_status",
            "public_legal_status",
            "transposition_status",
            "criteria",
            "missing_fields",
            "notes",
        }
        for rule in client.get(PUBLIC_REGISTRY).json()["rules"]:
            assert set(rule) == allowed_keys, f"clé inattendue : {set(rule) - allowed_keys}"
            # `criteria` ne porte que des CODES de critère : jamais une réponse,
            # jamais une preuve, jamais un réviseur.
            assert all(isinstance(code, str) for code in rule["criteria"])

    def test_no_verdict_is_rendered_for_any_entity(self, client: TestClient) -> None:
        """Le registre public ne rend aucun verdict de portée.

        Un verdict n'existe que pour un couple (règle, entité) : le produire
        ici supposerait une entité, donc un tenant.
        """
        payload = client.get(PUBLIC_REGISTRY).json()
        assert "assessments" not in payload
        assert "outcome" not in client.get(PUBLIC_REGISTRY).text


class TestAuthenticationRequired:
    """Les deux surfaces décisionnelles exigent un jeton."""

    def test_synthesis_refuses_anonymous(self, client: TestClient) -> None:
        assert client.get(SYNTHESIS).status_code in (401, 403)

    def test_evaluate_refuses_anonymous(self, client: TestClient) -> None:
        assert client.post(EVALUATE, json=_scenario_body()).status_code in (401, 403)

    def test_evaluate_refuses_an_invalid_token(self, client: TestClient) -> None:
        response = client.post(
            EVALUATE, headers={"Authorization": "Bearer invalide"}, json=_scenario_body()
        )
        assert response.status_code == 401


class TestCompanyIdComesOnlyFromTheToken:
    """Un identifiant de tenant fourni par l'appelant n'est jamais un paramètre."""

    def test_synthesis_serves_the_token_company(
        self, client: TestClient, empty_synthesis: None
    ) -> None:
        payload = client.get(SYNTHESIS, headers=_auth(_token_for(COMPANY_A))).json()
        assert payload["company_id"] == COMPANY_A

    def test_a_company_id_in_the_query_is_ignored(
        self, client: TestClient, empty_synthesis: None
    ) -> None:
        response = client.get(
            f"{SYNTHESIS}?company_id={COMPANY_B}", headers=_auth(_token_for(COMPANY_A))
        )
        assert response.status_code == 200
        assert response.json()["company_id"] == COMPANY_A, (
            "le périmètre servi doit venir du jeton, jamais de la requête"
        )

    def test_two_tokens_serve_two_perimeters(
        self, client: TestClient, empty_synthesis: None
    ) -> None:
        a = client.get(SYNTHESIS, headers=_auth(_token_for(COMPANY_A))).json()
        b = client.get(SYNTHESIS, headers=_auth(_token_for(COMPANY_B))).json()
        assert a["company_id"] == COMPANY_A
        assert b["company_id"] == COMPANY_B

    def test_the_endpoint_declares_no_company_id_parameter(self) -> None:
        """Garde-fou de code : le paramètre ne doit pas réapparaître."""
        source = (
            Path(__file__).resolve().parents[1] / "routers" / "water.py"
        ).read_text(encoding="utf-8")
        body = source[source.index("async def get_decision_synthesis_endpoint") :]
        signature = body[: body.index(")")]
        assert "company_id" not in signature

    def test_six_facets_are_always_present(
        self, client: TestClient, empty_synthesis: None
    ) -> None:
        payload = client.get(SYNTHESIS, headers=_auth(_token_for(COMPANY_A))).json()
        assert [facet["facet"] for facet in payload["facets"]] == [
            "risk",
            "confidence",
            "dependency",
            "resource_material",
            "iro",
            "action",
        ]

    def test_no_global_score_is_returned(
        self, client: TestClient, empty_synthesis: None
    ) -> None:
        raw = client.get(SYNTHESIS, headers=_auth(_token_for(COMPANY_A))).text.lower()
        for forbidden in ("score", "overall", "index"):
            assert forbidden not in raw


class TestFinancialScenarioRefusesGuesswork:
    """Aucune hypothèse n'est fournie à la place de l'appelant."""

    def test_a_complete_scenario_is_evaluated(self, client: TestClient) -> None:
        response = client.post(
            EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=_scenario_body()
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["present_value"] is not None
        assert len(payload["sensitivities"]) == 4

    @pytest.mark.parametrize(
        "missing",
        ["discount_rate", "revenue_per_day", "margin_rate", "outage_days"],
    )
    def test_a_missing_assumption_is_refused(self, client: TestClient, missing: str) -> None:
        body = _scenario_body()
        del body[missing]
        response = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body)
        assert response.status_code == 422, f"{missing} ne doit pas avoir de valeur par défaut"

    def test_probability_is_optional_and_never_fabricated(self, client: TestClient) -> None:
        payload = client.post(
            EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=_scenario_body()
        ).json()
        assert payload["probability_weighted"] is None

    def test_a_supplied_probability_is_used(self, client: TestClient) -> None:
        body = _scenario_body(probability=_quantity("0.5"))
        payload = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body).json()
        assert payload["probability_weighted"] is not None

    def test_a_derived_provenance_is_refused(self, client: TestClient) -> None:
        body = _scenario_body(revenue_per_day=_quantity("1000", "derived"))
        response = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body)
        assert response.status_code == 422

    def test_an_assumption_without_basis_is_refused(self, client: TestClient) -> None:
        body = _scenario_body()
        body["margin_rate"] = {"value": "0.3", "provenance": "assumption", "basis": ""}
        response = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body)
        assert response.status_code == 422

    def test_an_impossible_horizon_is_refused_with_a_reason(self, client: TestClient) -> None:
        body = _scenario_body(base_year=2030, horizon_year=2026)
        response = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body)
        assert response.status_code == 422
        assert "ordre temporel" in response.text

    def test_an_unknown_accounting_signal_is_refused(self, client: TestClient) -> None:
        body = _scenario_body(signals=["IFRS 42"])
        response = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body)
        assert response.status_code == 422

    def test_declared_signals_are_returned_as_questions(self, client: TestClient) -> None:
        body = _scenario_body(signals=["IAS 36"])
        payload = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body).json()
        assert payload["signals"] == ["IAS 36"]

    def test_an_absent_input_yields_an_absent_result_not_zero(self, client: TestClient) -> None:
        body = _scenario_body(revenue_per_day=_quantity(None))
        payload = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body).json()
        assert payload["is_absent"] is True
        assert payload["present_value"] is None
        assert "revenue_per_day" in payload["absence_reason"]

    def test_an_unknown_field_is_refused(self, client: TestClient) -> None:
        body = _scenario_body()
        body["company_id"] = COMPANY_B
        response = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body)
        assert response.status_code == 422, (
            "un champ étranger — a fortiori un company_id — doit être refusé"
        )

    def test_the_payload_field_count_is_bounded(self, client: TestClient) -> None:
        body = _scenario_body(signals=["IAS 36"] * 50)
        response = client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=body)
        assert response.status_code == 422


class TestFinancialEndpointIsStateless:
    """Rien n'est persisté : ni le scénario, ni le résultat."""

    def test_the_endpoint_never_opens_a_database_connection(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        opened: list[str] = []

        import db.database as database

        original = database.get_db

        def _tracked(*args: object, **kwargs: object):  # pragma: no cover - ne doit pas courir
            opened.append("get_db")
            return original(*args, **kwargs)

        monkeypatch.setattr(database, "get_db", _tracked, raising=True)
        client.post(EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=_scenario_body())
        assert opened == [], "l'évaluation financière ne doit toucher aucune base"

    def test_two_identical_requests_return_identical_payloads(self, client: TestClient) -> None:
        headers = _auth(_token_for(COMPANY_A))
        first = client.post(EVALUATE, headers=headers, json=_scenario_body()).json()
        second = client.post(EVALUATE, headers=headers, json=_scenario_body()).json()
        assert first == second

    def test_amounts_travel_as_decimal_strings(self, client: TestClient) -> None:
        payload = client.post(
            EVALUATE, headers=_auth(_token_for(COMPANY_A)), json=_scenario_body()
        ).json()
        assert isinstance(payload["present_value"], str)
        Decimal(payload["present_value"])


class TestRateLimitRulesDeclared:
    """Les nouvelles routes sont déclarées, pas laissées au fourre-tout."""

    def test_public_surface_is_ip_scoped(self) -> None:
        from middleware.rate_limit import RULES

        rule = RULES["/water-intelligence"]
        assert rule.scope == "ip", "surface publique : portée IP, comme /verify"

    def test_financial_evaluation_is_user_scoped(self) -> None:
        from middleware.rate_limit import RULES

        rule = RULES["/water/financial-scenarios"]
        assert rule.scope == "user"
        assert rule.limit <= 30


class TestNoExternalCall:
    """Le router public ne peut appeler aucun portail."""

    def test_no_http_client_is_imported(self) -> None:
        tree = ast.parse(_ROUTER.read_text(encoding="utf-8"))
        forbidden = {"requests", "httpx", "urllib", "urllib.request", "socket", "aiohttp"}
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
        assert not (imported & forbidden)

    def test_no_database_is_imported_by_the_public_router(self) -> None:
        source = _ROUTER.read_text(encoding="utf-8")
        assert "db.database" not in source
        assert "get_db" not in source
