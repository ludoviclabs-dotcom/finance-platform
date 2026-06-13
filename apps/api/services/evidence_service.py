"""
evidence_service.py — T2.1 : pièces justificatives par datapoint.

Une pièce (PDF/PNG/JPG) est rattachée à un datapoint (code KPI) via un NOUVEL
event chaîné (append-only) : l'event d'origine n'est jamais muté. Le SHA-256 de
la pièce est inscrit dans `source_path` (`evidence:<sha256>`) — donc protégé par
la chaîne hash, vérifiable par verify_chain — et détaillé dans `meta.evidence`
pour l'UI. La suppression est elle aussi un event chaîné
(`evidence-revoke:<sha256>`) ; le fichier reste adressé par son hash dans le
stockage (content-addressed), jamais réécrit.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

from services import facts_service
from services.storage import evidence_key, get_storage

logger = logging.getLogger(__name__)

EVIDENCE_ATTACH = "evidence_attach"
EVIDENCE_REVOKE = "evidence_revoke"


class EvidenceError(Exception):
    """Erreur métier d'attachement/révocation de pièce (pas de fact cible, DB KO…)."""


def _latest_fact(company_id: int, code: str) -> facts_service.FactEvent | None:
    events = facts_service.get_trail(code=code, company_id=company_id, limit=1)
    return events[0] if events else None


def attach_evidence(
    *,
    company_id: int,
    code: str,
    data: bytes,
    filename: str,
    ext: str,
    content_type: str | None,
    uploaded_by: str | None,
) -> dict[str, Any]:
    """Stocke la pièce et émet un event chaîné qui la rattache au datapoint `code`."""
    sha256 = hashlib.sha256(data).hexdigest()
    target = _latest_fact(company_id, code)
    if target is None:
        raise EvidenceError(
            f"Aucun fact pour le code '{code}' — émettez un fact (ingest) avant d'attacher une pièce."
        )

    key = evidence_key(company_id, target.id, sha256, ext)
    # put() peut renvoyer une référence canonique ≠ de la clé (URL Blob publique
    # en backend vercel-blob) — c'est CETTE valeur que get()/signed_url() attendent.
    stored_ref = get_storage().put(key, data, content_type)  # lève StorageError si > 5 Mo

    piece = {
        "sha256": sha256,
        "filename": filename,
        "size": len(data),
        "content_type": content_type,
        "storage_key": stored_ref,
        "uploaded_by": uploaded_by,
        "uploaded_at": datetime.now(tz=timezone.utc).isoformat(),
    }

    event = facts_service.emit_fact(
        company_id=company_id,
        code=code,
        value=target.value,
        unit=target.unit,
        ef_id=target.ef_id,
        source_path=f"evidence:{sha256}",
        meta={"kind": EVIDENCE_ATTACH, "target_fact_id": target.id, "evidence": piece},
    )
    if event is None:
        raise EvidenceError("Émission de l'event de preuve échouée (DB indisponible ou conflit).")

    return {"event_id": event.id, "hash_self": event.hash_self, **piece}


def revoke_evidence(
    *, company_id: int, code: str, sha256: str, revoked_by: str | None
) -> dict[str, Any]:
    """Émet un event chaîné de révocation. Le fichier reste adressé par son hash."""
    target = _latest_fact(company_id, code)
    if target is None:
        raise EvidenceError(f"Aucun fact pour le code '{code}'.")

    event = facts_service.emit_fact(
        company_id=company_id,
        code=code,
        value=target.value,
        unit=target.unit,
        ef_id=target.ef_id,
        source_path=f"evidence-revoke:{sha256}",
        meta={"kind": EVIDENCE_REVOKE, "target_sha256": sha256, "revoked_by": revoked_by},
    )
    if event is None:
        raise EvidenceError("Émission de l'event de révocation échouée.")

    return {"event_id": event.id, "hash_self": event.hash_self, "sha256": sha256, "revoked": True}


def active_evidence(events: list[Any]) -> list[dict[str, Any]]:
    """Reconstruit les pièces ACTIVES à partir d'une liste d'events.

    Applique attach puis revoke dans l'ordre chronologique. Fonction pure
    (aucun accès DB/stockage) — testable directement.
    """
    ordered = sorted(events, key=lambda e: (e.computed_at, e.id))
    active: dict[str, dict[str, Any]] = {}
    for e in ordered:
        meta = e.meta or {}
        kind = meta.get("kind")
        if kind == EVIDENCE_ATTACH:
            piece = meta.get("evidence")
            if isinstance(piece, dict) and piece.get("sha256"):
                active[piece["sha256"]] = {
                    **piece,
                    "event_id": e.id,
                    "hash_self": e.hash_self,
                }
        elif kind == EVIDENCE_REVOKE:
            active.pop(meta.get("target_sha256"), None)
    return list(active.values())


def list_evidence(*, company_id: int, code: str, sign: bool = True) -> list[dict[str, Any]]:
    """Liste les pièces actives d'un datapoint, avec URL signée expirante (15 min)."""
    events = facts_service.get_trail(code=code, company_id=company_id, limit=1000)
    pieces = active_evidence(events)
    if sign and pieces:
        storage = get_storage()
        for p in pieces:
            try:
                p["url"] = storage.signed_url(p["storage_key"])
            except Exception as exc:  # pragma: no cover - best effort
                logger.warning("signed_url échouée pour %s: %s", p.get("storage_key"), exc)
                p["url"] = None
    return pieces
