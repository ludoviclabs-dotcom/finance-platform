"""
test_migration_runner.py — PR-02A : découverte, checksum, planificateur (lecture seule).

Portée : uniquement les méthodes lecture-seule de MigrationRunner
(discover_migrations, calculate_checksum, load_records, build_plan).
Aucun test ne touche une vraie base Neon — `load_records` est mocké
(monkeypatch), à l'image de test_ensure_schema.py. apply/baseline/verify
arrivent en PR-02B.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from db.migration_runner import (
    ManualMigrationRequired,
    MigrationError,
    MigrationFile,
    MigrationRecord,
    MigrationRunner,
    _plan_item,
)


def _write(tmp_path: Path, filename: str, content: str = "-- sql\n") -> None:
    (tmp_path / filename).write_text(content, encoding="utf-8")


# ── discover_migrations ──────────────────────────────────────────────────


def test_discover_sorts_by_numeric_version_then_suffix(tmp_path):
    for name in [
        "009_rls_force.sql",
        "008b_rls_suppliers.sql",
        "008_suppliers.sql",
        "010_ingest_jobs.sql",
    ]:
        _write(tmp_path, name)
    runner = MigrationRunner(migrations_dir=tmp_path)
    files = runner.discover_migrations()
    assert [f.version for f in files] == ["008", "008b", "009", "010"]


def test_discover_ignores_non_conforming_filenames(tmp_path):
    _write(tmp_path, "001_ok.sql")
    _write(tmp_path, "README.md")
    _write(tmp_path, "not_a_migration.sql")
    _write(tmp_path, "0001_too_many_digits.sql")
    runner = MigrationRunner(migrations_dir=tmp_path)
    files = runner.discover_migrations()
    assert [f.version for f in files] == ["001"]


def test_discover_rejects_uppercase_suffix(tmp_path):
    _write(tmp_path, "008B_rls_suppliers.sql")  # majuscule non conforme à la regex §7
    runner = MigrationRunner(migrations_dir=tmp_path)
    assert runner.discover_migrations() == []


def test_discover_ignores_subdirectories(tmp_path):
    (tmp_path / "001_nested").mkdir()
    _write(tmp_path, "001_real.sql")
    runner = MigrationRunner(migrations_dir=tmp_path)
    files = runner.discover_migrations()
    assert [f.name for f in files] == ["001_real.sql"]


def test_discover_ignores_bootstrap_subdirectory_defensively(tmp_path):
    """`_bootstrap/000_...sql` (PR-02B) vit hors de `migrations/`, en sibling —
    zéro risque de découverte par construction. Test défensif au cas où un
    futur `_bootstrap/` serait par erreur nesté DANS `migrations_dir` : le
    garde `is_file()` de `discover_migrations()` doit quand même l'ignorer."""
    bootstrap_dir = tmp_path / "_bootstrap"
    bootstrap_dir.mkdir()
    (bootstrap_dir / "000_schema_migrations_ledger.sql").write_text("-- sql\n", encoding="utf-8")
    _write(tmp_path, "001_real.sql")
    runner = MigrationRunner(migrations_dir=tmp_path)
    files = runner.discover_migrations()
    assert [f.name for f in files] == ["001_real.sql"]


def test_discover_real_migrations_dir_has_no_000(tmp_path):
    """Le vrai `apps/api/db/migrations/` ne contient jamais de fichier `000_...`
    — celui-ci vit dans `apps/api/db/_bootstrap/` (sibling), confirmé ici
    contre le vrai dossier plutôt qu'un tmp_path isolé."""
    runner = MigrationRunner()  # migrations_dir par défaut = apps/api/db/migrations
    versions = [f.version for f in runner.discover_migrations()]
    assert "000" not in versions


# ── calculate_checksum ───────────────────────────────────────────────────


def test_checksum_stable_for_same_content(tmp_path):
    _write(tmp_path, "001_a.sql", "CREATE TABLE t (id INT);\n")
    runner = MigrationRunner(migrations_dir=tmp_path)
    path = tmp_path / "001_a.sql"
    assert runner.calculate_checksum(path) == runner.calculate_checksum(path)


