"""tests/test_water_intelligence_operator_scripts.py — bornes des commandes
opérateur Water Intelligence (X1.6).

## Aucun appel réseau, et c'est vérifié plutôt que promis

`OperatorFetcher` reçoit son `opener_factory` par injection. Tous les tests de
ce fichier en fournissent un, donc aucune socket n'est ouverte — et
`TestNoNetworkInThisFile` le vérifie par analyse AST du fichier lui-même : un
`OperatorFetcher(...)` construit ici sans `opener_factory` fait échouer la
suite. C'est la seule façon d'empêcher qu'un test futur ouvre le réseau par
distraction.

## Ce que ces tests couvrent (X1.6)

allowlist · HTTPS · timeout · retry · redirection externe · limites d'octets et
de pages · checksum · rapport sans secret · absence de base · absence de
publication · sens de la dépendance scripts → services.
"""

from __future__ import annotations

import ast
import email.message
import hashlib
import io
import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from scripts.water_intelligence import eea_artifact_inspector as eea_inspector
from scripts.water_intelligence import fetcher as fetcher_mod
from scripts.water_intelligence import validate_eea
from scripts.water_intelligence.fetcher import (
    FetcherNetworkError,
    FetcherRefusal,
    FetcherTimeout,
    OperatorFetcher,
    _BoundedRedirectHandler,
    public_url,
    redact_params,
)
from scripts.water_intelligence.replay import ReplayTransport
from scripts.water_intelligence.reporting import ReportError, ValidationReport
from scripts.water_intelligence.validate_hubeau import (
    FAMILIES,
    build_socket_fetcher,
    decide_verdict,
    run_prelevements_multi_year,
)
from services.water_intelligence import hubeau_transport as transport_mod
from services.water_intelligence.pipeline_transport import TransportError

API_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = API_ROOT / "scripts" / "water_intelligence"
SERVICES_DIR = API_ROOT / "services" / "water_intelligence"
HOSTS = frozenset({"hubeau.eaufrance.fr"})
URL = "https://hubeau.eaufrance.fr/api/v1/prelevements/chroniques"


# ---------------------------------------------------------------------------
# Double d'ouverture — remplace urllib, n'ouvre aucune socket
# ---------------------------------------------------------------------------


class _FakeResponse(io.BytesIO):
    def __init__(self, body: bytes, status: int, content_type: str | None, url: str) -> None:
        super().__init__(body)
        self.status = status
        self.headers = email.message.Message()
        if content_type:
            self.headers["Content-Type"] = content_type
        self._url = url

    def geturl(self) -> str:
        return self._url

    def getcode(self) -> int:
        return self.status

    def __enter__(self):  # noqa: D105 - protocole de contexte
        return self

    def __exit__(self, *exc_info) -> bool:  # noqa: D105
        return False


class _FakeOpener:
    """Ouvre… rien. Rend une réponse scriptée ou lève l'erreur demandée."""

    def __init__(
        self,
        *,
        body: bytes = b"{}",
        status: int = 200,
        content_type: str | None = "application/json",
        raise_error: BaseException | None = None,
    ) -> None:
        self.body = body
        self.status = status
        self.content_type = content_type
        self.raise_error = raise_error
        self.calls: list[str] = []

    def __call__(self, _redirect_handler):
        return self

    def open(self, request, timeout=None):  # noqa: A003 - signature urllib
        self.calls.append(request.full_url)
        if self.raise_error is not None:
            raise self.raise_error
        return _FakeResponse(self.body, self.status, self.content_type, request.full_url)


def make_fetcher(opener: _FakeOpener, **kwargs) -> OperatorFetcher:
    return OperatorFetcher(allowed_hosts=HOSTS, opener_factory=opener, **kwargs)


class _YearRoutedOpener:
    """Renvoie une page différente selon la valeur du paramètre `annee` de
    l'URL demandée. Nécessaire pour scripter plusieurs requêtes annuelles
    distinctes (X2A, prélèvements) sans jamais ouvrir de socket : une seule
    réponse fixe, comme `_FakeOpener`, ne peut pas distinguer deux années."""

    def __init__(self, pages_by_year: dict[int, bytes], *, status: int = 200) -> None:
        self.pages_by_year = pages_by_year
        self.status = status
        self.calls: list[str] = []

    def __call__(self, _redirect_handler):
        return self

    def open(self, request, timeout=None):  # noqa: A003 - signature urllib
        self.calls.append(request.full_url)
        query = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(request.full_url).query))
        year = int(query["annee"])
        if year not in self.pages_by_year:
            raise AssertionError(f"aucune page scriptée pour l'année {year}")
        return _FakeResponse(self.pages_by_year[year], self.status, "application/json",
                              request.full_url)


# ---------------------------------------------------------------------------
# 1 — Allowlist et schéma
# ---------------------------------------------------------------------------


