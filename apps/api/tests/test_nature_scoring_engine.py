"""
test_nature_scoring_engine.py — moteur PUR risque/opportunité nature
(PR-09 tranche B). Aucune base requise (comme `test_water_screening_engine.py`)
— `services/calculations/nature_scoring.py` est un module pur.

Couvre les règles non négociables : une composante sans donnée ACCEPTÉE est
exclue (poids renormalisés, jamais comptée à zéro) ; `risk_score`/
`opportunity_score` valent `None` si rien n'est calculable, la confiance
reste calculée (elle dégrade) ; `likelihood` est un jugement humain transmis
tel quel, JAMAIS dérivé du score (indépendance prouvée par test) ; sélection
du palier le plus critique (jamais une moyenne) ; reproductibilité.
"""

from __future__ import annotations

from services.calculations import nature_scoring as scoring


def _dep(dep_id: int, level: str) -> dict:
    return {"id": dep_id, "dependency_level": level, "ecosystem_service": "freshwater"}


def _imp(imp_id: int, kind: str, magnitude: str) -> dict:
    return {"id": imp_id, "impact_kind": kind, "magnitude_qualitative": magnitude, "pressure_type": "water_use"}


def _inter(inter_id: int, feature_kind: str, matched: bool = True) -> dict:
    return {"id": inter_id, "feature_kind": feature_kind, "matched": matched}


class TestComponentSelection:
    """Le palier le plus CRITIQUE est sélectionné — jamais une moyenne."""

    def test_dependency_exposure_selects_worst_not_average(self):
        deps = [_dep(1, "low"), _dep(2, "critical")]
        result = scoring.score_risk(
            dependencies=deps, impacts=[], intersections=[], total_rows=2, accepted_rows=2,
        )
        dep_component = next(c for c in result["components"] if c["code"] == "dependency_exposure")
        assert dep_component["value"] == scoring.QUALITATIVE_VALUE["critical"]
        assert "critical" in dep_component["rationale"]

    def test_impact_severity_ignores_positive_impacts(self):
        """Seuls les impacts NÉGATIFS alimentent le risque — un impact
        positif n'est jamais compté comme une sévérité de risque."""
        impacts = [_imp(1, "positive", "critical"), _imp(2, "negative", "low")]
        result = scoring.score_risk(
            dependencies=[], impacts=impacts, intersections=[], total_rows=2, accepted_rows=2,
        )
        sev_component = next(c for c in result["components"] if c["code"] == "impact_severity")
        assert sev_component["value"] == scoring.QUALITATIVE_VALUE["low"]

    def test_opportunity_uses_only_positive_impacts(self):
        impacts = [_imp(1, "positive", "high"), _imp(2, "negative", "critical")]
        result = scoring.score_opportunity(
            dependencies=[], impacts=impacts, total_rows=2, accepted_rows=2,
        )
        component = next(c for c in result["components"] if c["code"] == "positive_impact_potential")
        assert component["value"] == scoring.QUALITATIVE_VALUE["high"]


class TestMissingDataNeverFabricatedZero:
    """Règle non négociable PR-09 : l'absence de donnée dégrade la
    CONFIANCE, jamais le risque — un score inventé serait pire qu'une
    absence de score."""

    def test_no_components_at_all_risk_score_is_none(self):
        result = scoring.score_risk(
            dependencies=[], impacts=[], intersections=[], total_rows=0, accepted_rows=0,
        )
        assert result["risk_score"] is None
        assert any("non produit" in w for w in result["warnings"])
        # La confiance reste calculée — elle vaudra logiquement très peu, mais
        # n'est jamais absente (c'est précisément son rôle).
        assert result["confidence"] is not None

    def test_no_components_opportunity_score_is_none(self):
        result = scoring.score_opportunity(
            dependencies=[], impacts=[], total_rows=0, accepted_rows=0,
        )
        assert result["opportunity_score"] is None

    def test_partial_components_excluded_not_zeroed(self):
        """Seule impact_severity a des données : dependency_exposure et
        site_sensitivity sont EXCLUES (poids renormalisé sur impact_severity
        à 100%), jamais comptées comme 0."""
        impacts = [_imp(1, "negative", "high")]
        result = scoring.score_risk(
            dependencies=[], impacts=impacts, intersections=[], total_rows=1, accepted_rows=1,
        )
        assert result["risk_score"] == scoring.QUALITATIVE_VALUE["high"]
        missing_warning = next((w for w in result["warnings"] if "Composantes exclues" in w), None)
        assert missing_warning is not None
        assert "dependency_exposure" in missing_warning
        assert "site_sensitivity" in missing_warning

    def test_confidence_degrades_with_pending_rows_not_the_score(self):
        """Deux dépendances ACCEPTÉES identiques ; `total_rows` variable
        simule des lignes PENDING supplémentaires dans le périmètre — la
        confiance baisse avec la couverture de revue, le score reste
        identique (les deux grandeurs sont indépendantes)."""
        deps = [_dep(1, "high"), _dep(2, "high")]
        full_coverage = scoring.score_risk(
            dependencies=deps, impacts=[], intersections=[], total_rows=2, accepted_rows=2,
        )
        partial_coverage = scoring.score_risk(
            dependencies=deps, impacts=[], intersections=[], total_rows=10, accepted_rows=2,
        )
        assert full_coverage["risk_score"] == partial_coverage["risk_score"]
        assert partial_coverage["confidence"] < full_coverage["confidence"]