def test_checksum_changes_with_single_byte(tmp_path):
    _write(tmp_path, "001_a.sql", "CREATE TABLE t (id INT);\n")
    runner = MigrationRunner(migrations_dir=tmp_path)
    path = tmp_path / "001_a.sql"
    original = runner.calculate_checksum(path)
    path.write_text("CREATE TABLE t (id INT)!\n", encoding="utf-8")
    assert runner.calculate_checksum(path) != original


# ── load_records ─────────────────────────────────────────────────────────


def test_load_records_raises_when_db_unconfigured(monkeypatch, tmp_path):
    import db.migration_runner as mr

    monkeypatch.setattr(mr, "db_available", lambda: False)
    runner = MigrationRunner(migrations_dir=tmp_path)
    with pytest.raises(RuntimeError):
        runner.load_records()


# ── _plan_item — logique pure de décision ────────────────────────────────


def _file(version: str = "001", suffix: str = "", checksum: str = "abc123") -> MigrationFile:
    return MigrationFile(
        version=version, suffix=suffix, name=f"{version}_x.sql", path=Path("x"),
        checksum_sha256=checksum,
    )


def _record(version: str = "001", status: str = "applied", checksum: str = "abc123", **kw) -> MigrationRecord:
    defaults = dict(
        version=version, name=f"{version}_x.sql", checksum_sha256=checksum, status=status,
        applied_at=None, execution_ms=None, applied_by=None, requires_owner=False,
        transactional=True, error_message=None, metadata={},
    )
    defaults.update(kw)
    return MigrationRecord(**defaults)


def test_plan_item_pending_without_manifest_entry_is_apply():
    item = _plan_item(_file(version="001"), None)
    assert item.action == "apply"


def test_plan_item_pending_requires_owner_is_blocked_manual():
    item = _plan_item(_file(version="027", checksum="c"), None)
    assert item.action == "blocked_manual"


def test_plan_item_applied_matching_checksum_is_skip():
    f = _file(version="001", checksum="same")
    r = _record(version="001", status="applied", checksum="same")
    item = _plan_item(f, r)
    assert item.action == "skip"


def test_plan_item_baseline_matching_checksum_is_skip():
    f = _file(version="004", checksum="same")
    r = _record(version="004", status="baseline", checksum="same")
    item = _plan_item(f, r)
    assert item.action == "skip"


def test_plan_item_checksum_mismatch_wins_over_applied():
    f = _file(version="001", checksum="new-content")
    r = _record(version="001", status="applied", checksum="old-content")
    item = _plan_item(f, r)
    assert item.action == "checksum_mismatch"


def test_plan_item_manual_required_stays_blocked():
    f = _file(version="027", checksum="same")
    r = _record(version="027", status="manual_required", checksum="same", requires_owner=True)
    item = _plan_item(f, r)
    assert item.action == "blocked_manual"


def test_plan_item_failed_is_not_retried_automatically():
    f = _file(version="015", checksum="same")
    r = _record(version="015", status="failed", checksum="same", error_message="boom")
    item = _plan_item(f, r)
    assert item.action == "blocked_manual"


def test_plan_item_checksum_mismatch_detected_even_on_manual_required():
    f = _file(version="027", checksum="changed")
    r = _record(version="027", status="manual_required", checksum="original", requires_owner=True)
    item = _plan_item(f, r)
    assert item.action == "checksum_mismatch"


# ── build_plan — déterminisme et intégration ─────────────────────────────


def test_build_plan_is_deterministic_for_same_state(tmp_path, monkeypatch):
    _write(tmp_path, "001_a.sql")
    _write(tmp_path, "002_b.sql")
    runner = MigrationRunner(migrations_dir=tmp_path)
    monkeypatch.setattr(runner, "load_records", lambda: {})
    plan_a = runner.build_plan()
    plan_b = runner.build_plan()
    assert [(i.file.version, i.action) for i in plan_a.items] == [
        (i.file.version, i.action) for i in plan_b.items
    ]


