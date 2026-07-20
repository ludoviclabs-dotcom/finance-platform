"""
test_crma_scoring.py — CarbonCo Material Exposure Score, tests PURS (PR-07).

Aucune base : `services.crma.scoring` est volontairement sans I/O, donc la
méthode elle-même est prouvée ici, partout, y compris hors CI PostgreSQL.
C'est le socle de la PR — les tests DB-gated vérifient le câblage, ceux-ci
vérifient les RÈGLES.

Ce qui est prouvé ici :
  * l'extraction n'est jamais mélangée au raffinage ni à la transformation ;
  * risque et confiance sont deux grandeurs indépendantes ;
  * une donnée manquante n'est jamais comptée comme un risque nul ;
  * une licence refusée dégrade la confiance, pas le risque ;
  * la méthode est versionnée et le score n'est jamais présenté comme officiel.
"""

from __future__ import annotations

from datetime import date

import pytest

from services.crma import scoring


def _obs(country: str, share: float, stage: str = "extraction", **kw) -> dict:
    row = {
        "country_code": country,
        "share_pct": share,
        "stage_code": stage,
        "data_status": kw.get("data_status", "estimated"),
        "reference_year": kw.get("reference_year", 2025),
        "source_release_id": kw.get("source_release_id"),
    }
    return row


def _stages() -> list[dict]:
    return [
        {"code": code, "label": code.title(), "stage_order": order,
         "is_upstream": code in scoring.UPSTREAM_STAGES}
        for code, order in scoring.STAGE_ORDER.items()
    ]


# ── Concentration par étape ─────────────────────────────────────────────────

class TestStageConcentration:
    def test_single_country_gives_maximal_hhi(self):
        c = scoring.compute_stage_concentration(
            stage_code="extraction", rows=[_obs("CN", 100.0)]
        )
        assert c.hhi_pct == 100.0
        assert c.top_country_code == "CN"
        assert c.country_count == 1

    def test_four_equal_countries_gives_quarter_hhi(self):
        rows = [_obs(c, 25.0) for c in ("CN", "AU", "US", "MM")]
        c = scoring.compute_stage_concentration(stage_code="extraction", rows=rows)
        assert c.hhi_pct == 25.0
        assert c.country_count == 4

    def test_partial_coverage_is_renormalised_and_reported(self):
        """Données incomplètes : les parts sont renormalisées au total OBSERVÉ,
        et l'incomplétude reste visible dans `observed_total_pct`."""
        rows = [_obs("CN", 40.0), _obs("US", 20.0)]  # seulement 60 % documentés
        c = scoring.compute_stage_concentration(stage_code="extraction", rows=rows)
        assert c.observed_total_pct == 60.0
        # 40/60 et 20/60 -> (2/3)^2 + (1/3)^2 = 0.5556
        assert c.hhi_pct == pytest.approx(55.56, abs=0.01)

    def test_observation_of_another_stage_is_rejected(self):
        """Le mélange d'étapes est une ERREUR, pas un arrondi silencieux."""
        with pytest.raises(scoring.ScoringError, match="ne se mélangent jamais"):
            scoring.compute_stage_concentration(
                stage_code="extraction", rows=[_obs("CN", 100.0, stage="refining")]
            )

    def test_share_out_of_bounds_is_rejected(self):
        with pytest.raises(scoring.ScoringError):
            scoring.compute_stage_concentration(
                stage_code="extraction", rows=[_obs("CN", 140.0)]
            )

    def test_empty_stage_yields_no_hhi_not_zero(self):
        """Aucune donnée -> pas de HHI. Un HHI de 0 signifierait « marché
        parfaitement atomisé », l'inverse de « on ne sait pas »."""
        c = scoring.compute_stage_concentration(stage_code="magnet", rows=[])
        assert c.hhi_pct is None
        assert c.country_count == 0