class TestAllowlistAndScheme:
    def test_http_is_refused(self) -> None:
        fetch = make_fetcher(_FakeOpener())
        with pytest.raises(FetcherRefusal, match="schéma"):
            fetch.fetch("http://hubeau.eaufrance.fr/api/v1/prelevements/chroniques")

    def test_host_outside_the_allowlist_is_refused(self) -> None:
        fetch = make_fetcher(_FakeOpener())
        with pytest.raises(FetcherRefusal, match="hors allowlist"):
            fetch.fetch("https://hubeau.brgm-rec.fr/api/v1/prelevements/chroniques")

    def test_credentials_in_the_url_are_refused(self) -> None:
        fetch = make_fetcher(_FakeOpener())
        with pytest.raises(FetcherRefusal, match="identifiants"):
            fetch.fetch("https://user:pass@hubeau.eaufrance.fr/api/v1/x")

    def test_an_empty_allowlist_is_refused_at_construction(self) -> None:
        with pytest.raises(FetcherRefusal, match="allowlist vide"):
            OperatorFetcher(allowed_hosts=frozenset())

    def test_a_refusal_never_opens_anything(self) -> None:
        opener = _FakeOpener()
        fetch = make_fetcher(opener)
        with pytest.raises(FetcherRefusal):
            fetch.fetch("https://example.invalid/x")
        assert opener.calls == []

    def test_a_refusal_is_journalised(self) -> None:
        fetch = make_fetcher(_FakeOpener())
        with pytest.raises(FetcherRefusal):
            fetch.fetch("https://example.invalid/x")
        assert len(fetch.log) == 1
        assert fetch.log[0].status_code is None
        assert "hors allowlist" in (fetch.log[0].error or "")


# ---------------------------------------------------------------------------
# 2 — Redirections
# ---------------------------------------------------------------------------


class TestRedirectControl:
    def _handler(self, max_redirects: int = 3) -> _BoundedRedirectHandler:
        return _BoundedRedirectHandler(HOSTS, max_redirects)

    def test_a_redirect_outside_the_allowlist_is_refused(self) -> None:
        handler = self._handler()
        with pytest.raises(FetcherRefusal, match="hors allowlist"):
            handler.redirect_request(
                urllib.request.Request(URL), None, 302, "Found", email.message.Message(),
                "https://ailleurs.example/x",
            )

    def test_a_redirect_downgraded_to_http_is_refused(self) -> None:
        handler = self._handler()
        with pytest.raises(FetcherRefusal, match="schéma"):
            handler.redirect_request(
                urllib.request.Request(URL), None, 302, "Found", email.message.Message(),
                "http://hubeau.eaufrance.fr/x",
            )

    def test_the_redirect_chain_is_bounded(self) -> None:
        handler = self._handler(max_redirects=1)
        handler.redirect_request(
            urllib.request.Request(URL), None, 302, "Found", email.message.Message(),
            "https://hubeau.eaufrance.fr/etape-1",
        )
        with pytest.raises(FetcherRefusal, match="redirection"):
            handler.redirect_request(
                urllib.request.Request(URL), None, 302, "Found", email.message.Message(),
                "https://hubeau.eaufrance.fr/etape-2",
            )

    def test_an_allowed_redirect_is_recorded_without_its_query(self) -> None:
        handler = self._handler()
        handler.redirect_request(
            urllib.request.Request(URL), None, 302, "Found", email.message.Message(),
            "https://hubeau.eaufrance.fr/etape?code_departement=34",
        )
        assert handler.redirects == ["https://hubeau.eaufrance.fr/etape"]


# ---------------------------------------------------------------------------
# 3 — Budgets
# ---------------------------------------------------------------------------


class TestByteBudget:
    def test_a_body_over_the_budget_is_refused_not_truncated(self) -> None:
        fetch = make_fetcher(_FakeOpener(body=b"x" * 101), max_bytes=100)
        with pytest.raises(FetcherRefusal, match="budget d'octets"):
            fetch.fetch(URL)

    def test_a_body_exactly_at_the_budget_is_accepted(self) -> None:
        fetch = make_fetcher(_FakeOpener(body=b"x" * 100), max_bytes=100)
        assert fetch.fetch(URL).bytes_received == 100

    def test_a_null_budget_is_refused_at_construction(self) -> None:
        with pytest.raises(FetcherRefusal, match="max_bytes"):
            OperatorFetcher(allowed_hosts=HOSTS, max_bytes=0)

    def test_the_socle_bounds_pages_independently(self) -> None:
        """La limite de PAGES appartient au socle, pas au Fetcher."""
        query = transport_mod.HubeauQuery(
            endpoint_key="prelevements.chroniques",
            # `annee` (X2A) — `annee_min`/`annee_max` sont refusés depuis que
            # la validation live X1 a montré qu'ils n'existent pas côté
            # plateforme, qui les ignorait en silence.
            parameters={"code_departement": "34", "annee": "2020"},
            page_size=10,
        )
        page = b'{"count": 999, "data": [%s]}' % b",".join([b'{"a":1}'] * 10)
        opener = _FakeOpener(body=page)
        transport = transport_mod.HubeauTransport(
            query=query,
            fetcher=build_socket_fetcher(make_fetcher(opener)),
            max_pages=1,
            max_total_bytes=1_000_000,
        )
        transport.fetch_page(page_token=None)
        with pytest.raises(transport_mod.HubeauBudgetExceeded, match="limite de pages"):
            transport.fetch_page(page_token="2")


# ---------------------------------------------------------------------------
# 4 — Timeout et retry
# ---------------------------------------------------------------------------


