"""
routers/_snapshots.py — service commun des GET /{domaine}/snapshot.

Règle (faux positifs M-01 à M-04) : en base, une organisation ne voit QUE ses
propres données importées. Les classeurs maîtres du dépôt sont un jeu de
démonstration (« Acme Industries », totaux figés) : ils ne servent de repli
qu'en développement sans base, jamais pour un tenant réel — auparavant, une
organisation sans import recevait (et persistait) ces chiffres comme les siens.
"""

from __future__ import annotations

from typing import Any, Callable

from fastapi import HTTPException

from db.database import db_available
from services.snapshot_cache import SnapshotStoreError, read_snapshot, write_snapshot

NO_SNAPSHOT_MESSAGE = (
    "Aucune donnée importée pour ce domaine. Importez votre classeur depuis la page Import."
)


def no_snapshot_error(domain: str) -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"error": "no_snapshot", "domain": domain, "message": NO_SNAPSHOT_MESSAGE},
    )


def serve_snapshot(
    domain: str,
    company_id: int,
    build_demo: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    """Dernier snapshot de l'organisation ; repli démo en développement sans base."""
    try:
        cached = read_snapshot(domain, company_id=company_id)
    except SnapshotStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if cached:
        return cached
    if db_available():
        raise no_snapshot_error(domain)
    try:
        result = build_demo()
        write_snapshot(domain, result, company_id=company_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Calcul du snapshot {domain} impossible : {exc}") from exc
    return result