class TestValueChainNeverMixesStages:
    def test_extraction_and_refining_stay_separate(self):
        """Le cœur du gate Phase 6 : deux étapes aux géographies opposées
        gardent deux concentrations distinctes, jamais une moyenne."""
        rows = [
            # Extraction diversifiée : 4 pays à 25 %.
            *[_obs(c, 25.0, stage="extraction") for c in ("CN", "AU", "US", "MM")],
            # Raffinage ultra-concentré : un seul pays.
            _obs("CN", 100.0, stage="refining"),
        ]
        chain = scoring.build_value_chain(
            material_id="nd", observation_rows=rows, stages=_stages()
        )
        by_stage = {s.stage_code: s for s in chain.stages}
        assert by_stage["extraction"].hhi_pct == 25.0
        assert by_stage["refining"].hhi_pct == 100.0
        # Aucune moyenne (62.5) n'apparaît nulle part.
        assert all(s.hhi_pct != 62.5 for s in chain.stages if s.hhi_pct is not None)

    def test_undocumented_stages_are_visible_not_dropped(self):
        rows = [_obs("CN", 100.0, stage="extraction")]
        chain = scoring.build_value_chain(
            material_id="nd", observation_rows=rows, stages=_stages()
        )
        assert chain.stages_total == 8
        assert chain.stages_with_data == 1
        assert {s.stage_code for s in chain.stages} == set(scoring.STAGE_ORDER)

    def test_stages_are_ordered_upstream_to_downstream(self):
        chain = scoring.build_value_chain(
            material_id="nd", observation_rows=[], stages=_stages()
        )
        orders = [s.stage_order for s in chain.stages]
        assert orders == sorted(orders)
        assert chain.stages[0].stage_code == "extraction"
        assert chain.stages[-1].stage_code == "product"

    def test_upstream_flag_separates_extraction_from_transformation(self):
        chain = scoring.build_value_chain(
            material_id="nd", observation_rows=[], stages=_stages()
        )
        upstream = {s.stage_code for s in chain.stages if s.is_upstream}
        assert upstream == {"extraction", "separation"}
        assert "refining" not in upstream


class TestThirdCountryShare:
    def test_eu_countries_are_not_third_countries(self):
        c = scoring.compute_stage_concentration(
            stage_code="refining",
            rows=[_obs("FR", 50.0, stage="refining"), _obs("CN", 50.0, stage="refining")],
        )
        assert scoring.third_country_share(c) == 50.0

    def test_all_eu_gives_zero_third_country(self):
        c = scoring.compute_stage_concentration(
            stage_code="refining",
            rows=[_obs("FR", 60.0, stage="refining"), _obs("DE", 40.0, stage="refining")],
        )
        assert scoring.third_country_share(c) == 0.0


# ── Score : risque vs confiance ─────────────────────────────────────────────

def _concentrated_chain() -> list:
    rows = [_obs("CN", 90.0, stage="refining"), _obs("MY", 10.0, stage="refining")]
    return scoring.build_value_chain(
        material_id="nd", observation_rows=rows, stages=_stages()
    ).stages


class TestRiskAndConfidenceAreSeparate:
    def test_both_are_produced_and_differ_in_nature(self):
        score = scoring.compute_score(
            material_id="nd", stage_concentrations=_concentrated_chain(), as_of=date(2026, 1, 1)
        )
        assert score.risk_score is not None
        assert 0 <= score.risk_score <= 100
        assert 0 <= score.confidence <= 100
        # Aucun champ ne fusionne les deux.
        assert not hasattr(score, "net_score")
        assert "confidence" not in {c.code for c in score.components}

    def test_adding_data_quality_changes_confidence_not_risk(self):
        """Passer les MÊMES parts de `estimated` à `verified` ne doit PAS
        bouger le risque — seulement la confiance. C'est la preuve que les deux
        dimensions ne communiquent pas."""
        rows_est = [_obs("CN", 90.0, stage="refining", data_status="estimated"),
                    _obs("MY", 10.0, stage="refining", data_status="estimated")]
        rows_ver = [_obs("CN", 90.0, stage="refining", data_status="verified"),
                    _obs("MY", 10.0, stage="refining", data_status="verified")]

        def score_for(rows):
            stages = scoring.build_value_chain(
                material_id="nd", observation_rows=rows, stages=_stages()
            ).stages
            return scoring.compute_score(
                material_id="nd", stage_concentrations=stages, as_of=date(2026, 1, 1)
            )

        low, high = score_for(rows_est), score_for(rows_ver)
        assert low.risk_score == high.risk_score
        assert high.confidence > low.confidence

    def test_confidence_components_never_appear_in_risk_components(self):
        score = scoring.compute_score(
            material_id="nd", stage_concentrations=_concentrated_chain()
        )
        risk_codes = {c.code for c in score.components}
        conf_codes = {c.code for c in score.confidence_components}
        assert risk_codes.isdisjoint(conf_codes)


