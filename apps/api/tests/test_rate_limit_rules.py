"""
test_rate_limit_rules.py — T1.5 : règles de rate-limit (configuration).

Le rate-limit est désactivé en test (RATE_LIMIT_DISABLED=1) ; on vérifie ici la
configuration des règles et la résolution par préfixe le plus spécifique.
"""

from __future__ import annotations

from middleware.rate_limit import RULES, _match_rule


def test_global_catch_all():
    rule = RULES.get("")
    assert rule is not None and rule.limit == 100 and rule.window_seconds == 60


def test_auth_group_rule():
    rule = RULES.get("/auth")
    assert rule is not None and rule.limit == 20 and rule.window_seconds == 60


def test_upload_hourly_rule():
    for prefix in ("/excel/upload", "/excel/ingest-uploaded"):
        rule = RULES.get(prefix)
        assert rule is not None and rule.limit == 10 and rule.window_seconds == 3600


def test_match_prefers_most_specific():
    # /auth/login (5/60) plus spécifique que /auth (20/60) que "" (100/60)
    _, rule = _match_rule("/auth/login")
    assert rule.limit == 5
    _, totp = _match_rule("/auth/totp/verify")
    assert totp.limit == 5 and totp.window_seconds == 900
    _, upload = _match_rule("/excel/ingest-uploaded")
    assert upload.window_seconds == 3600
    # une route non listée -> catch-all global
    _, glob = _match_rule("/dashboard/whatever")
    assert glob.limit == 100
