"""
test_water_intelligence_observation_identity.py — identité temporelle sûre
(P10, Wave C, commit C1).

AUCUNE base, AUCUN réseau : primitive pure.

Couvre les douze cas exigés par le prompt Wave C — deux trimestres EEA, deux
mesures Hub'Eau à deux dates, même observation rejouée, même identité avec
valeur différente, géographie différente, scénario différent, période annuelle
BNPE, période ponctuelle hydrométrique, `null` distinct de zéro, ordre
déterministe, compatibilité WRI, non-régression `/materials` — plus la
décision documentée d'exclure méthode/version de l'identité.
"""

from __future__ import annotations

import ast
import hashlib
import json
from datetime import date
from pathlib import Path

import pytest

from models.analytics import MethodRef
from models.water_intelligence import (
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterQualityMetadata,
    WaterScenario,
    WaterSourceReference,
)
from services.intelligence.adapters.base import ObservationDraft
from services.water_intelligence.observation_identity import (
    IDENTITY_SCHEMA_VERSION,
    WaterIdentityCollisionError,
    WaterIdentityIncompleteError,
    WaterObservationLedger,
    build_water_observation_identity,
    content_digest,
)

IDENTITY_MODULE = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "observation_identity.py"
)

ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)
BLOCKED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=False, allow_derived_use=False
)

FIXTURE_CHECKSUM = "a" * 64


def source(**overrides) -> WaterSourceReference:
    params = dict(
        source_code="EEA_WEI_PLUS",
        release_key="eea-wei-plus-subunit-2023-fixture",
        checksum_sha256=FIXTURE_CHECKSUM,
        retrieved_at=date(2026, 2, 10),
        methodology_version="1.0.0",
        license=ALLOWED,
    )
    params.update(overrides)
    return WaterSourceReference(**params)


def observation(**overrides) -> WaterMetricObservation:
    params = dict(
        metric_code="eea_wei_plus.subunit.value_pct",
        value=12.5,
        unit="%",
        geography=WaterGeographyRef(scope="europe", code="EEA-FIXTURE-001", label="EEA-FIXTURE-001"),
        period_start=date(2023, 1, 1),
        period_end=date(2023, 3, 31),
        method=MethodRef(code="CC-WI-EEA-WEI-PLUS-PASSTHROUGH", version="1.0.0"),
        quality=WaterQualityMetadata(data_status="modelled", confidence=None, coverage_pct=None),
        source=source(),
        scenario=None,
        value_withheld=False,
    )
    params.update(overrides)
    return WaterMetricObservation(**params)


def identity_of(obs: WaterMetricObservation, *, subject_key="EEA-FIXTURE-001"):
    return build_water_observation_identity(
        obs, subject_type="eea_wei_plus_unit", subject_key=subject_key
    )


# ---------------------------------------------------------------------------
# 1-2. Périodes distinctes = identités distinctes
# ---------------------------------------------------------------------------