def test_build_plan_has_blocking_issues_when_manual_pending(tmp_path, monkeypatch):
    _write(tmp_path, "001_a.sql")
    _write(tmp_path, "027_sites.sql")
    runner = MigrationRunner(migrations_dir=tmp_path)
    monkeypatch.setattr(runner, "load_records", lambda: {})
    plan = runner.build_plan()
    assert plan.has_blocking_issues is True
    actions = {i.file.version: i.action for i in plan.items}
    assert actions["001"] == "apply"
    assert actions["027"] == "blocked_manual"


def test_build_plan_no_blocking_issues_when_all_apply(tmp_path, monkeypatch):
    _write(tmp_path, "001_a.sql")
    _write(tmp_path, "002_b.sql")
    runner = MigrationRunner(migrations_dir=tmp_path)
    monkeypatch.setattr(runner, "load_records", lambda: {})
    plan = runner.build_plan()
    assert plan.has_blocking_issues is False


# ── Corpus réel (28 fichiers existants) ──────────────────────────────────


def test_build_plan_against_real_migrations_directory(monkeypatch):
    """Critère de sortie PR-02A : plan correct pour les 28 fichiers existants, ledger vide."""
    runner = MigrationRunner()  # migrations_dir par défaut = apps/api/db/migrations
    monkeypatch.setattr(runner, "load_records", lambda: {})
    plan = runner.build_plan()

    versions = [i.file.version for i in plan.items]
    assert len(versions) == 28
    assert versions == sorted(versions, key=lambda v: (int(v[:3]), v[3:]))
    assert "008b" in versions

    actions = {i.file.version: i.action for i in plan.items}
    assert actions["027"] == "blocked_manual"
    assert actions["004"] == "apply"
    assert actions["009"] == "apply"
    assert plan.has_blocking_issues is True


# ── PR-02C : apply_plan — gardes pré-connexion (aucune DB requise) ────────
# Ces cas lèvent AVANT d'ouvrir une connexion → testables sans PostgreSQL.


def test_apply_plan_raises_manual_required_on_requires_owner(tmp_path, monkeypatch):
    """Un plan contenant une migration requires_owner non résolue (ex. 027) doit
    lever ManualMigrationRequired avant toute exécution (I4)."""
    _write(tmp_path, "027_sites.sql")  # get_meta("027").requires_owner is True
    runner = MigrationRunner(migrations_dir=tmp_path)
    monkeypatch.setattr(runner, "load_records", lambda: {})
    with pytest.raises(ManualMigrationRequired):
        runner.apply_plan()


def test_apply_plan_raises_on_checksum_mismatch(tmp_path, monkeypatch):
    """Un checksum_mismatch bloque tout apply (I2), avant exécution."""
    _write(tmp_path, "028_new.sql", "CREATE TABLE t028 (id INT);\n")
    runner = MigrationRunner(migrations_dir=tmp_path)
    stale = MigrationRecord(
        version="028", name="028_new.sql", checksum_sha256="ancien-checksum-different",
        status="applied", applied_at=None, execution_ms=None, applied_by=None,
        requires_owner=False, transactional=True, error_message=None, metadata={},
    )
    monkeypatch.setattr(runner, "load_records", lambda: {"028": stale})
    with pytest.raises(MigrationError):
        runner.apply_plan()


def test_apply_plan_noop_when_nothing_to_apply(tmp_path, monkeypatch):
    """Aucun item 'apply' (dossier vide) → retourne [] sans ouvrir de connexion.

    connection_factory qui lève si appelée : prouve qu'aucune connexion n'est
    ouverte quand il n'y a rien à appliquer.
    """
    def _boom():
        raise AssertionError("aucune connexion ne doit être ouverte")

    runner = MigrationRunner(migrations_dir=tmp_path, connection_factory=_boom)
    monkeypatch.setattr(runner, "load_records", lambda: {})
    assert runner.apply_plan() == []
