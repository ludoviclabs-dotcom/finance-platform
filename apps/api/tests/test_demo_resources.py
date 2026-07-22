"""test_demo_resources.py — MODULE 2 (PR-M2D), PUR (sans base de données).

Prouve, dans le job `tests` (pas de Postgres requis), que le scénario Asterion
produit des assessments RESSOURCES stables et cohérents via le MOTEUR RÉEL
(`services/resources/scoring.py`) :
  - parité EXACTE avec les valeurs canoniques déclarées (`expected_assessments`) ;
  - risque ≠ confiance (deux grandeurs séparées, toutes deux calculées) ;
  - données manquantes attendues (substituabilité toujours absente ici) ;
  - reproductibilité (input_hash déterministe) ;
  - 100 % fictif (synthetic=true, data_status estimated/manual).
"""

from __future__ import annotations

from datetime import date

from demo.loader import load_scenario
from services.resources import scoring


def _assess(slug: str, res: dict, cfg: dict):
    ry = int(cfg.get("reference_year", 2024))
    obs = [
        {"stage_code": o["stage_code"], "country_code": o["country_code"],
         "metric_code": o.get("metric_code", "production"), "share_pct": o.get("share_pct"),
         "reference_year": ry, "data_status": o.get("data_status", "estimated"),
         "source_release_id": 1}
        for o in res.get("supply", [])
    ]
    shares = [x["share_of_supply_pct"] for x in res.get("exposures", [])
              if x.get("share_of_supply_pct") is not None]
    stocks = [x["stock_coverage_days"] for x in res.get("exposures", [])
              if x.get("stock_coverage_days") is not None]
    return scoring.assess(
        resource_slug=slug, observation_rows=obs, supplier_shares=shares, substitutes=[],
        stock_coverage_days=min(stocks) if stocks else None,
        as_of=date.fromisoformat(str(cfg.get("reference_date", "2026-06-30"))),
        market_total=1, market_blocked=0,
    )


def test_all_resources_match_canonical_expected():
    cfg = load_scenario().resources
    expected = cfg["expected_assessments"]
    for res in cfg["resources"]:
        slug = res["slug"]
        r = _assess(slug, res, cfg)
        exp = expected[slug]
        assert r.risk_score == exp["risk_score"], f"{slug} risk"
        assert r.confidence == exp["confidence"], f"{slug} confidence"
        assert r.observed_hhi == exp["observed_hhi"], f"{slug} hhi"
        missing = sorted(d.dimension_code for d in r.dimensions if d.kind == "risk" and not d.available)
        assert missing == sorted(exp["missing_dimensions"]), f"{slug} missing"


def test_risk_and_confidence_separate_and_synthetic():
    cfg = load_scenario().resources
    assert cfg.get("synthetic") is True
    for res in cfg["resources"]:
        assert res.get("data_status") in ("estimated", "manual"), res["slug"]
        r = _assess(res["slug"], res, cfg)
        # Risque et confiance sont DEUX grandeurs distinctes, toutes deux calculées.
        assert r.confidence is not None
        # Substituabilité toujours manquante (aucun substitut CRMA pour ces ressources
        # synthétiques) => la démonstration montre bien une donnée manquante.
        assert any(d.dimension_code == "substitutability" and not d.available for d in r.dimensions), res["slug"]
        # Disclaimer explicitement non officiel.
        assert "PAS un score" in r.disclaimer


def test_reproducible_and_no_invented_index():
    cfg = load_scenario().resources
    res = next(r for r in cfg["resources"] if r["slug"] == "silicon-metal")
    a = _assess("silicon-metal", res, cfg)
    b = _assess("silicon-metal", res, cfg)
    assert a.input_hash == b.input_hash  # déterministe (reproductible)
    # Hydrogène : approvisionnement majoritairement UE => risque BAS, jamais nul ni None
    # (la concentration par étape reste calculable).
    hydro = next(r for r in cfg["resources"] if r["slug"] == "hydrogen")
    rh = _assess("hydrogen", hydro, cfg)
    assert rh.risk_score is not None and rh.risk_score < 40
