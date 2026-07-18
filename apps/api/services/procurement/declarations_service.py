"""
declarations_service.py — déclarations fournisseurs & PCF SOURCÉES (PR-05A).

Toute valeur chiffrée déclarée par un fournisseur (`supplier_metric_declarations`)
ou une empreinte carbone produit (`product_carbon_footprints`) est SOURCÉE via le
noyau Evidence Kernel (contrats §3) quand une release lui est associée :
  - une `observation` immuable (observation_service) porte le fait normalisé,
    citée par `observation_id` sur la ligne — corrigeable seulement par
    supersession (trigger `frozen`, migration 028) ;
  - une preuve `evidence_artifacts` (déjà enregistrée via artifact_service) est
    liée au claim par `claim_link_service` (`claim_type` = 'supplier_declaration'
    / 'product_carbon_footprint').

Convention de nommage des observations (documentée dans la traçabilité) :
  - déclaration : subject_type='supplier_product' (ou 'supplier'),
    subject_key='supplier_product:{id}' (ou 'supplier:{id}'),
    metric_code = celui de la déclaration (pass-through).
  - PCF : subject_type='supplier_product', subject_key='pcf:{supplier_product_id}',
    metric_code='pcf_kgco2e'.

Une déclaration/PCF PUREMENT manuelle (sans release) reste valide mais non
sourcée (`data_status='manual'`, `observation_id NULL`) — honnête, pas un
faux « vérifié ». Aucune valeur inventée, aucun LLM.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.intelligence import ClaimEvidenceLinkCreate, ObservationCreate
from models.procurement import (
    DeclarationCreate,
    DeclarationResponse,
    PcfCreate,
    PcfResponse,
)
from services.intelligence import claim_link_service, observation_service

_SCOPE = "company_id = %s"

PCF_METRIC_CODE = "pcf_kgco2e"


class DeclarationError(Exception):
    """Erreur métier des déclarations / PCF (fournisseur ou produit hors périmètre…)."""


# Erreurs des sous-services de sourcing (noyau) traduites en DeclarationError :
# le routeur ne connaît que le contrat d'erreur de CE module, et les messages
# (« introuvable »/« requis ») restent mappés correctement en HTTP par
# routers/_errors.http_error. Sans cette traduction, un source_release_id hors
# périmètre remonterait en 500 au lieu de 404.
_SOURCING_ERRORS = (observation_service.ObservationError, claim_link_service.ClaimLinkError)


def _assert_supplier_in_scope(cur, company_id: int, supplier_id: int) -> None:
    cur.execute("SELECT 1 FROM suppliers WHERE id = %s AND company_id = %s", (supplier_id, company_id))
    if cur.fetchone() is None:
        raise DeclarationError(f"Fournisseur '{supplier_id}' introuvable ou hors périmètre.")


def _assert_supplier_product_in_scope(cur, company_id: int, supplier_product_id: int) -> None:
    cur.execute(
        f"SELECT 1 FROM supplier_products WHERE id = %s AND {_SCOPE}",
        (supplier_product_id, company_id),
    )
    if cur.fetchone() is None:
        raise DeclarationError(
            f"Produit fournisseur '{supplier_product_id}' introuvable ou hors périmètre."
        )


# ---------------------------------------------------------------------------
# Déclarations fournisseurs
# ---------------------------------------------------------------------------

def create_declaration(
    *, company_id: int, payload: DeclarationCreate, created_by: int | None = None,
) -> DeclarationResponse:
    # 1. Pré-validation de périmètre (avant toute création d'observation, pour
    #    ne jamais laisser une observation orpheline sur un sujet hors scope).
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_supplier_in_scope(cur, company_id, payload.supplier_id)
            if payload.supplier_product_id is not None:
                _assert_supplier_product_in_scope(cur, company_id, payload.supplier_product_id)

    # 2. Sourcing : observation immuable si une release ET une valeur sont
    #    fournies (une observation exige une source_release_id, migration 028).
    observation_id: int | None = None
    if payload.source_release_id is not None and payload.value is not None:
        if payload.supplier_product_id is not None:
            subject_type = "supplier_product"
            subject_key = f"supplier_product:{payload.supplier_product_id}"
        else:
            subject_type = "supplier"
            subject_key = f"supplier:{payload.supplier_id}"
        try:
            obs = observation_service.create_observation(
                company_id=company_id,
                payload=ObservationCreate(
                    subject_type=subject_type,
                    subject_key=subject_key,
                    metric_code=payload.metric_code,
                    numeric_value=payload.value,
                    unit=payload.unit,
                    observed_at=None,
                    source_release_id=payload.source_release_id,
                    evidence_artifact_id=payload.evidence_artifact_id,
                    data_status=payload.data_status,
                    methodology_version=payload.methodology,
                ),
            )
        except _SOURCING_ERRORS as exc:
            raise DeclarationError(str(exc)) from exc
        observation_id = obs.id

    # 3. Insertion de la déclaration (transaction propre).
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO supplier_metric_declarations
                    (company_id, supplier_id, supplier_product_id, metric_code, value, unit,
                     reporting_year, boundary, methodology, primary_data_pct, assurance_status,
                     observation_id, evidence_artifact_id, source_release_id, data_status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.supplier_id, payload.supplier_product_id, payload.metric_code,
                    payload.value, payload.unit, payload.reporting_year, payload.boundary,
                    payload.methodology, payload.primary_data_pct, payload.assurance_status,
                    observation_id, payload.evidence_artifact_id, payload.source_release_id,
                    payload.data_status, created_by,
                ),
            )
            row = cur.fetchone()

    # 4. Lien preuve↔claim (supplémentaire) si une pièce est citée.
    if payload.evidence_artifact_id is not None:
        try:
            claim_link_service.create_link(
                company_id=company_id,
                payload=ClaimEvidenceLinkCreate(
                    claim_type="supplier_declaration",
                    claim_key=str(row["id"]),
                    evidence_artifact_id=payload.evidence_artifact_id,
                    relation_type="supports",
                ),
                created_by=created_by,
            )
        except _SOURCING_ERRORS as exc:
            raise DeclarationError(str(exc)) from exc
    return DeclarationResponse(**row)


def list_declarations(
    *,
    company_id: int,
    supplier_id: int | None = None,
    supplier_product_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[DeclarationResponse], int]:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    for column, value in (("supplier_id", supplier_id), ("supplier_product_id", supplier_product_id)):
        if value is not None:
            clauses.append(f"{column} = %s")
            params.append(value)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM supplier_metric_declarations {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM supplier_metric_declarations {where} "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [DeclarationResponse(**r) for r in rows], total


def get_declaration(*, company_id: int, declaration_id: int) -> DeclarationResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM supplier_metric_declarations WHERE id = %s AND {_SCOPE}",
                (declaration_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise DeclarationError(f"Déclaration '{declaration_id}' introuvable.")
    return DeclarationResponse(**row)


# ---------------------------------------------------------------------------
# PCF (empreinte carbone produit)
# ---------------------------------------------------------------------------

def create_pcf(
    *, company_id: int, payload: PcfCreate, created_by: int | None = None,
) -> PcfResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_supplier_product_in_scope(cur, company_id, payload.supplier_product_id)

    observation_id: int | None = None
    if payload.source_release_id is not None and payload.value_kgco2e is not None:
        try:
            obs = observation_service.create_observation(
                company_id=company_id,
                payload=ObservationCreate(
                    subject_type="supplier_product",
                    subject_key=f"pcf:{payload.supplier_product_id}",
                    metric_code=PCF_METRIC_CODE,
                    numeric_value=payload.value_kgco2e,
                    unit=payload.declared_unit or "kgCO2e",
                    observed_at=None,
                    source_release_id=payload.source_release_id,
                    evidence_artifact_id=payload.evidence_artifact_id,
                    data_status=payload.data_status,
                    methodology_version=payload.methodology,
                ),
            )
        except _SOURCING_ERRORS as exc:
            raise DeclarationError(str(exc)) from exc
        observation_id = obs.id

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO product_carbon_footprints
                    (company_id, supplier_product_id, cradle_boundary, value_kgco2e, declared_unit,
                     reference_flow, reporting_period, methodology, verification_status,
                     observation_id, evidence_artifact_id, source_release_id, data_status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.supplier_product_id, payload.cradle_boundary,
                    payload.value_kgco2e, payload.declared_unit, payload.reference_flow,
                    payload.reporting_period, payload.methodology, payload.verification_status,
                    observation_id, payload.evidence_artifact_id, payload.source_release_id,
                    payload.data_status, created_by,
                ),
            )
            row = cur.fetchone()

    if payload.evidence_artifact_id is not None:
        try:
            claim_link_service.create_link(
                company_id=company_id,
                payload=ClaimEvidenceLinkCreate(
                    claim_type="product_carbon_footprint",
                    claim_key=str(row["id"]),
                    evidence_artifact_id=payload.evidence_artifact_id,
                    relation_type="supports",
                ),
                created_by=created_by,
            )
        except _SOURCING_ERRORS as exc:
            raise DeclarationError(str(exc)) from exc
    return PcfResponse(**row)


def list_pcfs(
    *, company_id: int, supplier_product_id: int | None = None, limit: int = 50, offset: int = 0,
) -> tuple[list[PcfResponse], int]:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if supplier_product_id is not None:
        clauses.append("supplier_product_id = %s")
        params.append(supplier_product_id)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM product_carbon_footprints {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM product_carbon_footprints {where} "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [PcfResponse(**r) for r in rows], total


def get_pcf(*, company_id: int, pcf_id: int) -> PcfResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM product_carbon_footprints WHERE id = %s AND {_SCOPE}",
                (pcf_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise DeclarationError(f"PCF '{pcf_id}' introuvable.")
    return PcfResponse(**row)
