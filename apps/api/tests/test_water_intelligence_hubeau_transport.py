"""
test_water_intelligence_hubeau_transport.py — socle opérateur Hub'Eau (Wave B).

AUCUNE base requise, AUCUN réseau : le `Fetcher` est toujours un script en
mémoire. L'absence d'import réseau dans le paquet est déjà prouvée par
`test_water_intelligence_pipeline.py::TestNoRealNetworkOrDatabase` (analyse
AST sur `services/water_intelligence/*.py`, qui couvre ce module) ; on la
revérifie ici sur le module lui-même, plus la preuve qu'aucun `Fetcher` par
défaut n'existe — un transport sans transport injecté ne peut rien appeler.

Couvre les neuf cas exigés par le MACRO-PROMPT B — pagination, timeout, retry,
4xx/5xx, limites, domaine refusé, absence de filtre, reprise, logs — plus le
refus de toute URL arbitraire et la redaction systématique des journaux.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

from services.water_intelligence.hubeau_transport import (
    ALLOWED_HOSTS,
    DEFAULT_PAGE_SIZE,
    ENDPOINTS,
    MAX_PAGE_SIZE,
    MAX_RESULT_DEPTH,
    OFFICIAL_HOST,
    REDACTED,
    HubeauBudgetExceeded,
    HubeauEndpointRefused,
    HubeauHostRefused,
    HubeauHttpError,
    HubeauHttpRequest,
    HubeauHttpResponse,
    HubeauQuery,
    HubeauQueryRefused,
    HubeauRetryPolicy,
    HubeauTimeout,
    HubeauTimeoutSignal,
    HubeauTransport,
    HubeauTransportError,
    attribution,
)
from services.water_intelligence.pipeline_transport import TransportError

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "hubeau_transport.py"
)

CHRONICLE_ENDPOINT = "piezometrie.chroniques"
STATION_ENDPOINT = "piezometrie.stations"


# ---------------------------------------------------------------------------
# Fetchers scriptés — aucun réseau, jamais
# ---------------------------------------------------------------------------


def body(record_count: int, *, total: int | None = None) -> bytes:
    payload = {
        "count": total if total is not None else record_count,
        "data": [{"code_bss": f"FIXTURE-{i:04d}"} for i in range(record_count)],
    }
    return json.dumps(payload).encode("utf-8")


class ScriptedFetcher:
    """`Fetcher` piloté par une liste de réponses ou d'exceptions."""

    def __init__(self, script: list[HubeauHttpResponse | Exception]) -> None:
        self._script = list(script)
        self.requests: list[HubeauHttpRequest] = []

    def __call__(self, request: HubeauHttpRequest) -> HubeauHttpResponse:
        self.requests.append(request)
        if not self._script:
            raise AssertionError("Fetcher appelé plus de fois que scripté")
        item = self._script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class RecordingSleeper:
    """Ne dort jamais : enregistre les délais pour que le backoff soit
    vérifiable sans ralentir la suite de tests."""

    def __init__(self) -> None:
        self.delays: list[float] = []

    def __call__(self, seconds: float) -> None:
        self.delays.append(seconds)


def chronicle_query(**overrides) -> HubeauQuery:
    params = {
        "code_bss": "FIXTURE-BSS-0001",
        "date_debut_mesure": "2026-01-01",
        "date_fin_mesure": "2026-01-31",
    }
    params.update(overrides.pop("parameters", {}))
    return HubeauQuery(
        endpoint_key=overrides.pop("endpoint_key", CHRONICLE_ENDPOINT),
        parameters=params,
        page_size=overrides.pop("page_size", 2),
        **overrides,
    )


def make_transport(script, *, query=None, **overrides):
    sleeper = overrides.pop("sleeper", RecordingSleeper())
    fetcher = ScriptedFetcher(script)
    transport = HubeauTransport(
        query=query or chronicle_query(),
        fetcher=fetcher,
        sleeper=sleeper,
        **overrides,
    )
    return transport, fetcher, sleeper


# ---------------------------------------------------------------------------
# Allowlist d'hôtes et endpoints — aucune URL arbitraire
# ---------------------------------------------------------------------------


