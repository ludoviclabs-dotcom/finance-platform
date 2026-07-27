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


class TestTheMeasurementQueriesTheRealSchema:
    """Une requête SQL écrite de mémoire est une supposition.

    Défaut trouvé en revue (PR #175) : la mesure interrogeait une table
    `sources` — qui n'existe pas, le registre est `source_registry` — et
    sélectionnait des colonnes `license_url`/`license_allows_*` absentes du
    schéma. Le workflow atteint cette requête APRÈS avoir acquis les trois
    sources sur le réseau et ingéré les trois candidats : l'échec serait
    survenu au pire moment, exactement comme l'invocation `ingest_release`
    corrigée en PR #174.

    Le remède n'est pas une meilleure requête : c'est de n'en avoir qu'une.
    """

    def test_the_builder_reuses_the_writer_s_own_source_lookup(self) -> None:
        source = Path(bcs.__file__).read_text(encoding="utf-8")
        assert "load_source_row(" in source, (
            "le constructeur doit relire la source via la fonction du graveur, "
            "pas via une requête réécrite."
        )
        assert "FROM sources" not in source, (
            "`sources` n'existe pas — le registre est `source_registry`."
        )

    def test_the_shared_lookup_targets_the_table_that_exists(self) -> None:
        from services.water import staging_writer

        writer = Path(staging_writer.__file__).read_text(encoding="utf-8")
        assert "FROM source_registry WHERE code = %s" in writer

    def test_the_lookup_row_feeds_the_real_license_evaluator(self) -> None:
        """`license_policy.evaluate()` lit des colonnes précises.

        Les nommer à côté (`license_allows_derivatives` plutôt que
        `derived_use_allowed`) rendrait une décision entièrement fermée sans
        aucune erreur — une source correctement licenciée serait refusée, ou
        pire, une absence de colonne serait lue comme un `False`.
        """
        import inspect

        from services.intelligence import license_policy

        body = inspect.getsource(license_policy.evaluate)
        for column in (
            "automated_access_allowed",
            "storage_allowed",
            "display_allowed",
            "derived_use_allowed",
        ):
            assert f'"{column}"' in body


class TestBudgetsAreMeasuredWithinACandidate:
    """Une même source n'a pas le même périmètre d'un candidat à l'autre.

    Défaut trouvé en revue (PR #175) : les releases préparées étaient rangées
    par source seule. `HUBEAU_ADES` figurant dans les TROIS candidats, la
    mesure de `minimal_pilot` additionnait les trois releases — trois fois ses
    observations, trois fois son budget. Ce sont les chiffres censés guider la
    décision de publication : gonflés, ils ne guident rien.
    """

    def test_the_same_source_carries_distinct_scopes_across_candidates(self) -> None:
        """Le fait qui rend l'index par source seule faux."""
        from scripts.water_intelligence.candidate_scopes import CANDIDATES_BY_KEY

        windows = {
            key: next(
                s for s in candidate.scopes
                if s.source_code == "HUBEAU_QUALITE_SURFACE"
            )
            for key, candidate in CANDIDATES_BY_KEY.items()
            if "HUBEAU_QUALITE_SURFACE" in candidate.source_codes
        }
        assert len(windows) >= 2
        assert len({(s.date_from, s.date_to) for s in windows.values()}) > 1, (
            "si les fenêtres devenaient identiques, ce test cesserait de "
            "protéger quoi que ce soit — le mélange resterait faux."
        )

    def test_ades_appears_in_every_candidate_with_a_distinct_release_key(self) -> None:
        from scripts.water_intelligence.candidate_scopes import CANDIDATES

        keys = {
            f"hubeau_ades-{candidate.key}-x4b-prep"
            for candidate in CANDIDATES
            if "HUBEAU_ADES" in candidate.source_codes
        }
        assert len(keys) == 3

    def test_prepared_releases_are_keyed_by_candidate_then_source(self) -> None:
        from scripts.water_intelligence.build_candidate_snapshots import (
            _PreparedReleases,
        )

        class _Release:
            def __init__(self, observations):
                self.observations = observations

        loaded = _PreparedReleases(
            by_candidate={
                "minimal_pilot": {"HUBEAU_ADES": [_Release(["a", "b"])]},
                "x3_technical_sample": {"HUBEAU_ADES": [_Release(["c", "d", "e"])]},
            }
        )
        # Le défaut corrigé : `minimal_pilot` ne doit PAS voir les cinq.
        assert loaded.observations("minimal_pilot", ["HUBEAU_ADES"]) == ["a", "b"]
        assert loaded.observations("x3_technical_sample", ["HUBEAU_ADES"]) == [
            "c",
            "d",
            "e",
        ]
        assert len(loaded.releases()) == 2

    def test_an_unknown_candidate_yields_nothing_rather_than_everything(self) -> None:
        from scripts.water_intelligence.build_candidate_snapshots import (
            _PreparedReleases,
        )

        loaded = _PreparedReleases(by_candidate={})
        assert loaded.observations("inexistant", ["HUBEAU_ADES"]) == []
        assert loaded.codes_of("inexistant") == frozenset()


