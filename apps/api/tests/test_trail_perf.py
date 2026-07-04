"""
test_trail_perf.py — T1.1 DoD : p95 de /facts/{code}/trail < 500 ms.

Skip en CI (mode /tmp). Rejeu manuel contre Neon : seed 1 000 events puis mesure
20 appels get_trail, assert p95 < 500 ms.
"""

from __future__ import annotations

import os
import time

import pytest

from services import facts_service


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL requis (Neon) — mesure de perf rejouée manuellement",
)
def test_trail_p95_under_500ms():  # pragma: no cover - exécuté hors CI
    company_id = 1
    code = "CC.GES.SCOPE1"

    # Seed 1 000 events (best-effort, ignore les conflits computed_at).
    for i in range(1000):
        facts_service.emit_fact(
            company_id=company_id, code=code, value=float(i),
            unit="tCO2e", source_path=f"perf:{i}",
        )

    durations: list[float] = []
    for _ in range(20):
        start = time.perf_counter()
        facts_service.get_trail(code=code, company_id=company_id, limit=50)
        durations.append((time.perf_counter() - start) * 1000)

    durations.sort()
    p95 = durations[int(len(durations) * 0.95) - 1]
    assert p95 < 500, f"p95 trail = {p95:.0f} ms (> 500 ms)"
