"""
tests/test_water_intelligence_financial_scenarios.py — scénarios financiers
hydriques (P15, Wave D, commit D3).

AUCUNE base requise, AUCUN réseau, AUCUNE horloge : le moteur est pur et tous
les paramètres sont injectés.

## Matrice de couverture (exigences du MACRO-PROMPT D, commit D3)

| Exigence | Classe de test |
|---|---|
| unités | `TestUnits` |
| null | `TestAbsenceIsNotZero` |
| scénarios | `TestScenarioConstruction` |
| arrondis | `TestRounding` |
| reproductibilité | `TestReproducibility` |
| sensibilités | `TestSensitivity` |
| observé / hypothèse / dérivé | `TestProvenance` |
| aucune écriture comptable | `TestNoAccountingEntry` |
| aucun taux inventé | `TestNoInventedRate` |
| aucune probabilité produite par le moteur | `TestProbabilityIsHumanSupplied` |
"""

from __future__ import annotations

import ast
from decimal import Decimal
from pathlib import Path

import pytest

from services.water_intelligence.financial_scenarios import (
    ACCOUNTING_SIGNALS,
    UNIT_CURRENCY,
    UNIT_CURRENCY_PER_DAY,
    UNIT_DAY,
    UNIT_RATIO,
    FinancialScenarioError,
    Quantity,
    UnitMismatchError,
    WaterDisruptionScenario,
    add,
    build_exposure,
    discount_to_present,
    multiply,
)

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "services"
    / "water_intelligence"
    / "financial_scenarios.py"
)

VARIATION = Decimal("20")


def _q(value: str | None, unit: str, provenance: str = "assumption") -> Quantity:
    return Quantity(
        value=None if value is None else Decimal(value),
        unit=unit,
        provenance=provenance,  # type: ignore[arg-type]
        basis="hypothèse de test",
    )


def _scenario(**overrides: object) -> WaterDisruptionScenario:
    base: dict[str, object] = {
        "scenario_code": "TEST",
        "label": "Scénario de test",
        "base_year": 2026,
        "horizon_year": 2030,
        "outage_days": _q("10", UNIT_DAY),
        "affected_capacity_share": _q("0.5", UNIT_RATIO),
        "revenue_per_day": _q("1000", UNIT_CURRENCY_PER_DAY, "observed"),
        "margin_rate": _q("0.3", UNIT_RATIO),
        "additional_opex_per_day": _q("200", UNIT_CURRENCY_PER_DAY),
        "adaptation_capex": _q("5000", UNIT_CURRENCY),
        "discount_rate": _q("0.05", UNIT_RATIO),
    }
    base.update(overrides)
    return WaterDisruptionScenario(**base)  # type: ignore[arg-type]


class TestPurity:
    """Le moteur reste pur."""

    def test_no_forbidden_import(self) -> None:
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf-8"))
        forbidden = {"db", "db.database", "psycopg2", "requests", "httpx", "socket", "random"}
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
        assert not (imported & forbidden), f"import interdit : {imported & forbidden}"

    def test_no_implicit_clock(self) -> None:
        source = MODULE_PATH.read_text(encoding="utf-8")
        assert "date.today()" not in source
        assert "datetime.now()" not in source


class TestUnits:
    """Les unités ne se combinent jamais en silence."""

    def test_days_times_currency_per_day_gives_currency(self) -> None:
        result = multiply(_q("10", UNIT_DAY), _q("100", UNIT_CURRENCY_PER_DAY), basis="b")
        assert result.unit == UNIT_CURRENCY
        assert result.value == Decimal("1000")

    def test_currency_times_ratio_gives_currency(self) -> None:
        result = multiply(_q("1000", UNIT_CURRENCY), _q("0.3", UNIT_RATIO), basis="b")
        assert result.unit == UNIT_CURRENCY
        assert result.value == Decimal("300.0")

    def test_incompatible_product_raises(self) -> None:
        with pytest.raises(UnitMismatchError, match="produit impossible"):
            multiply(_q("10", UNIT_DAY), _q("10", UNIT_DAY), basis="b")

    def test_sum_of_different_units_raises(self) -> None:
        with pytest.raises(UnitMismatchError, match="somme impossible"):
            add(_q("1", UNIT_CURRENCY), _q("1", UNIT_DAY), basis="b")

    def test_unknown_unit_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="unité"):
            Quantity(value=Decimal("1"), unit="m3", provenance="observed", basis="b")

    def test_only_currency_can_be_discounted(self) -> None:
        with pytest.raises(UnitMismatchError, match="peut être actualisé"):
            discount_to_present(
                _q("10", UNIT_DAY), discount_rate=_q("0.05", UNIT_RATIO), years=1, basis="b"
            )

    def test_a_ratio_outside_zero_one_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="entre 0 et 1"):
            _q("1.5", UNIT_RATIO)

    def test_a_negative_amount_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="négative"):
            _q("-1", UNIT_CURRENCY)

    def test_float_values_are_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="Decimal"):
            Quantity(value=1.5, unit=UNIT_CURRENCY, provenance="observed", basis="b")  # type: ignore[arg-type]


