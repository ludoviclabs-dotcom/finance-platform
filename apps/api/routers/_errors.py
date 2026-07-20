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

from contextlib import contextmanager
from typing import Iterator

from fastapi import HTTPException

from db.database import db_available

# Détail contractuel (PR-08) consommé par le front : « initialisation du
# schéma en cours ». Ne pas reformuler côté serveur.
SCHEMA_NOT_READY_DETAIL = "schema_not_ready"

# SQLSTATE PostgreSQL d'un schéma pas encore migré : 42P01 undefined_table,
# 42703 undefined_column (psycopg2 expose `pgcode` sur chaque erreur). Comparés
# par code pour ne pas dépendre des classes psycopg2 (import optionnel dans
# db.database).
_SCHEMA_NOT_READY_PGCODES = frozenset({"42P01", "42703"})


def _is_schema_not_ready(exc: BaseException) -> bool:
    return getattr(exc, "pgcode", None) in _SCHEMA_NOT_READY_PGCODES


@contextmanager
def schema_ready_guard() -> Iterator[None]:
    """Garde « schéma pas encore migré » → 503 `schema_not_ready` (PR-08).

    Contexte : la production déploie le code AVANT l'application des
    migrations (036 exige une étape manuelle Neon). Sans cette garde, chaque
    NOUVELLE route renverrait une erreur SQL brute (UndefinedTable/
    UndefinedColumn) pendant la fenêtre entre déploiement et migration. Avec
    elle : 503 propre, détail contractuel `schema_not_ready`, que le front
    traduit en « initialisation du schéma en cours ». Les routes EXISTANTES ne
    l'utilisent pas (leur schéma est déjà en production) — la garde est
    réservée aux routes dont les tables arrivent avec 036/037.

    Toute autre exception repart inchangée — jamais un 503 fourre-tout qui
    masquerait un vrai bug.
    """
    try:
        yield
    except HTTPException:
        raise
    except Exception as exc:
        if _is_schema_not_ready(exc):
            raise HTTPException(503, detail=SCHEMA_NOT_READY_DETAIL) from exc
        raise


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