class TestParityCheckNeverEnforcesBudget:
    """Défaut trouvé au premier run réel (candidat `x3_technical_sample`) :
    `_check_parity` reconstruisait chaque release avec le budget appliqué par
    défaut, et la release ADES seule (~255 ko) faisait lever
    `SnapshotBudgetExceeded` AVANT que `command_measure` n'ait pu rapporter
    quoi que ce soit — le run entier mourait sur la première release
    individuellement surdimensionnée.

    Vérouillé au niveau du texte source : `_check_parity` doit passer
    `enforce_budget=False` à `reconstruct_candidate` — la parité vérifie la
    fidélité du contenu, pas la taille de publication, et les deux sont
    orthogonales.
    """

    def test_check_parity_disables_budget_enforcement(self) -> None:
        """Lu sur l'AST, pas sur le texte : un commentaire mentionnant
        `enforce_budget=False` ferait passer une recherche textuelle même si
        l'argument réel avait disparu du code — exactement le faux négatif
        que ce test doit éviter."""
        import ast

        source = Path(bcs.__file__).read_text(encoding="utf-8")
        tree = ast.parse(source)
        function = next(
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.FunctionDef) and node.name == "_check_parity"
        )
        calls = [
            node
            for node in ast.walk(function)
            if isinstance(node, ast.Call)
            and getattr(node.func, "attr", None) == "reconstruct_candidate"
        ]
        assert len(calls) == 1
        keywords = {kw.arg: kw.value for kw in calls[0].keywords}
        assert "enforce_budget" in keywords, (
            "_check_parity doit passer enforce_budget explicitement à "
            "reconstruct_candidate."
        )
        value = keywords["enforce_budget"]
        assert isinstance(value, ast.Constant) and value.value is False, (
            "_check_parity doit reconstruire SANS enforcer le budget de "
            "publication — une release individuellement surdimensionnée "
            "(cas connu : ADES/x3_technical_sample) ne doit pas faire "
            "échouer tout le run de mesure."
        )


class TestAdesDiffReadsTheValidatedReport:
    """Le verdict ADES doit venir des PREUVES, pas d'un champ manquant.

    Défaut du run 30306257628 : `command_diff_ades` lisait le payload brut,
    n'y trouvait ni `payload_sha256` ni `bytes_received`, et concluait
    `content_changed` sur `null` / `0` — un blocage prononcé sur une absence
    de preuve prise pour une preuve d'absence. Le rapport du même run portait
    pourtant exactement le checksum X3.
    """

    ADES_X3 = "54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b"

    def _reports_dir(self, tmp_path, *, checksum: str, size: int):
        """Écrit le rapport ADES du candidat `x3_technical_sample`."""
        import json as _json

        payload = {
            "source_code": "HUBEAU_ADES",
            "release_key": "hubeau_ades-x3_technical_sample-x4b-prep",
            "verdict": "ready_for_staging",
            "executed_at": "2026-07-27T21:18:58+00:00",
            "dry_run": True,
            "bytes_received": size,
            "pages_fetched": 1,
            "records_received": 182,
            "records_normalized": 182,
            "payload_sha256": checksum,
            "periods": ["2024-01-01/2024-03-31"],
            "geographies": ["09892X0679/EXH70"],
            "units": ["m"],
        }
        reports = tmp_path / "reports"
        reports.mkdir(parents=True, exist_ok=True)
        (reports / "acq_x3_technical_sample_HUBEAU_ADES.md").write_text(
            "# Validation live — HUBEAU_ADES\n\n```json\n"
            + _json.dumps(payload, ensure_ascii=False, indent=2)
            + "\n```\n",
            encoding="utf-8",
        )
        return reports

    def _run(self, tmp_path, *, checksum: str, size: int):
        import argparse
        import json as _json

        reports = self._reports_dir(tmp_path, checksum=checksum, size=size)
        args = argparse.Namespace(
            report_dir=str(reports), artifact_dir=str(tmp_path / "artifacts")
        )
        try:
            code = bcs.command_diff_ades(args)
        except bcs.CandidateBuildError as exc:
            code = exc
        verdict = _json.loads(
            (reports / "40_ades_diff.json").read_text(encoding="utf-8")
        )
        return code, verdict

    def test_the_x3_checksum_yields_byte_stable(self, tmp_path) -> None:
        """Le cas RÉEL du run 30306257628, avec sa vraie preuve."""
        code, report = self._run(tmp_path, checksum=self.ADES_X3, size=52139)
        assert code == 0
        assert report["verdict"] == "byte_stable"
        assert report["run_checksum"] == self.ADES_X3
        assert report["run_bytes"] == 52139
        assert report["matches_reference"]["X3"] is True
        assert report["blocks_source"] is None

    def test_the_run_bytes_are_never_zero_when_the_report_exists(self, tmp_path) -> None:
        """La signature exacte du défaut : `run_bytes=0` avec un rapport présent."""
        _, report = self._run(tmp_path, checksum=self.ADES_X3, size=52139)
        assert report["run_bytes"] != 0
        assert report["run_checksum"] is not None

    def test_same_length_other_checksum_is_provisional_not_final(self, tmp_path) -> None:
        code, report = self._run(tmp_path, checksum="a" * 64, size=52139)
        assert code == 0
        assert report["verdict"] == "transport_only_variation_unproven"
        assert report["blocks_source"] is None

    def test_other_length_other_checksum_blocks_ades_only(self, tmp_path) -> None:
        code, report = self._run(tmp_path, checksum="b" * 64, size=99999)
        assert isinstance(code, bcs.CandidateBuildError)
        assert report["verdict"] == "content_changed"
        # Le blocage est SOURCE-SCOPED : il nomme ADES, et rien d'autre.
        assert report["blocks_source"] == "HUBEAU_ADES"
        assert "QUALITE" in report["scope_note"] and "BNPE" in report["scope_note"]

    def test_a_missing_report_fails_loudly(self, tmp_path) -> None:
        import argparse

        reports = tmp_path / "reports"
        reports.mkdir()
        args = argparse.Namespace(
            report_dir=str(reports), artifact_dir=str(tmp_path / "artifacts")
        )
        with pytest.raises(bcs.CandidateBuildError, match="preuve d'acquisition"):
            bcs.command_diff_ades(args)

    def test_the_diff_never_reads_a_raw_payload(self) -> None:
        """Verrou de source : le payload brut ne doit plus être une entrée."""
        source = Path(bcs.__file__).read_text(encoding="utf-8")
        assert "_read_acquisition" not in source, (
            "le lecteur de payload brut doit avoir disparu — sa seule existence "
            "rend le défaut réintroduisible."
        )
        assert "load_acquisition_evidence" in source


