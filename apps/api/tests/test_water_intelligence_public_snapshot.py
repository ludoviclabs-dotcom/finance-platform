"""
test_water_intelligence_public_snapshot.py — read model public P10 (Wave C).

AUCUNE base, AUCUN réseau, aucune horloge : `generated_at` est toujours
injecté.

Couvre la matrice exigée — déterminisme, indépendance à l'ordre, identité
temporelle, licence bloquée, décision absente, exclusion WRI, exclusion
Copernicus, absence de tenant, snapshot vide valide, parité, fraîcheur, ETag,
cache, budget gzip, données manquantes — plus le gate licence lui-même :
identifier une licence permissive ne rend rien publiable.
"""

from __future__ import annotations

import ast
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.analytics import MethodRef
from models.water_intelligence import (
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterQualityMetadata,
    WaterSourceReference,
)
from services.water_intelligence.observation_identity import WaterIdentityCollisionError
from services.water_intelligence.public_snapshot import (
    MAX_MANIFEST_BYTES_UNCOMPRESSED,
    SNAPSHOT_SCHEMA_VERSION,
    PublicSnapshotError,
    PublicSnapshotLoader,
    SnapshotBudgetExceeded,
    TenantDataLeakError,
    assemble_public_snapshot,
)
from services.water_intelligence.publication_decisions import (
    EXCLUSION_DECISION_PENDING,
    EXCLUSION_DECISION_REFUSED,
    EXCLUSION_NO_DECISION,
    PublicationDecision,
    PublicationDecisionError,
    PublicationDecisionRegistry,
    current_registry,
)

SNAPSHOT_MODULE = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "public_snapshot.py"
)

GENERATED_AT = datetime(2026, 7, 25, 12, 0, tzinfo=timezone.utc)
CHECKSUM = "b" * 64

# Valeur passée par variable — cf. note identique dans le test d'identité.
EEA_RELEASE = "eea-wei-plus-2023-fixture"

ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)
BLOCKED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=False, allow_derived_use=False
)


def source(**overrides) -> WaterSourceReference:
    params = dict(
        source_code="EEA_WEI_PLUS",
        release_key=EEA_RELEASE,
        checksum_sha256=CHECKSUM,
        retrieved_at=date(2026, 2, 10),
        methodology_version="1.0.0",
        license=ALLOWED,
        attribution="Source: European Environment Agency (EEA) — CC-BY-4.0",
        # Depuis X4B-PREP, l'assembleur écarte une source publiée dont la
        # provenance ne porte aucune URL officielle stable : sans elle, la
        # condition de paternité de la Licence Ouverte 2.0 n'est pas
        # satisfaite. Les fixtures en portent donc une, comme les objets réels
        # — un double qui ne la porterait pas testerait un chemin que la
        # publication n'emprunte plus.
        source_information_url="https://www.eea.europa.eu/en/datahub",
    )
    params.update(overrides)
    return WaterSourceReference(**params)


def observation(**overrides) -> WaterMetricObservation:
    params = dict(
        metric_code="eea_wei_plus.subunit.value_pct",
        value=12.5,
        unit="%",
        geography=WaterGeographyRef(scope="europe", code="EEA-FIX-001", label="EEA-FIX-001"),
        period_start=date(2023, 1, 1),
        period_end=date(2023, 3, 31),
        method=MethodRef(code="CC-WI-EEA-WEI-PLUS-PASSTHROUGH", version="1.0.0"),
        quality=WaterQualityMetadata(data_status="modelled", coverage_pct=80.0, confidence=60),
        source=source(),
        value_withheld=False,
    )
    params.update(overrides)
    return WaterMetricObservation(**params)


def approving_registry(*source_codes: str) -> PublicationDecisionRegistry:
    """Registre de test où certaines sources SONT approuvées et signées."""
    return PublicationDecisionRegistry(
        PublicationDecision(
            source_code=code,
            status="approved",
            reason="Décision de test explicite et signée.",
            reviewed_by="Revue humaine (fixture de test)",
            reviewed_on=date(2026, 7, 1),
        )
        for code in source_codes
    )