class TestHostAndEndpointAllowlist:
    def test_official_host_is_the_only_allowed_one(self) -> None:
        assert ALLOWED_HOSTS == frozenset({"hubeau.eaufrance.fr"})
        assert OFFICIAL_HOST == "hubeau.eaufrance.fr"

    @pytest.mark.parametrize(
        "refused_host",
        [
            "hubeau.brgm-rec.fr",          # recette officielle, mais pas la source
            "evil.example.com",
            "hubeau.eaufrance.fr.evil.com",
            "localhost",
        ],
    )
    def test_non_allowlisted_host_is_refused(self, refused_host: str) -> None:
        with pytest.raises(HubeauHostRefused, match="allowlist"):
            chronicle_query(host=refused_host)

    def test_unknown_endpoint_is_refused(self) -> None:
        with pytest.raises(HubeauEndpointRefused, match="non déclaré"):
            chronicle_query(endpoint_key="piezometrie.tout_telecharger")

    def test_composed_url_is_https_on_the_official_host(self) -> None:
        request = chronicle_query().build_request(page=1, timeout_seconds=5.0, attempt=1)

        assert request.url.startswith("https://hubeau.eaufrance.fr/api/")
        assert request.url == "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques"

    def test_module_never_accepts_a_caller_supplied_url(self) -> None:
        """L'URL est COMPOSÉE à partir de l'endpoint déclaré : aucun champ de
        `HubeauQuery` ne permet d'en fournir une."""
        fields = set(HubeauQuery.__dataclass_fields__)

        assert "url" not in fields
        assert fields == {"endpoint_key", "parameters", "page_size", "host"}

    def test_every_declared_endpoint_targets_an_allowlisted_host(self) -> None:
        for key, endpoint in ENDPOINTS.items():
            url = endpoint.url(host=OFFICIAL_HOST)
            assert url.startswith(f"https://{OFFICIAL_HOST}/api/"), key


# ---------------------------------------------------------------------------
# Filtre géographique et fenêtre temporelle obligatoires
# ---------------------------------------------------------------------------


class TestMandatoryBounds:
    def test_missing_geographic_filter_is_refused(self) -> None:
        with pytest.raises(HubeauQueryRefused, match="filtre géographique obligatoire"):
            HubeauQuery(
                endpoint_key=CHRONICLE_ENDPOINT,
                parameters={"date_debut_mesure": "2026-01-01", "date_fin_mesure": "2026-01-31"},
            )

    def test_missing_time_window_on_a_chronicle_is_refused(self) -> None:
        with pytest.raises(HubeauQueryRefused, match="fenêtre temporelle obligatoire"):
            HubeauQuery(
                endpoint_key=CHRONICLE_ENDPOINT,
                parameters={"code_bss": "FIXTURE-BSS-0001"},
            )

    def test_partial_time_window_is_refused(self) -> None:
        with pytest.raises(HubeauQueryRefused, match="fenêtre temporelle obligatoire"):
            HubeauQuery(
                endpoint_key=CHRONICLE_ENDPOINT,
                parameters={"code_bss": "FIXTURE-BSS-0001", "date_debut_mesure": "2026-01-01"},
            )

    def test_referential_endpoint_needs_no_time_window(self) -> None:
        query = HubeauQuery(
            endpoint_key=STATION_ENDPOINT, parameters={"code_departement": "34"}
        )

        assert query.endpoint.requires_time_window is False

    def test_unknown_parameter_is_refused(self) -> None:
        with pytest.raises(HubeauQueryRefused, match="non déclaré"):
            chronicle_query(parameters={"tout": "oui"})

    def test_caller_cannot_drive_pagination_parameters(self) -> None:
        for forbidden in ("page", "size"):
            with pytest.raises(HubeauQueryRefused, match="pilotés par le socle"):
                chronicle_query(parameters={forbidden: "9999"})

    @pytest.mark.parametrize("bad_size", [0, -1, MAX_PAGE_SIZE + 1])
    def test_invalid_page_size_is_refused(self, bad_size: int) -> None:
        with pytest.raises(HubeauQueryRefused, match="hors bornes"):
            chronicle_query(page_size=bad_size)

    def test_every_chronicle_endpoint_requires_both_bounds(self) -> None:
        """Invariant de conception : toute chronique déclarée impose fenêtre
        temporelle ET filtre géographique."""
        for key, endpoint in ENDPOINTS.items():
            if endpoint.requires_time_window:
                assert endpoint.time_window_parameters is not None, key
                assert endpoint.requires_geographic_filter, key


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class TestPagination:
    def test_full_page_announces_a_next_page(self) -> None:
        transport, _, _ = make_transport([HubeauHttpResponse(200, body(2))])

        page = transport.fetch_page(page_token=None)

        assert page.page_number == 1
        assert page.has_next_page is True
        assert page.next_page_token == "2"

    def test_partial_page_ends_pagination(self) -> None:
        transport, _, _ = make_transport([HubeauHttpResponse(200, body(1))])

        page = transport.fetch_page(page_token=None)

        assert page.has_next_page is False
        assert page.next_page_token is None

    def test_pagination_increments_the_page_parameter(self) -> None:
        transport, fetcher, _ = make_transport(
            [HubeauHttpResponse(200, body(2)), HubeauHttpResponse(200, body(1))]
        )

        first = transport.fetch_page(page_token=None)
        transport.fetch_page(page_token=first.next_page_token)

        pages = [dict(r.params)["page"] for r in fetcher.requests]
        assert pages == ["1", "2"]

    def test_response_next_url_is_never_followed(self) -> None:
        """Hub'Eau renvoie un champ `next` contenant une URL complète. Le
        suivre laisserait la réponse choisir la cible suivante — exactement ce
        que l'allowlist interdit."""
        malicious = json.dumps({
            "count": 99,
            "next": "https://evil.example.com/api/v1/niveaux_nappes/chroniques?page=2",
            "data": [{"code_bss": "A"}, {"code_bss": "B"}],
        }).encode("utf-8")
        transport, fetcher, _ = make_transport(
            [HubeauHttpResponse(200, malicious), HubeauHttpResponse(200, body(0))]
        )

        first = transport.fetch_page(page_token=None)
        transport.fetch_page(page_token=first.next_page_token)

        assert all(r.url.startswith(f"https://{OFFICIAL_HOST}/") for r in fetcher.requests)
        assert not any("evil.example.com" in r.url for r in fetcher.requests)

    def test_page_token_must_be_a_page_number_not_a_url(self) -> None:
        transport, _, _ = make_transport([])

        with pytest.raises(HubeauQueryRefused, match="jamais une URL"):
            transport.fetch_page(page_token="https://evil.example.com/page/2")

    def test_unreadable_body_fails_explicitly(self) -> None:
        transport, _, _ = make_transport([HubeauHttpResponse(200, b"<html>oops</html>")])

        with pytest.raises(HubeauTransportError, match="illisible en JSON"):
            transport.fetch_page(page_token=None)

    def test_body_without_data_array_fails_explicitly(self) -> None:
        payload = json.dumps({"count": 3}).encode("utf-8")
        transport, _, _ = make_transport([HubeauHttpResponse(200, payload)])

        with pytest.raises(HubeauTransportError, match="sans tableau"):
            transport.fetch_page(page_token=None)


