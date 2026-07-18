"""
test_procurement_declarations.py — déclarations fournisseurs & PCF sourcées (PR-05A).

DB-gated : une valeur avec release crée une OBSERVATION immuable (Evidence
Kernel) citée par la ligne ; une pièce jointe crée un CLAIM LINK ; une valeur
purement manuelle reste `manual` sans observation (honnête, pas un faux
« vérifié ») ; isolation tenant et garde de périmètre.
"""

from __future__ import annotations

import hashlib
import os

import pytest

from db.database import db_available
from models.intelligence import ReleaseCreate, SourceCreate
from models.procurement import DeclarationCreate, PcfCreate, SupplierProductCreate
from services.intelligence import (
    artifact_service,
    claim_link_service,
    observation_service,
    release_service,
    source_service,
)
from services.procurement import declarations_service, supplier_sites_service

from ._procurement_fixtures import insert_supplier

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _published_release(cid: int, code: str):
    source = source_service.create_source(
        company_id=cid,
        payload=SourceCreate(
            code=code, publisher="P", title="T", source_type="manual",
            automated_access_allowed=True, storage_allowed=True, display_allowed=True,
            derived_use_allowed=True, commercial_use_allowed=True, redistribution_allowed=True,
        ),
        created_by=None,
    )
    release = release_service.detect_release(
        company_id=cid, source_id=source.id,
        payload=ReleaseCreate(release_key="v1", checksum_sha256=hashlib.sha256(code.encode()).hexdigest()),
        created_by=None,
    )
    release_service.validate_release(company_id=cid, release_id=release.id, passed=True)
    return release_service.publish_release(company_id=cid, release_id=release.id)


@_skip_no_db_url
@_skip_no_psycopg2
class TestDeclarations:
    def test_manual_declaration_has_no_observation(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        sup = insert_supplier(cid_a, "Décl manual")
        decl = declarations_service.create_declaration(
            company_id=cid_a,
            payload=DeclarationCreate(
                supplier_id=sup, metric_code="ghg_scope1_tco2e", value=120.0, unit="tCO2e",
                data_status="manual",
            ),
        )
        assert decl.data_status == "manual"
        assert decl.observation_id is None  # pas de release → non sourcée

    def test_sourced_declaration_creates_observation(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        sup = insert_supplier(cid_a, "Décl sourcée")
        release = _published_release(cid_a, f"decl-src-{cid_a}")
        decl = declarations_service.create_declaration(
            company_id=cid_a,
            payload=DeclarationCreate(
                supplier_id=sup, metric_code="ghg_scope1_tco2e", value=120.0, unit="tCO2e",
                data_status="verified", source_release_id=release.id,
            ),
        )
        assert decl.observation_id is not None
        obs = observation_service.get_observation(company_id=cid_a, observation_id=decl.observation_id)
        assert obs.numeric_value == 120.0
        assert obs.subject_key == f"supplier:{sup}"
        assert obs.metric_code == "ghg_scope1_tco2e"

    def test_unknown_supplier_rejected(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        with pytest.raises(declarations_service.DeclarationError):
            declarations_service.create_declaration(
                company_id=cid_a,
                payload=DeclarationCreate(
                    supplier_id=999_999_999, metric_code="m", value=1.0, data_status="manual",
                ),
            )

    def test_sourced_declaration_bad_release_raises_declaration_error(self, two_companies_proc):
        """Une release hors périmètre remonte en DeclarationError (traduite depuis
        ObservationError) → le routeur mappe en 404, jamais en 500."""
        cid_a, _ = two_companies_proc
        sup = insert_supplier(cid_a, "Décl bad release")
        with pytest.raises(declarations_service.DeclarationError):
            declarations_service.create_declaration(
                company_id=cid_a,
                payload=DeclarationCreate(
                    supplier_id=sup, metric_code="m", value=1.0, data_status="verified",
                    source_release_id=999_999_999,
                ),
            )

    def test_tenant_isolation_declaration(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        sup = insert_supplier(cid_a, "Décl iso")
        decl = declarations_service.create_declaration(
            company_id=cid_a,
            payload=DeclarationCreate(supplier_id=sup, metric_code="m", value=1.0, data_status="manual"),
        )
        with pytest.raises(declarations_service.DeclarationError):
            declarations_service.get_declaration(company_id=cid_b, declaration_id=decl.id)


@_skip_no_db_url
@_skip_no_psycopg2
class TestPcf:
    def _supplier_product(self, cid: int, code: str):
        sup = insert_supplier(cid, f"PCF sup {code}")
        return supplier_sites_service.create_product(
            company_id=cid, supplier_id=sup, payload=SupplierProductCreate(product_code=code),
        )

    def test_sourced_pcf_creates_observation_and_claim_link(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        sp = self._supplier_product(cid_a, "PCF-1")
        release = _published_release(cid_a, f"pcf-src-{cid_a}")
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=b"pcf-certificate", filename="pcf.pdf", mime_type="application/pdf",
            source_release_id=release.id,
        )
        pcf = declarations_service.create_pcf(
            company_id=cid_a,
            payload=PcfCreate(
                supplier_product_id=sp.id, value_kgco2e=42.5, declared_unit="kgCO2e/pcs",
                verification_status="third_party_verified", data_status="verified",
                source_release_id=release.id, evidence_artifact_id=artifact.id,
            ),
        )
        assert pcf.observation_id is not None
        obs = observation_service.get_observation(company_id=cid_a, observation_id=pcf.observation_id)
        assert obs.metric_code == "pcf_kgco2e"
        assert obs.numeric_value == 42.5
        assert obs.subject_key == f"pcf:{sp.id}"

        links, total = claim_link_service.list_links(
            company_id=cid_a, claim_type="product_carbon_footprint", claim_key=str(pcf.id),
        )
        assert total == 1
        assert links[0].evidence_artifact_id == artifact.id
        assert links[0].relation_type == "supports"

    def test_manual_pcf_has_no_observation(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        sp = self._supplier_product(cid_a, "PCF-2")
        pcf = declarations_service.create_pcf(
            company_id=cid_a,
            payload=PcfCreate(supplier_product_id=sp.id, value_kgco2e=10.0, data_status="manual"),
        )
        assert pcf.observation_id is None

    def test_pcf_unknown_supplier_product_rejected(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        with pytest.raises(declarations_service.DeclarationError):
            declarations_service.create_pcf(
                company_id=cid_a,
                payload=PcfCreate(supplier_product_id=999_999_999, value_kgco2e=1.0, data_status="manual"),
            )