class TestMissingDataIsNeverZeroRisk:
    def test_absent_components_are_unavailable_not_zero(self):
        score = scoring.compute_score(
            material_id="nd", stage_concentrations=_concentrated_chain()
        )
        by_code = {c.code: c for c in score.components}
        for code in ("substitutability", "recycling_potential", "stock_coverage",
                     "supplier_dependency", "regulatory_events"):
            assert by_code[code].available is False
            assert by_code[code].risk_value is None
            assert by_code[code].contribution == 0.0

    def test_no_events_recorded_is_unavailable_not_safe(self):
        """« Aucun événement enregistré » n'est pas « aucun événement »."""
        score = scoring.compute_score(
            material_id="nd", stage_concentrations=_concentrated_chain(), events=[]
        )
        events = next(c for c in score.components if c.code == "regulatory_events")
        assert events.available is False
        assert "absence de donnée" in events.rationale

    def test_events_recorded_but_none_active_is_available_and_low(self):
        """Registre consulté, rien d'actif : là, on SAIT — risque plancher."""
        score = scoring.compute_score(
            material_id="nd",
            stage_concentrations=_concentrated_chain(),
            events=[{"severity": "critical", "title": "Ancien quota",
                     "event_type": "quota", "effective_from": date(2020, 1, 1),
                     "effective_to": date(2021, 1, 1)}],
            as_of=date(2026, 1, 1),
        )
        events = next(c for c in score.components if c.code == "regulatory_events")
        assert events.available is True
        assert events.risk_value == 10.0

    def test_weights_are_renormalised_over_available_components(self):
        score = scoring.compute_score(
            material_id="nd",
            stage_concentrations=_concentrated_chain(),
            stock_coverage_days=90.0,
        )
        available = [c for c in score.components if c.available]
        assert sum(c.weight for c in available) == pytest.approx(1.0, abs=0.001)
        assert all(c.weight == 0.0 for c in score.components if not c.available)

    def test_no_component_at_all_yields_no_score(self):
        """Mieux vaut l'absence de score qu'un chiffre inventé."""
        empty = scoring.build_value_chain(
            material_id="nd", observation_rows=[], stages=_stages()
        ).stages
        score = scoring.compute_score(material_id="nd", stage_concentrations=empty)
        assert score.risk_score is None
        assert any("score non produit" in w for w in score.warnings)
        # La confiance reste calculée — et logiquement très faible.
        assert score.confidence < 30


class TestScoreSelectsAStageNeverBlendsThem:
    def test_stage_concentration_component_reports_one_stage(self):
        rows = [
            *[_obs(c, 25.0, stage="extraction") for c in ("CN", "AU", "US", "MM")],
            _obs("CN", 100.0, stage="refining"),
        ]
        stages = scoring.build_value_chain(
            material_id="nd", observation_rows=rows, stages=_stages()
        ).stages
        score = scoring.compute_score(material_id="nd", stage_concentrations=stages)
        comp = next(c for c in score.components if c.code == "stage_concentration")
        # La valeur retenue est CELLE du raffinage (100), pas une moyenne (62.5).
        assert comp.risk_value == 100.0
        assert comp.stage_code == "refining"
        assert comp.raw_unit == "HHI %"

    def test_detail_per_stage_remains_inspectable(self):
        score = scoring.compute_score(
            material_id="nd", stage_concentrations=_concentrated_chain()
        )
        assert len(score.stage_concentrations) == 8
        assert all(s.stage_code for s in score.stage_concentrations)


class TestLicenceAffectsConfidenceOnly:
    def test_blocked_market_data_lowers_confidence_not_risk(self):
        stages = _concentrated_chain()
        free = scoring.compute_score(
            material_id="nd", stage_concentrations=stages,
            market_observations_count=4, license_blocked_count=0,
        )
        blocked = scoring.compute_score(
            material_id="nd", stage_concentrations=stages,
            market_observations_count=4, license_blocked_count=4,
        )
        assert free.risk_score == blocked.risk_score
        assert blocked.confidence < free.confidence
        assert any("licence" in w for w in blocked.warnings)


