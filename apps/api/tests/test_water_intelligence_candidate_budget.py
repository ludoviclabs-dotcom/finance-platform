"""tests/test_water_intelligence_candidate_budget.py — mesure de budget et
définition des périmètres candidats (X4B-PREP).

Ces tests exercent la MACHINERIE sur des observations construites, pas sur une
acquisition réelle : Hub'Eau est injoignable depuis l'environnement de CI
public, et aucune valeur mesurée sur données réelles n'est donc produite ici.
Ce qu'ils verrouillent, c'est que la machinerie **refuse** au lieu de tronquer,
et qu'elle ne recommande jamais un candidat hors budget.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.water_intelligence import (
    MethodRef,
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterQualityMetadata,
    WaterSourceReference,
)
from scripts.water_intelligence import build_candidate_snapshots as bcs
from scripts.water_intelligence import candidate_budget as cb
from scripts.water_intelligence import candidate_scopes as cs
from services.water_intelligence import source_attribution as sa
from services.water_intelligence.public_snapshot import (
    MAX_MANIFEST_BYTES_UNCOMPRESSED,
)
from services.water_intelligence.publication_decisions import (
    PublicationDecision,
    PublicationDecisionRegistry,
)

CLOCK = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)
ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)


def _observations(source_code: str, count: int) -> list[WaterMetricObservation]:
    source = WaterSourceReference(
        source_code=source_code,
        release_key=f"{source_code.lower()}-x4b-prep",
        checksum_sha256="c" * 64,
        retrieved_at=date(2026, 7, 26),
        methodology_version="1.0.0",
        license=ALLOWED,
        attribution=sa.attribution_label(source_code, accessed_on=date(2026, 7, 26)),
        source_information_url=sa.information_url(source_code),
        source_refresh_cadence=sa.refresh_cadence(source_code),
        source_last_updated_on=sa.last_updated_on(source_code),
    )
    return [
        WaterMetricObservation(
            metric_code=f"{source_code.lower()}.metric",
            value=float(index),
            unit="m",
            geography=WaterGeographyRef(scope="france", code=f"S{index:05d}", label=f"S{index:05d}"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 1),
            method=MethodRef(code="CC-WI-TEST", version="1.0.0"),
            quality=WaterQualityMetadata(
                data_status="observed", coverage_pct=100.0, confidence=90
            ),
            source=source,
            value_withheld=False,
        )
        for index in range(count)
    ]


def _registry(*source_codes: str) -> PublicationDecisionRegistry:
    """Registre de TEST signé — le registre réel reste intouché."""
    return PublicationDecisionRegistry(
        [
            PublicationDecision(
                source_code=code,
                status="approved",
                reason="Signature FICTIVE, propre à ce test.",
                reviewed_by="test",
                reviewed_on=date(2026, 7, 27),
            )
            for code in source_codes
        ]
    )


class TestBudgetIsMeasuredNeverEstimated:
    def test_a_small_candidate_is_within_budget_with_a_named_margin(self) -> None:
        measurement = cb.measure(
            label="A",
            observations=_observations("HUBEAU_ADES", 10),
            registry=_registry("HUBEAU_ADES"),
            generated_at=CLOCK,
        )
        assert measurement.verdict == "within_budget"
        assert measurement.payload_bytes is not None
        assert measurement.margin_bytes == MAX_MANIFEST_BYTES_UNCOMPRESSED - measurement.payload_bytes
        assert measurement.observation_count == 10

    def test_an_oversized_candidate_is_refused_not_truncated(self) -> None:
        """Le refus EST le résultat — aucun candidat n'est allégé pour passer."""
        measurement = cb.measure(
            label="trop gros",
            observations=_observations("HUBEAU_ADES", 4000),
            registry=_registry("HUBEAU_ADES"),
            generated_at=CLOCK,
        )
        assert measurement.verdict == "over_budget"
        assert measurement.payload_bytes is None
        assert measurement.margin_bytes is None
        assert measurement.refusal and "budget" in measurement.refusal.lower()
        # L'observation compte reste celui du candidat DEMANDÉ : rien n'a été
        # retiré pour produire un résultat présentable.
        assert measurement.observation_count == 4000

    def test_provenance_weight_is_reported_separately(self) -> None:
        """La part qu'on serait tenté d'alléger en premier est rendue visible."""
        measurement = cb.measure(
            label="A",
            observations=_observations("HUBEAU_ADES", 10),
            registry=_registry("HUBEAU_ADES"),
            generated_at=CLOCK,
        )
        assert measurement.provenance_bytes and measurement.provenance_bytes > 0

    def test_gzip_is_reported_but_never_the_budget(self) -> None:
        measurement = cb.measure(
            label="A",
            observations=_observations("HUBEAU_ADES", 10),
            registry=_registry("HUBEAU_ADES"),
            generated_at=CLOCK,
        )
        assert measurement.payload_bytes_gzip is not None
        assert measurement.as_mapping()["budget_bytes"] == MAX_MANIFEST_BYTES_UNCOMPRESSED