class TestLikelihoodIndependence:
    """`likelihood` est un jugement humain — jamais dérivé du score. Preuve :
    faire varier `likelihood` seul ne doit JAMAIS changer `risk_score`, et
    faire varier les données seules ne doit JAMAIS changer `likelihood`."""

    def test_likelihood_passthrough_unchanged(self):
        deps = [_dep(1, "high")]
        result = scoring.score_risk(
            dependencies=deps, impacts=[], intersections=[], total_rows=1, accepted_rows=1,
            likelihood="critical",
        )
        assert result["likelihood"] == "critical"

    def test_likelihood_none_by_default(self):
        deps = [_dep(1, "high")]
        result = scoring.score_risk(
            dependencies=deps, impacts=[], intersections=[], total_rows=1, accepted_rows=1,
        )
        assert result["likelihood"] is None

    def test_varying_likelihood_does_not_change_risk_score(self):
        deps = [_dep(1, "high")]
        low = scoring.score_risk(
            dependencies=deps, impacts=[], intersections=[], total_rows=1, accepted_rows=1,
            likelihood="low",
        )
        critical = scoring.score_risk(
            dependencies=deps, impacts=[], intersections=[], total_rows=1, accepted_rows=1,
            likelihood="critical",
        )
        assert low["risk_score"] == critical["risk_score"]
        assert low["likelihood"] != critical["likelihood"]

    def test_varying_data_does_not_change_likelihood(self):
        weak = scoring.score_risk(
            dependencies=[_dep(1, "low")], impacts=[], intersections=[],
            total_rows=1, accepted_rows=1, likelihood="high",
        )
        strong = scoring.score_risk(
            dependencies=[_dep(1, "critical")], impacts=[], intersections=[],
            total_rows=1, accepted_rows=1, likelihood="high",
        )
        assert weak["risk_score"] != strong["risk_score"]
        assert weak["likelihood"] == strong["likelihood"] == "high"


class TestNeverFused:
    def test_risk_result_has_three_independent_keys(self):
        result = scoring.score_risk(
            dependencies=[_dep(1, "high")], impacts=[], intersections=[],
            total_rows=1, accepted_rows=1, likelihood="medium",
        )
        # Trois clés distinctes, aucune combinaison arithmétique de l'une
        # dans une autre (pas de "score_pondere" ou "risk_x_confidence").
        assert {"risk_score", "likelihood", "confidence"} <= set(result.keys())
        assert not any("weighted" in k or "combined" in k or "fused" in k for k in result.keys())


class TestSiteSensitivity:
    def test_unmatched_intersection_excluded(self):
        """Une intersection `matched=False` n'alimente jamais la sensibilité
        — proximité bbox seule n'est pas une appartenance confirmée."""
        inter = [_inter(1, "protected_area", matched=False)]
        result = scoring.score_risk(
            dependencies=[], impacts=[], intersections=inter, total_rows=1, accepted_rows=1,
        )
        sens = next(c for c in result["components"] if c["code"] == "site_sensitivity")
        assert sens["available"] is False

    def test_matched_kba_scores_highest_sensitivity(self):
        inter = [_inter(1, "ecosystem"), _inter(2, "kba")]
        result = scoring.score_risk(
            dependencies=[], impacts=[], intersections=inter, total_rows=2, accepted_rows=2,
        )
        sens = next(c for c in result["components"] if c["code"] == "site_sensitivity")
        assert sens["value"] == scoring.FEATURE_KIND_VALUE["kba"]


class TestReproducibility:
    def test_same_inputs_same_fingerprint(self):
        deps = [_dep(1, "high")]
        impacts = [_imp(2, "negative", "medium")]
        first = scoring.score_risk(
            dependencies=deps, impacts=impacts, intersections=[],
            total_rows=2, accepted_rows=2, likelihood="high",
        )
        second = scoring.score_risk(
            dependencies=[dict(d) for d in deps], impacts=[dict(i) for i in impacts],
            intersections=[], total_rows=2, accepted_rows=2, likelihood="high",
        )
        assert first["fingerprint"] == second["fingerprint"]
        assert first["risk_score"] == second["risk_score"]

    def test_fingerprint_is_sha256_hex(self):
        result = scoring.score_risk(
            dependencies=[_dep(1, "high")], impacts=[], intersections=[],
            total_rows=1, accepted_rows=1,
        )
        assert len(result["fingerprint"]) == 64
        int(result["fingerprint"], 16)
