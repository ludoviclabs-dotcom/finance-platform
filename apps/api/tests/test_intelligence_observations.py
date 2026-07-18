"""
test_intelligence_observations.py — observations (validation de valeur,
création, correction par supersession, immutabilité) et evidence_artifacts
(SHA-256, immutabilité conditionnelle si référencé). PR-03, DB-gated.
"""

from __future__ import annotations

import hashlib
import os

import pytest

from db.database import db_available, get_db
from models.intelligence import ObservationCreate, ReleaseCreate, SourceCreate
from services.intelligence import (
    artifact_service,
    observation_service,
    release_service,
    source_service,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _checksum(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()


def _published_release(cid: int, code: str):
    source = source_service.create_source(
        company_id=cid,
        payload=SourceCreate(
            code=code, publisher="P", title="T", source_type="manual",
            automated_access_allowed=True, storage_allowed=True, display_allowed=True,
            derived_use_allowed=True, commercial_use_allowed=True, redistribution_allowed=True,
        ),
        created_by=None,
    )
    release = release_service.detect_release(
        company_id=cid, source_id=source.id,
        payload=ReleaseCreate(release_key="v1", checksum_sha256=_checksum(code)),
        created_by=None,
    )
    release_service.validate_release(company_id=cid, release_id=release.id, passed=True)
    return release_service.publish_release(company_id=cid, release_id=release.id)


@_skip_no_db_url
@_skip_no_psycopg2
class TestObservationCreation:
    def test_create_observation_numeric(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-num-{cid_a}")
        obs = observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="REE-NdFeB", metric_code="price_usd_kg",
                numeric_value=95.5, unit="USD/kg", source_release_id=release.id, data_status="verified",
            ),
        )
        assert obs.numeric_value == 95.5
        assert obs.data_status == "verified"

    def test_create_observation_without_any_value_rejected(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-empty-{cid_a}")
        with pytest.raises(observation_service.ObservationError):
            observation_service.create_observation(
                company_id=cid_a,
                payload=ObservationCreate(
                    subject_type="material", subject_key="X", metric_code="m",
                    source_release_id=release.id, data_status="estimated",
                ),
            )

    def test_confidence_out_of_range_rejected_by_pydantic(self):
        with pytest.raises(Exception):
            ObservationCreate(
                subject_type="material", subject_key="X", metric_code="m", numeric_value=1.0,
                source_release_id=1, data_status="estimated", confidence=1.5,
            )

    def test_create_observation_unknown_release_raises(self, two_companies):
        cid_a, _ = two_companies
        with pytest.raises(observation_service.ObservationError):
            observation_service.create_observation(
                company_id=cid_a,
                payload=ObservationCreate(
                    subject_type="material", subject_key="X", metric_code="m", numeric_value=1.0,
                    source_release_id=999_999_999, data_status="estimated",
                ),
            )

    def test_correct_observation_creates_new_row_original_untouched(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-correct-{cid_a}")
        original = observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="REE-NdFeB", metric_code="price_usd_kg",
                numeric_value=90.0, source_release_id=release.id, data_status="estimated",
            ),
        )
        corrected = observation_service.correct_observation(
            company_id=cid_a, original_id=original.id,
            payload=ObservationCreate(
                subject_type="material", subject_key="REE-NdFeB", metric_code="price_usd_kg",
                numeric_value=93.0, source_release_id=release.id, data_status="verified",
            ),
        )
        assert corrected.id != original.id
        assert corrected.supersedes_id == original.id

        original_reloaded = observation_service.get_observation(company_id=cid_a, observation_id=original.id)
        assert original_reloaded.numeric_value == 90.0  # jamais modifiée

    def test_immutability_observation_cannot_be_updated(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-immut-{cid_a}")
        obs = observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="X", metric_code="m", numeric_value=1.0,
                source_release_id=release.id, data_status="estimated",
            ),
        )
        with pytest.raises(Exception, match="evidence_kernel"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute("UPDATE observations SET numeric_value = 2.0 WHERE id = %s", (obs.id,))

    def test_immutability_observation_cannot_be_deleted(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-nodel-{cid_a}")
        obs = observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="X", metric_code="m", numeric_value=1.0,
                source_release_id=release.id, data_status="estimated",
            ),
        )
        with pytest.raises(Exception, match="evidence_kernel"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM observations WHERE id = %s", (obs.id,))

    def test_confidence_range_constraint_at_db_level(self, two_companies):
        """Même en contournant Pydantic (INSERT SQL direct), la contrainte
        CHECK de la migration 028 protège la donnée."""
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-confcheck-{cid_a}")
        with pytest.raises(Exception):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO observations "
                        "(company_id, subject_type, subject_key, metric_code, numeric_value, "
                        " source_release_id, data_status, confidence) "
                        "VALUES (%s, 'material', 'X', 'm', 1.0, %s, 'estimated', 1.5)",
                        (cid_a, release.id),
                    )

    def test_value_presence_constraint_at_db_level(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-valcheck-{cid_a}")
        with pytest.raises(Exception):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO observations "
                        "(company_id, subject_type, subject_key, metric_code, source_release_id, data_status) "
                        "VALUES (%s, 'material', 'X', 'm', %s, 'estimated')",
                        (cid_a, release.id),
                    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestObservationListingAndRls:
    def test_list_observations_filters_by_metric_code(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"obs-filter-{cid_a}")
        observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="A", metric_code="metric-one",
                numeric_value=1.0, source_release_id=release.id, data_status="estimated",
            ),
        )
        observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="A", metric_code="metric-two",
                numeric_value=2.0, source_release_id=release.id, data_status="estimated",
            ),
        )
        items, total = observation_service.list_observations(company_id=cid_a, metric_code="metric-one")
        assert total >= 1
        assert all(o.metric_code == "metric-one" for o in items)

    def test_tenant_a_cannot_see_tenant_b_observation(self, two_companies):
        cid_a, cid_b = two_companies
        release_b = _published_release(cid_b, f"obs-rls-b-{cid_b}")
        obs_b = observation_service.create_observation(
            company_id=cid_b,
            payload=ObservationCreate(
                subject_type="material", subject_key="SECRET-B", metric_code="m",
                numeric_value=1.0, source_release_id=release_b.id, data_status="estimated",
            ),
        )
        with pytest.raises(observation_service.ObservationError):
            observation_service.get_observation(company_id=cid_a, observation_id=obs_b.id)


