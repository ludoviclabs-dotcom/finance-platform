"""
iro_service.py — `iros` (PR-10, migration 040) : CRUD, création de candidat,
progression de statut, vue complète.

**Candidat, jamais une décision.** `create_iro` force TOUJOURS
`status='candidate'`, que l'appel vienne d'un humain (`POST /iro/iros`,
`require_analyst`) ou d'un point d'appel additif depuis un autre domaine
(eau/nature/CRMA) : un signal externe ne peut jamais dépasser ce statut par
lui-même (`WAVE_4_INTERFACE_CONTRACTS.md` §10).

**Progression de statut = fait de calcul, pas décision.** `advance_status`
avance `candidate -> under_assessment -> assessed`, appelé par
`impact_assessment_service`/`financial_assessment_service` quand leur
précondition devient vraie (« au moins une évaluation calculée » — plan §9).
`decided` est posé par `materiality_decision_service` après une décision
HUMAINE. Ce n'est jamais un déclenchement automatique de décision : seul le
statut de workflow avance seul, `materiality_decisions.is_material` reste
strictement humain. `archived` n'a pas d'endpoint dédié dans cette PR (valeur
de schéma valide, non exposée — hors périmètre §10).

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.iro import (
    IroCreate,
    IroDetailResponse,
    IroEvidenceLinkRef,
    IroListResponse,
    IroResponse,
)

_SCOPE = "company_id = %s"

# Ordre de progression — `advance_status` n'avance JAMAIS en arrière.
STATUS_ORDER: tuple[str, ...] = ("candidate", "under_assessment", "assessed", "decided", "archived")


class IroError(Exception):
    """Erreur métier du registre IRO."""


def _iro_row(row: dict[str, Any]) -> IroResponse:
    return IroResponse(**{k: row[k] for k in IroResponse.model_fields})


def assert_iro_in_scope(cur, company_id: int, iro_id: int) -> dict[str, Any]:
    """Vérifie que l'IRO existe et appartient au tenant — renvoie la ligne
    complète (évite un second aller-retour aux appelants qui ont besoin du
    statut courant, ex. les services d'évaluation)."""
    cur.execute(f"SELECT * FROM iros WHERE id = %s AND {_SCOPE}", (iro_id, company_id))
    row = cur.fetchone()
    if row is None:
        raise IroError(f"IRO '{iro_id}' introuvable ou hors périmètre.")
    return dict(row)


def create_iro(
    *, company_id: int, payload: IroCreate, created_by: int | None = None,
) -> IroResponse:
    """Crée un IRO — TOUJOURS en `status='candidate'`, qu'il s'agisse d'une
    création manuelle ou d'un point d'appel interne depuis un autre domaine."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO iros
                    (company_id, title, description, iro_type, topic_code,
                     origin_domain, origin_reference, status, value_chain_location, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'candidate', %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.title, payload.description, payload.iro_type,
                    payload.topic_code, payload.origin_domain, payload.origin_reference,
                    payload.value_chain_location, created_by,
                ),
            )
            return _iro_row(dict(cur.fetchone()))


def get_iro(*, company_id: int, iro_id: int) -> IroResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            row = assert_iro_in_scope(cur, company_id, iro_id)
    return _iro_row(row)


def list_iros(
    *,
    company_id: int,
    status: str | None = None,
    iro_type: str | None = None,
    origin_domain: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> IroListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    for column, value in (("status", status), ("iro_type", iro_type), ("origin_domain", origin_domain)):
        if value is not None:
            clauses.append(f"{column} = %s")
            params.append(value)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM iros WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM iros WHERE {where} ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            items = [_iro_row(dict(r)) for r in cur.fetchall()]
    return IroListResponse(items=items, total=total, limit=limit, offset=offset)


def advance_status(*, company_id: int, iro_id: int, target: str) -> None:
    """Avance `iros.status` vers `target` — jamais en arrière (idempotent :
    appeler avec un statut déjà dépassé ne fait rien). Utilisé par
    `impact_assessment_service`/`financial_assessment_service`
    (`under_assessment`/`assessed`) et `materiality_decision_service`
    (`decided`) ; jamais appelé directement par un endpoint."""
    if target not in STATUS_ORDER:
        raise IroError(f"Statut IRO '{target}' inconnu.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            row = assert_iro_in_scope(cur, company_id, iro_id)
            current_rank = STATUS_ORDER.index(row["status"])
            target_rank = STATUS_ORDER.index(target)
            if target_rank <= current_rank:
                return
            cur.execute(
                f"UPDATE iros SET status = %s, updated_at = now() WHERE id = %s AND {_SCOPE}",
                (target, iro_id, company_id),
            )


def get_iro_detail(*, company_id: int, iro_id: int) -> IroDetailResponse:
    """Vue complète : IRO + évaluations + décisions + actions + disclosure
    mappings + preuves complémentaires (`claim_link_service.list_links`,
    réutilisé tel quel — PAS de seconde table `iro_evidence_links`).

    Modèle simple, PAS une `AnalyticalEnvelope` : cette vue agrège des
    sous-ressources déjà persistées, ce n'est pas un calcul dérivé présenté
    (motif `article24_service.build_report`, qui agrège lui aussi PLUSIEURS
    appels de service séparés — `exposure_service.list_exposures`,
    `reference_service.list_substitutes`, `list_recycling_routes`,
    `list_events`, `list_actions` — plutôt qu'une méga-requête SQL unique).
    Imports LOCAUX (pas en tête de module) : les services sœurs importent
    eux-mêmes `iro_service` (pour `assert_iro_in_scope`/`advance_status`),
    un import en tête de module créerait un cycle au chargement."""
    from services.intelligence import claim_link_service

    from . import (
        disclosure_mapping_service,
        financial_assessment_service,
        iro_actions_service,
        materiality_decision_service,
    )
    from . import impact_assessment_service as _impact_svc

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_row = assert_iro_in_scope(cur, company_id, iro_id)

    impact_assessments = _impact_svc.list_impact_assessments(
        company_id=company_id, iro_id=iro_id, limit=200,
    ).items
    financial_assessments = financial_assessment_service.list_financial_assessments(
        company_id=company_id, iro_id=iro_id, limit=200,
    ).items
    decisions = materiality_decision_service.list_decisions(
        company_id=company_id, iro_id=iro_id, limit=200,
    ).items
    actions = iro_actions_service.list_actions(
        company_id=company_id, iro_id=iro_id, limit=200,
    ).items
    disclosure_mappings = disclosure_mapping_service.list_mappings(
        company_id=company_id, iro_id=iro_id, limit=200,
    ).items

    links, _total = claim_link_service.list_links(
        company_id=company_id, claim_type="iro", claim_key=f"iro:{iro_id}", limit=200,
    )
    evidence_links = [
        IroEvidenceLinkRef(
            id=link.id, claim_type=link.claim_type, claim_key=link.claim_key,
            evidence_artifact_id=link.evidence_artifact_id, relation_type=link.relation_type,
            created_at=link.created_at,
        )
        for link in links
    ]

    return IroDetailResponse(
        iro=_iro_row(iro_row),
        impact_assessments=impact_assessments,
        financial_assessments=financial_assessments,
        decisions=decisions,
        actions=actions,
        disclosure_mappings=disclosure_mappings,
        evidence_links=evidence_links,
    )
