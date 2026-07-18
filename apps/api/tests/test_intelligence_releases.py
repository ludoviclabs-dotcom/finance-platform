"""
test_intelligence_releases.py — cycle de vie source_releases (detect/validate/
publish/supersede), immutabilité au niveau trigger, licence bloquante, et
ingestion_runs (idempotence, compteurs, garde d'état terminal). PR-03, DB-gated.
"""

from __future__ import annotations

import hashlib
import os

import pytest

from db.database import db_available, get_db
from models.intelligence import ReleaseCreate, SourceCreate
from services.intelligence import ingestion_service, release_service, source_service

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _checksum(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()


def _make_open_source(cid: int, code: str):
    return source_service.create_source(
        company_id=cid,
        payload=SourceCreate(
            code=code, publisher="Pub", title="T", source_type="manual",
            automated_access_allowed=True, storage_allowed=True, display_allowed=True,
            derived_use_allowed=True, commercial_use_allowed=True, redistribution_allowed=True,
        ),
        created_by=None,
    )


def _make_license_blocked_source(cid: int, code: str):
    return source_service.create_source(
        company_id=cid,
        payload=SourceCreate(
            code=code, publisher="Pub", title="T", source_type="manual",
            automated_access_allowed=False, storage_allowed=False,
        ),
        created_by=None,
    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestReleaseLifecycle:
    def test_detect_release_idempotent_on_same_checksum(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-idem-{cid_a}")
        payload = ReleaseCreate(release_key="2026", checksum_sha256=_checksum("release-content-v1"))
        first = release_service.detect_release(
            company_id=cid_a, source_id=source.id, payload=payload, created_by=None,
        )
        second = release_service.detect_release(
            company_id=cid_a, source_id=source.id, payload=payload, created_by=None,
        )
        assert first.id == second.id
        assert first.status == "detected"

    def test_detect_release_unknown_source_raises(self, two_companies):
        cid_a, _ = two_companies
        with pytest.raises(release_service.ReleaseError):
            release_service.detect_release(
                company_id=cid_a, source_id=999_999_999,
                payload=ReleaseCreate(release_key="x", checksum_sha256=_checksum("x")),
                created_by=None,
            )

    def test_validate_then_publish_happy_path(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-pub-{cid_a}")
        release = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="2026-q1", checksum_sha256=_checksum("q1")),
            created_by=None,
        )
        validated = release_service.validate_release(company_id=cid_a, release_id=release.id, passed=True)
        assert validated.status == "validated"
        published = release_service.publish_release(company_id=cid_a, release_id=release.id)
        assert published.status == "published"
        assert published.published_at is not None

    def test_publish_without_validation_rejected(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-nopub-{cid_a}")
        release = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="direct", checksum_sha256=_checksum("direct")),
            created_by=None,
        )
        with pytest.raises(release_service.ReleaseError):
            release_service.publish_release(company_id=cid_a, release_id=release.id)

    def test_validate_failed_moves_to_quarantined(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-quar-{cid_a}")
        release = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="bad", checksum_sha256=_checksum("bad")),
            created_by=None,
        )
        quarantined = release_service.validate_release(company_id=cid_a, release_id=release.id, passed=False)
        assert quarantined.status == "quarantined"

    def test_publish_blocked_by_license_sets_blocked_status_not_exception(self, two_companies):
        """La licence bloquante est un état normal du cycle de vie
        (blocked_license), pas une exception — les raisons sont tracées."""
        cid_a, _ = two_companies
        source = _make_license_blocked_source(cid_a, f"rel-blocked-{cid_a}")
        release = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="blocked", checksum_sha256=_checksum("blocked")),
            created_by=None,
        )
        release_service.validate_release(company_id=cid_a, release_id=release.id, passed=True)
        published = release_service.publish_release(company_id=cid_a, release_id=release.id)
        assert published.status == "blocked_license"
        assert "license_block_reasons" in published.metadata
        assert published.metadata["license_block_reasons"]

    def test_supersede_after_publish(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-supersede-{cid_a}")
        old = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="v1", checksum_sha256=_checksum("v1")),
            created_by=None,
        )
        release_service.validate_release(company_id=cid_a, release_id=old.id, passed=True)
        release_service.publish_release(company_id=cid_a, release_id=old.id)

        new = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="v2", checksum_sha256=_checksum("v2"), supersedes_id=old.id),
            created_by=None,
        )
        release_service.validate_release(company_id=cid_a, release_id=new.id, passed=True)
        new_published = release_service.publish_release(company_id=cid_a, release_id=new.id)
        assert new_published.status == "published"

        superseded = release_service.supersede_release(company_id=cid_a, new_release_id=new.id)
        assert superseded.status == "superseded"
        assert superseded.id == old.id

        refreshed_old = release_service.get_release(company_id=cid_a, release_id=old.id)
        assert refreshed_old.status == "superseded"

        # Idempotent : rejouer le supersede ne lève pas.
        again = release_service.supersede_release(company_id=cid_a, new_release_id=new.id)
        assert again.status == "superseded"

    def test_supersede_without_publishing_new_release_rejected(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-supersede-early-{cid_a}")
        old = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="v1", checksum_sha256=_checksum("early-v1")),
            created_by=None,
        )
        release_service.validate_release(company_id=cid_a, release_id=old.id, passed=True)
        release_service.publish_release(company_id=cid_a, release_id=old.id)

        new = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="v2", checksum_sha256=_checksum("early-v2"), supersedes_id=old.id),
            created_by=None,
        )
        with pytest.raises(release_service.ReleaseError):
            release_service.supersede_release(company_id=cid_a, new_release_id=new.id)

    def test_immutability_published_release_checksum_cannot_be_updated(self, two_companies):
        """Le trigger DB refuse toute UPDATE sur une ligne publiée sauf la
        transition published->superseded exacte — vérifié en direct SQL, le
        service n'orchestre que des transitions déjà légales pour le trigger."""
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-immut-{cid_a}")
        release = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="immut", checksum_sha256=_checksum("immut")),
            created_by=None,
        )
        release_service.validate_release(company_id=cid_a, release_id=release.id, passed=True)
        release_service.publish_release(company_id=cid_a, release_id=release.id)

        with pytest.raises(Exception, match="evidence_kernel"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE source_releases SET checksum_sha256 = %s WHERE id = %s",
                        (_checksum("tampered"), release.id),
                    )

    def test_immutability_published_release_cannot_be_deleted(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-nodel-{cid_a}")
        release = release_service.detect_release(
            company_id=cid_a, source_id=source.id,
            payload=ReleaseCreate(release_key="nodel", checksum_sha256=_checksum("nodel")),
            created_by=None,
        )
        release_service.validate_release(company_id=cid_a, release_id=release.id, passed=True)
        release_service.publish_release(company_id=cid_a, release_id=release.id)

        with pytest.raises(Exception, match="evidence_kernel"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM source_releases WHERE id = %s", (release.id,))

    def test_idempotency_constraint_rejects_raw_duplicate_insert(self, two_companies):
        """La contrainte SQL elle-même (pas seulement le service) protège
        l'idempotence — un INSERT direct dupliqué doit échouer."""
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"rel-rawdup-{cid_a}")
        checksum = _checksum("raw-dup")
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO source_releases (source_id, company_id, release_key, checksum_sha256, status) "
                    "VALUES (%s, %s, 'raw', %s, 'detected')",
                    (source.id, cid_a, checksum),
                )
        with pytest.raises(Exception):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO source_releases (source_id, company_id, release_key, checksum_sha256, status) "
                        "VALUES (%s, %s, 'raw', %s, 'detected')",
                        (source.id, cid_a, checksum),
                    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestIngestionRuns:
    def test_start_run_idempotent_on_same_key(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"ing-idem-{cid_a}")
        key = f"idem-key-{cid_a}"
        first = ingestion_service.start_run(company_id=cid_a, source_id=source.id, idempotency_key=key)
        second = ingestion_service.start_run(company_id=cid_a, source_id=source.id, idempotency_key=key)
        assert first.id == second.id
        assert first.status == "pending"

    def test_update_run_counters_and_status(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"ing-upd-{cid_a}")
        run = ingestion_service.start_run(company_id=cid_a, source_id=source.id, idempotency_key=f"upd-{cid_a}")
        updated = ingestion_service.update_run(
            company_id=cid_a, run_id=run.id, status="running",
            detected_count=10, accepted_count=8, rejected_count=2,
        )
        assert updated.status == "running"
        assert updated.detected_count == 10
        assert updated.accepted_count == 8
        assert updated.rejected_count == 2
        assert updated.completed_at is None  # 'running' n'est pas terminal

    def test_fail_run_sets_terminal_state_with_timestamp(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"ing-fail-{cid_a}")
        run = ingestion_service.start_run(company_id=cid_a, source_id=source.id, idempotency_key=f"fail-{cid_a}")
        failed = ingestion_service.fail_run(company_id=cid_a, run_id=run.id, error_summary="boom")
        assert failed.status == "failed"
        assert failed.error_summary == "boom"
        assert failed.completed_at is not None

    def test_terminal_run_cannot_be_updated_again(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"ing-term-{cid_a}")
        run = ingestion_service.start_run(company_id=cid_a, source_id=source.id, idempotency_key=f"term-{cid_a}")
        ingestion_service.fail_run(company_id=cid_a, run_id=run.id, error_summary="boom")
        with pytest.raises(ingestion_service.IngestionError):
            ingestion_service.update_run(company_id=cid_a, run_id=run.id, status="running")

    def test_start_run_unknown_source_raises(self, two_companies):
        cid_a, _ = two_companies
        with pytest.raises(ingestion_service.IngestionError):
            ingestion_service.start_run(company_id=cid_a, source_id=999_999_999, idempotency_key="ghost-source")

    def test_idempotency_key_unique_constraint_rejects_raw_duplicate(self, two_companies):
        cid_a, _ = two_companies
        source = _make_open_source(cid_a, f"ing-rawdup-{cid_a}")
        key = f"raw-dup-{cid_a}"
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO ingestion_runs (company_id, source_id, idempotency_key, status) "
                    "VALUES (%s, %s, %s, 'pending')",
                    (cid_a, source.id, key),
                )
        with pytest.raises(Exception):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO ingestion_runs (company_id, source_id, idempotency_key, status) "
                        "VALUES (%s, %s, %s, 'pending')",
                        (cid_a, source.id, key),
                    )