@_skip_no_db_url
@_skip_no_psycopg2
class TestArtifactService:
    def test_register_artifact_computes_sha256_and_size(self, two_companies):
        cid_a, _ = two_companies
        data = b"hello evidence kernel"
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=data, filename="proof.txt", mime_type="text/plain",
        )
        assert artifact.sha256 == hashlib.sha256(data).hexdigest()
        assert artifact.size_bytes == len(data)

    def test_register_artifact_unknown_release_raises(self, two_companies):
        cid_a, _ = two_companies
        with pytest.raises(artifact_service.ArtifactError):
            artifact_service.register_artifact(
                company_id=cid_a, data=b"x", filename="x.txt", mime_type="text/plain",
                source_release_id=999_999_999,
            )

    def test_get_artifact_tenant_scoped(self, two_companies):
        cid_a, cid_b = two_companies
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=b"scoped", filename="a.txt", mime_type="text/plain",
        )
        with pytest.raises(artifact_service.ArtifactError):
            artifact_service.get_artifact(company_id=cid_b, artifact_id=artifact.id)

    def test_delete_unused_artifact_allowed(self, two_companies):
        cid_a, _ = two_companies
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=b"disposable", filename="d.txt", mime_type="text/plain",
        )
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM evidence_artifacts WHERE id = %s", (artifact.id,))
        # Aucune exception levée = suppression réussie (artefact jamais référencé).

    def test_delete_referenced_artifact_blocked(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"art-ref-{cid_a}")
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=b"referenced", filename="r.txt", mime_type="text/plain",
            source_release_id=release.id,
        )
        observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="X", metric_code="m", numeric_value=1.0,
                source_release_id=release.id, evidence_artifact_id=artifact.id, data_status="verified",
            ),
        )
        with pytest.raises(Exception, match="evidence_kernel"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM evidence_artifacts WHERE id = %s", (artifact.id,))

    def test_update_checksum_of_referenced_artifact_blocked(self, two_companies):
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"art-checksum-{cid_a}")
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=b"checksum-guard", filename="c.txt", mime_type="text/plain",
            source_release_id=release.id,
        )
        observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="X", metric_code="m", numeric_value=1.0,
                source_release_id=release.id, evidence_artifact_id=artifact.id, data_status="verified",
            ),
        )
        with pytest.raises(Exception, match="evidence_kernel"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE evidence_artifacts SET sha256 = %s WHERE id = %s", ("0" * 64, artifact.id),
                    )

    def test_update_descriptive_metadata_of_referenced_artifact_allowed(self, two_companies):
        """Les colonnes descriptives restent modifiables même sur un artefact
        référencé — seuls sha256/blob_key sont gelés par le trigger."""
        cid_a, _ = two_companies
        release = _published_release(cid_a, f"art-meta-{cid_a}")
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=b"meta-editable", filename="m.txt", mime_type="text/plain",
            source_release_id=release.id,
        )
        observation_service.create_observation(
            company_id=cid_a,
            payload=ObservationCreate(
                subject_type="material", subject_key="X", metric_code="m", numeric_value=1.0,
                source_release_id=release.id, evidence_artifact_id=artifact.id, data_status="verified",
            ),
        )
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE evidence_artifacts SET page_reference = %s WHERE id = %s "
                    "RETURNING page_reference",
                    ("p. 42", artifact.id),
                )
                row = cur.fetchone()
        assert row["page_reference"] == "p. 42"
