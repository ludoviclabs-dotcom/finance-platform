"""
test_migration_probes.py — sondes objet-par-objet (PR-02B), DB-gated.

CI-compatible : skip si `DATABASE_URL` absent ou psycopg2 indisponible, comme
`test_rls_isolation.py`. Jamais contre Neon — conteneur `postgres:16` jetable
(CI, voir `.github/workflows/api.yml::migration-tests`) ou une instance locale
explicitement pointée par `DATABASE_URL`.

Non exécuté localement pendant cette implémentation (pas de `docker`
disponible dans ce shell, voir PR02B_IMPLEMENTATION_PLAN.md §9/§10) — à
surveiller sur le premier run CI.
"""

from __future__ import annotations

import os

import pytest

from db import migration_probes
from db.database import db_available, get_db

from ._migration_fixtures import (
    apply_ddl_inline,
    apply_upto,
    build_full_db,
    reset_public_schema,
)

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]

ALL_VERSIONS = sorted(
    migration_probes.MIGRATION_OBJECT_PROBES.keys(), key=lambda v: (int(v[:3]), v[3:])
)


@pytest.fixture()
def empty_conn():
    with get_db() as conn:
        reset_public_schema(conn)
        yield conn


@pytest.fixture()
def full_conn():
    with get_db() as conn:
        reset_public_schema(conn)
        build_full_db(conn)
        yield conn


@pytest.mark.parametrize("version", ALL_VERSIONS)
def test_probe_false_when_nothing_applied(empty_conn, version):
    with empty_conn.cursor() as cur:
        assert migration_probes.verify_object(cur, version) is False, (
            f"{version}: sonde positive alors que rien n'a été appliqué"
        )


@pytest.mark.parametrize("version", ALL_VERSIONS)
def test_probe_true_when_fully_applied(full_conn, version):
    with full_conn.cursor() as cur:
        assert migration_probes.verify_object(cur, version) is True, (
            f"{version}: sonde négative alors que la migration a réellement tourné"
        )


def test_unknown_version_is_false(empty_conn):
    with empty_conn.cursor() as cur:
        assert migration_probes.verify_object(cur, "999") is False


def test_probe_004_and_009_distinguish_via_force_rls(full_conn):
    """Le point exact qui a résolu D-3 : seul `relforcerowsecurity` distingue 004 de 009.

    Dans `full_conn`, 004 puis 009 ont tourné dans l'ordre réel — les policies
    de 009 (mêmes noms, DROP+CREATE) ont supersédé celles de 004, et FORCE est
    posé. `_probe_004` exige explicitement l'ABSENCE de FORCE : elle doit donc
    être fausse ici, pas parce que les policies sont absentes (elles sont
    présentes, sous les noms de 009), mais parce que 009 a bien tourné après.
    """
    with full_conn.cursor() as cur:
        assert migration_probes.verify_object(cur, "009") is True
        assert migration_probes.verify_object(cur, "004") is False


def test_probe_004_true_when_004_alone_without_009(empty_conn):
    """004 seule (sans 009) : policies présentes, FORCE absent — 004 doit être vraie."""
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "004")
    with empty_conn.cursor() as cur:
        assert migration_probes.verify_object(cur, "004") is True
        assert migration_probes.verify_object(cur, "009") is False


def test_probe_021_not_fooled_by_shared_policy_name_with_004_009(empty_conn):
    """Piège documenté (migration_probes.py, docstring) : `tenant_isolation_alert_rules`
    existe déjà via 004/009 avant même que 021 ne tourne — la sonde 021 doit
    tout de même rester fausse tant que SES artefacts propres sont absents.
    """
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "009")  # 004+009 tournées, 021 PAS encore
    with empty_conn.cursor() as cur:
        assert migration_probes._policy_exists(cur, "alert_rules", "tenant_isolation_alert_rules"), (
            "précondition du test : la policy partagée doit déjà exister via 004/009"
        )
        assert migration_probes.verify_object(cur, "021") is False, (
            "021 ne doit PAS être détectée seulement parce que 004/009 a créé "
            "tenant_isolation_alert_rules — ses propres artefacts (alert_notifications, "
            "alert_rules.mode, policies _ins/_upd) sont absents ici"
        )

    apply_upto(empty_conn, "021")
    with empty_conn.cursor() as cur:
        assert migration_probes.verify_object(cur, "021") is True, (
            "021 doit devenir vraie une fois ses propres artefacts appliqués"
        )


def test_probe_027_false_when_sites_exists_but_site_id_column_missing(empty_conn):
    """027 partielle : `sites` créée mais `actions.site_id` absente (ALTER TABLE

    échoué faute de privilège, cas réel documenté §8) — doit rester fausse,
    jamais `baseline` sur un état partiel.
    """
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "020")  # `actions` existe (créée par 020), sans `site_id`
    with empty_conn.cursor() as cur:
        cur.execute(
            "CREATE TABLE IF NOT EXISTS sites (id BIGSERIAL PRIMARY KEY, company_id INTEGER NOT NULL, "
            "name TEXT NOT NULL)"
        )
        cur.execute("ALTER TABLE sites ENABLE ROW LEVEL SECURITY")
        cur.execute("ALTER TABLE sites FORCE ROW LEVEL SECURITY")
        cur.execute(
            "CREATE POLICY tenant_isolation_sites ON sites USING (company_id = current_setting"
            "('app.current_company_id', true)::int)"
        )
        assert migration_probes.verify_object(cur, "027") is False, (
            "sites existe et est correctement configurée, mais actions.site_id est absente "
            "— 027 doit rester détectée comme incomplète"
        )
