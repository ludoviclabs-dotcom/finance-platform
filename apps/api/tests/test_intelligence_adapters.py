"""
test_intelligence_adapters.py — SourceAdapter/FakeAdapter + normaliseur CRM (PR-04).

Entièrement PUR (aucune base) : déterminisme de l'adaptateur, checksum,
mapping snapshot→observations, garde d'absence de valeur. Ces tests tournent
dans TOUS les jobs (pas DB-gated).
"""

from __future__ import annotations

import json

import pytest

from services.intelligence.adapters import (
    FakeAdapter,
    ObservationDraft,
    SourceAdapter,
    sha256_hex,
)
from services.intelligence.adapters.base import AdapterError
from services.intelligence.snapshot_migration import (
    METRIC_CRITICAL_EU,
    METRIC_PRICE_TREND,
    METRIC_PRICE_USD,
    METRIC_STRATEGIC_EU,
    METRIC_SUPPLY_RISK,
    METRIC_TOP_PRODUCER_SHARE,
    build_demo_adapter,
    crm_snapshot_to_drafts,
)

_MINI_SNAPSHOT = {
    "snapshot_date": "2026-06-30",
    "materials": [
        {
            "id": "antimony",
            "name_fr": "Antimoine",
            "is_critical_eu": True,
            "is_strategic_eu": False,
            "carbonco_supply_risk_score": 8.7,
            "score_methodology_version": "CC-SUPPLY-RISK-0.1",
            "score_confidence": None,
            "top_producers": [{"country": "Chine", "share_pct": 48}],
            "price_snapshot": {"date": "2026-06-30", "value": 39, "unit": "USD/kg", "trend_3m_pct": 34},
            "data_quality": "estimated",
        },
        {
            "id": "gallium",
            "name_fr": "Gallium",
            "is_critical_eu": True,
            "is_strategic_eu": True,
            "carbonco_supply_risk_score": 9.1,
            "score_methodology_version": "CC-SUPPLY-RISK-0.1",
            "score_confidence": None,
            "top_producers": [{"country": "Chine", "share_pct": 98}],
            "price_snapshot": None,  # pas de prix → pas d'observation prix
            "data_quality": "estimated",
        },
    ],
}


def _bytes(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False).encode("utf-8")


def _adapter(obj) -> FakeAdapter:
    return FakeAdapter(
        content=_bytes(obj), release_key="2026-06-30", normalizer=crm_snapshot_to_drafts,
    )


class TestFakeAdapterContract:
    def test_fake_adapter_satisfies_protocol(self):
        assert isinstance(_adapter(_MINI_SNAPSHOT), SourceAdapter)

    def test_detect_is_deterministic_same_checksum(self):
        a1 = _adapter(_MINI_SNAPSHOT).detect_releases()
        a2 = _adapter(_MINI_SNAPSHOT).detect_releases()
        assert a1[0].checksum_sha256 == a2[0].checksum_sha256
        assert a1[0].checksum_sha256 == sha256_hex(_bytes(_MINI_SNAPSHOT))
        assert len(a1[0].checksum_sha256) == 64

    def test_detect_returns_single_release_with_key(self):
        cands = _adapter(_MINI_SNAPSHOT).detect_releases()
        assert len(cands) == 1
        assert cands[0].release_key == "2026-06-30"

    def test_fetch_release_returns_raw_bytes_no_network(self):
        ad = _adapter(_MINI_SNAPSHOT)
        cand = ad.detect_releases()[0]
        assert ad.fetch_release(cand) == _bytes(_MINI_SNAPSHOT)

    def test_parse_invalid_json_raises_adaptererror(self):
        ad = FakeAdapter(content=b"{not json", release_key="x", normalizer=crm_snapshot_to_drafts)
        with pytest.raises(AdapterError):
            ad.parse(b"{not json")

    def test_missing_path_and_content_raises(self):
        with pytest.raises(AdapterError):
            FakeAdapter(release_key="x", normalizer=crm_snapshot_to_drafts)

    def test_normalize_rejects_valueless_draft(self):
        def bad_normalizer(_parsed):
            return [ObservationDraft(subject_type="material", subject_key="material:x", metric_code="m")]

        ad = FakeAdapter(content=_bytes(_MINI_SNAPSHOT), release_key="x", normalizer=bad_normalizer)
        with pytest.raises(AdapterError):
            ad.normalize({"materials": []})


class TestCrmNormalizer:
    def test_metric_counts_match_snapshot_shape(self):
        drafts = crm_snapshot_to_drafts(_MINI_SNAPSHOT)
        codes = [d.metric_code for d in drafts]
        # 2 matières : score×2, critical×2, strategic×2, top_producer×2, prix×1, trend×1
        assert codes.count(METRIC_SUPPLY_RISK) == 2
        assert codes.count(METRIC_CRITICAL_EU) == 2
        assert codes.count(METRIC_STRATEGIC_EU) == 2
        assert codes.count(METRIC_TOP_PRODUCER_SHARE) == 2
        assert codes.count(METRIC_PRICE_USD) == 1  # gallium sans prix
        assert codes.count(METRIC_PRICE_TREND) == 1

    def test_values_are_copied_faithfully(self):
        drafts = crm_snapshot_to_drafts(_MINI_SNAPSHOT)
        by = {(d.subject_key, d.metric_code): d for d in drafts}
        assert by[("material:antimony", METRIC_SUPPLY_RISK)].numeric_value == 8.7
        assert by[("material:antimony", METRIC_PRICE_USD)].numeric_value == 39
        assert by[("material:antimony", METRIC_PRICE_USD)].unit == "USD/kg"
        assert by[("material:antimony", METRIC_TOP_PRODUCER_SHARE)].numeric_value == 48
        assert by[("material:antimony", METRIC_TOP_PRODUCER_SHARE)].geography_code == "Chine"
        assert by[("material:antimony", METRIC_CRITICAL_EU)].boolean_value is True
        assert by[("material:antimony", METRIC_STRATEGIC_EU)].boolean_value is False

    def test_all_observations_estimated(self):
        drafts = crm_snapshot_to_drafts(_MINI_SNAPSHOT)
        assert all(d.data_status == "estimated" for d in drafts)

    def test_null_score_confidence_never_becomes_observation(self):
        drafts = crm_snapshot_to_drafts(_MINI_SNAPSHOT)
        assert all(d.metric_code != "score_confidence" for d in drafts)

    def test_invalid_structure_raises(self):
        with pytest.raises(Exception):
            crm_snapshot_to_drafts({"no_materials": True})

    def test_real_demo_snapshot_yields_192_observations(self):
        drafts = build_demo_adapter().normalize(
            build_demo_adapter().parse(build_demo_adapter().detect_releases()[0].content)
        )
        # 34 matières : 34 score + 34 critical + 34 strategic + 34 top + 28 prix + 28 trend
        assert len(drafts) == 192