# ---------------------------------------------------------------------------
# Timeout, retry, backoff, statuts HTTP
# ---------------------------------------------------------------------------


class TestRetryAndErrors:
    def test_timeout_is_retried_then_reported(self) -> None:
        script = [HubeauTimeoutSignal("lent"), HubeauTimeoutSignal("lent"), HubeauTimeoutSignal("lent")]
        transport, fetcher, sleeper = make_transport(script)

        with pytest.raises(HubeauTimeout, match="timeout"):
            transport.fetch_page(page_token=None)

        assert len(fetcher.requests) == 3
        assert sleeper.delays == [0.5, 1.0]

    def test_timeout_then_success_recovers(self) -> None:
        transport, fetcher, _ = make_transport(
            [HubeauTimeoutSignal("lent"), HubeauHttpResponse(200, body(1))]
        )

        page = transport.fetch_page(page_token=None)

        assert page.page_number == 1
        assert len(fetcher.requests) == 2

    def test_retryable_5xx_is_retried_then_reported(self) -> None:
        script = [HubeauHttpResponse(503, b""), HubeauHttpResponse(503, b"")]
        transport, fetcher, _ = make_transport(
            script, retry_policy=HubeauRetryPolicy(max_attempts=2)
        )

        with pytest.raises(HubeauHttpError) as excinfo:
            transport.fetch_page(page_token=None)

        assert excinfo.value.status_code == 503
        assert len(fetcher.requests) == 2

    def test_non_retryable_4xx_is_not_retried(self) -> None:
        """Rejouer une requête invalide produirait le même refus."""
        transport, fetcher, _ = make_transport([HubeauHttpResponse(400, b"")])

        with pytest.raises(HubeauHttpError, match="non réessayable"):
            transport.fetch_page(page_token=None)

        assert len(fetcher.requests) == 1

    def test_retry_is_bounded(self) -> None:
        policy = HubeauRetryPolicy(max_attempts=2)
        transport, fetcher, _ = make_transport(
            [HubeauHttpResponse(500, b""), HubeauHttpResponse(500, b"")],
            retry_policy=policy,
        )

        with pytest.raises(HubeauHttpError):
            transport.fetch_page(page_token=None)

        assert len(fetcher.requests) == policy.max_attempts

    def test_backoff_is_exponential_and_starts_at_zero(self) -> None:
        policy = HubeauRetryPolicy(max_attempts=4, initial_backoff_seconds=1.0, backoff_factor=2.0)

        assert policy.delay_before(1) == 0.0
        assert policy.delay_before(2) == 1.0
        assert policy.delay_before(3) == 2.0
        assert policy.delay_before(4) == 4.0

    def test_invalid_retry_policy_is_refused(self) -> None:
        with pytest.raises(HubeauQueryRefused):
            HubeauRetryPolicy(max_attempts=0)
        with pytest.raises(HubeauQueryRefused):
            HubeauRetryPolicy(backoff_factor=0.5)

    def test_transport_errors_are_caught_at_the_fetch_stage(self) -> None:
        """Toute erreur du socle est un `TransportError` : `run_pipeline()` la
        transforme en rapport, jamais en exception nue (contrat P03)."""
        for error_type in (
            HubeauHostRefused, HubeauEndpointRefused, HubeauQueryRefused,
            HubeauBudgetExceeded, HubeauHttpError, HubeauTimeout,
        ):
            assert issubclass(error_type, TransportError)

    def test_timeout_signal_is_not_a_transport_error(self) -> None:
        """Signal interne du `Fetcher` vers le socle — c'est le socle qui
        décide s'il reste des tentatives, pas le `Fetcher`."""
        assert not issubclass(HubeauTimeoutSignal, TransportError)


