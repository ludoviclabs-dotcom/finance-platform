"""Tests T2.6 — indicateurs de preuve & qualité + score audit.

Pur (sans DB) :
  - derive_quality : mapping source_path → 1-5 + override meta.quality
  - compute_score : reproduit EXACTEMENT les exemples d'AUDIT_SCORE.md
  - compute_indicators : _empty() sans DB (score 47)
  - endpoint /quality/indicators protégé par auth
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from services import quality_service

client = TestClient(app)


class TestDeriveQuality:
    def test_fec_is_monetary(self) -> None:
        assert quality_service.derive_quality("fec:2024.csv:42") == 4

    def test_manual_is_estimated(self) -> None:
        assert quality_service.derive_quality("manual:user@e.fr") == 3

    def test_evidence_promotes_to_justified(self) -> None:
        assert quality_service.derive_quality("upload:x", has_evidence=True) == 2

    def test_master_is_justified(self) -> None:
        assert quality_service.derive_quality("master") == 2

    def test_default_is_estimated(self) -> None:
        assert quality_service.derive_quality("upload:Excel!S1!C10") == 3
        assert quality_service.derive_quality(None) == 3

    def test_meta_override_wins(self) -> None:
        assert quality_service.derive_quality("upload:x", meta={"quality": 1}) == 1
        assert quality_service.derive_quality("fec:x", meta={"quality": 5}) == 5

    def test_meta_override_out_of_range_ignored(self) -> None:
        assert quality_service.derive_quality("fec:x", meta={"quality": 9}) == 4


class TestComputeScore:
    def test_empty_is_47(self) -> None:
        # AUDIT_SCORE.md exemple 1 : coverage 0, avg ∅, chain ok, fe ∅
        assert quality_service.compute_score(
            {"evidence_coverage": 0.0, "avg_quality": None, "chain_ok": True, "fe_versions": []}
        ) == 47

    def test_strong_profile_is_94(self) -> None:
        # AUDIT_SCORE.md exemple 2
        assert quality_service.compute_score(
            {"evidence_coverage": 1.0, "avg_quality": 2, "chain_ok": True, "fe_versions": ["v2025"]}
        ) == 94

    def test_broken_chain_caps_at_70(self) -> None:
        # AUDIT_SCORE.md exemple 3 : tout idéal sauf la chaîne rompue
        assert quality_service.compute_score(
            {"evidence_coverage": 1.0, "avg_quality": 1, "chain_ok": False, "fe_versions": ["v2025"]}
        ) == 70

    def test_clamped_0_100(self) -> None:
        s = quality_service.compute_score(
            {"evidence_coverage": 1.0, "avg_quality": 1, "chain_ok": True, "fe_versions": ["v"]}
        )
        assert 0 <= s <= 100


class TestComputeIndicatorsNoDb:
    def test_empty_indicators(self) -> None:
        ind = quality_service.compute_indicators(999321)
        assert ind["total_datapoints"] == 0
        assert ind["audit_score"] == 47
        assert ind["quality_distribution"] == {str(i): 0 for i in range(1, 6)}


class TestEndpointGuard:
    def test_requires_auth(self) -> None:
        assert client.get("/quality/indicators").status_code in (401, 403)
