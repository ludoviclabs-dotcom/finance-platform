"""
release_service.py — cycle de vie d'une release de source (PR-03).

Pipeline : detect -> validate -> publish -> (supersede par une release
suivante). `evidence_kernel_guard('source_release')` (migration 028) gèle
toute ligne au statut 'published'/'superseded' au niveau base — ce module
ne fait qu'orchestrer des transitions déjà légales pour le trigger ; toute
tentative de transition illégale lève une erreur PostgreSQL explicite avant
même d'atteindre ce module si le contrôle Python ci-dessous était contourné.
"""

from __future__ import annotations

import json
from typing import Any

from db.database import get_db
from models.intelligence import ReleaseCreate, ReleaseResponse
from services.intelligence import license_policy

# Isolation en profondeur (cf. docstring de source_service) : prédicat de
# lecture (propre au tenant OU global) et d'écriture (propre au tenant
# uniquement), répliqué dans chaque requête en plus de la RLS primaire.
_READ_SCOPE = "(company_id = %s OR company_id IS NULL)"
_WRITE_SCOPE = "company_id = %s"


class ReleaseError(Exception):
    """Erreur métier du cycle de vie d'une release (introuvable, transition invalide…)."""


def _row_to_response(row: dict[str, Any]) -> ReleaseResponse:
    return ReleaseResponse(**row)


def detect_release(
    *, company_id: int, source_id: int, payload: ReleaseCreate, created_by: int | None,
) -> ReleaseResponse:
    """Idempotent sur (source_id, release_key, checksum_sha256) : rappeler
    avec les mêmes octets renvoie la ligne déjà détectée, jamais une erreur
    ni un doublon (§8.4 PR02_ARCHITECTURE_PLAN.md)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id FROM source_registry WHERE id = %s AND {_READ_SCOPE}",
                (source_id, company_id),
            )
            if cur.fetchone() is None:
                raise ReleaseError(f"Source '{source_id}' introuvable.")

            cur.execute(
                """
                INSERT INTO source_releases
                    (source_id, company_id, release_key, published_at, valid_from, valid_to,
                     checksum_sha256, blob_key, mime_type, schema_version, status, supersedes_id,
                     metadata, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'detected', %s, %s, %s)
                ON CONFLICT (source_id, release_key, checksum_sha256) DO NOTHING
                RETURNING *
                """,
                (
                    source_id, company_id, payload.release_key, payload.published_at,
                    payload.valid_from, payload.valid_to, payload.checksum_sha256,
                    payload.blob_key, payload.mime_type, payload.schema_version,
                    payload.supersedes_id, json.dumps(payload.metadata), created_by,
                ),
            )
            row = cur.fetchone()
            if row is None:
                # Re-lecture idempotente, scopée au tenant : la même
                # (source, clé, checksum) rappelée par CE tenant renvoie sa
                # ligne ; jamais celle d'un autre tenant (l'index d'unicité est
                # global, mais une release appartient toujours à son détecteur).
                cur.execute(
                    "SELECT * FROM source_releases "
                    f"WHERE source_id = %s AND release_key = %s AND checksum_sha256 = %s AND {_WRITE_SCOPE}",
                    (source_id, payload.release_key, payload.checksum_sha256, company_id),
                )
                row = cur.fetchone()
    if row is None:
        raise ReleaseError("Détection de release incohérente (conflit détecté puis lecture vide).")
    return _row_to_response(row)


def get_release(*, company_id: int, release_id: int) -> ReleaseResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM source_releases WHERE id = %s AND {_READ_SCOPE}",
                (release_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise ReleaseError(f"Release '{release_id}' introuvable.")
    return _row_to_response(row)


def list_releases_for_source(
    *, company_id: int, source_id: int, limit: int = 50, offset: int = 0,
) -> tuple[list[ReleaseResponse], int]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM source_releases WHERE source_id = %s AND {_READ_SCOPE}",
                (source_id, company_id),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM source_releases WHERE source_id = %s AND {_READ_SCOPE} "
                "ORDER BY retrieved_at DESC LIMIT %s OFFSET %s",
                (source_id, company_id, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_response(r) for r in rows], total


def validate_release(*, company_id: int, release_id: int, passed: bool) -> ReleaseResponse:
    """`detected`/`quarantined` -> `validated` (passed) ou `quarantined` (échec)."""
    target_status = "validated" if passed else "quarantined"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            # Mutation d'une transition : scopée au tenant propriétaire.
            cur.execute(
                f"SELECT * FROM source_releases WHERE id = %s AND {_WRITE_SCOPE}",
                (release_id, company_id),
            )
            release = cur.fetchone()
            if release is None:
                raise ReleaseError(f"Release '{release_id}' introuvable.")
            if release["status"] not in ("detected", "quarantined"):
                raise ReleaseError(
                    f"Release '{release_id}' au statut '{release['status']}' — "
                    "validation impossible depuis cet état."
                )
            cur.execute(
                "UPDATE source_releases SET status = %s WHERE id = %s RETURNING *",
                (target_status, release_id),
            )
            row = cur.fetchone()
    return _row_to_response(row)


def publish_release(*, company_id: int, release_id: int) -> ReleaseResponse:
    """`validated` -> `published` (license OK) ou `blocked_license` (license KO).

    La licence bloquante n'est jamais une exception — c'est un statut normal
    du cycle de vie (blocked_license figure dans l'énumération de la
    migration 028), avec les raisons du blocage tracées dans `metadata`.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM source_releases WHERE id = %s AND {_WRITE_SCOPE}",
                (release_id, company_id),
            )
            release = cur.fetchone()
            if release is None:
                raise ReleaseError(f"Release '{release_id}' introuvable.")
            if release["status"] != "validated":
                raise ReleaseError(
                    f"Release '{release_id}' au statut '{release['status']}' — "
                    "seule une release 'validated' peut être publiée."
                )

            cur.execute(
                f"SELECT * FROM source_registry WHERE id = %s AND {_READ_SCOPE}",
                (release["source_id"], company_id),
            )
            source = cur.fetchone()
            decision = license_policy.evaluate(source)

            if not (decision.allow_ingest and decision.allow_store):
                cur.execute(
                    """
                    UPDATE source_releases
                    SET status = 'blocked_license', metadata = metadata || %s::jsonb
                    WHERE id = %s
                    RETURNING *
                    """,
                    (json.dumps({"license_block_reasons": decision.reasons}), release_id),
                )
            else:
                cur.execute(
                    "UPDATE source_releases SET status = 'published', published_at = now() "
                    "WHERE id = %s RETURNING *",
                    (release_id,),
                )
            row = cur.fetchone()
    return _row_to_response(row)


