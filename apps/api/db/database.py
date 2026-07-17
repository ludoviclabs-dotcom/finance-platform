"""
database.py — Connexion PostgreSQL via psycopg2 (synchrone, léger pour FastAPI).

Stratégie :
  - Si DATABASE_URL est définie → PostgreSQL (Neon ou autre)
  - Sinon → mode dégradé : les services utilisent le fallback /tmp JSON

Usage :
    from db.database import get_db, db_available

    # Sans tenant context (admin, scripts maintenance)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT ...")

    # AVEC tenant context (RLS isolation, mode standard pour les routes API) :
    with get_db(company_id=42) as conn:
        # toutes les requêtes sont automatiquement filtrées sur company_id=42
        ...
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Generator

try:
    import psycopg2
    import psycopg2.extras
    _PSYCOPG2_AVAILABLE = True
except ImportError:
    _PSYCOPG2_AVAILABLE = False

logger = logging.getLogger(__name__)

DATABASE_URL: str | None = os.environ.get("DATABASE_URL")
# Connexion dédiée aux opérations admin/migrations (rôle neondb_owner, NON
# poolée — PgBouncer en mode transaction casse les SET LOCAL / advisory locks
# de session, cf. 009_rls_force.sql). Jamais exposée à l'application FastAPI :
# seuls le runner de migrations et le workflow db-migrate.yml la consomment.
DATABASE_ADMIN_URL: str | None = os.environ.get("DATABASE_ADMIN_URL")


def db_available() -> bool:
    """Return True if PostgreSQL is configured and psycopg2 is installed."""
    return bool(DATABASE_URL and _PSYCOPG2_AVAILABLE)


def _get_connection():  # type: ignore[return]
    if not db_available():
        raise RuntimeError("PostgreSQL non configuré (DATABASE_URL manquant ou psycopg2 absent)")
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    return conn


@contextmanager
def get_db(company_id: int | None = None) -> Generator:
    """Context manager — yields a psycopg2 connection.

    Si `company_id` est fourni, la session exécute `SET LOCAL app.current_company_id = $1`
    avant de yield, ce qui active les RLS policies pour l'isolation multi-tenant.

    Commit on exit, rollback on error.
    """
    conn = _get_connection()
    try:
        if company_id is not None:
            with conn.cursor() as cur:
                # SET LOCAL : portée limitée à la transaction courante, auto-reset au commit/rollback
                cur.execute("SET LOCAL app.current_company_id = %s", (str(int(company_id)),))
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _admin_url() -> str | None:
    """URL pour les opérations admin/migrations, avec repli explicite.

    Préfère `DATABASE_ADMIN_URL` (rôle neondb_owner, non poolée). Si absente
    (poste de développeur, CI sans secret admin), retombe sur `DATABASE_URL`
    avec un avertissement — jamais une erreur bloquante. En production, le
    workflow `db-migrate.yml` fournit toujours `DATABASE_ADMIN_URL`.
    """
    if DATABASE_ADMIN_URL:
        return DATABASE_ADMIN_URL
    if DATABASE_URL:
        logger.warning(
            "DATABASE_ADMIN_URL absente — repli sur DATABASE_URL pour les opérations admin "
            "(attendu en dev/CI ; en production, provisionner DATABASE_ADMIN_URL avec le rôle neondb_owner)."
        )
        return DATABASE_URL
    return None


@contextmanager
def get_admin_db() -> Generator:
    """Comme `get_db()` mais via `DATABASE_ADMIN_URL` (non poolée, rôle migrations/DDL).

    Jamais de `company_id` — les opérations admin (bootstrap du ledger,
    baseline, apply) ne posent pas de contexte tenant (le runner ne dépend
    jamais du RLS tenant, invariant I8). Commit on exit, rollback on error,
    connexion fermée à chaque fois — contrat identique à `get_db()`.
    """
    url = _admin_url()
    if not url or not _PSYCOPG2_AVAILABLE:
        raise RuntimeError(
            "PostgreSQL non configuré (DATABASE_ADMIN_URL/DATABASE_URL manquant ou psycopg2 absent)"
        )
    conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