def assemble(observations, *, registry=None, **kwargs):
    return assemble_public_snapshot(
        observations,
        generated_at=GENERATED_AT,
        registry=registry or approving_registry("EEA_WEI_PLUS"),
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Gate licence — une licence permissive n'autorise rien
# ---------------------------------------------------------------------------


class TestLicenceGate:
    def test_no_source_is_approved_today(self) -> None:
        """Le registre réel : aucune source n'est approuvée à ce jour."""
        assert current_registry().approved_source_codes == ()

    def test_identifying_a_permissive_licence_does_not_publish(self) -> None:
        """EEA est en CC BY 4.0 et Hub'Eau en Licence Ouverte — vérifié en
        Waves A et B. Aucune des deux n'est publiable pour autant."""
        registry = current_registry()

        for code in ("EEA_WEI_PLUS", "HUBEAU_HYDROMETRIE", "HUBEAU_QUALITE_SURFACE"):
            assert registry.allows(code) is False
            assert registry.exclusion_reason(code) == EXCLUSION_DECISION_PENDING

    def test_wri_is_refused_with_its_real_reason(self) -> None:
        registry = current_registry()

        assert registry.allows("WRI_AQUEDUCT") is False
        assert registry.exclusion_reason("WRI_AQUEDUCT") == EXCLUSION_DECISION_REFUSED
        assert "enregistrement" in registry.get("WRI_AQUEDUCT").reason.lower()

    def test_copernicus_is_refused_with_its_real_reason(self) -> None:
        registry = current_registry()

        assert registry.allows("COPERNICUS_EDO") is False
        assert "decoder_deferred" in registry.get("COPERNICUS_EDO").reason

    def test_unknown_source_is_excluded_by_default(self) -> None:
        assert current_registry().allows("SOURCE_INCONNUE") is False
        assert current_registry().exclusion_reason("SOURCE_INCONNUE") == EXCLUSION_NO_DECISION

    def test_approved_without_reviewer_is_refused_at_construction(self) -> None:
        """Une signature manquante n'est pas une signature."""
        with pytest.raises(PublicationDecisionError, match="signature manquante"):
            PublicationDecision(
                source_code="X", status="approved", reason="Sans réviseur."
            )

    def test_decision_without_reason_is_refused(self) -> None:
        with pytest.raises(PublicationDecisionError, match="motif obligatoire"):
            PublicationDecision(source_code="X", status="proposed", reason="  ")

    def test_duplicate_decision_is_refused(self) -> None:
        decision = PublicationDecision(source_code="X", status="proposed", reason="ok")

        with pytest.raises(PublicationDecisionError, match="deux décisions"):
            PublicationDecisionRegistry([decision, decision])

    def test_proposed_never_becomes_authorised(self) -> None:
        proposed = PublicationDecision(source_code="X", status="proposed", reason="analyse faite")

        assert proposed.allows_publication is False
        assert proposed.exclusion_reason == EXCLUSION_DECISION_PENDING


# ---------------------------------------------------------------------------
# Snapshot vide — état valide et testé
# ---------------------------------------------------------------------------


class TestEmptySnapshot:
    def test_real_registry_produces_an_empty_snapshot(self) -> None:
        snapshot = assemble([observation()], registry=current_registry())

        assert snapshot.is_empty is True
        assert snapshot.manifest is None
        assert snapshot.observation_count == 0
        assert snapshot.included_source_codes == ()

    def test_empty_snapshot_is_still_informative(self) -> None:
        """Un snapshot vide porte les exclusions, les décisions et les
        budgets : de l'information réelle et vérifiable."""
        snapshot = assemble([observation()], registry=current_registry())

        assert snapshot.exclusions
        assert snapshot.decisions
        assert snapshot.budgets["max_features_per_layer"] == 1000
        assert any("gate licence" in w for w in snapshot.warnings)

    def test_empty_snapshot_serialises_and_has_an_etag(self) -> None:
        snapshot = assemble([], registry=current_registry())

        payload = json.loads(snapshot.canonical_json())
        assert payload["is_empty"] is True
        assert payload["manifest"] is None
        assert snapshot.etag().startswith('W/"wi-')

    def test_every_excluded_source_carries_a_reason(self) -> None:
        snapshot = assemble([observation()], registry=current_registry())

        for exclusion in snapshot.exclusions:
            assert exclusion.reason
            assert exclusion.detail

    def test_wri_and_copernicus_are_explicitly_excluded_in_the_manifest(self) -> None:
        snapshot = assemble([observation()], registry=current_registry())

        excluded = {e.source_code for e in snapshot.exclusions}
        assert "WRI_AQUEDUCT" in excluded
        assert "COPERNICUS_EDO" in excluded


# ---------------------------------------------------------------------------
# Assemblage avec sources autorisées
# ---------------------------------------------------------------------------


class TestAssembly:
    def test_approved_source_is_published(self) -> None:
        snapshot = assemble([observation()])

        assert snapshot.is_empty is False
        assert snapshot.observation_count == 1
        assert snapshot.included_source_codes == ("EEA_WEI_PLUS",)
        assert snapshot.manifest is not None
        assert snapshot.manifest.observations[0].value == 12.5

    def test_blocked_licence_observation_is_never_published(self) -> None:
        """Double barrière : la source est autorisée, mais la licence de
        l'observation interdit l'affichage."""
        withheld = observation(value=None, value_withheld=True, source=source(license=BLOCKED))

        snapshot = assemble([withheld])

        assert snapshot.observation_count == 0
        assert any("non publiable" in w for w in snapshot.warnings)

    def test_manifest_lists_periods_and_methods(self) -> None:
        q1 = observation(period_start=date(2023, 1, 1), period_end=date(2023, 3, 31))
        q3 = observation(period_start=date(2023, 7, 1), period_end=date(2023, 9, 30))

        snapshot = assemble([q1, q3])

        assert snapshot.periods == (
            ("2023-01-01", "2023-03-31"),
            ("2023-07-01", "2023-09-30"),
        )
        assert snapshot.methods == (("CC-WI-EEA-WEI-PLUS-PASSTHROUGH", "1.0.0"),)

    def test_two_periods_are_both_kept(self) -> None:
        """Application directe de l'identité C1 : deux périodes, deux faits."""
        q1 = observation(period_start=date(2023, 1, 1), period_end=date(2023, 3, 31))
        q3 = observation(period_start=date(2023, 7, 1), period_end=date(2023, 9, 30))

        assert assemble([q1, q3]).observation_count == 2

    def test_identity_collision_is_raised_not_silently_resolved(self) -> None:
        first = observation(value=1.0)
        second = observation(value=2.0)

        with pytest.raises(WaterIdentityCollisionError):
            assemble([first, second])

    def test_replayed_identical_observation_is_idempotent(self) -> None:
        obs = observation()

        snapshot = assemble([obs, obs])

        assert snapshot.observation_count == 2  # les deux sont publiées…
        assert len(snapshot.manifest.sources) == 1  # …mais la source est unique

    def test_attribution_is_carried(self) -> None:
        snapshot = assemble([observation()])

        assert snapshot.manifest.sources[0].attribution is not None
        assert "EEA" in snapshot.manifest.sources[0].attribution

    def test_missing_value_is_kept_as_absent_not_zero(self) -> None:
        absent = observation(value=None)

        snapshot = assemble([absent])

        assert snapshot.manifest.observations[0].value is None

    def test_coverage_is_exposed_separately_from_value(self) -> None:
        snapshot = assemble([observation()])

        published = snapshot.manifest.observations[0]
        assert published.quality.coverage_pct == 80.0
        assert published.quality.confidence == 60


# ---------------------------------------------------------------------------
# Déterminisme, ETag, cache
# ---------------------------------------------------------------------------


class TestDeterminismAndCache:
    def test_same_inputs_produce_identical_bytes(self) -> None:
        first = assemble([observation()])
        second = assemble([observation()])

        assert first.canonical_json() == second.canonical_json()
        assert first.etag() == second.etag()

    def test_input_order_does_not_change_the_snapshot(self) -> None:
        q1 = observation(period_start=date(2023, 1, 1), period_end=date(2023, 3, 31))
        q3 = observation(period_start=date(2023, 7, 1), period_end=date(2023, 9, 30))

        forward = assemble([q1, q3])
        backward = assemble([q3, q1])

        assert forward.canonical_json() == backward.canonical_json()
        assert forward.etag() == backward.etag()

    def test_etag_changes_when_content_changes(self) -> None:
        """Le cache ne peut être invalidé que par un changement réel."""
        base = assemble([observation()])
        changed = assemble([observation(value=13.5)])

        assert base.etag() != changed.etag()

    def test_etag_is_weak_and_prefixed(self) -> None:
        etag = assemble([observation()]).etag()

        assert etag.startswith('W/"wi-')
        assert etag.endswith('"')

    def test_generated_at_is_injected_never_read_from_a_clock(self) -> None:
        snapshot = assemble([observation()])

        assert snapshot.generated_at == GENERATED_AT

        tree = ast.parse(SNAPSHOT_MODULE.read_text(encoding="utf-8"))
        clock_calls = [
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in {"now", "utcnow", "today"}
        ]
        assert not clock_calls


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------


class TestBudgets:
    def test_budgets_match_the_p02_contract(self) -> None:
        budgets = assemble([observation()]).budgets

        assert budgets["max_manifest_bytes_uncompressed"] == 100_000
        assert budgets["max_layer_bytes_gzip"] == 400_000
        assert budgets["max_features_per_layer"] == 1_000
        assert budgets["max_points_per_series"] == 120

    def test_gzip_payload_is_measured(self) -> None:
        snapshot = assemble([observation()])

        assert 0 < snapshot.payload_bytes_gzip() < snapshot.payload_bytes()

    def test_oversized_snapshot_is_refused_not_truncated(self) -> None:
        many = [
            observation(
                geography=WaterGeographyRef(
                    scope="europe", code=f"EEA-FIX-{i:05d}", label=f"EEA-FIX-{i:05d}"
                )
            )
            for i in range(400)
        ]

        with pytest.raises(SnapshotBudgetExceeded, match="jamais tronquer"):
            assemble(many)

    def test_empty_snapshot_is_far_below_budget(self) -> None:
        snapshot = assemble([], registry=current_registry())

        assert snapshot.payload_bytes() < MAX_MANIFEST_BYTES_UNCOMPRESSED


# ---------------------------------------------------------------------------
# Aucune donnée tenant
# ---------------------------------------------------------------------------


class TestNoTenantData:
    def test_public_mapping_contains_no_tenant_field(self) -> None:
        payload = assemble([observation()]).canonical_json()

        for tenant_field in ("company_id", "tenant_id", "site_id", "user_id"):
            assert tenant_field not in payload

    def test_tenant_field_in_an_observation_stops_the_assembly(self) -> None:
        leaky = observation()
        object.__setattr__(leaky, "company_id", 42)

        with pytest.raises(TenantDataLeakError, match="champ tenant"):
            assemble([leaky])

    def test_loader_refuses_a_snapshot_carrying_a_tenant_field(self) -> None:
        payload = json.dumps(
            {"schema_version": SNAPSHOT_SCHEMA_VERSION, "company_id": 7}
        ).encode("utf-8")

        with pytest.raises(TenantDataLeakError):
            PublicSnapshotLoader().load_mapping(payload)


# ---------------------------------------------------------------------------
# Loader public — borné, lecture seule
# ---------------------------------------------------------------------------


class TestLoader:
    def test_loads_a_valid_snapshot(self) -> None:
        snapshot = assemble([observation()])

        loaded = PublicSnapshotLoader().load_mapping(snapshot.canonical_json().encode("utf-8"))

        assert loaded["schema_version"] == SNAPSHOT_SCHEMA_VERSION
        assert loaded["is_empty"] is False

    def test_refuses_an_oversized_payload(self) -> None:
        with pytest.raises(SnapshotBudgetExceeded):
            PublicSnapshotLoader(max_bytes=10).load_mapping(b'{"schema_version":"1.0.0"}')

    def test_refuses_unreadable_bytes(self) -> None:
        with pytest.raises(PublicSnapshotError, match="illisible"):
            PublicSnapshotLoader().load_mapping(b"<html>nope</html>")

    def test_refuses_an_unexpected_schema_version(self) -> None:
        payload = json.dumps({"schema_version": "999.0.0"}).encode("utf-8")

        with pytest.raises(PublicSnapshotError, match="version de schéma"):
            PublicSnapshotLoader().load_mapping(payload)

    def test_loader_exposes_no_write_method(self) -> None:
        """Lecture seule : la surface publique consomme, elle ne produit pas."""
        methods = {m for m in dir(PublicSnapshotLoader) if not m.startswith("_")}

        assert methods == {"load_mapping"}

    def test_module_has_no_network_or_database_import(self) -> None:
        tree = ast.parse(SNAPSHOT_MODULE.read_text(encoding="utf-8"))
        roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                roots.add(node.module.split(".")[0])

        assert not (roots & {"requests", "httpx", "urllib", "socket", "db", "psycopg2"})