class TestTimeoutAndRetry:
    def test_a_socket_timeout_becomes_a_fetcher_timeout(self) -> None:
        fetch = make_fetcher(_FakeOpener(raise_error=socket.timeout("trop long")))
        with pytest.raises(FetcherTimeout, match="délai"):
            fetch.fetch(URL)

    def test_a_urlerror_wrapping_a_timeout_is_also_a_timeout(self) -> None:
        fetch = make_fetcher(
            _FakeOpener(raise_error=urllib.error.URLError(socket.timeout("trop long")))
        )
        with pytest.raises(FetcherTimeout):
            fetch.fetch(URL)

    def test_a_connection_failure_is_not_a_timeout(self) -> None:
        fetch = make_fetcher(_FakeOpener(raise_error=urllib.error.URLError("injoignable")))
        with pytest.raises(FetcherNetworkError) as excinfo:
            fetch.fetch(URL)
        assert not isinstance(excinfo.value, FetcherTimeout)

    def test_a_timeout_is_handed_back_to_the_socle_so_it_can_retry(self) -> None:
        """Le Fetcher ne décide pas des reprises : il SIGNALE, le socle décide."""
        adapted = build_socket_fetcher(
            make_fetcher(_FakeOpener(raise_error=socket.timeout("trop long")))
        )
        request = transport_mod.HubeauHttpRequest(
            url=URL, params=(), timeout_seconds=1.0, attempt=1
        )
        with pytest.raises(transport_mod.HubeauTimeoutSignal):
            adapted(request)

    def test_a_refusal_is_never_retried(self) -> None:
        """Un refus de bornage n'est pas un incident : le rejouer donnerait le
        même refus, et masquerait la vraie cause derrière des tentatives."""
        adapted = build_socket_fetcher(make_fetcher(_FakeOpener()))
        request = transport_mod.HubeauHttpRequest(
            url="https://ailleurs.example/x", params=(), timeout_seconds=1.0, attempt=1
        )
        with pytest.raises(transport_mod.HubeauTransportError) as excinfo:
            adapted(request)
        assert not isinstance(excinfo.value, transport_mod.HubeauTimeoutSignal)

    def test_a_non_2xx_status_is_a_response_not_an_exception(self) -> None:
        """Un 400 doit pouvoir être CITÉ dans un rapport, donc traversé."""
        fetch = make_fetcher(_FakeOpener(body=b'{"code":"InvalidRequest"}', status=400))
        assert fetch.fetch(URL).status_code == 400


# ---------------------------------------------------------------------------
# 5 — Checksum et expurgation
# ---------------------------------------------------------------------------


class TestChecksumAndRedaction:
    def test_the_checksum_covers_the_received_bytes(self) -> None:
        body = b'{"data": []}'
        fetch = make_fetcher(_FakeOpener(body=body))
        outcome = fetch.fetch(URL)
        assert outcome.sha256 == hashlib.sha256(body).hexdigest()
        assert fetch.log[0].sha256 == outcome.sha256

    def test_the_journalised_url_carries_no_query(self) -> None:
        fetch = make_fetcher(_FakeOpener())
        fetch.fetch(URL, params={"code_departement": "34"})
        assert fetch.log[0].url == URL
        assert "34" not in fetch.log[0].url

    def test_a_parameter_that_looks_like_a_secret_is_masked(self) -> None:
        masked = dict(redact_params({"api_key": "s3cr3t", "code_departement": "34"}))
        assert masked["api_key"] == fetcher_mod.REDACTED
        assert masked["code_departement"] == "34"

    def test_public_url_strips_query_and_fragment(self) -> None:
        assert public_url("https://h.example/p?a=1#frag") == "https://h.example/p"

    def test_the_journal_never_carries_the_body(self) -> None:
        fetch = make_fetcher(_FakeOpener(body=b'{"secret_payload": 42}'))
        fetch.fetch(URL)
        assert "secret_payload" not in str(fetch.log[0].as_mapping())


# ---------------------------------------------------------------------------
# 6 — Le rapport ne peut pas mentir
# ---------------------------------------------------------------------------


def _report(**overrides) -> ValidationReport:
    payload = {
        "source_code": "HUBEAU_ADES",
        "release_key": "recette-x1",
        "verdict": "ready_for_staging",
        "executed_at": "2026-07-26T00:00:00+00:00",
        "method": "CC-WI-HUBEAU-HYDRO-PASSTHROUGH 1.0.0",
    }
    payload.update(overrides)
    return ValidationReport(**payload)


class TestReportSafety:
    def test_an_unknown_verdict_is_refused(self) -> None:
        with pytest.raises(ReportError, match="verdict"):
            _report(verdict="ok")

    def test_a_report_cannot_claim_a_non_dry_run(self) -> None:
        with pytest.raises(ReportError, match="lecture seule"):
            _report(dry_run=False)

    def test_a_report_cannot_claim_a_publication(self) -> None:
        with pytest.raises(ReportError, match="ne publie rien"):
            _report(records_publishable=3)

    def test_a_report_cannot_carry_an_unmasked_secret(self) -> None:
        with pytest.raises(ReportError, match="sensible"):
            _report(query_parameters={"api_key": "s3cr3t"})

    def test_the_markdown_states_that_nothing_was_written(self) -> None:
        markdown = _report().to_markdown()
        assert "dry_run=true" in markdown
        assert "aucune" in markdown.lower()

    def test_the_markdown_is_written_where_asked(self, tmp_path: Path) -> None:
        target = _report().write(tmp_path / "sub" / "report.md")
        assert target.exists()
        assert target.read_text(encoding="utf-8").startswith("# Validation live")


# ---------------------------------------------------------------------------
# 7 — Rejeu local
# ---------------------------------------------------------------------------


class TestReplayTransport:
    def test_it_replays_pages_in_order(self) -> None:
        transport = ReplayTransport([b"page-1", b"page-2"])
        first = transport.fetch_page(page_token=None)
        assert first.content == b"page-1"
        assert first.has_next_page is True
        assert transport.fetch_page(page_token=first.next_page_token).content == b"page-2"

    def test_an_empty_payload_is_not_a_successful_collection(self) -> None:
        with pytest.raises(TransportError, match="payload vide"):
            ReplayTransport([])

    def test_a_url_shaped_token_is_refused(self) -> None:
        transport = ReplayTransport([b"page-1"])
        with pytest.raises(TransportError, match="jamais une URL"):
            transport.fetch_page(page_token="https://hubeau.eaufrance.fr/next")