class TestDistinctPeriods:
    def test_two_eea_quarters_are_two_identities(self) -> None:
        """Cas 1 : le défaut exact de `dedup_key()`. Même métrique, même
        unité spatiale, deux trimestres — deux faits."""
        q1 = observation(period_start=date(2023, 1, 1), period_end=date(2023, 3, 31))
        q3 = observation(period_start=date(2023, 7, 1), period_end=date(2023, 9, 30))

        assert identity_of(q1).fingerprint() != identity_of(q3).fingerprint()
        assert q1.metric_code == q3.metric_code  # le metric_code, lui, est stable

    def test_two_hubeau_measurements_on_two_days_are_two_identities(self) -> None:
        """Cas 2 : chronique journalière."""
        common = dict(
            metric_code="hubeau.hydrometrie.debit",
            unit="l/s",
            geography=WaterGeographyRef(scope="france", code="FIX-STATION-001", label="FIX-STATION-001"),
            source=source(source_code="HUBEAU_HYDROMETRIE", release_key="hubeau-hydro-2026-01"),
        )
        day1 = observation(**common, period_start=date(2026, 1, 1), period_end=date(2026, 1, 1))
        day2 = observation(**common, period_start=date(2026, 1, 2), period_end=date(2026, 1, 2))

        first = identity_of(day1, subject_key="FIX-STATION-001")
        second = identity_of(day2, subject_key="FIX-STATION-001")

        assert first.fingerprint() != second.fingerprint()

    def test_annual_bnpe_period_spans_the_civil_year(self) -> None:
        """Cas 7 : une déclaration annuelle couvre l'année entière."""
        annual = observation(
            metric_code="hubeau.prelevements.volume",
            unit="m3",
            value=125000.0,
            geography=WaterGeographyRef(scope="france", code="FIX-OUVRAGE-1", label="FIX-OUVRAGE-1"),
            period_start=date(2023, 1, 1),
            period_end=date(2023, 12, 31),
            source=source(source_code="HUBEAU_BNPE_PRELEVEMENTS", release_key="bnpe-2023"),
        )

        built = identity_of(annual, subject_key="FIX-OUVRAGE-1")

        assert built.period_start == date(2023, 1, 1)
        assert built.period_end == date(2023, 12, 31)

    def test_pointwise_and_annual_periods_never_collide(self) -> None:
        """Cas 8 : une mesure ponctuelle du 1er janvier ne peut pas se
        confondre avec l'année entière qui commence le même jour."""
        pointwise = observation(period_start=date(2023, 1, 1), period_end=date(2023, 1, 1))
        annual = observation(period_start=date(2023, 1, 1), period_end=date(2023, 12, 31))

        assert identity_of(pointwise).fingerprint() != identity_of(annual).fingerprint()

    def test_inverted_period_is_refused(self) -> None:
        """Le contrat P02 ne vérifie pas l'ordre des bornes ; l'identité, si —
        une période inversée rendrait l'empreinte ininterprétable."""
        inverted = observation(
            period_start=date(2023, 12, 31), period_end=date(2023, 1, 1)
        )

        with pytest.raises(WaterIdentityIncompleteError, match="période invalide"):
            identity_of(inverted)


# ---------------------------------------------------------------------------
# 3-4. Rejeu et collision
# ---------------------------------------------------------------------------


class TestReplayAndCollision:
    def test_same_observation_replayed_is_idempotent(self) -> None:
        """Cas 3 : rejouer n'ajoute rien et ne lève rien."""
        ledger = WaterObservationLedger()
        obs = observation()

        first = ledger.add_observation(obs, subject_type="u", subject_key="k")
        second = ledger.add_observation(obs, subject_type="u", subject_key="k")

        assert first is True
        assert second is False
        assert len(ledger) == 1

    def test_same_identity_with_a_different_value_raises(self) -> None:
        """Cas 4 : le cœur du commit. Jamais « première valeur gagnante »."""
        ledger = WaterObservationLedger()
        ledger.add_observation(observation(value=12.5), subject_type="u", subject_key="k")

        with pytest.raises(WaterIdentityCollisionError, match="collision d'identité"):
            ledger.add_observation(observation(value=99.9), subject_type="u", subject_key="k")

    def test_collision_message_names_the_conflicting_fact(self) -> None:
        ledger = WaterObservationLedger()
        ledger.add_observation(observation(value=1.0), subject_type="u", subject_key="k")

        with pytest.raises(WaterIdentityCollisionError) as excinfo:
            ledger.add_observation(observation(value=2.0), subject_type="u", subject_key="k")

        message = str(excinfo.value)
        assert "EEA_WEI_PLUS" in message
        assert "eea_wei_plus.subunit.value_pct" in message
        assert "2023-01-01" in message
        assert "Aucune valeur n'est retenue par défaut" in message

    def test_a_method_version_change_is_a_collision_not_a_new_fact(self) -> None:
        """Décision documentée : méthode/version sont EXCLUES de l'identité.
        À l'intérieur d'une release immuable, le même fait recalculé avec une
        autre méthode est une incohérence — et doit être bruyante."""
        ledger = WaterObservationLedger()
        ledger.add_observation(observation(), subject_type="u", subject_key="k")
        recomputed = observation(method=MethodRef(code="CC-WI-EEA-WEI-PLUS-PASSTHROUGH", version="2.0.0"))

        with pytest.raises(WaterIdentityCollisionError):
            ledger.add_observation(recomputed, subject_type="u", subject_key="k")

    def test_a_new_release_is_a_new_identity_not_a_collision(self) -> None:
        """Corollaire : une montée de méthode accompagnée d'une nouvelle
        release produit naturellement une identité distincte."""
        ledger = WaterObservationLedger()
        ledger.add_observation(observation(), subject_type="u", subject_key="k")
        next_release = observation(
            source=source(release_key="eea-wei-plus-subunit-2024-fixture"),
            method=MethodRef(code="CC-WI-EEA-WEI-PLUS-PASSTHROUGH", version="2.0.0"),
        )

        assert ledger.add_observation(next_release, subject_type="u", subject_key="k") is True
        assert len(ledger) == 2


