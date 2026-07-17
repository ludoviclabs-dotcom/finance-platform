"""
test_migration_ledger.py — bootstrap, baseline, verify, mark_manual_verified,
verrou advisory (PR-02B). DB-gated.

CI-compatible : skip si `DATABASE_URL` absent, comme `test_rls_isolation.py`.
Jamais contre Neon. Non exécuté localement pendant cette implémentation (pas
de `docker` disponible dans ce shell) — à surveiller sur le premier run CI
(voir PR02B_IMPLEMENTATION_PLAN.md §9/§10).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from db.migration_runner import MigrationLockError, MigrationRunner

from ._migration_fixtures import (
    apply_ddl_inline,
    apply_upto,
    build_full_db,
    reset_public_schema,
)

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]


@pytest.fixture()
def empty_conn():
    with get_db() as conn:
        reset_public_schema(conn)
        yield conn


@pytest.fixture()
def runner():
    return MigrationRunner()


# ── Bootstrap ─────────────────────────────────────────────────────────────


def test_bootstrap_creates_ledger_table(empty_conn, runner):
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is None, "précondition : la table ne doit pas encore exister"
    runner._ensure_ledger_table(empty_conn)
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is not None


def test_bootstrap_is_idempotent(empty_conn, runner):
    runner._ensure_ledger_table(empty_conn)
    runner._ensure_ledger_table(empty_conn)  # 2e appel — ne doit pas lever
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is not None


def test_plan_and_load_records_never_create_the_table(empty_conn, runner):
    """Invariant PR-02A, revalidé contre un vrai Postgres (pas seulement mocké)."""
    assert runner.load_records() == {}
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is None, "load_records() ne doit jamais créer la table"


# ── Baseline — 3 fixtures ─────────────────────────────────────────────────


def test_baseline_dry_run_on_empty_db(empty_conn, runner):
    """Base neuve : 000 encore pending (rien appliqué), 001-026+008b+009 pending,
    027 (requires_owner) -> manual_required. Rien n'est écrit (dry_run)."""
    result = runner.baseline(dry_run=True)
    assert result.dry_run is True
    assert result.written_count == 0

    actions = {i.file.version: i.action for i in result.items}
    assert actions["000"] == "still_pending"
    assert actions["001"] == "still_pending"
    assert actions["027"] == "manual_required"

    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is None, "dry_run ne doit jamais bootstrapper la table"


def test_baseline_commit_on_empty_db_writes_only_manual_required(empty_conn, runner):
    result = runner.baseline(dry_run=False)
    assert result.written_count == 1  # seule 027 (manual_required) est écrite ; le reste still_pending

    records = runner.load_records()
    assert records["027"].status == "manual_required"
    assert records["027"].requires_owner is True
    assert "001" not in records  # still_pending -> aucune ligne écrite


def test_baseline_on_partial_db(empty_conn, runner):
    """001-020 appliquées (via DDL inline + fichiers) : baseline pour ces versions,
    021-026+009 encore pending, 027 manual_required."""
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "020")

    result = runner.baseline(dry_run=True)
    actions = {i.file.version: i.action for i in result.items}
    assert actions["000"] == "baseline"
    assert actions["001"] == "baseline"
    assert actions["020"] == "baseline"
    assert actions["021"] == "still_pending"
    assert actions["027"] == "manual_required"


def test_baseline_on_full_db_marks_004_and_009_both_baseline(empty_conn, runner):
    """L'état réel de prod (D-3) : 004 ET 009 doivent toutes deux devenir `baseline`,
    pas seulement l'une des deux."""
    build_full_db(empty_conn)

    result = runner.baseline(dry_run=False)
    actions = {i.file.version: i.action for i in result.items}
    assert actions["004"] == "baseline"
    assert actions["009"] == "baseline"
    assert actions["027"] == "baseline"  # objets vérifiés présents -> baseline, pas manual_required
    assert all(a == "baseline" for a in actions.values())
    assert result.written_count == 29  # 000 + 28 fichiers

    records = runner.load_records()
    assert records["004"].requires_owner is False
    assert records["009"].requires_owner is False
    assert records["027"].requires_owner is True  # historisé depuis le manifeste, même si baseline


def test_baseline_never_rewrites_existing_row(empty_conn, runner):
    """Contrainte #1 : une version déjà dans le ledger n'est jamais réécrite."""
    build_full_db(empty_conn)
    runner.baseline(dry_run=False)
    first_pass_records = runner.load_records()

    result = runner.baseline(dry_run=False)  # 2e appel
    assert result.written_count == 0
    assert all(i.action == "already_recorded" for i in result.items)

    second_pass_records = runner.load_records()
    assert first_pass_records["027"].applied_at == second_pass_records["027"].applied_at