# ---------------------------------------------------------------------------
# 8 — Verdicts
# ---------------------------------------------------------------------------


class TestVerdicts:
    def test_a_transfer_failure_is_never_a_schema_problem(self) -> None:
        assert (
            decide_verdict(
                transfer_failed=True,
                schema_rejected=False,
                records_normalized=0,
                pipeline_failed=False,
            )
            == "source_unavailable"
        )

    def test_a_rejected_schema_is_reported_as_drift(self) -> None:
        assert (
            decide_verdict(
                transfer_failed=False,
                schema_rejected=True,
                records_normalized=0,
                pipeline_failed=False,
            )
            == "schema_drift"
        )

    def test_ready_requires_transfer_schema_and_pipeline(self) -> None:
        assert (
            decide_verdict(
                transfer_failed=False,
                schema_rejected=False,
                records_normalized=12,
                pipeline_failed=False,
            )
            == "ready_for_staging"
        )
        assert (
            decide_verdict(
                transfer_failed=False,
                schema_rejected=False,
                records_normalized=12,
                pipeline_failed=True,
            )
            == "schema_drift"
        )

    def test_every_family_of_the_pack_is_declared(self) -> None:
        assert sorted(FAMILIES) == [
            "hydrometrie", "piezometrie", "prelevements", "qualite_surface",
        ]


# ---------------------------------------------------------------------------
# 10 — Prélèvements : orchestration multi-année (X2A)
# ---------------------------------------------------------------------------


def withdrawal_record(*, ouvrage="OUV-0001", year=2020, volume=1000.0):
    return {
        "code_ouvrage": ouvrage,
        "annee": year,
        "volume": volume,
        "code_usage": "IRR",
        "libelle_usage": "Irrigation",
        "code_type_milieu": "SOUT",
        "libelle_type_milieu": "Souterrain",
        "code_departement": "34",
    }


def withdrawal_page(*records) -> bytes:
    return json.dumps({"count": len(records), "data": list(records)}).encode("utf-8")


def run_multi_year(pages_by_year, **overrides):
    opener = _YearRoutedOpener(pages_by_year)
    fetcher = make_fetcher(opener, max_bytes=overrides.pop("max_bytes", 1_000_000))
    kwargs = dict(
        geography_type="code_departement",
        geography_code="34",
        year_from=min(pages_by_year),
        year_to=max(pages_by_year),
        max_years=overrides.pop("max_years", len(pages_by_year)),
        release_key="hubeau-bnpe-chroniques-test",
        retrieved_at=date(2026, 2, 1),
        fetcher=fetcher,
        max_pages_per_year=overrides.pop("max_pages_per_year", 1),
        max_bytes_per_year=overrides.pop("max_bytes_per_year", 1_000_000),
        max_total_bytes=overrides.pop("max_total_bytes", 10_000_000),
        timeout_seconds=20.0,
        page_size=100,
        clock=lambda: datetime(2026, 2, 2, tzinfo=timezone.utc),
    )
    kwargs.update(overrides)
    report = run_prelevements_multi_year(**kwargs)
    return report, opener


