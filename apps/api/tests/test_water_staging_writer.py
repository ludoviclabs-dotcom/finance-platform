"""tests/test_water_staging_writer.py — graveur Evidence Kernel Eau (X2B).

Deux moitiés :

1. **Étape pure** (`prepare_release`) — sans PostgreSQL, exécutée partout.
2. **Étape transactionnelle** (`ingest_staging_release`) — DB-gated, exécutée
   par le job `migration-tests` UNIQUEMENT (inscrit dans `.github/workflows/api.yml`).
   Un graveur ne se prouve pas avec un double : un double d'écriture ne peut
   ni oublier une contrainte CHECK, ni déclencher un trigger d'immutabilité,
   ni faire échouer un `ON CONFLICT`. C'est la leçon du défaut anti-IDOR de la
   Wave E, et elle vaut ici mot pour mot.

**Toutes les données sont FICTIVES** : stations `FIX-*`, valeurs inventées,
aucune donnée Hub'Eau réelle. Les `source_code` sont en revanche les VRAIS
codes du catalogue, puisque le graveur n'accepte qu'eux.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import date
from pathlib import Path

import pytest

from models.intelligence import LicenseDecision
from services.water.staging_ingestion import (
    StagingIngestionRefused,
    WaterStagingIngestionRequest,
    payload_digest,
)
from services.water.staging_writer import (
    DATA_STATUS_MAPPING,
    STAGING_RELEASE_STATUS,
    idempotency_key,
    ingest_staging_release,
    prepare_release,
)
from services.water_intelligence.release_provenance import provenance_for
from services.water_intelligence.source_attribution import stable_attribution

HYDRO = "HUBEAU_HYDROMETRIE"
RELEASE = "hubeau-hydrometrie-x2b-fixture"
STATION = "FIX-STATION-001"

PERMISSIVE = LicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)
NO_DISPLAY = LicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=False, allow_derived_use=False
)


def hydro_page(*days_and_values: tuple[str, float], station: str = STATION) -> bytes:
    return json.dumps(
        {
            "data": [
                {
                    "code_station": station,
                    "grandeur_hydro": "H",
                    "date_obs": day,
                    "resultat_obs": value,
                    "libelle_statut": "Donnée brute",
                }
                for day, value in days_and_values
            ]
        }
    ).encode("utf-8")


DEFAULT_PAGE = hydro_page(("2026-01-01", 1200.0), ("2026-01-02", 1210.0))


def report_payload(pages: list[bytes], **overrides) -> dict:
    payload = {
        "source_code": HYDRO,
        "release_key": RELEASE,
        "verdict": "ready_for_staging",
        "dry_run": True,
        "payload_sha256": payload_digest(pages),
        "periods": ["2026-01-01 → 2026-01-02"],
        "geographies": [STATION],
        "query_parameters": {
            "code_entite": STATION,
            "date_debut_obs": "2026-01-01",
            "date_fin_obs": "2026-01-31",
            "grandeur_hydro": "H",
        },
    }
    payload.update(overrides)
    return payload


def build_request(tmp_path: Path, pages: list[bytes] | None = None, **overrides):
    """Écrit artefact + rapport SYNTHÉTIQUES et rend (request, pages, report)."""
    pages = pages or [DEFAULT_PAGE]
    tmp_path.mkdir(parents=True, exist_ok=True)
    directory = tmp_path / "pages"
    directory.mkdir(parents=True, exist_ok=True)
    for index, page in enumerate(pages, start=1):
        (directory / f"{HYDRO}_p{index:03d}.json").write_bytes(page)

    report = report_payload(pages, **overrides.pop("report", {}))
    report_path = tmp_path / "report.md"
    report_path.write_text(
        "```json\n" + json.dumps(report, ensure_ascii=False) + "\n```\n", encoding="utf-8"
    )

    params = {
        "source_code": HYDRO,
        "release_key": RELEASE,
        "artifact_path": directory,
        "expected_sha256": payload_digest(pages),
        "report_path": report_path,
        "report_sha256": hashlib.sha256(report_path.read_bytes()).hexdigest(),
        "method_code": "CC-WI-HUBEAU-HYDRO-PASSTHROUGH",
        "method_version": "1.0.0",
    }
    params.update(overrides)
    request = WaterStagingIngestionRequest(**params)
    decoded = [json.loads(p) for p in pages]
    return request, pages, decoded, report


# ===========================================================================
# 1 — Étape pure : aucune base
# ===========================================================================


class TestPreparePure:
    def _prepare(self, tmp_path: Path, *, license_decision=PERMISSIVE, pages=None):
        request, _raw, decoded, report = build_request(tmp_path, pages)
        return prepare_release(
            request,
            pages=decoded,
            report=report,
            license_decision=license_decision,
            retrieved_at=date(2026, 7, 26),
            provenance=provenance_for(
                request.source_code, accessed_on=date(2026, 7, 26)
            ),
        )

    def test_each_measurement_becomes_one_identified_observation(self, tmp_path: Path) -> None:
        outcome = self._prepare(tmp_path)

        assert len(outcome.prepared) == 2
        assert outcome.records_received == 2
        assert outcome.records_rejected == 0

    def test_the_native_unit_is_preserved_without_conversion(self, tmp_path: Path) -> None:
        """X2A a établi que `H` est en millimètres : le graveur ne convertit
        rien, ni mm→m, ni l/s→m³/s."""
        outcome = self._prepare(tmp_path)

        assert {item.observation.unit for item in outcome.prepared} == {"mm"}

    def test_each_period_is_distinct(self, tmp_path: Path) -> None:
        """Deux jours = deux périodes = deux identités. Une clé sans période
        (comme `ObservationDraft.dedup_key`) en écraserait une."""
        outcome = self._prepare(tmp_path)

        periods = {(i.observation.period_start, i.observation.period_end) for i in outcome.prepared}
        assert len(periods) == 2

    def test_identities_are_distinct_and_carry_the_release(self, tmp_path: Path) -> None:
        outcome = self._prepare(tmp_path)
        identities = [item.identity for item in outcome.prepared]

        assert len({i.fingerprint() for i in identities}) == 2
        assert {i.release_key for i in identities} == {RELEASE}
        assert {i.source_code for i in identities} == {HYDRO}

    def test_a_repeated_measurement_with_identical_content_is_idempotent(
        self, tmp_path: Path
    ) -> None:
        """Même identité + même contenu = doublon ignoré, pas une erreur."""
        page = hydro_page(("2026-01-01", 1200.0), ("2026-01-01", 1200.0))
        outcome = self._prepare(tmp_path, pages=[page])

        assert len(outcome.prepared) == 1
        assert any("idempotent" in w for w in outcome.warnings)

    def test_a_repeated_identity_with_a_different_value_is_a_collision(
        self, tmp_path: Path
    ) -> None:
        """Même identité + contenu DIFFÉRENT = erreur. Aucune valeur n'est
        retenue par défaut : le premier ne gagne pas en silence."""
        page = hydro_page(("2026-01-01", 1200.0), ("2026-01-01", 9999.0))

        with pytest.raises(Exception) as excinfo:
            self._prepare(tmp_path, pages=[page])

        assert "collision" in str(excinfo.value).lower()

    def test_a_withheld_value_survives_preparation_but_carries_no_value(
        self, tmp_path: Path
    ) -> None:
        """La licence sans affichage retient la valeur : c'est l'écriture qui
        refusera, en nommant la contrainte du noyau (audit §11.3)."""
        outcome = self._prepare(tmp_path, license_decision=NO_DISPLAY)

        assert all(i.observation.value is None for i in outcome.prepared)
        assert all(i.observation.value_withheld for i in outcome.prepared)

    def test_a_report_without_its_window_parameters_is_refused(self, tmp_path: Path) -> None:
        request, _raw, decoded, report = build_request(
            tmp_path, report={"query_parameters": {"code_entite": STATION}}
        )

        with pytest.raises(StagingIngestionRefused, match="paramètre de fenêtre"):
            prepare_release(
                request, pages=decoded, report=report, license_decision=PERMISSIVE,
                retrieved_at=date(2026, 7, 26),
                provenance=provenance_for(
                    request.source_code, accessed_on=date(2026, 7, 26)
                ),
            )

    def test_preparation_is_deterministic(self, tmp_path: Path) -> None:
        first = self._prepare(tmp_path)
        second = self._prepare(tmp_path)

        assert [i.identity.fingerprint() for i in first.prepared] == [
            i.identity.fingerprint() for i in second.prepared
        ]
        assert [i.content_digest for i in first.prepared] == [
            i.content_digest for i in second.prepared
        ]


class TestDataStatusMapping:
    def test_the_mapping_is_explicit_and_closed(self) -> None:
        assert DATA_STATUS_MAPPING == {
            "observed": "verified",
            "modelled": "inferred",
            "estimated": "estimated",
            "manual": "manual",
        }

    def test_fixture_has_no_target(self) -> None:
        """Une donnée de fixture n'entre jamais dans le noyau de preuve."""
        assert "fixture" not in DATA_STATUS_MAPPING

    def test_every_target_is_a_real_kernel_status(self) -> None:
        from typing import get_args

        from models.intelligence import DataStatus

        assert set(DATA_STATUS_MAPPING.values()) <= set(get_args(DataStatus))