# ── verify() — checksum_mismatch et drift_detected ───────────────────────


def test_verify_clean_after_baseline(empty_conn, runner):
    build_full_db(empty_conn)
    runner.baseline(dry_run=False)
    assert runner.verify() == []


def test_verify_detects_checksum_mismatch(empty_conn, runner, monkeypatch, tmp_path):
    """Un fichier modifié après coup doit être signalé, jamais réappliqué silencieusement."""
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "001")
    runner.baseline(dry_run=False)

    real_path = runner.migrations_dir / "001_emission_factors.sql"
    original = real_path.read_bytes()
    try:
        real_path.write_bytes(original + b"\n-- octet ajoute apres coup\n")
        anomalies = runner.verify()
        assert any("001" in a and "checksum_mismatch" in a for a in anomalies)
    finally:
        real_path.write_bytes(original)  # restaurer, ne jamais laisser le repo modifié


def test_verify_detects_drift_when_object_dropped(empty_conn, runner):
    """Ligne `baseline` mais objet supprimé après coup — jamais réappliqué automatiquement."""
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "001")
    runner.baseline(dry_run=False)

    with empty_conn.cursor() as cur:
        cur.execute("DROP TABLE emission_factors")

    anomalies = runner.verify()
    assert any("001" in a and "drift_detected" in a for a in anomalies)


def test_verify_returns_empty_when_ledger_not_bootstrapped(empty_conn, runner):
    assert runner.verify() == []


# ── mark_manual_verified ─────────────────────────────────────────────────


def test_mark_manual_verified_requires_applied_by_and_proof(runner):
    with pytest.raises(ValueError):
        runner.mark_manual_verified("027", applied_by="", proof="capture.png")
    with pytest.raises(ValueError):
        runner.mark_manual_verified("027", applied_by="ludo", proof="")


def test_mark_manual_verified_unknown_version_raises(runner):
    with pytest.raises(KeyError):
        runner.mark_manual_verified("999", applied_by="ludo", proof="preuve")


def test_mark_manual_verified_refuses_without_verified_objects(empty_conn, runner):
    """Défense en profondeur (§8) : une preuve textuelle ne suffit pas si les objets
    ne sont réellement pas là."""
    from db.migration_runner import MigrationError

    with pytest.raises(MigrationError):
        runner.mark_manual_verified(
            "027", applied_by="ludo", proof="je jure que je l'ai fait (mais non)"
        )


def test_mark_manual_verified_transitions_to_baseline_with_proof(empty_conn, runner):
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "027")  # 027 réellement appliquée

    record = runner.mark_manual_verified(
        "027", applied_by="ludo@neon-sql-editor", proof="SELECT to_regclass('public.sites') -> non-null"
    )
    assert record.status == "baseline"
    assert record.applied_by == "ludo@neon-sql-editor"

    records = runner.load_records()
    assert records["027"].status == "baseline"
    assert records["027"].metadata.get("proof")


def test_mark_manual_verified_refuses_to_rewrite_existing_row(empty_conn, runner):
    build_full_db(empty_conn)
    runner.baseline(dry_run=False)  # 027 déjà baseline

    with pytest.raises(ValueError):
        runner.mark_manual_verified("027", applied_by="ludo", proof="preuve")


# ── acquire_lock — concurrence simplifiée (2 connexions) ─────────────────


def test_acquire_lock_blocks_a_second_connection(runner):
    with get_db() as conn_a, get_db() as conn_b:
        with runner.acquire_lock(conn_a, timeout_s=1.0, retry_interval_s=0.2):
            with pytest.raises(MigrationLockError):
                with runner.acquire_lock(conn_b, timeout_s=1.0, retry_interval_s=0.2):
                    pass  # ne doit jamais être atteint


def test_acquire_lock_released_after_context_exit(runner):
    with get_db() as conn_a:
        with runner.acquire_lock(conn_a, timeout_s=1.0, retry_interval_s=0.2):
            pass
    with get_db() as conn_b:
        # Le verrou de conn_a a été libéré à la sortie du `with` -> conn_b l'obtient sans attendre.
        with runner.acquire_lock(conn_b, timeout_s=1.0, retry_interval_s=0.2):
            pass


# ── CLI bout-en-bout ──────────────────────────────────────────────────────


def test_cli_end_to_end_status_verify_baseline_verify(empty_conn, runner):
    build_full_db(empty_conn)

    assert runner.verify() == []  # rien dans le ledger encore -> sain par définition

    dry = runner.baseline(dry_run=True)
    assert dry.written_count == 0

    committed = runner.baseline(dry_run=False)
    assert committed.written_count == 29
    assert runner.verify() == []
