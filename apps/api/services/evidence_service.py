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
import os
from datetime import datetime, timezone
from typing import Any

from services import facts_service
from services.storage import MEDIA_TYPES, evidence_key, get_storage, parse_evidence_key

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


def list_evidence(
    *, company_id: int, code: str, sign: bool = True, url_template: str | None = None,
) -> list[dict[str, Any]]:
    """Liste les pièces actives d'un datapoint.

    Si `sign`, chaque pièce reçoit `url` = route de téléchargement proxy
    authentifiée — jamais une URL de stockage directe (Vercel Blob est un
    store Private : toute lecture exige un Authorization: Bearer côté
    serveur, un navigateur ne peut pas la charger telle quelle).

    `url_template` doit contenir le littéral `{sha256}` ; par défaut pointe
    vers la route facts.py (JWT). Le point d'entrée auditor.py (accès par
    lien à token, cf. routers/auditor.py) fournit son propre template pointant
    vers sa propre route publique.
    """
    events = facts_service.get_trail(code=code, company_id=company_id, limit=1000)
    pieces = active_evidence(events)
    if sign:
        template = url_template or f"/facts/{code}/evidence/{{sha256}}/download"
        for p in pieces:
            p["url"] = template.format(sha256=p["sha256"])
    return pieces


def get_evidence_file(*, company_id: int, code: str, sha256: str) -> tuple[bytes, str]:
    """Résout et lit les octets d'une pièce active pour `company_id`/`code`/`sha256`.

    Double vérification anti-IDOR avant toute lecture de stockage :
      1. La pièce doit être active dans le trail de CETTE company (get_trail
         est déjà filtré par company_id + RLS).
      2. La storage_key elle-même doit être adressée à cette company — garde-fou
         indépendant du (1), au cas où le filtrage amont serait un jour cassé.
    Une pièce introuvable, révoquée, ou hors-périmètre lève systématiquement la
    MÊME EvidenceError (le routeur la traduit en 404) : on ne distingue jamais
    "existe mais pas à vous" de "n'existe pas", pour ne rien laisser fuiter à
    un appelant sur une autre company.

    Retourne (data, content_type). Peut lever StorageError si le backend de
    stockage échoue (objet référencé mais absent, panne réseau…).
    """
    not_found = EvidenceError(f"Pièce '{sha256}' introuvable pour '{code}'.")
    pieces = list_evidence(company_id=company_id, code=code, sign=False)
    piece = next((p for p in pieces if p.get("sha256") == sha256), None)
    if piece is None:
        raise not_found

    storage_key = piece.get("storage_key") or ""
    parsed = parse_evidence_key(storage_key)
    if parsed is None or parsed[0] != company_id:
        logger.error(
            "IDOR bloqué : storage_key=%r hors périmètre de company_id=%s (code=%s, sha256=%s)",
            storage_key, company_id, code, sha256,
        )
        raise not_found

    data = get_storage().get(storage_key)
    content_type = piece.get("content_type") or MEDIA_TYPES.get(
        os.path.splitext(piece.get("filename") or "")[1].lower(), "application/octet-stream",
    )
    return data, content_type
