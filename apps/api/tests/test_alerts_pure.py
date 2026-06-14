"""Tests T5.3 — cœur d'évaluation des alertes (PUR, sans DB)."""

from __future__ import annotations

from services import alerts_service as als


class TestCondition:
    def test_absolute(self) -> None:
        assert als.compute_rule_condition(600, 500, "gt") is True
        assert als.compute_rule_condition(400, 500, "gt") is False
        assert als.compute_rule_condition(500, 500, "gte") is True

    def test_delta_pct_vs_n1(self) -> None:
        # gaz : 100 vs 50 l'an passé = +100 % → règle "+50 %" se déclenche
        assert als.compute_rule_condition(100, 50, "gt", previous=50, mode="delta_pct") is True
        # +20 % seulement → ne se déclenche pas pour un seuil de 50 %
        assert als.compute_rule_condition(60, 50, "gt", previous=50, mode="delta_pct") is False

    def test_delta_pct_no_previous(self) -> None:
        assert als.compute_rule_condition(100, 50, "gt", previous=None, mode="delta_pct") is False
        assert als.compute_rule_condition(100, 50, "gt", previous=0, mode="delta_pct") is False

    def test_missing(self) -> None:
        assert als.compute_rule_condition(None, None, "gt", mode="missing") is True
        assert als.compute_rule_condition(42, None, "gt", mode="missing") is False

    def test_current_none_non_missing(self) -> None:
        assert als.compute_rule_condition(None, 500, "gt") is False


class TestEvaluate:
    def test_gas_plus_50_pct_fires(self) -> None:
        rules = [{
            "id": 1, "name": "Gaz +50% vs N-1", "domain": "carbon",
            "field_path": "carbon.scope1Tco2e", "operator": "gt",
            "threshold": 50, "mode": "delta_pct", "is_active": True,
        }]
        current = {"carbon": {"carbon": {"scope1Tco2e": 100}}}
        previous = {"carbon": {"carbon": {"scope1Tco2e": 50}}}
        fired = als.evaluate_rules_pure(rules, current, previous)
        assert len(fired) == 1
        assert fired[0]["rule_id"] == 1
        assert fired[0]["current_value"] == 100

    def test_inactive_skipped(self) -> None:
        rules = [{"id": 1, "name": "x", "domain": "carbon", "field_path": "carbon.x",
                  "operator": "gt", "threshold": 0, "mode": "absolute", "is_active": False}]
        assert als.evaluate_rules_pure(rules, {"carbon": {"carbon": {"x": 999}}}, {}) == []

    def test_missing_data_fires(self) -> None:
        rules = [{"id": 2, "name": "Donnée manquante", "domain": "vsme",
                  "field_path": "vsme.energieMwh", "operator": "eq",
                  "threshold": None, "mode": "missing", "is_active": True}]
        fired = als.evaluate_rules_pure(rules, {"vsme": {"vsme": {}}}, {})
        assert len(fired) == 1


class TestFormat:
    def test_titles(self) -> None:
        title, body = als.format_notification({
            "rule_name": "Gaz", "mode": "delta_pct", "domain": "carbon",
            "field_path": "carbon.scope1Tco2e", "current_value": 100,
            "previous_value": 50, "operator": "gt", "threshold": 50,
        })
        assert title == "Gaz"
        assert "100" in body and "%" in body

    def test_email_disabled_by_default(self) -> None:
        # Sans EMAIL_ENABLED, aucun envoi (zéro dépendance e-mail).
        assert als.email_enabled() is False
        assert als.send_email("a@e.fr", "s", "b") is False