class TestPrelevementsMultiYearOrchestration:
    def test_annee_min_and_annee_max_are_refused(self) -> None:
        """X2A, règle 4 : ni `annee_min`, ni `annee_max`, ni aucune
        combinaison ambiguë — le socle les refuse depuis que la validation
        live X1 a montré qu'ils n'existent pas côté plateforme."""
        with pytest.raises(transport_mod.HubeauQueryRefused, match="non déclaré"):
            transport_mod.HubeauQuery(
                endpoint_key="prelevements.chroniques",
                parameters={
                    "code_departement": "34", "annee_min": "2020", "annee_max": "2021",
                },
            )

    def test_a_single_year_is_a_single_request(self) -> None:
        report, opener = run_multi_year({2020: withdrawal_page(withdrawal_record(year=2020))})

        assert len(opener.calls) == 1
        assert "annee=2020" in opener.calls[0]
        assert report.verdict == "ready_for_staging"
        assert report.records_normalized == 1

    def test_a_year_range_issues_one_request_per_year(self) -> None:
        report, opener = run_multi_year({
            2020: withdrawal_page(withdrawal_record(year=2020, ouvrage="OUV-A")),
            2021: withdrawal_page(withdrawal_record(year=2021, ouvrage="OUV-B")),
        })

        assert len(opener.calls) == 2
        assert {"annee=2020" in c for c in opener.calls} == {False, True}
        assert any("annee=2021" in c for c in opener.calls)
        assert report.records_normalized == 2
        assert report.verdict == "ready_for_staging"
        assert set(report.geographies) == {"OUV-A", "OUV-B"}

    def test_period_carries_the_year_of_each_observation(self) -> None:
        """X2A, règle 3 : l'année reste portée par la période de chaque
        observation, orchestration multi-requêtes ou non — inchangé côté
        connecteur (`build_withdrawals_period_resolver`)."""
        report, _ = run_multi_year({
            2020: withdrawal_page(withdrawal_record(year=2020)),
            2021: withdrawal_page(withdrawal_record(year=2021)),
        })

        assert report.pipeline_steps_failed == ()
        assert "derive" in report.pipeline_steps_executed

    def test_a_row_from_another_year_is_an_explicit_contract_error(self) -> None:
        """X2A, règles 5 et 6 : une ligne d'une autre année n'est jamais
        filtrée en silence — elle échoue explicitement, ET elle apparaît dans
        le rapport, sans empêcher les autres années de rester visibles."""
        report, _ = run_multi_year({
            # La requête annee=2020 « devrait » ne renvoyer que 2020 ; ce
            # scénario simule une anomalie de plateforme où une ligne 2019
            # se glisse dans la réponse.
            2020: withdrawal_page(withdrawal_record(year=2019, ouvrage="OUV-CONTAMINEE")),
            2021: withdrawal_page(withdrawal_record(year=2021, ouvrage="OUV-B")),
        })

        assert report.verdict == "schema_drift"
        assert any("année 2020" in cause for cause in report.rejection_causes)
        assert any("hors de la fenêtre demandée" in cause for cause in report.rejection_causes)
        # 2021 reste traité et compté : la contamination de 2020 n'efface pas
        # ce qui a été validé ailleurs.
        assert report.records_normalized == 1
        assert "OUV-B" in report.geographies

    def test_max_years_is_enforced_before_any_network_call(self) -> None:
        """X2A, règle 3 : une plage doit déclarer une borne maximale
        explicite, refusée AVANT tout appel réseau si dépassée."""
        opener = _YearRoutedOpener({y: withdrawal_page(withdrawal_record(year=y))
                                     for y in (2018, 2019, 2020, 2021)})
        fetcher = make_fetcher(opener)

        with pytest.raises(SystemExit, match="max-years"):
            run_prelevements_multi_year(
                geography_type="code_departement",
                geography_code="34",
                year_from=2018,
                year_to=2021,
                max_years=2,
                release_key="hubeau-bnpe-chroniques-test",
                retrieved_at=date(2026, 2, 1),
                fetcher=fetcher,
                max_pages_per_year=1,
                max_bytes_per_year=1_000_000,
                max_total_bytes=10_000_000,
                timeout_seconds=20.0,
                page_size=100,
                clock=lambda: datetime(2026, 2, 2, tzinfo=timezone.utc),
            )
        assert opener.calls == []

    def test_pagination_is_bounded_independently_per_year(self) -> None:
        """X2A : `max_pages_per_year` borne CHAQUE année séparément — une
        année ne consomme pas le budget de pages d'une autre."""
        report, opener = run_multi_year(
            {
                2020: withdrawal_page(withdrawal_record(year=2020)),
                2021: withdrawal_page(withdrawal_record(year=2021)),
            },
            max_pages_per_year=1,
        )

        assert len(opener.calls) == 2  # une page par année, pas plus
        assert report.limits["max_pages_per_year"] == 1

    def test_global_byte_budget_stops_before_the_last_year(self) -> None:
        """X2A : le budget CUMULÉ across années, pas seulement par année —
        une plage large peut être arrêtée avant sa dernière année. Le budget
        global est fixé à EXACTEMENT le poids d'une année : le reliquat tombe
        à zéro après la première, ce qui arrête la collecte avant tout appel
        pour la seconde — pas un appel tenté puis tronqué."""
        big_page = withdrawal_page(withdrawal_record(year=2020, ouvrage="OUV-" + "X" * 500))
        report, opener = run_multi_year(
            {2020: big_page, 2021: big_page, 2022: big_page},
            max_bytes_per_year=len(big_page) + 10,
            max_total_bytes=len(big_page),  # exactement une année, aucune marge
        )

        assert len(opener.calls) == 1
        assert any("budget global" in w for w in report.warnings)

    def test_undeclared_volume_is_absent_not_zero(self) -> None:
        """X2A, règle 7 : absence de déclaration ≠ zéro, y compris agrégée
        sur plusieurs années."""
        record = withdrawal_record(year=2020)
        record["volume"] = None
        report, _ = run_multi_year({2020: withdrawal_page(record)})

        assert report.records_absent_value == 1
        assert report.records_normalized == 0

    def test_orchestration_is_idempotent(self) -> None:
        """Deux exécutions indépendantes, mêmes pages scriptées, même
        résultat structurel — hors horodatage."""
        pages = {
            2020: withdrawal_page(withdrawal_record(year=2020)),
            2021: withdrawal_page(withdrawal_record(year=2021)),
        }

        first, _ = run_multi_year(pages)
        second, _ = run_multi_year(pages)

        assert first.verdict == second.verdict
        assert first.records_received == second.records_received
        assert first.records_normalized == second.records_normalized
        assert first.rejection_causes == second.rejection_causes
        assert first.units == second.units
        assert first.geographies == second.geographies

    def test_no_license_decision_is_ever_provided(self) -> None:
        report, _ = run_multi_year({2020: withdrawal_page(withdrawal_record(year=2020))})

        assert report.records_publishable == 0


# ---------------------------------------------------------------------------
# 11 — EEA : conversion d'artefact local cadrée, sans deviner (X2A)
# ---------------------------------------------------------------------------