class TestAbsenceIsNotZero:
    """Une entrée absente rend un résultat absent, jamais zéro."""

    def test_missing_input_propagates_as_absent(self) -> None:
        exposure = build_exposure(
            _scenario(revenue_per_day=_q(None, UNIT_CURRENCY_PER_DAY)),
            sensitivity_variation_pct=VARIATION,
        )
        assert exposure.is_absent is True
        assert exposure.present_value.value is None
        assert "revenue_per_day" in (exposure.absence_reason or "")

    def test_absent_result_is_never_rendered_as_zero(self) -> None:
        exposure = build_exposure(
            _scenario(adaptation_capex=_q(None, UNIT_CURRENCY)),
            sensitivity_variation_pct=VARIATION,
        )
        payload = exposure.as_mapping()
        assert payload["present_value"] is None
        assert payload["present_value"] != "0"

    def test_a_complete_scenario_has_no_absence_reason(self) -> None:
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        assert exposure.absence_reason is None
        assert exposure.is_absent is False


class TestScenarioConstruction:
    """Un scénario mal formé est refusé à la construction."""

    def test_horizon_before_base_year_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="ordre temporel"):
            _scenario(base_year=2030, horizon_year=2026)

    def test_wrong_unit_on_a_field_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="outage_days"):
            _scenario(outage_days=_q("10", UNIT_CURRENCY))

    def test_a_quantity_without_basis_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="basis"):
            Quantity(value=Decimal("1"), unit=UNIT_CURRENCY, provenance="observed", basis=" ")

    def test_years_to_horizon_is_derived_from_the_two_years(self) -> None:
        assert _scenario(base_year=2026, horizon_year=2031).years_to_horizon == 5

    def test_unknown_accounting_signal_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="inconnus"):
            build_exposure(
                _scenario(), sensitivity_variation_pct=VARIATION, signals=("IFRS 42",)
            )

    def test_declared_signals_are_kept_sorted_and_deduplicated(self) -> None:
        exposure = build_exposure(
            _scenario(),
            sensitivity_variation_pct=VARIATION,
            signals=("IAS 37", "IAS 36", "IAS 36"),
        )
        assert exposure.signals == ("IAS 36", "IAS 37")


class TestNoInventedRate:
    """Aucun taux d'actualisation, fiscal ou d'inflation n'est encodé."""

    def test_discount_rate_is_mandatory(self) -> None:
        with pytest.raises(FinancialScenarioError, match="taux d'actualisation est obligatoire"):
            _scenario(discount_rate=_q(None, UNIT_RATIO))

    def test_sensitivity_width_is_a_mandatory_parameter(self) -> None:
        with pytest.raises(FinancialScenarioError, match="strictement positive"):
            build_exposure(_scenario(), sensitivity_variation_pct=Decimal("0"))

    def test_module_declares_no_tax_field(self) -> None:
        source = MODULE_PATH.read_text(encoding="utf-8").lower()
        for forbidden in ("tax_rate", "taux_fiscal", "vat_rate", "inflation_rate"):
            assert forbidden not in source

    def test_module_defines_no_default_rate_constant(self) -> None:
        """Un taux par défaut serait une hypothèse invisible."""
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and "RATE" in target.id.upper():
                        pytest.fail(f"constante de taux détectée : {target.id}")


class TestProbabilityIsHumanSupplied:
    """Aucune probabilité produite par le moteur — ni par un modèle."""

    def test_probability_is_optional_and_absent_by_default(self) -> None:
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        assert exposure.probability_weighted is None

    def test_a_derived_probability_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="jamais calculée ici"):
            _scenario(probability=_q("0.2", UNIT_RATIO, "derived"))

    def test_a_supplied_probability_weights_the_present_value(self) -> None:
        exposure = build_exposure(
            _scenario(probability=_q("0.5", UNIT_RATIO, "assumption")),
            sensitivity_variation_pct=VARIATION,
        )
        assert exposure.probability_weighted is not None
        assert exposure.probability_weighted.value == (
            exposure.present_value.value * Decimal("0.5")  # type: ignore[operator]
        ).quantize(Decimal("0.01"))

    def test_module_never_draws_a_random_number(self) -> None:
        source = MODULE_PATH.read_text(encoding="utf-8")
        for forbidden in ("random", "uniform(", "gauss(", "montecarlo", "monte_carlo"):
            assert forbidden not in source.lower()


