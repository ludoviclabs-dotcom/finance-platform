"""
test_scope2_units.py — conversions d'unités d'énergie (PR-06B), tests PURS.

Jamais skippés : aucune DB, aucun réseau. Le point non négociable vérifié ici
est qu'une unité inconnue ou non énergétique produit une ERREUR EXPLICITE, et
jamais une conversion « au mieux » — une consommation en kg ou en € ne doit pas
pouvoir se glisser dans un calcul d'énergie.
"""

from __future__ import annotations

import pytest

from services.calculations import CalculationError, units


class TestToMwh:
    @pytest.mark.parametrize(
        "quantity,unit,expected",
        [
            (1.0, "MWh", 1.0),
            (1000.0, "kWh", 1.0),
            (1_000_000.0, "Wh", 1.0),
            (1.0, "GWh", 1000.0),
            (1.0, "TWh", 1_000_000.0),
            (3600.0, "MJ", 1.0),
            (3.6, "GJ", 1.0),
            (3_600_000.0, "kJ", 1.0),
            (0.0036, "TJ", 1.0),
        ],
    )
    def test_conversions_exactes(self, quantity, unit, expected):
        assert units.to_mwh(quantity, unit) == pytest.approx(expected, rel=1e-12)

    @pytest.mark.parametrize("unit", ["kwh", "KWH", "kWh", " kWh ", "kW.h", "kilowattheure"])
    def test_ecritures_equivalentes_reconnues(self, unit):
        """La normalisation RECONNAÎT des écritures d'une même unité ; elle
        n'invente aucune unité par défaut."""
        assert units.to_mwh(1000.0, unit) == pytest.approx(1.0)

    def test_zero_reste_zero(self):
        assert units.to_mwh(0.0, "kWh") == 0.0

    @pytest.mark.parametrize("unit", ["kg", "t", "km", "m3", "€", "EUR", "unité", "", "tCO2e"])
    def test_unite_non_energetique_erreur_explicite(self, unit):
        with pytest.raises(CalculationError) as exc:
            units.to_mwh(10.0, unit)
        assert "non convertible" in str(exc.value)

    def test_unite_none_erreur_explicite(self):
        with pytest.raises(CalculationError):
            units.to_mwh(10.0, None)  # type: ignore[arg-type]


class TestFactorConversion:
    def test_facteur_par_kwh_vers_par_mwh(self):
        """0,0571 kgCO2e/kWh (ordre de grandeur d'un mix électrique) = 57,1
        kgCO2e/MWh — le facteur est multiplié par 1000, pas divisé."""
        assert units.factor_to_kgco2e_per_mwh(0.0571, "kWh") == pytest.approx(57.1)

    def test_facteur_par_mwh_inchange(self):
        assert units.factor_to_kgco2e_per_mwh(57.1, "MWh") == pytest.approx(57.1)

    def test_facteur_par_mj(self):
        # 1 MWh = 3600 MJ → un facteur par MJ vaut 3600 fois plus par MWh.
        assert units.factor_to_kgco2e_per_mwh(0.1, "MJ") == pytest.approx(360.0)

    def test_denominateur_non_energetique_erreur(self):
        with pytest.raises(CalculationError) as exc:
            units.factor_to_kgco2e_per_mwh(2.5, "kg")
        assert "non convertible" in str(exc.value)


class TestHelpers:
    def test_kg_to_tonnes(self):
        assert units.kg_to_tonnes(1500.0) == pytest.approx(1.5)

    @pytest.mark.parametrize("unit,expected", [("kWh", True), ("MJ", True), ("kg", False), (None, False)])
    def test_is_energy_unit(self, unit, expected):
        assert units.is_energy_unit(unit) is expected