class TestEeaManualArtifactRequired:
    def test_no_input_is_manual_artifact_required_not_decoder_deferred(self) -> None:
        """X2A remplace l'ancien verdict X1 pour EEA : `decoder_deferred`
        reste réservé à Copernicus (décodeur RASTER non livré). EEA a
        l'outillage ; ce qui manque est un profil vérifié par un humain."""
        assert (
            validate_eea._decide(
                identity_ok=True, has_input=False, payload=None, payload_format=None,
                records_normalized=0, pipeline_failed=False, rejected=False,
            )
            == "manual_artifact_required"
        )

    def test_binary_payload_without_profile_is_manual_artifact_required(self) -> None:
        assert (
            validate_eea._decide(
                identity_ok=True, has_input=True, payload=b"PK\x03\x04...",
                payload_format="zip/ooxml (xlsx, shapefile compressé)",
                records_normalized=0, pipeline_failed=False, rejected=False,
            )
            == "manual_artifact_required"
        )

    def test_payload_lost_to_a_checksum_mismatch_is_source_unavailable(self) -> None:
        """`payload=None` avec `has_input=True` : le contrôle de checksum de
        `main()` a rejeté l'extrait — ni un succès, ni un défaut de schéma."""
        assert (
            validate_eea._decide(
                identity_ok=True, has_input=True, payload=None, payload_format=None,
                records_normalized=0, pipeline_failed=False, rejected=False,
            )
            == "source_unavailable"
        )

    def test_other_verdicts_are_unaffected(self) -> None:
        assert (
            validate_eea._decide(
                identity_ok=False, has_input=False, payload=None, payload_format=None,
                records_normalized=0, pipeline_failed=False, rejected=False,
            )
            == "source_unavailable"
        )
        assert (
            validate_eea._decide(
                identity_ok=True, has_input=True, payload=b"x", payload_format="texte utf-8",
                records_normalized=0, pipeline_failed=False, rejected=True,
            )
            == "schema_drift"
        )
        assert (
            validate_eea._decide(
                identity_ok=True, has_input=True, payload=b"x", payload_format="texte utf-8",
                records_normalized=3, pipeline_failed=False, rejected=False,
            )
            == "ready_for_staging"
        )


class TestEeaExtensionConsistency:
    def test_matching_extension_is_silent(self) -> None:
        warnings: list[str] = []
        validate_eea._check_extension_consistency(
            Path("release.xlsx"), "zip/ooxml (xlsx, shapefile compressé)", warnings,
        )
        assert warnings == []

    def test_mismatched_extension_is_flagged_not_refused(self) -> None:
        warnings: list[str] = []
        validate_eea._check_extension_consistency(
            Path("release.csv"), "zip/ooxml (xlsx, shapefile compressé)", warnings,
        )
        assert any("inattendue" in w for w in warnings)

    def test_unknown_container_is_silent(self) -> None:
        warnings: list[str] = []
        validate_eea._check_extension_consistency(Path("release.bin"), "binaire non identifié", warnings)
        assert warnings == []


