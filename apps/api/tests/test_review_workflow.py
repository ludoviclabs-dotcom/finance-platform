"""
test_review_workflow.py — Tests unitaires du workflow de validation.

Teste principalement la machine d'état (_VALID_TRANSITIONS) sans DB.
Les tests DB sont skippés si DATABASE_URL absent.
"""

from __future__ import annotations

import os

import pytest

from services.review_service import (
    REVIEW_TIMEOUT_HOURS,
    ReviewError,
    _VALID_TRANSITIONS,
)


class TestTransitionMatrix:
    def test_proposed_can_go_to_in_review(self):
        assert "in_review" in _VALID_TRANSITIONS["proposed"]

    def test_proposed_can_go_to_validated_directly(self):
        """Bypass in_review autorisé (validation express)."""
        assert "validated" in _VALID_TRANSITIONS["proposed"]

    def test_proposed_can_be_rejected(self):
        assert "rejected" in _VALID_TRANSITIONS["proposed"]

    def test_in_review_to_validated(self):
        assert "validated" in _VALID_TRANSITIONS["in_review"]

    def test_validated_to_frozen(self):
        assert "frozen" in _VALID_TRANSITIONS["validated"]

    def test_frozen_is_terminal(self):
        """FROZEN ne doit pas avoir de transition sortante."""
        assert _VALID_TRANSITIONS["frozen"] == set()

    def test_validated_cannot_go_back_to_proposed(self):
        assert "proposed" not in _VALID_TRANSITIONS["validated"]

    def test_rejected_can_restart_cycle(self):
        assert "proposed" in _VALID_TRANSITIONS["rejected"]

    def test_validated_can_be_rejected_before_freeze(self):
        """Un validated peut être rejeté avant freeze (erreur détectée a posteriori)."""
        assert "rejected" in _VALID_TRANSITIONS["validated"]

    def test_all_statuses_covered(self):
        expected = {"proposed", "in_review", "validated", "frozen", "rejected"}
        assert set(_VALID_TRANSITIONS.keys()) == expected


class TestTimeoutConstant:
    def test_timeout_is_2h(self):
        """DoD Phase 3 : timeout auto à 2h."""
        assert REVIEW_TIMEOUT_HOURS == 2


# ── Tests DB ─────────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL absent — tests DB skippés",
)
class TestReviewLifecycleDb:
    """Tests end-to-end sur DB locale. Requiert PostgreSQL + migration 006 appliquée."""

    def test_full_lifecycle(self):
        """propose → in_review → validated → frozen (chemin heureux)."""
        from services import review_service

        # Utilise company_id=1 par défaut (fixture démarrage)
        company_id = 1
        r1 = review_service.propose(
            company_id=company_id,
            fact_code="test.lifecycle.fact",
            proposed_by=None,
            comment="test unitaire",
        )
        assert r1 is not None
        assert r1.status == "proposed"

        r2 = review_service.move_to_review(
            review_id=r1.id, company_id=company_id, user_id=None,
        )
        assert r2.status == "in_review"

        r3 = review_service.approve(
            review_id=r1.id, company_id=company_id, user_id=1,
        )
        assert r3.status == "validated"
        assert r3.reviewed_at is not None

        r4 = review_service.freeze(
            review_id=r1.id, company_id=company_id, user_id=1,
        )
        assert r4.status == "frozen"
        assert r4.frozen_at is not None

    def test_reject_requires_reason(self):
        from services import review_service

        with pytest.raises(ReviewError, match="Motif"):
            review_service.reject(
                review_id=999_999, company_id=1, user_id=1, reject_reason="",
            )

    def test_frozen_cannot_transition(self):
        """Un datapoint frozen ne peut plus bouger."""
        from services import review_service

        r = review_service.propose(
            company_id=1, fact_code="test.terminal.fact",
        )
        assert r is not None
        review_service.approve(review_id=r.id, company_id=1, user_id=1)
        review_service.freeze(review_id=r.id, company_id=1, user_id=1)

        with pytest.raises(ReviewError, match="Transition interdite"):
            review_service.reject(
                review_id=r.id, company_id=1, user_id=1, reject_reason="test",
            )
