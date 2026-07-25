"""
tests/test_water_synthesis_service.py — lecteur tenant de la synthèse hydrique
(P14, Wave D, commit D2).

AUCUNE base requise : les services de lecture sont remplacés par des doubles
(monkeypatch). Ce que ces tests vérifient n'est pas le SQL — il est déjà couvert
par les suites de chaque module — mais la **composition** et la **dégradation** :

| Exigence | Classe de test |
|---|---|
| dégradation par facette, pas 503 global | `TestSchemaDegradation` |
| une vraie erreur n'est jamais masquée | `TestRealErrorsPropagate` |
| absence ≠ zéro (risque non apparié) | `TestAbsenceIsNotZero` |
| risque et confiance restent séparés | `TestRiskConfidenceSeparation` |
| tenant A / tenant B | `TestTenantIsolation` |
| aucun import DB dans le paquet pur | `TestPurityBoundary` |
"""

from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace

import pytest

from services.water import water_synthesis_service as svc
from services.water_intelligence.tenant_synthesis import CrossTenantEntryError

COMPANY_A = 101
COMPANY_B = 202

_WI_DIR = Path(__file__).resolve().parents[1] / "services" / "water_intelligence"


class _SchemaMissing(Exception):
    """Double d'une erreur psycopg2 « table absente »."""

    pgcode = "42P01"


def _listing(items: list[object]) -> SimpleNamespace:
    return SimpleNamespace(items=items, total=len(items), limit=50, offset=0)


def _screening(
    screening_id: int = 1,
    site_id: int = 7,
    risk_category: str | None = "high",
    confidence: float | None = 80.0,
    company_id: int = COMPANY_A,
) -> SimpleNamespace:
    """Double d'un `WaterScreeningSummary`.

    `company_id` est présent parce que l'objet réel le porte : c'est lui que le
    lecteur estampille sur l'entrée, jamais le tenant demandé. Un double qui
    l'omettrait rendrait le garde-fou anti-fuite intestable — c'est exactement
    l'angle mort qu'a révélé le premier test contre un vrai PostgreSQL.
    """
    return SimpleNamespace(
        id=screening_id,
        site_id=site_id,
        company_id=company_id,
        methodology_code="CC-WATER-SCREENING",
        risk_category=risk_category,
        confidence=confidence,
    )


@pytest.fixture(autouse=True)
def _empty_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    """Par défaut, toutes les sources répondent « aucun enregistrement ».

    Chaque test ne surcharge que la source qui l'intéresse.
    """
    from services.iro import iro_service
    from services.resources import exposure_link_service
    from services.water import (
        activities_service,
        screening_service,
        targets_actions_service,
    )

    monkeypatch.setattr(
        screening_service, "list_screenings", lambda **_: _listing([]), raising=True
    )
    monkeypatch.setattr(
        activities_service, "list_activities", lambda **_: _listing([]), raising=True
    )
    monkeypatch.setattr(
        exposure_link_service, "list_links", lambda **_: _listing([]), raising=True
    )
    monkeypatch.setattr(iro_service, "list_iros", lambda **_: _listing([]), raising=True)
    monkeypatch.setattr(
        targets_actions_service, "list_actions", lambda **_: _listing([]), raising=True
    )


class TestPurityBoundary:
    """La synthèse lit le tenant ; le paquet public reste pur."""

    def test_water_intelligence_package_never_imports_the_database(self) -> None:
        forbidden = {"db", "db.database", "psycopg", "psycopg2"}
        for module_path in sorted(_WI_DIR.glob("*.py")):
            tree = ast.parse(module_path.read_text(encoding="utf-8"))
            imported: set[str] = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imported.update(alias.name for alias in node.names)
                elif isinstance(node, ast.ImportFrom) and node.module:
                    imported.add(node.module)
            assert not (imported & forbidden), (
                f"{module_path.name} importe {imported & forbidden} — le paquet "
                "water_intelligence doit rester pur."
            )

    def test_the_reader_lives_outside_that_package(self) -> None:
        assert "water_intelligence" not in Path(svc.__file__).parent.name