class TestStagingIsANativeStatus:
    def test_the_staging_status_is_validated(self) -> None:
        assert STAGING_RELEASE_STATUS == "validated"

    def test_it_belongs_to_the_kernel_vocabulary(self) -> None:
        from typing import get_args

        from models.intelligence import ReleaseStatus

        assert STAGING_RELEASE_STATUS in get_args(ReleaseStatus)

    def test_the_writer_never_writes_published(self) -> None:
        """Aucune écriture du statut `published` : la publication est X4, et
        elle passe par une décision humaine absente pour les 7 sources."""
        source = (
            Path(__file__).resolve().parents[1] / "services" / "water" / "staging_writer.py"
        ).read_text(encoding="utf-8")

        assert "'published'" not in source
        assert '"published"' not in source

    def test_no_status_is_simulated_in_metadata(self, tmp_path: Path) -> None:
        """Le statut est une COLONNE. `metadata` ne porte que de la provenance
        descriptive — jamais un état déguisé en donnée libre."""
        from services.water.staging_writer import _release_metadata

        request, *_ = build_request(tmp_path)
        metadata = _release_metadata(request)

        assert not any("status" in key.lower() for key in metadata)
        assert STAGING_RELEASE_STATUS not in {str(v) for v in metadata.values()}


class TestIdempotencyKey:
    def test_the_same_bytes_give_the_same_key(self, tmp_path: Path) -> None:
        first, *_ = build_request(tmp_path / "a")
        second, *_ = build_request(tmp_path / "b")

        assert idempotency_key(first) == idempotency_key(second)

    def test_different_bytes_give_a_different_key(self, tmp_path: Path) -> None:
        first, *_ = build_request(tmp_path / "a")
        other_page = hydro_page(("2026-02-01", 42.0))
        second, *_ = build_request(tmp_path / "b", pages=[other_page])

        assert idempotency_key(first) != idempotency_key(second)