class TestRecommendation:
    def test_the_largest_compliant_candidate_is_recommended(self) -> None:
        small = cb.measure(
            label="A", observations=_observations("HUBEAU_ADES", 5),
            registry=_registry("HUBEAU_ADES"), generated_at=CLOCK,
        )
        larger = cb.measure(
            label="B", observations=_observations("HUBEAU_ADES", 40),
            registry=_registry("HUBEAU_ADES"), generated_at=CLOCK,
        )
        assert cb.recommend([small, larger]) is larger

    def test_an_over_budget_candidate_is_never_recommended(self) -> None:
        small = cb.measure(
            label="A", observations=_observations("HUBEAU_ADES", 5),
            registry=_registry("HUBEAU_ADES"), generated_at=CLOCK,
        )
        huge = cb.measure(
            label="C", observations=_observations("HUBEAU_ADES", 4000),
            registry=_registry("HUBEAU_ADES"), generated_at=CLOCK,
        )
        assert cb.recommend([small, huge]) is small

    def test_no_recommendation_when_nothing_fits(self) -> None:
        huge = cb.measure(
            label="C", observations=_observations("HUBEAU_ADES", 4000),
            registry=_registry("HUBEAU_ADES"), generated_at=CLOCK,
        )
        assert cb.recommend([huge]) is None


class TestCandidateScopes:
    def test_three_families_exist(self) -> None:
        assert set(cs.CANDIDATES_BY_KEY) == {
            "minimal_pilot",
            "balanced_pilot",
            "x3_technical_sample",
        }

    def test_the_x3_sample_is_never_recommended_for_publication(self) -> None:
        """Deux de ses trois périmètres sont des pages saturées, donc tronquées."""
        assert cs.X3_TECHNICAL_SAMPLE.recommended_for_publication is False

    def test_saturated_x3_scopes_do_not_claim_exhaustivity(self) -> None:
        by_source = {s.source_code: s for s in cs.X3_TECHNICAL_SAMPLE.scopes}
        assert by_source["HUBEAU_QUALITE_SURFACE"].expects_incomplete_last_page is False
        assert by_source["HUBEAU_BNPE_PRELEVEMENTS"].expects_incomplete_last_page is False
        # ADES n'était PAS saturée en X3 (182 < 200) : elle peut le prétendre.
        assert by_source["HUBEAU_ADES"].expects_incomplete_last_page is True

    def test_editorial_candidates_all_claim_and_must_prove_exhaustivity(self) -> None:
        for candidate in (cs.MINIMAL_PILOT, cs.BALANCED_PILOT):
            for scope in candidate.scopes:
                assert scope.expects_incomplete_last_page is True, scope.source_code

    @pytest.mark.parametrize("candidate", cs.CANDIDATES)
    def test_every_scope_names_a_justification_and_an_interpretation_risk(
        self, candidate: cs.Candidate
    ) -> None:
        for scope in candidate.scopes:
            assert scope.justification.strip(), scope.source_code
            assert scope.interpretation_risk.strip(), scope.source_code

    @pytest.mark.parametrize("candidate", cs.CANDIDATES)
    def test_no_candidate_touches_an_excluded_source(self, candidate: cs.Candidate) -> None:
        excluded = {
            "HUBEAU_HYDROMETRIE",
            "EEA_WEI_PLUS",
            "WRI_AQUEDUCT",
            "COPERNICUS_EDO",
        }
        assert not (set(candidate.source_codes) & excluded)

    @pytest.mark.parametrize("candidate", cs.CANDIDATES)
    def test_every_candidate_source_has_a_canonical_attribution(
        self, candidate: cs.Candidate
    ) -> None:
        for source_code in candidate.source_codes:
            assert sa.attribution_for(source_code)

    def test_seven_budget_combinations_are_declared(self) -> None:
        assert len(cs.BUDGET_COMBINATIONS) == 7
        assert cs.BUDGET_COMBINATIONS[-1] == (
            "HUBEAU_ADES",
            "HUBEAU_QUALITE_SURFACE",
            "HUBEAU_BNPE_PRELEVEMENTS",
        )