# ---------------------------------------------------------------------------
# Limites et budgets
# ---------------------------------------------------------------------------


class TestBudgets:
    def test_page_limit_is_enforced(self) -> None:
        transport, _, _ = make_transport(
            [HubeauHttpResponse(200, body(2)), HubeauHttpResponse(200, body(2))],
            max_pages=1,
        )

        transport.fetch_page(page_token=None)

        with pytest.raises(HubeauBudgetExceeded, match="limite de pages"):
            transport.fetch_page(page_token="2")

    def test_byte_budget_is_enforced(self) -> None:
        transport, _, _ = make_transport(
            [HubeauHttpResponse(200, body(2))], max_total_bytes=10
        )

        with pytest.raises(HubeauBudgetExceeded, match="budget d'octets"):
            transport.fetch_page(page_token=None)

    def test_result_depth_limit_matches_the_documented_platform_limit(self) -> None:
        assert MAX_RESULT_DEPTH == 20_000
        assert MAX_PAGE_SIZE == 20_000
        assert DEFAULT_PAGE_SIZE == 5_000

    def test_depth_limit_is_refused_when_composing_the_request(self) -> None:
        query = chronicle_query(page_size=10_000)

        with pytest.raises(HubeauBudgetExceeded, match="profondeur d'accès"):
            query.build_request(page=3, timeout_seconds=5.0, attempt=1)

    def test_max_page_number_derives_from_the_depth_limit(self) -> None:
        assert chronicle_query(page_size=10_000).max_page_number == 2
        assert chronicle_query(page_size=1_000).max_page_number == 20

    def test_pagination_stops_before_exceeding_the_depth_limit(self) -> None:
        query = chronicle_query(page_size=10_000)
        transport, _, _ = make_transport(
            [HubeauHttpResponse(200, body(10_000))], query=query, max_pages=10
        )

        page = transport.fetch_page(page_token=None)

        # 2 pages × 10 000 = 20 000 = plafond : pas de 3e page annoncée.
        assert page.has_next_page is True
        second, _, _ = make_transport(
            [HubeauHttpResponse(200, body(10_000))], query=query, max_pages=10
        )
        assert second.fetch_page(page_token="2").has_next_page is False

    def test_invalid_transport_bounds_are_refused(self) -> None:
        for kwargs in ({"max_pages": 0}, {"max_total_bytes": 0}, {"timeout_seconds": 0}):
            with pytest.raises(HubeauQueryRefused):
                make_transport([], **kwargs)


# ---------------------------------------------------------------------------
# Reprise contrôlée
# ---------------------------------------------------------------------------


class TestResume:
    def test_resume_starts_at_the_requested_page(self) -> None:
        transport, fetcher, _ = make_transport([HubeauHttpResponse(200, body(1))])

        page = transport.fetch_page(page_token="4")

        assert page.page_number == 4
        assert dict(fetcher.requests[0].params)["page"] == "4"

    def test_resume_does_not_refetch_earlier_pages(self) -> None:
        transport, fetcher, _ = make_transport([HubeauHttpResponse(200, body(1))])

        transport.fetch_page(page_token="3")

        assert len(fetcher.requests) == 1
        assert transport.pages_fetched == 1

    @pytest.mark.parametrize("bad_token", ["0", "-1", "abc", ""])
    def test_invalid_resume_token_is_refused(self, bad_token: str) -> None:
        transport, _, _ = make_transport([])

        with pytest.raises(HubeauQueryRefused, match="page_token invalide"):
            transport.fetch_page(page_token=bad_token)


