"""
test_snapshot_migration.py — import auditable du snapshot /materials (PR-04).

Deux couches :
  - Rapport de parité : PUR (aucune base), toujours exécuté.
  - Import de bout en bout : DB-gated (job `migration-tests`, PostgreSQL réel) —
    idempotence, parité, source globale `estimated`, licence permissive.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from services.intelligence.adapters import ObservationDraft, sha256_hex
from services.intelligence.snapshot_migration import (
    DEFAULT_SNAPSHOT_PATH,
    DEMO_SOURCE_CODE,
    build_parity_report,
    import_snapshot,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


# ── Rapport de parité — pur ────────────────────────────────────────────────

def _draft(key: str, metric: str, num=None, txt=None, boo=None, geo=None) -> ObservationDraft:
    return ObservationDraft(
        subject_type="material", subject_key=key, metric_code=metric,
        numeric_value=num, text_value=txt, boolean_value=boo, geography_code=geo,
    )


def _row(key: str, metric: str, num=None, txt=None, boo=None, geo=None) -> dict:
    return {
        "subject_type": "material", "subject_key": key, "metric_code": metric,
        "numeric_value": num, "text_value": txt, "boolean_value": boo, "geography_code": geo,
    }


class TestParityReport:
    def test_identical_is_ok(self):
        drafts = [_draft("material:a", "price_usd", num=39), _draft("material:a", "is_critical_eu", boo=True)]
        rows = [_row("material:a", "price_usd", num=39), _row("material:a", "is_critical_eu", boo=True)]
        rep = build_parity_report(drafts, rows)
        assert rep.ok is True
        assert rep.matched == 2 == rep.total_expected == rep.total_found

    def test_decimal_fidelity_no_false_mismatch(self):
        from decimal import Decimal
        # DB renvoie des Decimal ; 8.7 float doit matcher Decimal('8.7'), 39 → 39.0
        drafts = [_draft("material:a", "score", num=8.7), _draft("material:a", "p", num=39)]
        rows = [_row("material:a", "score", num=Decimal("8.7")), _row("material:a", "p", num=Decimal("39.0"))]
        assert build_parity_report(drafts, rows).ok is True

    def test_changed_value_is_mismatch(self):
        drafts = [_draft("material:a", "price_usd", num=39)]
        rows = [_row("material:a", "price_usd", num=40)]
        rep = build_parity_report(drafts, rows)
        assert rep.ok is False
        assert rep.mismatches[0].kind == "mismatch"

    def test_missing_observation_detected(self):
        rep = build_parity_report([_draft("material:a", "price_usd", num=39)], [])
        assert rep.ok is False
        assert rep.mismatches[0].kind == "missing"

    def test_extra_observation_detected(self):
        rep = build_parity_report([], [_row("material:a", "price_usd", num=39)])
        assert rep.ok is False
        assert rep.mismatches[0].kind == "extra"


# ── Import de bout en bout — DB-gated ──────────────────────────────────────

class _MemStorage:
    """Stockage en mémoire (aucun effet de bord disque) pour les tests DB."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        self.objects[key] = data
        return key

    def get(self, key: str) -> bytes:
        return self.objects[key]

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)


def _cleanup_demo_globals() -> None:
    """Supprime les lignes globales de la source démo (triggers d'immutabilité
    désactivés le temps du cleanup — même geste que _intelligence_fixtures)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET session_replication_role = replica")
            cur.execute(
                "SELECT id FROM source_registry WHERE code = %s AND company_id IS NULL",
                (DEMO_SOURCE_CODE,),
            )
            src = cur.fetchone()
            if src:
                cur.execute(
                    "DELETE FROM observations WHERE source_release_id IN "
                    "(SELECT id FROM source_releases WHERE source_id = %s)",
                    (src["id"],),
                )
                cur.execute("DELETE FROM evidence_artifacts WHERE source_release_id IN "
                            "(SELECT id FROM source_releases WHERE source_id = %s)", (src["id"],))
                cur.execute("DELETE FROM source_releases WHERE source_id = %s", (src["id"],))
                cur.execute("DELETE FROM source_registry WHERE id = %s", (src["id"],))
            cur.execute("SET session_replication_role = origin")


@pytest.fixture(scope="module")
def imported(evidence_kernel_schema):
    """Importe le snapshot une fois (superuser CI), nettoie en tear-down.

    Non skip-marqué : les tests qui l'utilisent portent les marks DB-gated, donc
    le fixture n'est jamais instancié quand DATABASE_URL est absent (un test
    skippé ne déclenche pas ses fixtures)."""
    _cleanup_demo_globals()
    result = import_snapshot(publish=True, connection_factory=get_db, storage=_MemStorage())
    yield result
    _cleanup_demo_globals()


@_skip_no_db_url
@_skip_no_psycopg2
class TestSnapshotImport:
    def test_first_import_creates_source_release_observations(self, imported):
        assert imported.source_reused is False
        assert imported.release_status == "published"
        assert imported.observations_created == 192
        assert imported.observations_total == 192
        assert len(imported.checksum_sha256) == 64

    def test_checksum_matches_file_bytes(self, imported):
        assert imported.checksum_sha256 == sha256_hex(DEFAULT_SNAPSHOT_PATH.read_bytes())

    def test_parity_is_ok(self, imported):
        assert imported.parity is not None
        assert imported.parity["ok"] is True
        assert imported.parity["matched"] == 192

    def test_reimport_is_idempotent_no_duplicates(self, imported):
        again = import_snapshot(publish=True, connection_factory=get_db, storage=_MemStorage())
        assert again.source_reused is True
        assert again.release_reused is True
        assert again.artifact_reused is True
        assert again.observations_created == 0
        assert again.observations_skipped == 192
        assert again.parity["ok"] is True

    def test_observations_are_global_and_estimated(self, imported):
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT count(*) AS c, "
                    "count(*) FILTER (WHERE data_status <> 'estimated') AS non_estimated, "
                    "count(*) FILTER (WHERE company_id IS NOT NULL) AS tenant_scoped "
                    "FROM observations WHERE source_release_id = %s",
                    (imported.release_id,),
                )
                row = cur.fetchone()
        assert row["c"] == 192
        assert row["non_estimated"] == 0
        assert row["tenant_scoped"] == 0

    def test_license_permissive_allows_publish(self, imported):
        # display + derived autorisés → aucune raison de blocage
        assert imported.license_reasons == []

    def test_tenant_sees_global_demo_source(self, imported, two_companies):
        """La source démo globale est lisible par n'importe quel tenant (RLS
        globale, contrats §7) — sans qu'aucun tenant ne l'ait créée."""
        from services.intelligence import source_service

        cid_a, _ = two_companies
        items, _total = source_service.list_sources(company_id=cid_a, limit=500)
        assert any(s.code == DEMO_SOURCE_CODE and s.company_id is None for s in items)

    def test_no_publish_mode_skips_observations(self, imported):
        """publish=False : release détectée (réutilisée), aucune observation
        matérialisée en plus (la release est déjà published par le fixture, donc
        aucune transition ; le mode sans publication ne matérialise rien de neuf)."""
        detected = import_snapshot(publish=False, connection_factory=get_db, storage=_MemStorage())
        # release déjà published (fixture) → import_snapshot ne recrée rien
        assert detected.release_reused is True
        assert detected.observations_created == 0
