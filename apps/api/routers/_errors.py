"""
routers/_errors.py — helpers HTTP partagés Wave 2 (contrats §6).

Factorise la traduction « exception métier → HTTPException » et la garde
« base indisponible → 503 », jusqu'ici recopiées dans chaque router
(`intelligence.py::_http_error`). La convention lexicale est identique et gelée
par les contrats d'interface : le message français décide du code HTTP, pas une
hiérarchie d'exceptions par code. Les nouveaux routers Wave 2 (procurement,
products) l'importent plutôt que de le recopier.

Note de cadrage (traçabilité PR-05A) : ce module est introduit par PR-05A (il
était marqué « candidat À CONFIRMER » dans WAVE_2_INTERFACE_CONTRACTS.md §6).
`routers/intelligence.py` (PR-03, déjà mergé et testé) conserve sa copie locale
identique pour ne pas déstabiliser une surface figée ; il pourra être rebranché
ici lors d'un passage ultérieur.
"""

from __future__ import annotations

from fastapi import HTTPException

from db.database import db_available


def http_error(exc: Exception) -> HTTPException:
    """Traduit une erreur métier en HTTPException par convention lexicale :
    « introuvable » → 404, « requis/requise » → 400, sinon → 409 (conflit /
    règle métier). Messages en français, non sensibles (jamais de SQL, de
    secret, ni de fuite d'existence cross-tenant)."""
    message = str(exc)
    if "introuvable" in message:
        return HTTPException(404, detail=message)
    if "requise" in message or "requis" in message:
        return HTTPException(400, detail=message)
    return HTTPException(409, detail=message)


def require_db() -> None:
    """Garde 503 quand PostgreSQL est absent (mode /tmp sans DATABASE_URL) —
    identique partout (contrats §6)."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")