class TestOperatorInvocationsMatchTheRealParsers:
    """Les invocations composées doivent être acceptées par les VRAIS parsers.

    Défaut que ces tests verrouillent, trouvé avant le premier run : le
    constructeur composait `ingest_release --artifact-dir …` sans
    `--source-code` ni `--report`, alors que les trois sont obligatoires. Le
    workflow aurait acquis les trois sources sur le réseau, puis échoué à la
    première ingestion sur un `unrecognized arguments` — au pire moment, après
    avoir déjà consommé les appels réseau.

    Confronter la composition au parser plutôt qu'à sa lecture est la seule
    façon de le voir sans dépenser un run : c'est la même leçon que le drapeau
    `--environment staging` de X3, qui nommait une intention sans que rien ne
    la confronte au réel.
    """

    def _scope(self) -> cs.SourceScope:
        return cs.BALANCED_PILOT.scopes[1]  # qualité : porte des --parameter-code

    def test_acquisition_argv_is_accepted_by_the_real_parser(self) -> None:
        from scripts.water_intelligence.validate_hubeau import build_parser

        argv = bcs._acquisition_argv(
            self._scope(),
            candidate_key="balanced_pilot",
            release="r-test",
            artifacts=Path("/tmp/a"),
            reports=Path("/tmp/r"),
        )
        parsed = build_parser().parse_args(argv[3:])  # sans python -m <module>
        assert parsed.release == "r-test"
        assert parsed.parameter_code == ["1339", "1340"]

    def test_ingestion_argv_is_accepted_by_the_real_parser(self) -> None:
        from scripts.water_intelligence.ingest_release import build_parser

        scope = self._scope()
        argv = bcs._ingestion_argv(
            scope,
            candidate_key="balanced_pilot",
            release="r-test",
            expect_database="carbonco_water_staging",
            artifacts=Path("/tmp/a"),
            reports=Path("/tmp/r"),
        )
        parsed = build_parser().parse_args(argv[3:])
        assert parsed.source_code == scope.source_code
        assert parsed.release == "r-test"
        assert parsed.expect_database == "carbonco_water_staging"
        assert parsed.ephemeral is True
        # `--dry-run` / `--commit` sont ajoutés par phase, jamais dans la base :
        # le défaut par défaut doit rester le dry-run.
        assert parsed.commit is False

    def test_every_candidate_scope_composes_a_valid_ingestion(self) -> None:
        """Aucun périmètre ne doit produire une invocation refusée."""
        from scripts.water_intelligence.ingest_release import build_parser

        for candidate in cs.CANDIDATES:
            for scope in candidate.scopes:
                argv = bcs._ingestion_argv(
                    scope,
                    candidate_key=candidate.key,
                    release=f"{scope.source_code.lower()}-{candidate.key}",
                    expect_database="carbonco_water_staging",
                    artifacts=Path("/tmp/a"),
                    reports=Path("/tmp/r"),
                )
                build_parser().parse_args(argv[3:])


class TestCandidatesNeverShareAcquisitionPaths:
    """`--candidate all` ne doit jamais faire écraser un candidat par un autre.

    Défaut trouvé en revue : les chemins d'artefacts et de rapport étaient
    indexés sur la seule `source_code`, alors que `HUBEAU_ADES` figure dans les
    TROIS candidats avec une `release_key` différente. A était écrasé par B,
    puis par C ; l'ingestion de A recevait le rapport de C, et `verify_report()`
    rejetait la `release_key` discordante — après que les trois acquisitions
    réseau avaient déjà été consommées.
    """

    def _pairs(self) -> list[tuple[str, str]]:
        return [
            (candidate.key, scope.source_code)
            for candidate in cs.CANDIDATES
            for scope in candidate.scopes
        ]

    def test_ades_really_appears_in_all_three_candidates(self) -> None:
        """La prémisse du défaut — si elle tombe, ces tests perdent leur sens."""
        carrying = [c.key for c in cs.CANDIDATES if "HUBEAU_ADES" in c.source_codes]
        assert len(carrying) == 3

    def test_every_pair_gets_its_own_artifact_dir_and_report(self) -> None:
        seen: dict[tuple[Path, Path], tuple[str, str]] = {}
        for candidate_key, source_code in self._pairs():
            paths = bcs._scope_paths(
                candidate_key, source_code, artifacts=Path("/tmp/a"), reports=Path("/tmp/r")
            )
            assert paths not in seen, (
                f"{candidate_key}/{source_code} partage ses chemins avec "
                f"{seen[paths]} — un candidat en écraserait un autre."
            )
            seen[paths] = (candidate_key, source_code)
        assert len(seen) == len(self._pairs())

    def test_acquisition_and_ingestion_agree_on_the_same_paths(self) -> None:
        """Le rapport écrit par l'acquisition doit être celui que l'ingestion lit.

        C'est la discordance exacte que la revue a trouvée : deux compositions
        indépendantes qui pouvaient diverger sans que rien ne le signale.
        """
        for candidate in cs.CANDIDATES:
            for scope in candidate.scopes:
                release = f"{scope.source_code.lower()}-{candidate.key}-x4b-prep"
                acq = bcs._acquisition_argv(
                    scope, candidate_key=candidate.key, release=release,
                    artifacts=Path("/tmp/a"), reports=Path("/tmp/r"),
                )
                ing = bcs._ingestion_argv(
                    scope, candidate_key=candidate.key, release=release,
                    expect_database="carbonco_water_staging",
                    artifacts=Path("/tmp/a"), reports=Path("/tmp/r"),
                )
                acq_report = acq[acq.index("--report") + 1]
                acq_dir = acq[acq.index("--artifact-dir") + 1]
                assert ing[ing.index("--report") + 1] == acq_report
                assert ing[ing.index("--artifact") + 1] == acq_dir

    def test_artifact_path_carries_the_candidate(self) -> None:
        directory, report = bcs._scope_paths(
            "balanced_pilot", "HUBEAU_ADES", artifacts=Path("/tmp/a"), reports=Path("/tmp/r")
        )
        assert "balanced_pilot" in str(directory)
        assert "balanced_pilot" in report.name
