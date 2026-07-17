"""
test_migration_cli.py — CLI du ledger de migrations.

PR-02A : `plan`. PR-02B : `status`, `verify`, `baseline`,
`mark-manual-verified`. PR-02C (ajouté ici) : `apply`. Tous testés par mock
(monkeypatch de `MigrationRunner`), jamais contre une vraie DB ici (voir
test_migration_ledger.py pour les tests DB-gated des méthodes elles-mêmes).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from db import migration_cli
from db.migration_runner import (
    BaselineItem,
    BaselineResult,
    ManualMigrationRequired,
    MigrationError,
    MigrationFile,
    MigrationLockError,
    MigrationPlan,
    MigrationPlanItem,
    MigrationRecord,
)


def _fake_plan(has_blocking_issues: bool = False) -> MigrationPlan:
    f = MigrationFile(
        version="001", suffix="", name="001_x.sql", path=Path("001_x.sql"),
        checksum_sha256="abc123",
    )
    item = MigrationPlanItem(file=f, record=None, action="apply", reason="absente du ledger")
    return MigrationPlan(items=[item], has_blocking_issues=has_blocking_issues)


def test_cmd_plan_json_output(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli.MigrationRunner, "build_plan", lambda self: _fake_plan())
    exit_code = migration_cli.main(["plan", "--json"])
    assert exit_code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["items"][0]["version"] == "001"
    assert out["items"][0]["action"] == "apply"
    assert out["has_blocking_issues"] is False


def test_cmd_plan_text_output(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli.MigrationRunner, "build_plan", lambda self: _fake_plan())
    exit_code = migration_cli.main(["plan"])
    assert exit_code == 0
    out = capsys.readouterr().out
    assert "001" in out
    assert "apply" in out


def test_cmd_plan_text_output_warns_on_blocking_issues(monkeypatch, capsys):
    monkeypatch.setattr(
        migration_cli.MigrationRunner, "build_plan", lambda self: _fake_plan(has_blocking_issues=True)
    )
    migration_cli.main(["plan"])
    out = capsys.readouterr().out
    assert "Attention" in out


def test_cmd_plan_reports_error_with_exit_code_1(monkeypatch, capsys):
    def _boom(self):
        raise RuntimeError("PostgreSQL non configuré")

    monkeypatch.setattr(migration_cli.MigrationRunner, "build_plan", _boom)
    exit_code = migration_cli.main(["plan"])
    assert exit_code == 1
    assert "PostgreSQL non configuré" in capsys.readouterr().err


def test_cli_requires_a_subcommand():
    with pytest.raises(SystemExit):
        migration_cli.main([])


# ── status ────────────────────────────────────────────────────────────────


def _fake_file(version: str) -> MigrationFile:
    return MigrationFile(version=version, suffix="", name=f"{version}_x.sql", path=Path("x"), checksum_sha256="c")


def test_cmd_status_json_no_anomalies(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli.MigrationRunner, "discover_migrations", lambda self: [_fake_file("001")])
    monkeypatch.setattr(migration_cli.MigrationRunner, "load_records", lambda self: {})
    monkeypatch.setattr(migration_cli.MigrationRunner, "verify", lambda self: [])
    exit_code = migration_cli.main(["status", "--json"])
    assert exit_code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["counts"]["pending"] == 1
    assert out["anomalies"] == []


def test_cmd_status_exit_code_4_on_anomalies(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli.MigrationRunner, "discover_migrations", lambda self: [])
    monkeypatch.setattr(migration_cli.MigrationRunner, "load_records", lambda self: {})
    monkeypatch.setattr(migration_cli.MigrationRunner, "verify", lambda self: ["001: checksum_mismatch (...)"])
    exit_code = migration_cli.main(["status"])
    assert exit_code == 4
    assert "anomalie" in capsys.readouterr().out.lower()


# ── verify ────────────────────────────────────────────────────────────────


def test_cmd_verify_clean(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli.MigrationRunner, "verify", lambda self: [])
    exit_code = migration_cli.main(["verify"])
    assert exit_code == 0
    assert "Aucune anomalie" in capsys.readouterr().out


def test_cmd_verify_reports_anomalies_and_exit_4(monkeypatch, capsys):
    monkeypatch.setattr(
        migration_cli.MigrationRunner, "verify", lambda self: ["027: drift_detected (...)"]
    )
    exit_code = migration_cli.main(["verify", "--json"])
    assert exit_code == 4
    out = json.loads(capsys.readouterr().out)
    assert len(out["anomalies"]) == 1


# ── baseline ──────────────────────────────────────────────────────────────


def _fake_baseline_result(dry_run: bool, manual_required: bool = False) -> BaselineResult:
    action = "manual_required" if manual_required else "baseline"
    item = BaselineItem(file=_fake_file("027"), action=action, reason="test")
    return BaselineResult(items=[item], dry_run=dry_run, written_count=0 if dry_run else 1)


def test_cmd_baseline_defaults_to_dry_run(monkeypatch, capsys):
    calls = []
    monkeypatch.setattr(
        migration_cli.MigrationRunner,
        "baseline",
        lambda self, dry_run=True: (calls.append(dry_run), _fake_baseline_result(dry_run))[1],
    )
    exit_code = migration_cli.main(["baseline"])
    assert calls == [True]
    assert exit_code == 0
    assert "DRY-RUN" in capsys.readouterr().out


def test_cmd_baseline_commit_flag(monkeypatch, capsys):
    calls = []
    monkeypatch.setattr(
        migration_cli.MigrationRunner,
        "baseline",
        lambda self, dry_run=True: (calls.append(dry_run), _fake_baseline_result(dry_run))[1],
    )
    exit_code = migration_cli.main(["baseline", "--commit"])
    assert calls == [False]
    assert exit_code == 0
    assert "COMMIT" in capsys.readouterr().out


def test_cmd_baseline_exit_code_3_when_manual_required(monkeypatch, capsys):
    monkeypatch.setattr(
        migration_cli.MigrationRunner,
        "baseline",
        lambda self, dry_run=True: _fake_baseline_result(dry_run, manual_required=True),
    )
    exit_code = migration_cli.main(["baseline"])
    assert exit_code == 3


def test_cmd_baseline_lock_error_exit_code_2(monkeypatch, capsys):
    def _boom(self, dry_run=True):
        raise MigrationLockError("verrou non obtenu")

    monkeypatch.setattr(migration_cli.MigrationRunner, "baseline", _boom)
    exit_code = migration_cli.main(["baseline"])
    assert exit_code == 2
    assert "verrou" in capsys.readouterr().err.lower()


# ── mark-manual-verified ──────────────────────────────────────────────────


def test_cmd_mark_manual_verified_success(monkeypatch, capsys):
    def _fake_mark(self, version, applied_by, proof):
        return MigrationRecord(
            version=version, name=f"{version}_x.sql", checksum_sha256="c", status="baseline",
            applied_at=datetime.now(tz=timezone.utc), execution_ms=None, applied_by=applied_by,
            requires_owner=True, transactional=True, error_message=None, metadata={"proof": proof},
        )

    monkeypatch.setattr(migration_cli.MigrationRunner, "mark_manual_verified", _fake_mark)
    exit_code = migration_cli.main(
        ["mark-manual-verified", "027", "--applied-by", "ludo", "--proof", "capture Neon SQL editor"]
    )
    assert exit_code == 0
    assert "baseline" in capsys.readouterr().out


def test_cmd_mark_manual_verified_requires_applied_by_and_proof():
    with pytest.raises(SystemExit):
        migration_cli.main(["mark-manual-verified", "027"])


def test_cmd_mark_manual_verified_value_error_exit_code_1(monkeypatch, capsys):
    def _boom(self, version, applied_by, proof):
        raise ValueError("applied_by et proof sont obligatoires")

    monkeypatch.setattr(migration_cli.MigrationRunner, "mark_manual_verified", _boom)
    exit_code = migration_cli.main(
        ["mark-manual-verified", "027", "--applied-by", "ludo", "--proof", "x"]
    )
    assert exit_code == 1


def test_cmd_mark_manual_verified_migration_error_exit_code_1(monkeypatch, capsys):
    def _boom(self, version, applied_by, proof):
        raise MigrationError("objets non vérifiés présents")

    monkeypatch.setattr(migration_cli.MigrationRunner, "mark_manual_verified", _boom)
    exit_code = migration_cli.main(
        ["mark-manual-verified", "027", "--applied-by", "ludo", "--proof", "x"]
    )
    assert exit_code == 1
    assert "non vérifiés" in capsys.readouterr().err


# ── apply (PR-02C) ────────────────────────────────────────────────────────


def _fake_applied_records():
    return [
        MigrationRecord(
            version="028", name="028_x.sql", checksum_sha256="c", status="applied",
            applied_at=datetime.now(tz=timezone.utc), execution_ms=42, applied_by="test",
            requires_owner=False, transactional=True, error_message=None, metadata={},
        )
    ]


def test_cmd_apply_refuses_in_production_without_yes(monkeypatch, capsys):
    """En production, apply sans --yes est un refus explicite (exit 1) — jamais d'exécution."""
    monkeypatch.setattr(migration_cli, "is_production", lambda: True)
    called = []
    monkeypatch.setattr(
        migration_cli.MigrationRunner, "apply_plan",
        lambda self, applied_by=None: called.append(1) or [],
    )
    exit_code = migration_cli.main(["apply"])
    assert exit_code == 1
    assert called == [], "apply_plan ne doit jamais être appelé si la confirmation manque"
    assert "yes" in capsys.readouterr().err.lower()