class TestAcquisitionSummaryUsesRealCounts:
    """`10_acquisitions.json` portait 0 partout, pour la même raison."""

    def _evidence(self, *, records: int, pages: int, size: int):
        from services.water.staging_ingestion import AcquisitionEvidence

        return AcquisitionEvidence(
            source_code="HUBEAU_QUALITE_SURFACE",
            release_key="hubeau_qualite_surface-balanced_pilot-x4b-prep",
            verdict="ready_for_staging",
            bytes_received=size,
            pages_fetched=pages,
            records_received=records,
            records_normalized=records,
            payload_sha256="c" * 64,
            periods=("2024-01-01/2024-01-31",),
            geographies=("34",),
            units=("mg/L",),
        )

    def _scope(self, source_code: str):
        return next(
            s
            for s in cs.CANDIDATES_BY_KEY["balanced_pilot"].scopes
            if s.source_code == source_code
        )

    def test_quality_balanced_reports_its_real_counts(self) -> None:
        scope = self._scope("HUBEAU_QUALITE_SURFACE")
        summary = bcs._assert_exhaustive(
            scope, self._evidence(records=78, pages=1, size=455168)
        )
        assert summary["records_received"] == 78
        assert summary["pages"] == 1
        assert summary["bytes_received"] == 455168
        # 78 < 1 × 200 : la dernière page n'est pas saturée, donc exhaustif.
        assert summary["last_page_full"] is False
        assert summary["exhaustive"] is True

    def test_bnpe_balanced_reports_its_real_counts(self) -> None:
        scope = self._scope("HUBEAU_BNPE_PRELEVEMENTS")
        summary = bcs._assert_exhaustive(
            scope, self._evidence(records=3, pages=1, size=3118)
        )
        assert summary["records_received"] == 3
        assert summary["exhaustive"] is True

    def test_a_saturated_last_page_is_not_exhaustive(self) -> None:
        """Le contrôle se fonde sur pages × page_size RÉELS.

        Mesuré sur le scope `x3_technical_sample`, qui ne revendique PAS
        l'exhaustivité : c'est justement le périmètre dont X3 a montré que sa
        dernière page était saturée.
        """
        scope = next(
            s
            for s in cs.CANDIDATES_BY_KEY["x3_technical_sample"].scopes
            if s.source_code == "HUBEAU_QUALITE_SURFACE"
        )
        assert scope.expects_incomplete_last_page is False
        summary = bcs._assert_exhaustive(
            scope, self._evidence(records=scope.page_size, pages=1, size=1)
        )
        assert summary["last_page_full"] is True
        assert summary["exhaustive"] is False

    def test_a_scope_claiming_exhaustivity_refuses_a_saturated_page(self) -> None:
        scope = self._scope("HUBEAU_QUALITE_SURFACE")
        assert scope.expects_incomplete_last_page is True
        with pytest.raises(bcs.CandidateBuildError, match="SATURÉE"):
            bcs._assert_exhaustive(
                scope, self._evidence(records=scope.page_size, pages=1, size=1)
            )

    def test_the_summary_carries_the_checksum_not_a_null(self) -> None:
        scope = self._scope("HUBEAU_BNPE_PRELEVEMENTS")
        summary = bcs._assert_exhaustive(
            scope, self._evidence(records=3, pages=1, size=3118)
        )
        assert summary["payload_sha256"] == "c" * 64