# ---------------------------------------------------------------------------
# 5-6. Géographie et scénario
# ---------------------------------------------------------------------------


class TestGeographyAndScenario:
    def test_different_geography_is_a_different_identity(self) -> None:
        """Cas 5."""
        here = observation()
        there = observation(
            geography=WaterGeographyRef(scope="europe", code="EEA-FIXTURE-002", label="EEA-FIXTURE-002")
        )

        assert identity_of(here).fingerprint() != identity_of(there).fingerprint()

    def test_different_scope_is_a_different_identity(self) -> None:
        europe = observation()
        france = observation(
            geography=WaterGeographyRef(scope="france", code="EEA-FIXTURE-001", label="EEA-FIXTURE-001")
        )

        assert identity_of(europe).fingerprint() != identity_of(france).fingerprint()

    def test_missing_geography_code_outside_world_is_refused(self) -> None:
        """Le contrat P02 l'interdit déjà à la construction ; l'identité le
        revérifie, car une identité sans code ferait collisionner deux
        territoires distincts. `model_construct` contourne volontairement la
        validation pour exercer cette seconde barrière."""
        without_code = WaterGeographyRef.model_construct(
            scope="europe", code=None, label="Sans code"
        )
        broken = observation().model_copy(update={"geography": without_code})

        with pytest.raises(WaterIdentityIncompleteError, match="geography.code obligatoire"):
            identity_of(broken)

    def test_different_scenario_is_a_different_identity(self) -> None:
        """Cas 6 : une projection n'est pas l'observation, et deux horizons
        sont deux projections."""
        observed = observation()
        projected = observation(
            scenario=WaterScenario(
                scenario_code="bau", label="Business as usual", horizon_year=2030, source=source()
            )
        )
        further = observation(
            scenario=WaterScenario(
                scenario_code="bau", label="Business as usual", horizon_year=2050, source=source()
            )
        )

        prints = {
            identity_of(observed).fingerprint(),
            identity_of(projected).fingerprint(),
            identity_of(further).fingerprint(),
        }
        assert len(prints) == 3

    def test_scenario_fields_are_null_when_absent(self) -> None:
        built = identity_of(observation())

        assert built.scenario_code is None
        assert built.horizon_year is None


# ---------------------------------------------------------------------------
# 9-10. null vs zéro, déterminisme
# ---------------------------------------------------------------------------


class TestValueSemanticsAndDeterminism:
    def test_null_and_zero_have_different_content_digests(self) -> None:
        """Cas 9 : absence ≠ zéro, jusque dans l'empreinte."""
        absent = observation(value=None)
        zero = observation(value=0.0)

        assert content_digest(absent) != content_digest(zero)

    def test_zero_and_false_and_text_zero_are_all_distinct(self) -> None:
        assert content_digest(observation(value=0.0)) != content_digest(observation(value=False))
        assert content_digest(observation(value=0.0)) != content_digest(observation(value="0"))

    def test_absent_value_does_not_collide_with_a_present_one(self) -> None:
        ledger = WaterObservationLedger()
        ledger.add_observation(observation(value=None), subject_type="u", subject_key="k")

        with pytest.raises(WaterIdentityCollisionError):
            ledger.add_observation(observation(value=0.0), subject_type="u", subject_key="k")

    def test_fingerprint_is_stable_across_calls(self) -> None:
        """Cas 10 : déterminisme."""
        built = identity_of(observation())

        assert built.fingerprint() == built.fingerprint()
        assert identity_of(observation()).fingerprint() == built.fingerprint()

    def test_fingerprint_does_not_depend_on_declaration_order(self) -> None:
        """La forme canonique est triée : réordonner le mapping ne change
        rien à l'empreinte."""
        built = identity_of(observation())
        mapping = built.as_canonical_mapping()
        reversed_mapping = dict(reversed(list(mapping.items())))

        def digest(payload: dict) -> str:
            return hashlib.sha256(
                json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
            ).hexdigest()

        assert digest(mapping) == digest(reversed_mapping) == built.fingerprint()

    def test_ledger_order_does_not_change_its_content(self) -> None:
        forward, backward = WaterObservationLedger(), WaterObservationLedger()
        a = observation(period_start=date(2023, 1, 1), period_end=date(2023, 3, 31))
        b = observation(period_start=date(2023, 7, 1), period_end=date(2023, 9, 30))

        for obs in (a, b):
            forward.add_observation(obs, subject_type="u", subject_key="k")
        for obs in (b, a):
            backward.add_observation(obs, subject_type="u", subject_key="k")

        assert [e.identity_fingerprint for e in forward.entries] == [
            e.identity_fingerprint for e in backward.entries
        ]

    def test_schema_version_is_part_of_the_identity(self) -> None:
        built = identity_of(observation())

        assert built.schema_version == IDENTITY_SCHEMA_VERSION
        assert "schema_version" in built.as_canonical_mapping()


