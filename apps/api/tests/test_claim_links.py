"""
test_claim_links.py — claim_link_service (PR-05A comble la dette PR-03).

Deux niveaux :
  - PUR (jamais skippé) : validation du `relation_type` (Literal Pydantic +
    garde défensive du service) — vocabulaire gelé des contrats §1.
  - DB-gated : création d'un lien preuve↔claim, garde de périmètre (artefact
    d'un autre tenant non liable), filtres de liste.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.intelligence import ClaimEvidenceLinkCreate
from services.intelligence import artifact_service, claim_link_service

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


# ── Pur : validation du relation_type (aucune DB) ────────────────────────────

class TestRelationTypeValidation:
    def test_valid_relation_types_are_the_four_frozen_values(self):
        assert set(claim_link_service.VALID_RELATION_TYPES) == {
            "supports", "contradicts", "contextualizes", "derived_from",
        }

    @pytest.mark.parametrize("relation", ["supports", "contradicts", "contextualizes", "derived_from"])
    def test_validate_accepts_each_frozen_value(self, relation):
        # Ne lève pas.
        claim_link_service.validate_relation_type(relation)

    @pytest.mark.parametrize("relation", ["support", "SUPPORTS", "", "related", "cause"])
    def test_validate_rejects_unknown_value(self, relation):
        with pytest.raises(claim_link_service.ClaimLinkError):
            claim_link_service.validate_relation_type(relation)

    def test_pydantic_model_rejects_unknown_relation(self):
        with pytest.raises(Exception):
            ClaimEvidenceLinkCreate(
                claim_type="purchase_line", claim_key="1", evidence_artifact_id=1,
                relation_type="not_a_relation",
            )


# ── DB-gated : création / périmètre / liste ──────────────────────────────────

@_skip_no_db_url
@_skip_no_psycopg2
class TestClaimLinkService:
    def _artifact(self, cid: int, seed: str = "proof"):
        return artifact_service.register_artifact(
            company_id=cid, data=seed.encode(), filename=f"{seed}.pdf", mime_type="application/pdf",
        )

    def test_create_link_to_own_artifact(self, two_companies):
        cid_a, _ = two_companies
        art = self._artifact(cid_a, f"link-a-{cid_a}")
        link = claim_link_service.create_link(
            company_id=cid_a,
            payload=ClaimEvidenceLinkCreate(
                claim_type="purchase_line", claim_key="42",
                evidence_artifact_id=art.id, relation_type="supports",
            ),
        )
        assert link.claim_type == "purchase_line"
        assert link.claim_key == "42"
        assert link.evidence_artifact_id == art.id
        assert link.relation_type == "supports"

    def test_create_link_unknown_artifact_raises(self, two_companies):
        cid_a, _ = two_companies
        with pytest.raises(claim_link_service.ClaimLinkError):
            claim_link_service.create_link(
                company_id=cid_a,
                payload=ClaimEvidenceLinkCreate(
                    claim_type="purchase_line", claim_key="1",
                    evidence_artifact_id=999_999_999, relation_type="supports",
                ),
            )

    def test_cannot_link_to_other_tenant_artifact(self, two_companies):
        cid_a, cid_b = two_companies
        art_a = self._artifact(cid_a, f"link-iso-{cid_a}")
        # B ne voit pas l'artefact de A → lien refusé (même erreur, pas de fuite).
        with pytest.raises(claim_link_service.ClaimLinkError):
            claim_link_service.create_link(
                company_id=cid_b,
                payload=ClaimEvidenceLinkCreate(
                    claim_type="purchase_line", claim_key="1",
                    evidence_artifact_id=art_a.id, relation_type="supports",
                ),
            )

    def test_list_links_filters_by_claim(self, two_companies):
        cid_a, _ = two_companies
        art = self._artifact(cid_a, f"link-list-{cid_a}")
        claim_link_service.create_link(
            company_id=cid_a,
            payload=ClaimEvidenceLinkCreate(
                claim_type="procurement_run", claim_key="run-xyz",
                evidence_artifact_id=art.id, relation_type="derived_from",
            ),
        )
        items, total = claim_link_service.list_links(
            company_id=cid_a, claim_type="procurement_run", claim_key="run-xyz",
        )
        assert total >= 1
        assert all(link.claim_type == "procurement_run" and link.claim_key == "run-xyz" for link in items)

    def test_get_link_tenant_scoped(self, two_companies):
        cid_a, cid_b = two_companies
        art = self._artifact(cid_a, f"link-get-{cid_a}")
        link = claim_link_service.create_link(
            company_id=cid_a,
            payload=ClaimEvidenceLinkCreate(
                claim_type="purchase_line", claim_key="7",
                evidence_artifact_id=art.id, relation_type="contextualizes",
            ),
        )
        with pytest.raises(claim_link_service.ClaimLinkError):
            claim_link_service.get_link(company_id=cid_b, link_id=link.id)

    def test_relation_type_check_at_db_level(self, two_companies):
        """La contrainte CHECK SQL protège même en contournant Pydantic."""
        cid_a, _ = two_companies
        art = self._artifact(cid_a, f"link-check-{cid_a}")
        with pytest.raises(Exception):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO claim_evidence_links "
                        "(company_id, claim_type, claim_key, evidence_artifact_id, relation_type) "
                        "VALUES (%s, 'purchase_line', '1', %s, 'invalid_relation')",
                        (cid_a, art.id),
                    )