def supersede_release(*, company_id: int, new_release_id: int) -> ReleaseResponse:
    """Une fois `new_release_id` publiée, marque `superseded` la release
    qu'elle remplace (son `supersedes_id`, fixé une fois pour toutes à la
    création — jamais modifié après coup, cf. ReleaseCreate.supersedes_id).

    Idempotent : si la release remplacée est déjà `superseded`, renvoie son
    état actuel sans erreur (rejouer un supersede déjà effectif est un no-op,
    pas un échec).
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM source_releases WHERE id = %s AND {_WRITE_SCOPE}",
                (new_release_id, company_id),
            )
            new_release = cur.fetchone()
            if new_release is None:
                raise ReleaseError(f"Release '{new_release_id}' introuvable.")
            if new_release["status"] != "published":
                raise ReleaseError(
                    f"Release '{new_release_id}' au statut '{new_release['status']}' — "
                    "doit être 'published' avant de superséder."
                )
            old_id = new_release["supersedes_id"]
            if old_id is None:
                raise ReleaseError(f"Release '{new_release_id}' n'a pas de supersedes_id — rien à superséder.")

            cur.execute(
                f"SELECT * FROM source_releases WHERE id = %s AND {_WRITE_SCOPE}",
                (old_id, company_id),
            )
            old_release = cur.fetchone()
            if old_release is None:
                raise ReleaseError(f"Release supersédée '{old_id}' introuvable.")
            if old_release["status"] == "superseded":
                return _row_to_response(old_release)
            if old_release["status"] != "published":
                raise ReleaseError(
                    f"Release '{old_id}' au statut '{old_release['status']}' — "
                    "seule une release 'published' peut être supersédée."
                )

            cur.execute(
                "UPDATE source_releases SET status = 'superseded' WHERE id = %s RETURNING *",
                (old_id,),
            )
            row = cur.fetchone()
    return _row_to_response(row)