# ---------------------------------------------------------------------------
# 11-12. Compatibilité WRI, non-régression /materials
# ---------------------------------------------------------------------------


class TestCompatibilityAndNonRegression:
    def test_wri_world_scope_without_geography_code_is_accepted(self) -> None:
        """Cas 11 : Aqueduct publie à l'échelle `world`, seule échelle pour
        laquelle le contrat P02 autorise un `code` absent."""
        wri = observation(
            metric_code="wri_aqueduct.bws.raw",
            geography=WaterGeographyRef(scope="world", code="FIXTURE-AREA-001", label="Zone (fixture)"),
            source=source(source_code="WRI_AQUEDUCT", release_key="aqueduct-4-0-fixture"),
        )

        built = identity_of(wri, subject_key="FIXTURE-AREA-001")

        assert built.geography_scope == "world"
        assert built.source_code == "WRI_AQUEDUCT"

    def test_materials_dedup_key_contract_is_untouched(self) -> None:
        """Cas 12 : `ObservationDraft.dedup_key()` garde exactement sa forme
        PR-04. Ce module n'y touche pas — le modifier engagerait l'import
        `/materials` sans démonstration de non-régression."""
        draft = ObservationDraft(
            subject_type="material",
            subject_key="material:42",
            metric_code="price_usd",
            numeric_value=1.0,
        )

        assert draft.dedup_key() == ("material", "material:42", "price_usd")
        assert len(draft.dedup_key()) == 3

    def test_identity_module_never_imports_or_calls_dedup_key(self) -> None:
        """Non-régression structurelle : la primitive Water Intelligence ne
        réutilise pas la clé PR-04, même indirectement."""
        tree = ast.parse(IDENTITY_MODULE.read_text(encoding="utf-8"))

        attributes = {
            node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)
        }
        names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}

        assert "dedup_key" not in attributes
        assert "dedup_key" not in names

    def test_identity_module_is_pure(self) -> None:
        """Aucune base, aucun réseau, aucune horloge implicite."""
        tree = ast.parse(IDENTITY_MODULE.read_text(encoding="utf-8"))

        roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                roots.add(node.module.split(".")[0])
        assert not (roots & {"db", "psycopg", "psycopg2", "requests", "httpx", "urllib", "socket"})

        clock_calls = [
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in {"now", "utcnow", "today"}
        ]
        assert not clock_calls


# ---------------------------------------------------------------------------
# Composants obligatoires manquants
# ---------------------------------------------------------------------------


class TestIncompleteIdentity:
    @pytest.mark.parametrize("blank", ["", "   "])
    def test_blank_subject_key_is_refused(self, blank: str) -> None:
        with pytest.raises(WaterIdentityIncompleteError, match="subject_key"):
            build_water_observation_identity(
                observation(), subject_type="u", subject_key=blank
            )

    @pytest.mark.parametrize("blank", ["", "   "])
    def test_blank_subject_type_is_refused(self, blank: str) -> None:
        with pytest.raises(WaterIdentityIncompleteError, match="subject_type"):
            build_water_observation_identity(
                observation(), subject_type=blank, subject_key="k"
            )

    def test_withheld_value_still_has_a_stable_identity(self) -> None:
        """Une valeur retenue pour licence garde une identité : ce qui est
        bloqué est la valeur, pas l'existence du fait."""
        withheld = observation(value=None, value_withheld=True, source=source(license=BLOCKED))

        built = identity_of(withheld)

        assert built.fingerprint()
        assert content_digest(withheld) != content_digest(observation())
