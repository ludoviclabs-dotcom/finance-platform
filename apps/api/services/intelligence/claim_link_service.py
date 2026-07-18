"""
claim_link_service.py — liens preuve ↔ claim applicatif (comble la dette PR-03).

`claim_evidence_links` (migration 028) n'avait ni service ni endpoint en PR-03
(schéma seul). PR-05A est la première PR Wave 2 qui en a besoin — pour lier une
pièce de preuve (`evidence_artifacts`) à un claim métier libre (`claim_type` /
`claim_key`), par exemple une ligne d'achat, une déclaration fournisseur ou une
PCF. Ce service est documenté dans WAVE_2_INTERFACE_CONTRACTS.md §1 et
PR05A_PROCUREMENT_FOUNDATION_TRACEABILITY.md pour réutilisation par les PR
suivantes (liens IRO PR-10, etc.).

Contrat gelé (contrats §1) :
  - `relation_type ∈ {supports, contradicts, contextualizes, derived_from}`
    (contrainte CHECK `claim_evidence_links_relation_type_check`, migration 028).
  - `claim_type` / `claim_key` sont des chaînes libres (point d'accroche métier).
  - référence stable secondaire : `(claim_type, claim_key, evidence_artifact_id)`.

Isolation en profondeur (même patron que source/observation_service) : la RLS
028 reste la garantie primaire ; en plus, chaque requête porte son prédicat de
périmètre explicite. L'artefact cité doit être lisible par le tenant (le sien
ou un global) — jamais celui d'un autre tenant.
"""

from __future__ import annotations

from typing import Any, get_args

from db.database import get_db
from models.intelligence import (
    ClaimEvidenceLinkCreate,
    ClaimEvidenceLinkResponse,
    ClaimRelationType,
)

# Lecture : propre au tenant OU pièce globale. Écriture : propre au tenant.
_READ_SCOPE = "(company_id = %s OR company_id IS NULL)"
_WRITE_SCOPE = "company_id = %s"

# Valeurs autorisées, dérivées du Literal Pydantic (source de vérité unique,
# alignée sur le CHECK SQL) — utilisées pour une validation défensive côté
# service au cas où un appelant contournerait le modèle Pydantic.
VALID_RELATION_TYPES: tuple[str, ...] = get_args(ClaimRelationType)


class ClaimLinkError(Exception):
    """Erreur métier d'un lien preuve↔claim (artefact hors périmètre, relation invalide…)."""


def _row_to_response(row: dict[str, Any]) -> ClaimEvidenceLinkResponse:
    return ClaimEvidenceLinkResponse(**row)


def validate_relation_type(relation_type: str) -> None:
    """Vérifie l'appartenance au vocabulaire gelé — même contrat que le CHECK
    SQL, levé ici en amont pour un message clair plutôt qu'une erreur
    PostgreSQL brute (utile quand le service est appelé sans passer par le
    modèle Pydantic, ex. depuis un autre service métier)."""
    if relation_type not in VALID_RELATION_TYPES:
        raise ClaimLinkError(
            f"relation_type '{relation_type}' invalide — "
            f"attendu l'un de {', '.join(VALID_RELATION_TYPES)}."
        )


def create_link(
    *, company_id: int, payload: ClaimEvidenceLinkCreate, created_by: int | None = None,
) -> ClaimEvidenceLinkResponse:
    """Crée un lien preuve↔claim. Vérifie que l'artefact cité est accessible au
    tenant (le sien ou un global) avant d'insérer — un tenant ne lie jamais un
    claim à la preuve d'un autre tenant."""
    validate_relation_type(payload.relation_type)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id FROM evidence_artifacts WHERE id = %s AND {_READ_SCOPE}",
                (payload.evidence_artifact_id, company_id),
            )
            if cur.fetchone() is None:
                raise ClaimLinkError(
                    f"Artefact '{payload.evidence_artifact_id}' introuvable ou hors périmètre."
                )
            cur.execute(
                """
                INSERT INTO claim_evidence_links
                    (company_id, claim_type, claim_key, evidence_artifact_id, relation_type, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.claim_type, payload.claim_key,
                    payload.evidence_artifact_id, payload.relation_type, created_by,
                ),
            )
            row = cur.fetchone()
    return _row_to_response(row)


def get_link(*, company_id: int, link_id: int) -> ClaimEvidenceLinkResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM claim_evidence_links WHERE id = %s AND {_READ_SCOPE}",
                (link_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise ClaimLinkError(f"Lien de preuve '{link_id}' introuvable.")
    return _row_to_response(row)


def list_links(
    *,
    company_id: int,
    claim_type: str | None = None,
    claim_key: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ClaimEvidenceLinkResponse], int]:
    clauses: list[str] = [_READ_SCOPE]
    params: list[Any] = [company_id]
    for column, value in (("claim_type", claim_type), ("claim_key", claim_key)):
        if value is not None:
            clauses.append(f"{column} = %s")
            params.append(value)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM claim_evidence_links {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM claim_evidence_links {where} "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_response(r) for r in rows], total