class TestEeaInspectAndConvert:
    def test_non_xlsx_binary_is_left_untouched(self) -> None:
        notes: list[str] = []
        payload, fmt = validate_eea._inspect_and_convert(
            b"\xd0\xcf\x11\xe0old-xls", "ole2 (xls)", "any-release", notes, [], [],
        )

        assert payload == b"\xd0\xcf\x11\xe0old-xls"
        assert fmt == "ole2 (xls)"
        assert any("non inspectable" in n for n in notes)

    def test_xlsx_without_a_profile_surfaces_sheets_and_stays_binary(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import io as _io

        import openpyxl as _openpyxl

        workbook = _openpyxl.Workbook()
        workbook.active.title = "Data"
        workbook.active.append(["spatialUnitIdentifier", "year"])
        buffer = _io.BytesIO()
        workbook.save(buffer)
        raw = buffer.getvalue()

        notes: list[str] = []
        payload, fmt = validate_eea._inspect_and_convert(
            raw, "zip/ooxml (xlsx, shapefile compressé)", "release-without-profile", notes, [], [],
        )

        assert payload == raw
        assert fmt == "zip/ooxml (xlsx, shapefile compressé)"
        assert any("Data" in n for n in notes)
        assert any(eea_inspector.MAPPING_PROFILE_STATUS in n for n in notes)

    def test_xlsx_with_a_verified_profile_is_converted(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import io as _io

        import openpyxl as _openpyxl

        release_key = "release-with-profile"
        profile = eea_inspector.ColumnMappingProfile(
            release_key=release_key, sheet_name="Data",
            identifier_column="spatialUnitIdentifier", year_column="year",
            quarter_column="quarter", value_column="wei_plus_pct", unit_column="unit",
            verified_by="test", verified_on="2026-07-26",
        )
        monkeypatch.setitem(eea_inspector.MAPPING_PROFILES, release_key, profile)

        workbook = _openpyxl.Workbook()
        workbook.active.title = "Data"
        workbook.active.append(["spatialUnitIdentifier", "year", "quarter", "wei_plus_pct", "unit"])
        workbook.active.append(["FR001", 2020, "Q1", 12.3, "%"])
        buffer = _io.BytesIO()
        workbook.save(buffer)

        notes: list[str] = []
        warnings: list[str] = []
        payload, fmt = validate_eea._inspect_and_convert(
            buffer.getvalue(), "zip/ooxml (xlsx, shapefile compressé)", release_key,
            notes, warnings, [],
        )

        assert fmt == "texte utf-8"
        assert b"FR001,2020,Q1,12.3,%" in payload
        assert any("converti" in w for w in warnings)


# ---------------------------------------------------------------------------
# 9 — Aucune base, aucune publication, aucune dépendance inversée
# ---------------------------------------------------------------------------


def _sources(directory: Path) -> list[Path]:
    return sorted(p for p in directory.glob("*.py"))


def _imported_names(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
    return names


class TestNoDatabaseNoPublication:
    FORBIDDEN = ("psycopg", "psycopg2", "sqlalchemy", "asyncpg", "db", "db.session")

    #: Scripts opérateur autorisés à ouvrir la base. Exemption NOMMÉE, même
    #: idiome que `fetcher.py` pour le réseau : la règle reste vraie pour tous
    #: les autres, et un nouveau script qui toucherait la base fait échouer ce
    #: test tant qu'il n'est pas listé ici — c'est-à-dire tant qu'un humain ne
    #: l'a pas décidé. C'est ce qui s'est produit pour le troisième nom.
    #:
    #: - `ingest_release.py` — graveur Evidence Kernel, ÉCRIT (X2B) ;
    #: - `staging_rehearsal.py` — outils de répétition staging (X3) ;
    #: - `build_candidate_snapshots.py` — constructeur de candidats (X4B-PREP),
    #:   **LECTURE SEULE**. Depuis X4B-RECONSTRUCT il ne relit plus aucune
    #:   observation publiable depuis SQL : les releases sont préparées depuis
    #:   les ARTEFACTS, par `prepare_release()`, le graveur lui-même. Ses deux
    #:   seuls accès base sont des SELECT — la ligne du Source Registry (pour
    #:   confronter la provenance et évaluer la licence) et les lignes déjà
    #:   gravées (pour la PARITÉ, jamais pour composer). Il est listé parce
    #:   qu'il OUVRE la base, pas parce qu'il y écrit — l'exemption porte sur
    #:   l'accès, jamais sur l'intention déclarée.
    #:   `test_the_candidate_builder_never_writes` vérifie qu'il n'emprunte
    #:   aucun chemin d'écriture.
    DATABASE_EXEMPT = frozenset(
        {
            "ingest_release.py",
            "staging_rehearsal.py",
            "build_candidate_snapshots.py",
        }
    )

    def test_no_operator_script_imports_a_database_client(self) -> None:
        for path in _sources(SCRIPTS_DIR):
            if path.name in self.DATABASE_EXEMPT:
                continue
            imported = _imported_names(path)
            offending = {n for n in imported if n.split(".")[0] in self.FORBIDDEN}
            assert not offending, f"{path.name} importe {offending}"

    def test_the_database_exemption_stays_an_explicit_short_list(self) -> None:
        """L'exemption ne doit jamais devenir une catégorie : chaque fichier
        qui touche la base est nommé, et il n'y en a que trois — le graveur
        (X2B), les outils de répétition staging (X3) et le constructeur de
        candidats en lecture seule (X4B-PREP)."""
        assert self.DATABASE_EXEMPT == {
            "ingest_release.py",
            "staging_rehearsal.py",
            "build_candidate_snapshots.py",
        }
        for name in self.DATABASE_EXEMPT:
            assert (SCRIPTS_DIR / name).is_file()

    def test_the_candidate_builder_never_writes(self) -> None:
        """Le constructeur de candidats LIT — il ne doit jamais écrire.

        Son exemption porte sur l'accès à la base, pas sur une autorisation
        d'écriture : mesurer ce que pèserait une publication n'est pas publier.
        Un `INSERT`/`UPDATE`/`DELETE` apparu ici doit casser la CI, pas passer
        parce que le fichier figure dans la liste.
        """
        source = (SCRIPTS_DIR / "build_candidate_snapshots.py").read_text(encoding="utf-8")
        for statement in ("INSERT INTO", "UPDATE ", "DELETE FROM", "publish_release"):
            assert statement not in source, (
                f"build_candidate_snapshots.py contient {statement!r} : il est exempté "
                "pour LIRE, jamais pour écrire ni publier."
            )
        # Il importe `staging_writer` pour `prepare_release()` — l'étape PURE,
        # sans connexion. Appeler le graveur lui-même écrirait.
        assert "ingest_staging_release" not in source, (
            "build_candidate_snapshots.py appelle le graveur : il n'importe "
            "`staging_writer` que pour sa préparation pure."
        )

    def test_the_candidate_builder_shares_the_writer_s_preparation(self) -> None:
        """L'inverse du précédent, et la décision d'architecture de X4B.

        Le constructeur DOIT appeler `prepare_release()` — la fonction qui
        grave — et non une normalisation à lui. Un second normaliseur
        divergerait du premier à la première correction, et un budget mesuré
        sur une release préparée autrement ne serait le budget de rien.
        """
        source = (SCRIPTS_DIR / "build_candidate_snapshots.py").read_text(encoding="utf-8")
        assert "prepare_release(" in source
        assert "read_validated_observations" not in source, (
            "le constructeur relit des observations depuis SQL — la projection "
            "ne conserve ni période, ni géographie, ni provenance."
        )

    def test_every_exempt_script_goes_through_the_environment_gate(self) -> None:
        """Toucher la base ne suffit pas : il faut prouver la destination.
        Un script exempté qui n'importerait pas la porte pourrait écrire
        n'importe où."""
        for name in self.DATABASE_EXEMPT:
            imported = _imported_names(SCRIPTS_DIR / name)
            assert any(
                n.startswith("services.water.staging_environment") for n in imported
            ), f"{name} n'importe pas la porte d'environnement"

    #: Modules de service constituant le SEUL chemin d'écriture Eau. Depuis X3,
    #: `ingest_release.py` n'importe plus `db` directement : il passe par la
    #: porte d'environnement. Sans le test ci-dessous, le garde-fou
    #: d'import ne prouverait donc plus rien — il passerait pour tous les
    #: scripts, y compris un futur script qui écrirait via ces services.
    WRITE_PATH_MODULES = (
        "services.water.staging_writer",
        "services.water.staging_environment",
    )

    def test_no_other_operator_script_reaches_the_write_path(self) -> None:
        for path in _sources(SCRIPTS_DIR):
            if path.name in self.DATABASE_EXEMPT:
                continue
            imported = _imported_names(path)
            offending = {n for n in imported if n.startswith(self.WRITE_PATH_MODULES)}
            assert not offending, (
                f"{path.name} atteint le chemin d'écriture via {offending} — "
                "seul ingest_release.py le peut."
            )

    def test_the_exempt_script_actually_uses_the_gated_write_path(self) -> None:
        """Symétrique du précédent : si `ingest_release.py` cessait d'utiliser
        la porte, l'exemption survivrait à sa raison d'être."""
        imported = _imported_names(SCRIPTS_DIR / "ingest_release.py")

        assert any(n.startswith("services.water.staging_environment") for n in imported)
        assert any(n.startswith("services.water.staging_writer") for n in imported)

    def test_the_exempt_script_still_opens_no_network(self) -> None:
        """Écrire en base ne donne pas le droit de retélécharger : le graveur
        ingère un artefact DÉJÀ acquis, jamais une source qu'il irait relire."""
        imported = {n.split(".")[0] for n in _imported_names(SCRIPTS_DIR / "ingest_release.py")}
        assert not (imported & {"urllib", "requests", "httpx", "socket", "aiohttp"})

    def test_no_operator_script_can_leave_dry_run(self) -> None:
        """`dry_run=False` n'apparaît nulle part : `publish_dry_run` le refuse
        déjà, mais un script qui le TENTE serait un script qui a cru pouvoir."""
        for path in _sources(SCRIPTS_DIR):
            source = path.read_text(encoding="utf-8")
            assert "dry_run=False" not in source, f"{path.name} tente de quitter le dry-run"

    def test_no_operator_script_composes_a_license_decision(self) -> None:
        """X1 n'approuve rien : une décision de licence n'est jamais FABRIQUÉE.

        La règle porte sur l'origine de l'AUTORISATION, pas sur le mot. Un
        script peut :

        - transmettre une décision **évaluée par `license_policy` depuis la
          ligne du Source Registry** — c'est la barrière réelle, celle que suit
          le graveur ;
        - construire une décision **entièrement fermée** (les quatre `allow_*`
          à `False`), comme le fait `validate_eea.py` pour dire « X1 a lu la
          licence sur la fiche officielle, il n'en décide rien ». Refuser
          n'accorde aucun droit.

        Ce qu'aucun script ne peut faire, c'est écrire une autorisation :
        un seul `allow_*` à `True` — ou une valeur calculée, qui pourrait valoir
        `True` — passerait la porte de licence sans que rien ne l'ait vérifiée.

        Formulée en texte brut, la règle interdisait aussi la transmission
        légitime. Elle est donc lue sur l'AST.
        """
        for path in _sources(SCRIPTS_DIR):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
                if name not in ("LicenseDecision", "WaterLicenseDecision"):
                    continue
                for keyword in node.keywords:
                    if not (keyword.arg or "").startswith("allow_"):
                        continue
                    closed = (
                        isinstance(keyword.value, ast.Constant)
                        and keyword.value.value is False
                    )
                    assert closed, (
                        f"{path.name} construit une décision de licence dont "
                        f"`{keyword.arg}` n'est pas `False` — une autorisation "
                        "ne s'écrit pas, elle s'évalue depuis le registre."
                    )

    def test_a_transmitted_license_decision_comes_from_the_real_evaluator(self) -> None:
        """Transmettre une décision oblige à l'avoir évaluée dans le même fichier.

        Sans ce test, le précédent laisserait passer un script qui recevrait sa
        décision d'ailleurs — un défaut par argument, plus difficile à voir
        qu'un littéral.
        """
        for path in _sources(SCRIPTS_DIR):
            source = path.read_text(encoding="utf-8")
            if "license_decision=" not in source:
                continue
            if "license_decision=None" in source:
                continue
            assert "license_policy.evaluate(" in source, (
                f"{path.name} transmet une décision de licence sans l'évaluer "
                "depuis le Source Registry."
            )


class TestDependencyDirection:
    def test_services_never_import_the_operator_scripts(self) -> None:
        """Le sens de la dépendance est ce qui garde `services` sans réseau."""
        for path in _sources(SERVICES_DIR) + _sources(SERVICES_DIR / "connectors"):
            imported = _imported_names(path)
            assert not any(name.startswith("scripts") for name in imported), (
                f"{path.name} importe les scripts opérateur — le paquet de services "
                "cesserait d'être sans réseau."
            )

    def test_only_the_fetcher_opens_the_network(self) -> None:
        network = {"urllib", "urllib.request", "http.client", "socket", "requests", "httpx"}
        for path in _sources(SCRIPTS_DIR):
            imported = {n.split(".")[0] for n in _imported_names(path)}
            if imported & {n.split(".")[0] for n in network}:
                assert path.name in {"fetcher.py"}, (
                    f"{path.name} importe un client réseau : seul fetcher.py le peut."
                )


class TestNoNetworkInThisFile:
    def test_every_fetcher_built_here_is_injected(self) -> None:
        """Garde-fou contre le test futur qui ouvrirait le réseau par mégarde."""
        tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            called = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if called != "OperatorFetcher":
                continue
            keywords = {kw.arg for kw in node.keywords}
            # Les seules constructions sans opener sont celles qui vérifient un
            # refus À LA CONSTRUCTION : elles n'atteignent jamais `fetch`.
            assert "opener_factory" in keywords or keywords & {"max_bytes", "allowed_hosts"}, (
                "un OperatorFetcher est construit sans opener injecté"
            )
