"""
test_scope2_selection.py — helper LB/MB consolidé (PR-06A). PUR, jamais skippé.

Verrouille la règle « préférer LB, se rabattre sur MB seulement si LB ABSENT
(sur la présence, pas la valeur — LB = 0 est légitime) » extraite de
beges_export / actions_service. Ces tests protègent les DEUX consommateurs
refactorés : toute régression du helper casserait ici (et non plus, de façon
diffuse, dans beges/actions).
"""

from __future__ import annotations

from services.carbon import scope2_selection as s
from services.carbon.scope2_selection import CODE_SCOPE2_LB, CODE_SCOPE2_MB


class TestSelectScope2:
    def test_lb_present_preferred_over_mb(self) -> None:
        sel = s.select_scope2(120.0, 90.0)
        assert sel is not None
        assert sel.value == 120.0
        assert sel.basis == "location_based"

    def test_lb_zero_is_legitimate_and_preferred(self) -> None:
        # LB = 0 (électricité 100 % renouvelable) DOIT primer — présence, pas véracité.
        sel = s.select_scope2(0.0, 50.0)
        assert sel is not None
        assert sel.value == 0.0
        assert sel.basis == "location_based"

    def test_mb_fallback_only_when_lb_absent(self) -> None:
        sel = s.select_scope2(None, 50.0)
        assert sel is not None
        assert sel.value == 50.0
        assert sel.basis == "market_based"

    def test_mb_zero_fallback_when_lb_absent(self) -> None:
        sel = s.select_scope2(None, 0.0)
        assert sel is not None
        assert sel.value == 0.0
        assert sel.basis == "market_based"

    def test_both_absent_returns_none(self) -> None:
        assert s.select_scope2(None, None) is None

    def test_only_lb_present(self) -> None:
        sel = s.select_scope2(75.0, None)
        assert sel is not None
        assert sel.value == 75.0
        assert sel.basis == "location_based"


class TestSelectScope2FromFacts:
    def test_prefers_lb_even_at_zero(self) -> None:
        vals = {CODE_SCOPE2_LB: 0.0, CODE_SCOPE2_MB: 50.0}
        sel = s.select_scope2_from_facts(vals)
        assert sel is not None
        assert sel.value == 0.0
        assert sel.basis == "location_based"

    def test_falls_back_to_mb_when_lb_absent(self) -> None:
        sel = s.select_scope2_from_facts({CODE_SCOPE2_MB: 42.0})
        assert sel is not None
        assert sel.value == 42.0
        assert sel.basis == "market_based"

    def test_no_scope2_codes_returns_none(self) -> None:
        assert s.select_scope2_from_facts({"CC.GES.SCOPE1": 100.0}) is None

    def test_empty_mapping_returns_none(self) -> None:
        assert s.select_scope2_from_facts({}) is None


class TestConsumerParity:
    """Le helper reproduit EXACTEMENT l'ancienne logique inline de beges /
    actions — même sortie sur les cas nominaux, quel que soit l'ordre."""

    def test_matches_beges_reduce_scope_rows_lb_zero(self) -> None:
        from services import beges_export as beges
        for rows in (
            [(CODE_SCOPE2_LB, 0.0), (CODE_SCOPE2_MB, 50.0)],
            [(CODE_SCOPE2_MB, 50.0), (CODE_SCOPE2_LB, 0.0)],
        ):
            assert beges._reduce_scope_rows(rows)["S2"] == 0.0

    def test_matches_beges_reduce_scope_rows_mb_fallback(self) -> None:
        from services import beges_export as beges
        assert beges._reduce_scope_rows([(CODE_SCOPE2_MB, 50.0)])["S2"] == 50.0
        # Aucun Scope 2 du tout : S2 reste 0.0 (défaut d'initialisation, inchangé).
        assert beges._reduce_scope_rows([("CC.GES.SCOPE1", 10.0)])["S2"] == 0.0
