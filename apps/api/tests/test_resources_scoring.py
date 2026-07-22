"""
test_resources_scoring.py — Resource Exposure Score, tests PURS (PR-M2B).

Aucune base : `services.resources.scoring` est sans I/O, donc la MÉTHODE est
prouvée ici, partout (y compris hors CI PostgreSQL). Barème HHI canonique
0-10000 (monopole = 10000, quatre parts égales = 2500).
"""

from __future__ import annotations

from datetime import date

import pytest

from services.resources import scoring


def _obs(country: str, share: float | None = None, *, stage: str = "extraction",
         year: int = 2025, status: str = "estimated", release: int | None = None,
         volume: float | None = None, unit: str | None = None) -> dict:
    return {
        "country_code": country, "share_pct": share, "stage_code": stage,
        "reference_year": year, "data_status": status, "source_release_id": release,
        "volume_value": volume, "volume_unit": unit, "metric_code": "production",
    }


class TestHhi:
    def test_monopoly_is_10000(self):
        assert scoring.herfindahl([100.0]) == 10000.0

    def test_four_equal_is_2500(self):
        assert scoring.herfindahl([25.0, 25.0, 25.0, 25.0]) == 2500.0

    def test_empty_is_none(self):
        assert scoring.herfindahl([]) is None
        assert scoring.herfindahl([0.0, 0.0]) is None

    def test_crma_scale_still_available(self):
        # Réutilisation : barème 0-100 possible (défaut CRMA), sans régression.
        assert scoring.herfindahl([100.0], scale=100.0) == 100.0


class TestComputeStage:
    def test_single_country_full_coverage(self):
        s = scoring.compute_stage("extraction", [_obs("CN", 100.0)])
        assert s["hhi"] == 10000.0
        assert s["coverage_pct"] == 100.0
        assert s["missing_share_pct"] == 0.0
        assert s["top_country"] == "CN"

    def test_four_equal_countries(self):
        s = scoring.compute_stage("extraction", [_obs(c, 25.0) for c in ("CN", "AU", "US", "MM")])
        assert s["hhi"] == 2500.0
        assert s["country_count"] == 4

    def test_partial_coverage_reported(self):
        s = scoring.compute_stage("extraction", [_obs("CN", 40.0), _obs("US", 20.0)])
        assert s["coverage_pct"] == 60.0
        assert s["missing_share_pct"] == 40.0
        # 40/60 et 20/60 -> (2/3)^2 + (1/3)^2 = 0.5556 -> 5555.56
        assert s["hhi"] == pytest.approx(5555.56, abs=0.5)

    def test_invalid_share_rejected(self):
        with pytest.raises(scoring.ResourceScoringError):
            scoring.compute_stage("extraction", [_obs("CN", 140.0)])

    def test_mixed_stage_rejected(self):
        with pytest.raises(scoring.ResourceScoringError, match="ne se mélangent jamais"):
            scoring.compute_stage("extraction", [_obs("CN", 100.0, stage="refining")])

    def test_mixed_years_rejected(self):
        with pytest.raises(scoring.ResourceScoringError, match="années différentes"):
            scoring.compute_stage("extraction", [_obs("CN", 50.0, year=2024), _obs("US", 50.0, year=2025)])

    def test_incompatible_units_rejected(self):
        with pytest.raises(scoring.ResourceScoringError, match="[Uu]nités incompatibles"):
            scoring.compute_stage("extraction", [
                _obs("CN", None, volume=100.0, unit="kg"),
                _obs("US", None, volume=50.0, unit="t"),
            ])

    def test_share_and_volume_mix_rejected(self):
        with pytest.raises(scoring.ResourceScoringError, match="[Uu]nités incompatibles"):
            scoring.compute_stage("extraction", [
                _obs("CN", 50.0), _obs("US", None, volume=50.0, unit="kg"),
            ])

    def test_non_eu_dependency(self):
        s = scoring.compute_stage("extraction", [_obs("CN", 60.0), _obs("FR", 40.0)])
        # 60 % hors UE sur 100 observés.
        assert s["non_eu_pct"] == 60.0


class TestAssess:
    def test_no_observations_gives_no_index(self):
        r = scoring.assess(resource_slug="x", observation_rows=[])
        assert r.risk_score is None  # donnée obligatoire manquante -> pas d'indice inventé
        assert r.confidence is not None  # la confiance reste calculée
        assert any("indice global non produit" in w for w in r.warnings)

    def test_monopoly_drives_max_risk(self):
        r = scoring.assess(resource_slug="x", observation_rows=[_obs("CN", 100.0)])
        assert r.observed_hhi == 10000.0
        assert r.risk_score == 100.0  # seule composante dispo, renormalisée à 1.0

    def test_risk_and_confidence_are_independent(self):
        rows_v = [_obs("CN", 60.0, status="verified", release=1), _obs("US", 40.0, status="verified", release=1)]
        rows_i = [_obs("CN", 60.0, status="inferred"), _obs("US", 40.0, status="inferred")]
        rv = scoring.assess(resource_slug="x", observation_rows=rows_v)
        ri = scoring.assess(resource_slug="x", observation_rows=rows_i)
        assert rv.risk_score == ri.risk_score          # même risque
        assert rv.confidence > ri.confidence           # meilleure confiance (données vérifiées)

    def test_reproducible_input_hash_and_score(self):
        rows = [_obs("CN", 50.0), _obs("US", 30.0), _obs("AU", 20.0)]
        a = scoring.assess(resource_slug="helium", observation_rows=rows, as_of=date(2026, 1, 1))
        b = scoring.assess(resource_slug="helium", observation_rows=list(rows), as_of=date(2026, 1, 1))
        assert a.input_hash == b.input_hash
        assert a.risk_score == b.risk_score
        assert a.confidence == b.confidence

    def test_substitutability_keeps_dimensions_separate(self):
        r = scoring.assess(
            resource_slug="x", observation_rows=[_obs("CN", 100.0)],
            substitutes=[{"maturity": "pilot", "performance_penalty_pct": 35.0}],
        )
        sub = next(d for d in r.dimensions if d.dimension_code == "substitutability")
        assert sub.available is True
        # Maturité et pénalité restent séparées (jamais fusionnées en un opaque).
        assert sub.detail["maturity"] == "pilot"
        assert sub.detail["penalty_pct"] == 35.0

    def test_missing_component_never_counted_as_zero(self):
        # Aucun substitut -> dimension indisponible, PAS risque nul.
        r = scoring.assess(resource_slug="x", observation_rows=[_obs("CN", 100.0)])
        sub = next(d for d in r.dimensions if d.dimension_code == "substitutability")
        assert sub.available is False
        assert sub.risk_value is None

    def test_sensitivity_band_contains_score(self):
        r = scoring.assess(
            resource_slug="x",
            observation_rows=[_obs("CN", 60.0), _obs("US", 40.0)],
            supplier_shares=[70.0, 30.0], stock_coverage_days=30.0,
        )
        assert r.sensitivity is not None
        assert r.sensitivity["band"]["low"] <= r.risk_score <= r.sensitivity["band"]["high"]

    def test_low_coverage_flags_but_still_scores(self):
        # Une seule observation à 30 % : couverture faible -> signalée, pas retirée.
        r = scoring.assess(resource_slug="x", observation_rows=[_obs("CN", 30.0)])
        assert r.observed_hhi == 10000.0  # 100 % du marché OBSERVÉ
        assert r.coverage_pct == 30.0
        assert r.missing_share_pct == 70.0
        assert any("couverture" in w.lower() for w in r.warnings)