def test_cmd_apply_runs_in_production_with_yes(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli, "is_production", lambda: True)
    monkeypatch.setattr(
        migration_cli.MigrationRunner, "apply_plan",
        lambda self, applied_by=None: _fake_applied_records(),
    )
    exit_code = migration_cli.main(["apply", "--yes", "--json"])
    assert exit_code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["applied_count"] == 1
    assert out["applied"][0]["version"] == "028"


def test_cmd_apply_runs_outside_production_without_yes(monkeypatch, capsys):
    """Hors production, apply ne demande pas --yes."""
    monkeypatch.setattr(migration_cli, "is_production", lambda: False)
    monkeypatch.setattr(
        migration_cli.MigrationRunner, "apply_plan", lambda self, applied_by=None: []
    )
    exit_code = migration_cli.main(["apply"])
    assert exit_code == 0
    assert "Aucune migration" in capsys.readouterr().out


def test_cmd_apply_manual_required_exit_code_3(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli, "is_production", lambda: False)

    def _boom(self, applied_by=None):
        raise ManualMigrationRequired("027 requires_owner")

    monkeypatch.setattr(migration_cli.MigrationRunner, "apply_plan", _boom)
    exit_code = migration_cli.main(["apply"])
    assert exit_code == 3


def test_cmd_apply_lock_error_exit_code_2(monkeypatch, capsys):
    monkeypatch.setattr(migration_cli, "is_production", lambda: False)

    def _boom(self, applied_by=None):
        raise MigrationLockError("verrou non obtenu")

    monkeypatch.setattr(migration_cli.MigrationRunner, "apply_plan", _boom)
    exit_code = migration_cli.main(["apply"])
    assert exit_code == 2