# ===========================================================================
# 2 — Étape transactionnelle : PostgreSQL RÉEL (job migration-tests)
# ===========================================================================

from db.database import db_available, get_admin_db, get_db  # noqa: E402

from ._intelligence_fixtures import build_evidence_kernel_db  # noqa: E402

pg = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or not db_available(),
    reason="DATABASE_URL absent ou psycopg2 indisponible — tests PostgreSQL skippés",
)


class _MemoryStorage:
    """Substitut de `StorageAdapter` : aucun octet ne quitte le processus."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, key: str, data: bytes, mime_type: str) -> str:
        self.objects[key] = data
        return key


@pytest.fixture(scope="module")
def x2b_schema():
    with get_db() as conn:
        build_evidence_kernel_db(conn)


@pytest.fixture
def clean_kernel(x2b_schema):
    """Nettoie les lignes GLOBALES semées par ce module, avant ET après.

    `session_replication_role = replica` désactive les triggers d'immutabilité
    le temps du nettoyage (rôle superuser CI) — le noyau refuse sinon toute
    DELETE sur `observations` et `source_releases`, ce qui est exactement le
    comportement attendu en production.
    """
    def _wipe() -> None:
        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                cur.execute("SET session_replication_role = replica")
                cur.execute(
                    "DELETE FROM observations WHERE company_id IS NULL AND source_release_id IN "
                    "(SELECT r.id FROM source_releases r JOIN source_registry s ON s.id = r.source_id "
                    " WHERE s.company_id IS NULL AND s.code = %s)", (HYDRO,))
                cur.execute(
                    "DELETE FROM ingestion_runs WHERE company_id IS NULL AND source_id IN "
                    "(SELECT id FROM source_registry WHERE company_id IS NULL AND code = %s)", (HYDRO,))
                cur.execute(
                    "DELETE FROM evidence_artifacts WHERE company_id IS NULL AND source_release_id IN "
                    "(SELECT r.id FROM source_releases r JOIN source_registry s ON s.id = r.source_id "
                    " WHERE s.company_id IS NULL AND s.code = %s)", (HYDRO,))
                cur.execute(
                    "DELETE FROM source_releases WHERE company_id IS NULL AND source_id IN "
                    "(SELECT id FROM source_registry WHERE company_id IS NULL AND code = %s)", (HYDRO,))
                cur.execute(
                    "DELETE FROM source_registry WHERE company_id IS NULL AND code = %s", (HYDRO,))
                cur.execute("SET session_replication_role = origin")

    _wipe()
    yield
    _wipe()


def seed_source(**flags) -> int:
    """Déclare la source GLOBALE. X2B n'en crée jamais : la licence est un
    geste humain, exercé ici explicitement par le test."""
    values = {
        "automated_access_allowed": True, "storage_allowed": True,
        "display_allowed": True, "derived_use_allowed": True, "active": True,
    }
    values.update(flags)
    with get_admin_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(
                """
                INSERT INTO source_registry
                    (company_id, code, publisher, title, source_type,
                     automated_access_allowed, storage_allowed, display_allowed,
                     derived_use_allowed, commercial_use_allowed, redistribution_allowed,
                     active, attribution_text, license_code)
                VALUES (NULL, %s, 'Hub''Eau (fictif)', 'Hydrométrie (fixture X2B)', 'api',
                        %s, %s, %s, %s, true, true, %s, %s, 'etalab-2.0')
                RETURNING id
                """,
                # L'attribution semée est la forme STABLE canonique : depuis
                # X4B-RECONSTRUCT, le graveur confronte la ligne du registre à la
                # configuration et refuse une divergence. Une fixture qui sèmerait
                # autre chose testerait un état que la production n'admet plus.
                (HYDRO, values["automated_access_allowed"], values["storage_allowed"],
                 values["display_allowed"], values["derived_use_allowed"], values["active"],
                 stable_attribution(HYDRO)),
            )
            return cur.fetchone()["id"]


def run_ingest(request, pages, decoded, report, *, commit: bool, storage=None):
    return ingest_staging_release(
        request, pages=pages, decoded_pages=decoded, report=report,
        connection_factory=get_admin_db, storage=storage or _MemoryStorage(),
        commit=commit, retrieved_at=date(2026, 7, 26),
    )


def count_rows(table: str) -> int:
    with get_admin_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(f"SELECT COUNT(*) AS c FROM {table} WHERE company_id IS NULL")
            return cur.fetchone()["c"]


@pg
class TestCommitAgainstRealPostgres:
    def test_a_commit_writes_release_artifact_and_observations(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)

        result = run_ingest(request, pages, decoded, report, commit=True)

        assert result.committed is True
        assert result.observations_written == 2
        assert result.release_id is not None
        assert result.artifact_id is not None
        assert result.run_id is not None

    def test_the_release_is_validated_and_never_published(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)

        result = run_ingest(request, pages, decoded, report, commit=True)

        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                cur.execute(
                    "SELECT status, published_at, company_id FROM source_releases WHERE id = %s",
                    (result.release_id,),
                )
                row = cur.fetchone()

        assert row["status"] == "validated"
        assert row["published_at"] is None
        assert row["company_id"] is None

    def test_no_status_key_lands_in_release_metadata(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)
        result = run_ingest(request, pages, decoded, report, commit=True)

        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                cur.execute("SELECT metadata FROM source_releases WHERE id = %s", (result.release_id,))
                metadata = cur.fetchone()["metadata"]

        assert not any("status" in key.lower() for key in metadata)
        assert "staging" not in json.dumps(metadata).lower()

    def test_every_written_row_is_global_never_tenant(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)
        run_ingest(request, pages, decoded, report, commit=True)

        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                for table in ("source_releases", "evidence_artifacts", "observations", "ingestion_runs"):
                    cur.execute(f"SELECT COUNT(*) AS c FROM {table} WHERE company_id IS NOT NULL")
                    assert cur.fetchone()["c"] == 0, f"{table} porte une ligne de tenant"

    def test_observations_carry_their_period_and_native_unit(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)
        result = run_ingest(request, pages, decoded, report, commit=True)

        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                cur.execute(
                    "SELECT numeric_value, unit, valid_from, valid_to, data_status "
                    "FROM observations WHERE source_release_id = %s ORDER BY valid_from",
                    (result.release_id,),
                )
                rows = cur.fetchall()

        assert [float(r["numeric_value"]) for r in rows] == [1200.0, 1210.0]
        assert {r["unit"] for r in rows} == {"mm"}
        assert {r["data_status"] for r in rows} == {"verified"}
        assert rows[0]["valid_from"].date() != rows[1]["valid_from"].date()

    def test_multiple_periods_are_all_kept(self, clean_kernel, tmp_path: Path) -> None:
        seed_source()
        page = hydro_page(
            ("2026-01-01", 1.0), ("2026-01-02", 2.0), ("2026-01-03", 3.0), ("2026-01-04", 4.0)
        )
        request, pages, decoded, report = build_request(tmp_path, pages=[page])

        result = run_ingest(request, pages, decoded, report, commit=True)

        assert result.observations_written == 4


@pg
class TestIdempotenceAndCollisionAgainstRealPostgres:
    def test_replaying_the_same_ingestion_writes_nothing_new(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)

        first = run_ingest(request, pages, decoded, report, commit=True)
        second = run_ingest(request, pages, decoded, report, commit=True)

        assert first.observations_written == 2
        assert second.observations_written == 0
        assert second.observations_reused == 2
        assert second.release_reused is True
        assert second.release_id == first.release_id
        assert count_rows("observations") == 2

    def test_a_contradictory_content_under_the_same_identity_aborts(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        """Même release, même identité, valeur différente : refus explicite et
        transaction avortée — jamais un écrasement silencieux."""
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)
        run_ingest(request, pages, decoded, report, commit=True)

        # Même release_key et même checksum déclaré, mais des octets contredits.
        contradictory = hydro_page(("2026-01-01", 9999.0), ("2026-01-02", 1210.0))
        forged = json.loads(json.dumps(report))
        decoded_bad = [json.loads(contradictory)]

        with pytest.raises(StagingIngestionRefused, match="collision"):
            run_ingest(request, [contradictory], decoded_bad, forged, commit=True)

        assert count_rows("observations") == 2

    def test_the_run_ledger_is_idempotent_too(self, clean_kernel, tmp_path: Path) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)

        run_ingest(request, pages, decoded, report, commit=True)
        run_ingest(request, pages, decoded, report, commit=True)

        assert count_rows("ingestion_runs") == 1


@pg
class TestRollbackAgainstRealPostgres:
    def test_a_dry_run_leaves_no_row_behind(self, clean_kernel, tmp_path: Path) -> None:
        """Le dry-run exécute le VRAI chemin d'écriture puis avorte : c'est le
        seul rollback possible, `evidence_kernel_guard` interdisant toute
        suppression après commit."""
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)

        result = run_ingest(request, pages, decoded, report, commit=False)

        assert result.committed is False
        assert result.observations_written == 2  # le chemin a bien été exercé
        assert count_rows("observations") == 0
        assert count_rows("source_releases") == 0
        assert count_rows("ingestion_runs") == 0

    def test_a_dry_run_then_a_commit_writes_once(self, clean_kernel, tmp_path: Path) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)

        run_ingest(request, pages, decoded, report, commit=False)
        run_ingest(request, pages, decoded, report, commit=True)

        assert count_rows("observations") == 2

    def test_a_withheld_value_stops_the_ingestion_before_any_write(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        """Une licence sans affichage produit des observations sans valeur, que
        `observations_value_presence_check` refuserait (audit §11.3).

        Le refus tombe AVANT la moindre écriture — `prepare_release` précède la
        détection de release dans la transaction. La preuve du rollback en
        cours de route, elle, est `test_a_dry_run_leaves_no_row_behind`, où
        release, artefact, observations ET run sont réellement insérés avant
        que la transaction ne soit avortée.
        """
        seed_source(display_allowed=False)
        request, pages, decoded, report = build_request(tmp_path)

        with pytest.raises(StagingIngestionRefused, match="aucune valeur à écrire"):
            run_ingest(request, pages, decoded, report, commit=True)

        assert count_rows("source_releases") == 0
        assert count_rows("evidence_artifacts") == 0
        assert count_rows("observations") == 0

    def test_a_collision_after_the_release_exists_rolls_the_whole_batch_back(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        """Échec APRÈS des écritures réelles : la deuxième ingestion réinsère un
        artefact (octets différents) puis heurte la collision. Ni l'artefact ni
        rien d'autre ne doit survivre à l'avortement."""
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)
        run_ingest(request, pages, decoded, report, commit=True)
        artifacts_before = count_rows("evidence_artifacts")

        contradictory = hydro_page(("2026-01-01", 9999.0), ("2026-01-02", 1210.0))

        with pytest.raises(StagingIngestionRefused, match="collision"):
            run_ingest(request, [contradictory], [json.loads(contradictory)], report, commit=True)

        assert count_rows("evidence_artifacts") == artifacts_before
        assert count_rows("observations") == 2


@pg
class TestLicenceAndSourceRefusalsAgainstRealPostgres:
    def test_an_unregistered_source_is_refused(self, clean_kernel, tmp_path: Path) -> None:
        """X2B ne crée aucune source : déclarer une licence est un geste humain."""
        request, pages, decoded, report = build_request(tmp_path)

        with pytest.raises(StagingIngestionRefused, match="absente du Source Registry"):
            run_ingest(request, pages, decoded, report, commit=True)

    def test_a_licence_forbidding_ingestion_is_refused(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source(automated_access_allowed=False)
        request, pages, decoded, report = build_request(tmp_path)

        with pytest.raises(StagingIngestionRefused, match="ingestion interdite"):
            run_ingest(request, pages, decoded, report, commit=True)

        assert count_rows("source_releases") == 0

    def test_a_licence_forbidding_storage_is_refused(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source(storage_allowed=False)
        request, pages, decoded, report = build_request(tmp_path)

        with pytest.raises(StagingIngestionRefused, match="conservation interdite"):
            run_ingest(request, pages, decoded, report, commit=True)

    def test_an_inactive_source_is_refused(self, clean_kernel, tmp_path: Path) -> None:
        seed_source(active=False)
        request, pages, decoded, report = build_request(tmp_path)

        with pytest.raises(StagingIngestionRefused):
            run_ingest(request, pages, decoded, report, commit=True)

    def test_a_permissive_licence_never_publishes(self, clean_kernel, tmp_path: Path) -> None:
        """Le point le plus facile à rater : une licence permissive autorise le
        STOCKAGE, jamais la publication. Aucune source n'est `approved` au
        registre des décisions humaines."""
        from services.water_intelligence.publication_decisions import CURRENT_DECISIONS

        seed_source()
        request, pages, decoded, report = build_request(tmp_path)
        result = run_ingest(request, pages, decoded, report, commit=True)

        assert result.release_status == "validated"
        assert all(d.status != "approved" for d in CURRENT_DECISIONS)

    def test_no_release_is_ever_published_by_this_writer(
        self, clean_kernel, tmp_path: Path
    ) -> None:
        seed_source()
        request, pages, decoded, report = build_request(tmp_path)
        run_ingest(request, pages, decoded, report, commit=True)

        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                cur.execute(
                    "SELECT COUNT(*) AS c FROM source_releases "
                    "WHERE status = 'published' OR published_at IS NOT NULL"
                )
                assert cur.fetchone()["c"] == 0