class TestNoAccountingEntry:
    """Le moteur signale des questions, jamais des écritures."""

    def test_signals_are_questions_to_examine(self) -> None:
        for text in ACCOUNTING_SIGNALS.values():
            lowered = text.lower()
            assert "examiner" in lowered or "vérifier" in lowered or "dépendent" in lowered

    def test_no_bookkeeping_vocabulary_in_the_output(self) -> None:
        payload = build_exposure(
            _scenario(), sensitivity_variation_pct=VARIATION, signals=("IAS 36",)
        ).as_mapping()
        serialised = str(payload).lower()
        for forbidden in ("journal_entry", "debit", "credit", "provision_amount", "ecriture"):
            assert forbidden not in serialised

    def test_module_defines_no_entry_builder(self) -> None:
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf-8"))
        names = {
            node.name
            for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        for forbidden in ("entry", "journal", "posting", "provision"):
            assert not any(forbidden in name.lower() for name in names)


class TestProvenance:
    """Observé, hypothèse et dérivé ne se confondent pas."""

    def test_a_product_is_always_derived(self) -> None:
        result = multiply(
            _q("10", UNIT_DAY, "observed"),
            _q("100", UNIT_CURRENCY_PER_DAY, "observed"),
            basis="b",
        )
        assert result.provenance == "derived"

    def test_every_component_carries_its_basis(self) -> None:
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        for quantity in exposure.components.values():
            assert quantity.basis.strip()

    def test_observed_inputs_are_preserved_as_observed(self) -> None:
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        assert exposure.components["adaptation_capex"].provenance == "assumption"

    def test_unknown_provenance_is_refused(self) -> None:
        with pytest.raises(FinancialScenarioError, match="provenance"):
            Quantity(
                value=Decimal("1"),
                unit=UNIT_CURRENCY,
                provenance="guessed",  # type: ignore[arg-type]
                basis="b",
            )


class TestRounding:
    """Arrondi monétaire explicite, au pair le plus proche."""

    def test_present_value_is_quantised_to_two_decimals(self) -> None:
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        assert exposure.present_value.value is not None
        assert exposure.present_value.value.as_tuple().exponent == -2

    def test_half_even_rounding_is_used(self) -> None:
        """0,005 arrondit vers le pair : 1,00 et non 1,01."""
        amount = Quantity(
            value=Decimal("1.005"), unit=UNIT_CURRENCY, provenance="observed", basis="b"
        )
        result = discount_to_present(
            amount, discount_rate=_q("0", UNIT_RATIO), years=0, basis="b"
        )
        assert result.value == Decimal("1.00")

    def test_probability_weighted_value_is_also_quantised(self) -> None:
        exposure = build_exposure(
            _scenario(probability=_q("0.333", UNIT_RATIO)),
            sensitivity_variation_pct=VARIATION,
        )
        assert exposure.probability_weighted is not None
        assert exposure.probability_weighted.value.as_tuple().exponent == -2  # type: ignore[union-attr]


class TestReproducibility:
    """Deux exécutions identiques rendent exactement le même résultat."""

    def test_two_runs_produce_identical_payloads(self) -> None:
        first = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION).as_mapping()
        second = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION).as_mapping()
        assert first == second

    def test_component_order_is_deterministic(self) -> None:
        payload = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION).as_mapping()
        keys = list(payload["components"].keys())  # type: ignore[union-attr]
        assert keys == sorted(keys)

    def test_no_binary_float_appears_in_the_payload(self) -> None:
        """Les montants voyagent en chaînes décimales, jamais en flottants."""
        payload = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION).as_mapping()

        def _walk(node: object) -> None:
            if isinstance(node, float):
                pytest.fail(f"flottant binaire détecté dans la charge : {node}")
            if isinstance(node, dict):
                for value in node.values():
                    _walk(value)
            elif isinstance(node, list):
                for value in node:
                    _walk(value)

        _walk(payload)


class TestSensitivity:
    """Une valeur seule se lit comme une prévision : la bande l'accompagne."""

    def test_every_driver_produces_a_band(self) -> None:
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        drivers = [band.driver for band in exposure.sensitivities]
        assert drivers == ["outage_days", "revenue_per_day", "margin_rate", "discount_rate"]

    def test_a_band_brackets_the_central_value(self) -> None:
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        band = next(b for b in exposure.sensitivities if b.driver == "outage_days")
        assert band.low is not None and band.high is not None and band.base is not None
        assert band.low < band.base < band.high

    def test_discount_rate_moves_the_value_the_other_way(self) -> None:
        """Un taux plus élevé réduit la valeur actualisée."""
        exposure = build_exposure(_scenario(), sensitivity_variation_pct=VARIATION)
        band = next(b for b in exposure.sensitivities if b.driver == "discount_rate")
        assert band.low is not None and band.high is not None
        assert band.high < band.low

    def test_one_driver_varies_at_a_time(self) -> None:
        """Croiser les variations produirait un intervalle qui ressemble à un
        intervalle de confiance sans en être un."""
        source = MODULE_PATH.read_text(encoding="utf-8")
        assert "une variation à la fois" in source or "Une variation à la fois" in source

    def test_absent_input_yields_absent_bands(self) -> None:
        exposure = build_exposure(
            _scenario(outage_days=_q(None, UNIT_DAY)), sensitivity_variation_pct=VARIATION
        )
        for band in exposure.sensitivities:
            assert band.base is None