class TestComponentsAreInspectable:
    def test_every_available_component_carries_a_rationale(self):
        score = scoring.compute_score(
            material_id="nd",
            stage_concentrations=_concentrated_chain(),
            supplier_shares=[70.0, 30.0],
            substitutes=[{"substitute_material_id": "ferrite", "maturity": "pilot"}],
            recycling_routes=[{"route_code": "eol", "label": "EoL", "maturity": "commercial",
                               "recycled_content_pct": 20.0, "output_stage_code": "powder"}],
            stock_coverage_days=45.0,
            events=[{"severity": "high", "title": "Contrôle export", "event_type": "export_control",
                     "effective_from": date(2025, 1, 1), "effective_to": None,
                     "country_code": "CN", "stage_code": "refining"}],
            as_of=date(2026, 1, 1),
        )
        for component in score.components:
            assert component.rationale, f"{component.code} sans justification"
            if component.available:
                assert component.risk_value is not None
                assert component.label

    def test_drivers_are_sorted_by_contribution(self):
        score = scoring.compute_score(
            material_id="nd",
            stage_concentrations=_concentrated_chain(),
            supplier_shares=[100.0],
            stock_coverage_days=200.0,
        )
        contributions = [d.contribution for d in score.drivers]
        assert contributions == sorted(contributions, reverse=True)
        assert all(d.available for d in score.drivers)

    def test_risk_score_equals_sum_of_contributions(self):
        """Le score n'est pas opaque : il est exactement la somme de ses
        contributions publiées, reproductible à la main."""
        score = scoring.compute_score(
            material_id="nd",
            stage_concentrations=_concentrated_chain(),
            supplier_shares=[60.0, 40.0],
            stock_coverage_days=30.0,
        )
        total = sum(c.contribution for c in score.components if c.available)
        assert score.risk_score == pytest.approx(total, abs=0.01)


class TestMethodologyIsVersionedAndNotOfficial:
    def test_methodology_is_stamped(self):
        score = scoring.compute_score(
            material_id="nd", stage_concentrations=_concentrated_chain()
        )
        assert score.methodology_code == "CC-MATERIAL-EXPOSURE"
        assert score.methodology_version == "0.1.0"

    def test_disclaimer_denies_official_eu_status(self):
        score = scoring.compute_score(
            material_id="nd", stage_concentrations=_concentrated_chain()
        )
        assert "n'est PAS un score officiel" in score.disclaimer
        assert "Union européenne" in score.disclaimer

    def test_score_is_deterministic_for_identical_inputs(self):
        kwargs = dict(
            material_id="nd",
            stage_concentrations=_concentrated_chain(),
            supplier_shares=[55.0, 45.0],
            stock_coverage_days=60.0,
            as_of=date(2026, 1, 1),
        )
        first = scoring.compute_score(**kwargs)
        second = scoring.compute_score(**kwargs)
        assert first.risk_score == second.risk_score
        assert first.confidence == second.confidence


class TestStockAndSubstituteMonotonicity:
    def test_more_stock_lowers_risk(self):
        def risk(days: float) -> float:
            return next(
                c.risk_value
                for c in scoring.compute_score(
                    material_id="nd", stage_concentrations=_concentrated_chain(),
                    stock_coverage_days=days,
                ).components
                if c.code == "stock_coverage"
            )
        assert risk(0.0) > risk(90.0) > risk(180.0)
        assert risk(365.0) == risk(180.0)  # plancher, pas de bonus infini

    def test_mature_substitute_lowers_risk_more_than_research(self):
        def risk(maturity: str) -> float:
            return next(
                c.risk_value
                for c in scoring.compute_score(
                    material_id="nd", stage_concentrations=_concentrated_chain(),
                    substitutes=[{"substitute_material_id": "x", "maturity": maturity}],
                ).components
                if c.code == "substitutability"
            )
        assert risk("mature") < risk("commercial") < risk("pilot") < risk("research")