class TestSecurityStepsSurviveASourceBlock:
    """Un blocage de source ne doit dispenser aucun contrôle de sortie.

    Au run 30306257628, l'échec `diff-ades` a fait SAUTER « Vérifier qu'aucune
    donnée n'a été publiée » et « Scanner les rapports » : les deux étapes
    n'avaient pas de garde `if`. Un contrôle de sécurité qui ne s'exécute
    qu'en cas de succès ne contrôle que les runs dont on se méfie le moins.
    """

    #: Lu SANS PyYAML : `requirements.txt` ne le déclare pas, et le job `tests`
    #: de la CI n'installe que celui-là. S'en remettre à une bibliothèque
    #: présente seulement en local, c'est écrire un test qui ne s'exécute que
    #: sur la machine où il a été écrit — le défaut de la première version de
    #: cette classe, trouvé par la CI. Le fichier a une structure fixe (steps à
    #: 6 espaces, clés à 8), et ce scan ligne à ligne suffit à la lire.
    WORKFLOW = (
        Path(bcs.__file__).resolve().parents[4]
        / ".github"
        / "workflows"
        / "water-x4b-candidate-builder.yml"
    )

    def _steps(self) -> list[dict[str, str]]:
        steps: list[dict[str, str]] = []
        current: dict[str, str] | None = None
        in_steps = False
        for line in self.WORKFLOW.read_text(encoding="utf-8").split("\n"):
            if line.strip() == "steps:":
                in_steps = True
                continue
            if not in_steps:
                continue
            if line.startswith("      - "):
                current = {}
                steps.append(current)
                body = line[len("      - ") :]
            elif (
                line.startswith("        ")
                and not line.startswith("         ")
                and current is not None
            ):
                # Exactement 8 espaces : une clé de l'étape elle-même. Plus
                # profond, c'est un bloc imbriqué (`with:`), dont le `name:`
                # écraserait celui de l'étape.
                body = line[8:]
            else:
                continue
            if ":" in body and not body.lstrip().startswith(("#", "|", "-")):
                key, _, value = body.partition(":")
                if key.strip() and " " not in key.strip():
                    current[key.strip()] = value.strip()
        return steps

    def test_the_step_scan_actually_finds_the_steps(self) -> None:
        """Sans ce contrôle, un scan cassé rendrait les autres tests vides."""
        names = [s["name"] for s in self._steps() if "name" in s]
        assert len(names) >= 12, names
        assert any("Diff ADES" in n for n in names)

    def test_the_three_exit_steps_always_run(self) -> None:
        guarded = {
            step["name"]: step.get("if")
            for step in self._steps()
            if "name" in step
            and (
                "aucune donnée n'a été publiée" in step["name"]
                or "Scanner les rapports" in step["name"]
                or "Publier les rapports" in step["name"]
            )
        }
        assert len(guarded) == 3, guarded
        for name, condition in guarded.items():
            assert condition == "always()", f"{name} ne s'exécute pas toujours"

    def test_the_workflow_stays_dispatch_only(self) -> None:
        """Un blocage de source ne doit pas devenir un prétexte à automatiser."""
        text = self.WORKFLOW.read_text(encoding="utf-8")
        assert "\n  workflow_dispatch:\n" in text
        for forbidden in ("\n  push:", "\n  pull_request:", "\n  schedule:"):
            assert forbidden not in text, f"déclencheur interdit : {forbidden.strip()}"
        assert "\npermissions:\n  contents: read\n" in text
        # `contents: write` apparaît dans le commentaire d'en-tête, qui explique
        # pourquoi il est refusé. Seules les lignes EFFECTIVES comptent.
        effective = [
            line
            for line in text.split("\n")
            if "contents: write" in line and not line.lstrip().startswith("#")
        ]
        assert not effective, effective
