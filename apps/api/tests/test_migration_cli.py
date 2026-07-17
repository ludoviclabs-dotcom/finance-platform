"""
test_migration_cli.py — PR-02A : CLI `plan` (lecture seule).

status/apply/verify/baseline/mark-applied arrivent en PR-02B.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from db import migration_cli
from db.migration_runner import MigrationFile, MigrationPlan, MigrationPlanItem


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