# ---------------------------------------------------------------------------
# Journal — jamais de secret, jamais de contenu
# ---------------------------------------------------------------------------


class TestLogging:
    def test_every_attempt_is_recorded(self) -> None:
        transport, _, _ = make_transport(
            [HubeauHttpResponse(503, b""), HubeauHttpResponse(200, body(1))]
        )

        transport.fetch_page(page_token=None)

        assert [r.attempt for r in transport.call_records] == [1, 2]
        assert [r.status_code for r in transport.call_records] == [503, 200]

    def test_log_never_contains_the_response_body(self) -> None:
        """Le journal porte l'IDENTITÉ de l'appel (URL, paramètres, statut,
        taille) — jamais le CONTENU reçu. Le corps est marqué d'une valeur
        distinctive, absente des paramètres de requête, pour que le test
        distingue les deux."""
        marked = json.dumps({
            "count": 1,
            "data": [{"code_bss": "FIXTURE-0000", "valeur_confidentielle": "MARQUEUR-CORPS-42"}],
        }).encode("utf-8")
        transport, _, _ = make_transport([HubeauHttpResponse(200, marked)])

        transport.fetch_page(page_token=None)

        record = transport.call_records[0]
        assert not hasattr(record, "body")
        assert record.bytes_received == len(marked)
        serialised = json.dumps(record.__dict__, default=str)
        assert "MARQUEUR-CORPS-42" not in serialised
        assert "valeur_confidentielle" not in serialised

    def test_secret_looking_parameters_are_redacted(self) -> None:
        """Hub'Eau n'attend aucun secret, mais la redaction est appliquée par
        construction plutôt que par confiance."""
        request = HubeauHttpRequest(
            url=f"https://{OFFICIAL_HOST}/api/v1/niveaux_nappes/chroniques",
            params=(("api_key", "s3cr3t"), ("token", "abc"), ("code_bss", "FIXTURE-BSS-0001")),
            timeout_seconds=5.0,
            attempt=1,
        )

        redacted = dict(request.redacted_params())

        assert redacted["api_key"] == REDACTED
        assert redacted["token"] == REDACTED
        assert redacted["code_bss"] == "FIXTURE-BSS-0001"

    def test_timeout_is_recorded_with_its_reason(self) -> None:
        transport, _, _ = make_transport(
            [HubeauTimeoutSignal("lent"), HubeauHttpResponse(200, body(1))]
        )

        transport.fetch_page(page_token=None)

        first = transport.call_records[0]
        assert first.status_code is None
        assert first.error is not None and "timeout" in first.error

    def test_attribution_cites_the_publishers_and_the_licence(self) -> None:
        text = attribution(accessed_on="2026-07-24")

        assert "Office français de la biodiversité (OFB)" in text
        assert "Licence Ouverte" in text
        assert "2026-07-24" in text


# ---------------------------------------------------------------------------
# Absence de réseau — preuve structurelle
# ---------------------------------------------------------------------------


class TestNoNetworkByConstruction:
    @staticmethod
    def _imported_roots(path: Path) -> set[str]:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                roots.add(node.module.split(".")[0])
        return roots

    def test_socle_imports_no_http_client(self) -> None:
        forbidden = {
            "requests", "httpx", "urllib", "urllib3", "socket", "aiohttp",
            "http", "ftplib", "telnetlib",
        }
        assert not (self._imported_roots(MODULE_PATH) & forbidden)

    def test_socle_imports_no_database_module(self) -> None:
        forbidden = {"db", "psycopg", "psycopg2", "sqlalchemy"}
        assert not (self._imported_roots(MODULE_PATH) & forbidden)

    def test_transport_has_no_default_fetcher(self) -> None:
        """Sans `Fetcher` injecté, le transport ne peut rien appeler : c'est
        ce qui rend l'absence d'appel structurelle et non déclarative."""
        with pytest.raises(TypeError):
            HubeauTransport(query=chronicle_query())  # type: ignore[call-arg]

    def test_no_url_literal_other_than_the_official_host(self) -> None:
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf-8"))
        urls = [
            node.value
            for node in ast.walk(tree)
            if isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and node.value.startswith(("http://", "https://"))
        ]

        assert not urls, f"URL littérale dans le socle : {urls}"