class TestSchemaDegradation:
    """Une table absente dégrade SA facette, pas la synthèse entière."""

    def test_missing_water_schema_does_not_hide_the_other_facets(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from services.iro import iro_service
        from services.water import screening_service

        def _boom(**_: object) -> None:
            raise _SchemaMissing("relation « site_water_screenings » inexistante")

        monkeypatch.setattr(screening_service, "list_screenings", _boom, raising=True)
        monkeypatch.setattr(
            iro_service,
            "list_iros",
            lambda **_: _listing(
                [
                    SimpleNamespace(
                        id=3,
                        company_id=COMPANY_A,
                        title="Tension hydrique amont",
                        iro_type="risk",
                        origin_reference="site_water_screening:1",
                    )
                ]
            ),
            raising=True,
        )

        synthesis = svc.build_synthesis(company_id=COMPANY_A)

        risk = synthesis.facet("risk")
        assert len(risk.entries) == 1
        assert risk.entries[0].is_absent
        assert risk.entries[0].absence_reason == svc.ABSENCE_SCHEMA_NOT_READY

        iro = synthesis.facet("iro")
        assert [entry.value for entry in iro.entries] == ["risk"]

    def test_every_facet_degrades_independently(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from services.iro import iro_service
        from services.resources import exposure_link_service
        from services.water import (
            activities_service,
            screening_service,
            targets_actions_service,
        )

        def _boom(**_: object) -> None:
            raise _SchemaMissing("schéma absent")

        for module, name in (
            (screening_service, "list_screenings"),
            (activities_service, "list_activities"),
            (exposure_link_service, "list_links"),
            (iro_service, "list_iros"),
            (targets_actions_service, "list_actions"),
        ):
            monkeypatch.setattr(module, name, _boom, raising=True)

        synthesis = svc.build_synthesis(company_id=COMPANY_A)

        for facet in ("risk", "dependency", "resource_material", "iro", "action"):
            entries = synthesis.facet(facet).entries
            assert entries, f"la facette {facet} devrait porter une absence motivée"
            assert all(entry.absence_reason == svc.ABSENCE_SCHEMA_NOT_READY for entry in entries)

    def test_no_record_is_distinguished_from_missing_schema(self) -> None:
        synthesis = svc.build_synthesis(company_id=COMPANY_A)
        for facet in ("risk", "dependency", "resource_material", "iro", "action"):
            entries = synthesis.facet(facet).entries
            assert all(entry.absence_reason == svc.ABSENCE_NO_RECORD for entry in entries)


class TestRealErrorsPropagate:
    """Une erreur qui n'est pas un schéma manquant n'est jamais masquée."""

    def test_unexpected_error_is_reraised(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from services.water import screening_service

        def _boom(**_: object) -> None:
            raise ValueError("bug de programmation")

        monkeypatch.setattr(screening_service, "list_screenings", _boom, raising=True)

        with pytest.raises(ValueError, match="bug de programmation"):
            svc.build_synthesis(company_id=COMPANY_A)

    def test_a_database_error_with_another_pgcode_is_reraised(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from services.water import screening_service

        class _PermissionDenied(Exception):
            pgcode = "42501"

        def _boom(**_: object) -> None:
            raise _PermissionDenied("droit refusé")

        monkeypatch.setattr(screening_service, "list_screenings", _boom, raising=True)

        with pytest.raises(_PermissionDenied):
            svc.build_synthesis(company_id=COMPANY_A)


class TestAbsenceIsNotZero:
    """Une zone non appariée n'est pas un risque faible."""

    def test_null_risk_category_is_carried_as_a_motivated_absence(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from services.water import screening_service

        monkeypatch.setattr(
            screening_service,
            "list_screenings",
            lambda **_: _listing([_screening(risk_category=None, confidence=55.0)]),
            raising=True,
        )

        entry = svc.build_synthesis(company_id=COMPANY_A).facet("risk").entries[0]
        assert entry.value is None
        assert "pas un risque nul" in (entry.absence_reason or "")

    def test_null_confidence_is_carried_as_a_motivated_absence(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from services.water import screening_service

        monkeypatch.setattr(
            screening_service,
            "list_screenings",
            lambda **_: _listing([_screening(confidence=None)]),
            raising=True,
        )

        entry = svc.build_synthesis(company_id=COMPANY_A).facet("confidence").entries[0]
        assert entry.value is None
        assert entry.absence_reason == "confiance non calculée"


class TestRiskConfidenceSeparation:
    """Lus sur la même ligne, versés dans deux facettes, deux vocabulaires."""

    def test_one_screening_feeds_two_distinct_facets(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from services.water import screening_service

        monkeypatch.setattr(
            screening_service,
            "list_screenings",
            lambda **_: _listing([_screening(risk_category="extremely_high", confidence=40.0)]),
            raising=True,
        )

        synthesis = svc.build_synthesis(company_id=COMPANY_A)
        risk = synthesis.facet("risk")
        confidence = synthesis.facet("confidence")

        assert risk.entries[0].value == "extremely_high"
        assert confidence.entries[0].value == "40"
        assert risk.vocabularies == (svc.VOCAB_WATER_STRESS,)
        assert confidence.vocabularies == (svc.VOCAB_WATER_CONFIDENCE,)
        assert risk.vocabularies != confidence.vocabularies


class TestTenantIsolation:
    """Tenant A et tenant B ne se croisent jamais."""

    def test_company_id_is_passed_to_every_reader(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        seen: list[int] = []

        from services.iro import iro_service
        from services.resources import exposure_link_service
        from services.water import (
            activities_service,
            screening_service,
            targets_actions_service,
        )

        def _record(**kwargs: object) -> SimpleNamespace:
            seen.append(int(kwargs["company_id"]))  # type: ignore[arg-type]
            return _listing([])

        for module, name in (
            (screening_service, "list_screenings"),
            (activities_service, "list_activities"),
            (exposure_link_service, "list_links"),
            (iro_service, "list_iros"),
            (targets_actions_service, "list_actions"),
        ):
            monkeypatch.setattr(module, name, _record, raising=True)

        svc.build_synthesis(company_id=COMPANY_B)
        assert seen == [COMPANY_B] * 5

    def test_a_reader_leaking_another_tenant_fails_loudly(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Une lecture qui ramène la ligne d'un autre tenant fait ÉCHOUER.

        Le double rend maintenant une ligne réellement estampillée `COMPANY_B`
        — c'est la forme exacte du défaut : ce n'est pas la synthèse qui se
        trompe de tenant, c'est la requête en amont qui a fuité.
        """
        from services.water import screening_service

        monkeypatch.setattr(
            screening_service,
            "list_screenings",
            lambda **_: _listing([_screening(company_id=COMPANY_B)]),
            raising=True,
        )

        with pytest.raises(CrossTenantEntryError):
            svc.build_synthesis(company_id=COMPANY_A)

    def test_a_record_without_company_id_is_refused(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Un enregistrement sans tenant déclaré ne se rattache pas par défaut."""
        from services.water import screening_service

        orphan = SimpleNamespace(
            id=1, site_id=1, methodology_code="X", risk_category="high", confidence=1.0
        )
        monkeypatch.setattr(
            screening_service, "list_screenings", lambda **_: _listing([orphan]), raising=True
        )

        with pytest.raises(ValueError, match="sans company_id"):
            svc.build_synthesis(company_id=COMPANY_A)

    def test_two_tenants_produce_independent_syntheses(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from services.water import screening_service

        def _by_tenant(**kwargs: object) -> SimpleNamespace:
            company_id = int(kwargs["company_id"])  # type: ignore[arg-type]
            if company_id == COMPANY_A:
                return _listing([_screening(screening_id=1, site_id=11, company_id=COMPANY_A)])
            return _listing([_screening(screening_id=2, site_id=22, company_id=COMPANY_B)])

        monkeypatch.setattr(screening_service, "list_screenings", _by_tenant, raising=True)

        synthesis_a = svc.build_synthesis(company_id=COMPANY_A)
        synthesis_b = svc.build_synthesis(company_id=COMPANY_B)

        assert synthesis_a.facet("risk").entries[0].evidence_ref == "site_water_screening:1"
        assert synthesis_b.facet("risk").entries[0].evidence_ref == "site_water_screening:2"
        assert "Site 11" in synthesis_a.facet("risk").entries[0].label
        assert "Site 22" in synthesis_b.facet("risk").entries[0].label
