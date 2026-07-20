"""
test_energy_rls_non_superuser.py — RLS énergie EN CONDITIONS NON SUPERUSER
(DB-gated). Ferme un trou de couverture documenté dans 031_energy_scope2.sql.

LE TROU
-------
`FORCE ROW LEVEL SECURITY` soumet le PROPRIÉTAIRE de la table à ses propres
policies ; seuls un superuser ou un rôle `BYPASSRLS` y échappent. Or le
PostgreSQL du job `migration-tests` se connecte en `postgres`, SUPERUSER : la
RLS y est intégralement contournée. Tous les tests énergie existants
(test_energy_instruments.py, test_energy_meters.py, test_energy_import.py)
passent donc SANS jamais exercer une seule policy — ils prouvent la logique
applicative (`company_id = %s` explicite dans les requêtes du service), pas la
barrière base. En production (Neon, rôle propriétaire non superuser), c'est
FORCE qui porte l'isolation.

CE QUE CE MODULE PROUVE
-----------------------
On crée un rôle jetable `carbonco_rls_probe` (NOSUPERUSER, NOBYPASSRLS), on lui
TRANSFÈRE la propriété des 5 tables énergie ET de la fonction trigger
`energy_allocation_guard()`, puis on rejoue le parcours via `SET LOCAL ROLE`.
Cette forme est exactement celle de la production : un propriétaire non
superuser. Deux conséquences que le job actuel ne voit jamais :

  1. le rôle POSSÈDE les tables et reste malgré tout filtré → c'est bien FORCE
     qui agit (sans FORCE, un propriétaire verrait tout) ;
  2. `energy_allocation_guard()` est SECURITY DEFINER : sous CI son
     propriétaire est le superuser, donc le trigger voit TOUS les tenants ;
     une fois la fonction possédée par un rôle non superuser, le trigger
     redevient soumis à la RLS et ne compte plus que les lignes visibles du
     tenant courant. C'est le comportement de production, et il n'était pas
     testé.

Le module inclut un test « témoin » qui constate la fuite superuser : il
échouerait si le trou était refermé autrement (rôle CI non superuser), ce qui
est le signal voulu — la couverture ne doit jamais redevenir muette.

TEARDOWN
--------
Tout est rendu à l'état initial : `RESET ROLE`, restitution des propriétaires
d'origine (capturés au catalogue avant transfert), `DROP OWNED BY` puis
`DROP ROLE`. La restitution est vérifiée AVANT le `DROP OWNED BY` — sans quoi
un `DROP OWNED` supprimerait les tables encore possédées par le rôle. Le module
est rejouable tel quel sur le même conteneur jetable.
"""

from __future__ import annotations

import os
import re
from contextlib import contextmanager
from datetime import date

import pytest

from db.database import db_available, get_db

# ── Constantes ──────────────────────────────────────────────────────────────

#: Rôle jetable. Jamais `carbonco_app` : ce nom déclenche le bloc de GRANT
#: conditionnel en fin de 031_energy_scope2.sql (effet de bord non voulu ici).
PROBE_ROLE = "carbonco_rls_probe"

#: Tables énergie protégées par la RLS gen-2 de la migration 031.
ENERGY_TABLES = (
    "energy_meters",
    "energy_activities",
    "contractual_instruments",
    "instrument_allocations",
    "energy_factor_metadata",
)

#: Séquences BIGSERIAL associées (le transfert de propriété d'une table emporte
#: ses séquences possédées ; le GRANT explicite est une ceinture de sécurité).
ENERGY_SEQUENCES = tuple(f"{t}_id_seq" for t in ENERGY_TABLES)

GUARD_FUNCTION = "energy_allocation_guard"

_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _ident(name: str) -> str:
    """Quote un identifiant SQL après validation stricte.

    Les noms proviennent soit de constantes du module, soit du catalogue
    (`pg_get_userbyid`) — jamais d'une entrée utilisateur. La validation reste
    explicite : une interpolation d'identifiant ne doit jamais être implicite.
    """
    if not _IDENT_RE.match(name):
        raise ValueError(f"Identifiant SQL refusé : {name!r}")
    return f'"{name}"'


# ── Skips ───────────────────────────────────────────────────────────────────

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"),
        reason="DATABASE_URL absent — tests PostgreSQL skippés",
    ),
    pytest.mark.skipif(
        not db_available(), reason="psycopg2/PostgreSQL non disponible"
    ),
]


# ── Session sous rôle non superuser ─────────────────────────────────────────


@contextmanager
def _role_session(company_id: int | None):
    """Transaction tenant exécutée SOUS `PROBE_ROLE`.

    `get_db(company_id=...)` pose `SET LOCAL app.current_company_id` (le geste
    de production, database.py:73) ; on bascule ensuite en `SET LOCAL ROLE`.
    L'ordre est indifférent — un GUC `app.*` est un placeholder USERSET, il
    survit au changement de rôle et reste lisible depuis la fonction trigger.

    `SET LOCAL` borne le rôle à la transaction : même si le `RESET ROLE`
    explicite échoue (transaction avortée par un RAISE du trigger), le rollback
    de `get_db()` l'annule et la connexion est refermée juste après.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SET LOCAL ROLE {_ident(PROBE_ROLE)}")
        try:
            yield conn
        finally:
            try:
                with conn.cursor() as cur:
                    cur.execute("RESET ROLE")
            except Exception:
                # Transaction avortée : aucune commande hors ROLLBACK n'y
                # passe. Le SET LOCAL est de toute façon annulé au rollback.
                pass


def _scalar(conn, sql: str, params: tuple = ()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
    return None if row is None else next(iter(row.values()))


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def probe_role(energy_companies):
    """Crée le rôle non superuser, lui transfère les objets énergie, restitue tout.

    Dépend de `energy_companies` (donc de `energy_schema`) pour deux raisons :
    le schéma 031 doit exister avant tout transfert de propriété, et l'ordre de
    tear-down des fixtures module est l'inverse du setup — la restitution des
    propriétaires se fait donc AVANT le nettoyage superuser des lignes.
    """
    with get_db() as conn:
        is_super = _scalar(
            conn, "SELECT rolsuper FROM pg_roles WHERE rolname = current_user"
        )
        if not is_super:
            pytest.skip(
                "Connexion non superuser — impossible de créer un rôle et de "
                "transférer la propriété des tables ; ce module simule le "
                "non-superuser DEPUIS une session superuser."
            )

        # Propriétaires d'origine, capturés avant toute modification.
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = ANY(%s)
                """,
                (list(ENERGY_TABLES),),
            )
            table_owners = {r["relname"]: r["owner"] for r in cur.fetchall()}
            cur.execute(
                """
                SELECT pg_get_userbyid(p.proowner) AS owner
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = %s
                """,
                (GUARD_FUNCTION,),
            )
            row = cur.fetchone()
            function_owner = row["owner"] if row else None

    missing = [t for t in ENERGY_TABLES if t not in table_owners]
    assert not missing, f"Tables énergie absentes (migration 031 non appliquée) : {missing}"
    assert function_owner is not None, (
        f"Fonction {GUARD_FUNCTION}() absente — migration 031 non appliquée"
    )

    role = _ident(PROBE_ROLE)
    # Création + transfert en UNE transaction : en cas d'échec partiel, le
    # rollback de get_db() laisse la base intacte (pas de propriété orpheline).
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_roles WHERE rolname = '{PROBE_ROLE}'
                  ) THEN
                    CREATE ROLE {PROBE_ROLE} NOLOGIN;
                  END IF;
                END
                $$;
                """
            )
            # Rejouabilité : un rôle laissé par un run précédent est reramené
            # aux attributs attendus (le test n'a de sens que non superuser).
            cur.execute(
                f"ALTER ROLE {role} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE"
            )
            # CREATE sur le schéma : exigé de tout nouveau propriétaire d'objet
            # (ALTER ... OWNER TO échoue sinon). USAGE pour la résolution.
            cur.execute(f"GRANT USAGE, CREATE ON SCHEMA public TO {role}")
            cur.execute(f"GRANT SELECT ON companies, sites TO {role}")
            tables = ", ".join(_ident(t) for t in ENERGY_TABLES)
            cur.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON {tables} TO {role}"
            )
            seqs = ", ".join(_ident(s) for s in ENERGY_SEQUENCES)
            cur.execute(f"GRANT USAGE, SELECT ON SEQUENCE {seqs} TO {role}")
            # Le transfert de propriété est le cœur du dispositif : c'est lui
            # qui rend FORCE ROW LEVEL SECURITY réellement porteur.
            for table in ENERGY_TABLES:
                cur.execute(f"ALTER TABLE {_ident(table)} OWNER TO {role}")
            # SECURITY DEFINER : le trigger s'exécute avec les droits du
            # PROPRIÉTAIRE de la fonction. Tant qu'il s'agit du superuser CI,
            # le trigger voit tous les tenants.
            cur.execute(
                f"ALTER FUNCTION public.{_ident(GUARD_FUNCTION)}() OWNER TO {role}"
            )

    yield PROBE_ROLE

    # ── Tear-down ───────────────────────────────────────────────────────────
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("RESET ROLE")
            for table, owner in table_owners.items():
                cur.execute(
                    f"ALTER TABLE {_ident(table)} OWNER TO {_ident(owner)}"
                )
            cur.execute(
                f"ALTER FUNCTION public.{_ident(GUARD_FUNCTION)}() "
                f"OWNER TO {_ident(function_owner)}"
            )

    # `DROP OWNED BY` supprime les OBJETS possédés autant qu'il révoque les
    # privilèges : on ne l'exécute qu'après avoir VÉRIFIÉ que le rôle ne
    # possède plus rien. Une restitution muette qui aurait échoué détruirait
    # sinon les tables énergie. Échec bruyant, jamais destructif.
    with get_db() as conn:
        still_owned = _scalar(
            conn,
            """
            SELECT COUNT(*) FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = %s)
            """,
            (PROBE_ROLE,),
        )
    assert still_owned == 0, (
        f"Restitution de propriété incomplète : {still_owned} relation(s) "
        f"encore possédée(s) par {PROBE_ROLE} — DROP OWNED BY non exécuté "
        "(il détruirait ces tables). Rôle laissé en place pour inspection."
    )
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"DROP OWNED BY {role}")
            cur.execute(f"DROP ROLE IF EXISTS {role}")


@pytest.fixture(scope="module")
def seeded(probe_role, energy_companies):
    """Jeu de données des DEUX tenants, sur les 5 tables énergie.

    Par tenant : un compteur, une activité, un instrument (100 MWh), une
    allocation (10 MWh) et une métadonnée de facteur. Les 5 tables portent donc
    des lignes des deux tenants — sans quoi le test d'isolation paramétré
    passerait à vide sur les tables restées vides.

    Tout est inséré SOUS LE RÔLE, donc à travers les policies INSERT — la
    fixture est elle-même une preuve que le rôle peut écrire dans son périmètre.
    """
    cid_a, cid_b = energy_companies["a"], energy_companies["b"]
    out: dict[str, int] = {"a": cid_a, "b": cid_b}
    for key, cid in (("a", cid_a), ("b", cid_b)):
        with _role_session(cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO energy_meters (company_id, carrier, meter_code)
                    VALUES (%s, 'electricity', %s)
                    ON CONFLICT (company_id, meter_code)
                    DO UPDATE SET updated_at = now()
                    RETURNING id
                    """,
                    (cid, f"RLSNS-{key.upper()}"),
                )
                meter_id = cur.fetchone()["id"]
                cur.execute(
                    """
                    INSERT INTO energy_activities
                        (company_id, meter_id, carrier, quantity,
                         period_start, period_end, data_status, review_status)
                    VALUES (%s, %s, 'electricity', 500, %s, %s, 'manual', 'accepted')
                    ON CONFLICT (company_id, meter_id, period_start, period_end)
                    DO UPDATE SET updated_at = now()
                    RETURNING id
                    """,
                    (cid, meter_id, date(2026, 1, 1), date(2026, 1, 31)),
                )
                activity_id = cur.fetchone()["id"]
                cur.execute(
                    """
                    INSERT INTO contractual_instruments
                        (company_id, instrument_type, carrier, reference,
                         volume_mwh, valid_from, valid_to)
                    VALUES (%s, 'go', 'electricity', %s, 100, %s, %s)
                    RETURNING id
                    """,
                    (cid, f"RLSNS-{key.upper()}", date(2026, 1, 1), date(2026, 12, 31)),
                )
                instrument_id = cur.fetchone()["id"]
                cur.execute(
                    """
                    INSERT INTO instrument_allocations
                        (company_id, instrument_id, energy_activity_id, allocated_mwh)
                    VALUES (%s, %s, %s, 10)
                    RETURNING id
                    """,
                    (cid, instrument_id, activity_id),
                )
                allocation_id = cur.fetchone()["id"]
                cur.execute(
                    """
                    INSERT INTO energy_factor_metadata
                        (company_id, carrier, geography_code, basis)
                    VALUES (%s, 'electricity', 'FR', 'market')
                    RETURNING id
                    """,
                    (cid,),
                )
                factor_id = cur.fetchone()["id"]
        out[f"meter_{key}"] = meter_id
        out[f"activity_{key}"] = activity_id
        out[f"instrument_{key}"] = instrument_id
        out[f"allocation_{key}"] = allocation_id
        out[f"factor_{key}"] = factor_id
    return out


# ── Helpers de scénario ─────────────────────────────────────────────────────


def _new_instrument(cid: int, reference: str, volume: float = 100.0) -> int:
    """Instrument frais (isole les tests d'allocation les uns des autres)."""
    with _role_session(cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO contractual_instruments
                    (company_id, instrument_type, carrier, reference,
                     volume_mwh, valid_from, valid_to)
                VALUES (%s, 'rec', 'electricity', %s, %s, %s, %s)
                RETURNING id
                """,
                (cid, reference, volume, date(2026, 1, 1), date(2026, 12, 31)),
            )
            return cur.fetchone()["id"]


def _new_activity(cid: int, meter_id: int, start: date, end: date) -> int:
    with _role_session(cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO energy_activities
                    (company_id, meter_id, carrier, quantity,
                     period_start, period_end, data_status, review_status)
                VALUES (%s, %s, 'electricity', 200, %s, %s, 'manual', 'accepted')
                RETURNING id
                """,
                (cid, meter_id, start, end),
            )
            return cur.fetchone()["id"]


def _allocate(cid: int, instrument_id: int, activity_id: int, mwh: float) -> int:
    """INSERT direct d'allocation SOUS LE RÔLE (le trigger est le sujet du test)."""
    with _role_session(cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO instrument_allocations
                    (company_id, instrument_id, energy_activity_id, allocated_mwh)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (cid, instrument_id, activity_id, mwh),
            )
            return cur.fetchone()["id"]


# ── 1. Le rôle est bien soumis à la RLS ─────────────────────────────────────


class TestProbeRoleIsSubjectToRls:
    def test_role_is_neither_superuser_nor_bypassrls(self, probe_role):
        """Sans cela, tout le module serait un faux positif silencieux."""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = %s",
                    (PROBE_ROLE,),
                )
                row = cur.fetchone()
        assert row is not None, f"Rôle {PROBE_ROLE} absent"
        assert row["rolsuper"] is False, "Un superuser contournerait toute la RLS"
        assert row["rolbypassrls"] is False, "BYPASSRLS contournerait toute la RLS"

    def test_session_actually_runs_as_the_probe_role(self, probe_role, seeded):
        with _role_session(seeded["a"]) as conn:
            assert _scalar(conn, "SELECT current_user") == PROBE_ROLE
            assert _scalar(conn, "SHOW row_security") == "on"
            assert _scalar(
                conn, "SELECT current_setting('app.current_company_id', true)"
            ) == str(seeded["a"])

    def test_energy_tables_are_enable_and_force_rls(self, probe_role):
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT relname, relrowsecurity, relforcerowsecurity
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = ANY(%s)
                    """,
                    (list(ENERGY_TABLES),),
                )
                rows = {r["relname"]: r for r in cur.fetchall()}
        for table in ENERGY_TABLES:
            assert rows[table]["relrowsecurity"], f"RLS non activée sur {table}"
            assert rows[table]["relforcerowsecurity"], f"FORCE absent sur {table}"

    def test_probe_role_owns_the_tables_so_force_is_load_bearing(self, probe_role):
        """C'est CE fait qui rend le module probant.

        Un non-propriétaire est de toute façon soumis à ENABLE RLS : le test
        n'exercerait alors pas FORCE. En possédant les tables, le rôle ne peut
        être filtré QUE par FORCE ROW LEVEL SECURITY — configuration identique
        à la production (propriétaire non superuser).
        """
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = ANY(%s)
                    """,
                    (list(ENERGY_TABLES),),
                )
                owners = {r["relname"]: r["owner"] for r in cur.fetchall()}
        for table in ENERGY_TABLES:
            assert owners[table] == PROBE_ROLE, (
                f"{table} n'appartient pas à {PROBE_ROLE} : FORCE ne serait pas exercé"
            )

    def test_guard_function_is_owned_by_the_probe_role(self, probe_role):
        """SECURITY DEFINER = les droits du propriétaire de la fonction.

        Propriétaire superuser (cas CI par défaut) → le trigger ignore la RLS.
        Propriétaire non superuser (cas production) → le trigger y est soumis.
        """
        with get_db() as conn:
            owner = _scalar(
                conn,
                """
                SELECT pg_get_userbyid(p.proowner)
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = %s
                """,
                (GUARD_FUNCTION,),
            )
        assert owner == PROBE_ROLE


# ── 2. Le trou de couverture, constaté ──────────────────────────────────────


class TestSuperuserBypassIsTheCoverageHole:
    def test_superuser_session_sees_both_tenants(self, probe_role, seeded):
        """Témoin : la connexion CI (superuser) ignore la RLS.

        Sans `SET ROLE`, avec pourtant `app.current_company_id = A`, la session
        voit l'instrument du tenant B. C'est précisément pourquoi les tests
        énergie historiques ne prouvent rien sur la RLS.
        """
        with get_db(company_id=seeded["a"]) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT company_id FROM contractual_instruments WHERE id = %s",
                    (seeded["instrument_b"],),
                )
                row = cur.fetchone()
        assert row is not None, (
            "Attendu : le superuser CI contourne la RLS et voit l'instrument "
            "du tenant B. Si ce test échoue, la connexion n'est plus superuser "
            "— le trou est refermé en amont et ce module doit être relu."
        )
        assert row["company_id"] == seeded["b"]


# ── 3. Isolation tenant sous le rôle ────────────────────────────────────────


class TestTenantIsolationUnderProbeRole:
    @pytest.mark.parametrize("table", ENERGY_TABLES)
    def test_tenant_a_never_sees_tenant_b_rows(self, probe_role, seeded, table):
        """Aucune ligne d'un autre tenant, sur aucune des 5 tables."""
        with _role_session(seeded["a"]) as conn:
            with conn.cursor() as cur:
                # Identifiant issu d'une constante du module, validé par _ident.
                cur.execute(f"SELECT DISTINCT company_id FROM {_ident(table)}")
                seen = {r["company_id"] for r in cur.fetchall()}
        assert seeded["b"] not in seen, f"FUITE RLS sur {table} : tenant A voit B"
        assert seen <= {seeded["a"]}, f"FUITE RLS sur {table} : {seen}"

    def test_tenant_b_instrument_invisible_by_id(self, probe_role, seeded):
        with _role_session(seeded["a"]) as conn:
            found = _scalar(
                conn,
                "SELECT id FROM contractual_instruments WHERE id = %s",
                (seeded["instrument_b"],),
            )
        assert found is None, "FUITE RLS : l'instrument de B est lisible par A"

    def test_tenant_a_sees_its_own_rows(self, probe_role, seeded):
        """Contrôle négatif : la policy filtre, elle ne bloque pas tout."""
        with _role_session(seeded["a"]) as conn:
            found = _scalar(
                conn,
                "SELECT id FROM contractual_instruments WHERE id = %s",
                (seeded["instrument_a"],),
            )
        assert found == seeded["instrument_a"]

    def test_insert_for_another_tenant_is_refused(self, probe_role, seeded):
        """WITH CHECK : écrire au nom de B depuis le contexte A est refusé."""
        with pytest.raises(Exception, match="row-level security"):
            with _role_session(seeded["a"]) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO contractual_instruments
                            (company_id, instrument_type, carrier, reference,
                             volume_mwh, valid_from, valid_to)
                        VALUES (%s, 'go', 'electricity', 'RLSNS-INJECTION',
                                10, %s, %s)
                        """,
                        (seeded["b"], date(2026, 1, 1), date(2026, 12, 31)),
                    )

    def test_update_cannot_reach_another_tenant_row(self, probe_role, seeded):
        """La policy UPDATE filtre en USING : la ligne de B est hors de portée."""
        with _role_session(seeded["a"]) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE contractual_instruments SET status = 'cancelled' "
                    "WHERE id = %s",
                    (seeded["instrument_b"],),
                )
                assert cur.rowcount == 0, "FUITE RLS : A a modifié une ligne de B"
        with get_db(company_id=seeded["b"]) as conn:
            status = _scalar(
                conn,
                "SELECT status FROM contractual_instruments WHERE id = %s",
                (seeded["instrument_b"],),
            )
        assert status == "active"

    def test_without_tenant_context_no_row_is_visible(self, probe_role, seeded):
        """Défaut fermé : sans `app.current_company_id`, la policy ne matche rien."""
        with _role_session(None) as conn:
            count = _scalar(
                conn, "SELECT COUNT(*) FROM contractual_instruments"
            )
        assert count == 0, (
            f"Sans contexte tenant, aucune ligne ne doit être visible (vu : {count})"
        )


# ── 4. Le trigger sous RLS ──────────────────────────────────────────────────


class TestAllocationGuardUnderProbeRole:
    def test_legitimate_allocation_is_accepted(self, probe_role, seeded):
        """Le filet base ne doit pas bloquer un usage normal sous le rôle."""
        instrument = _new_instrument(seeded["a"], "RLSNS-OK")
        activity = _new_activity(
            seeded["a"], seeded["meter_a"], date(2026, 2, 1), date(2026, 2, 28)
        )
        allocation_id = _allocate(seeded["a"], instrument, activity, 40.0)
        assert allocation_id is not None

        with _role_session(seeded["a"]) as conn:
            total = _scalar(
                conn,
                "SELECT COALESCE(SUM(allocated_mwh), 0) FROM instrument_allocations "
                "WHERE instrument_id = %s",
                (instrument,),
            )
        assert float(total) == 40.0

    def test_over_allocation_is_refused(self, probe_role, seeded):
        """Survente : 70 + 40 > 100 → refus du trigger, sous le rôle."""
        instrument = _new_instrument(seeded["a"], "RLSNS-OVER")
        a1 = _new_activity(
            seeded["a"], seeded["meter_a"], date(2026, 3, 1), date(2026, 3, 31)
        )
        a2 = _new_activity(
            seeded["a"], seeded["meter_a"], date(2026, 4, 1), date(2026, 4, 30)
        )
        _allocate(seeded["a"], instrument, a1, 70.0)
        with pytest.raises(Exception, match="energy_scope2"):
            _allocate(seeded["a"], instrument, a2, 40.0)

    def test_allocation_exactly_at_volume_is_accepted(self, probe_role, seeded):
        """Borne haute : l'égalité stricte au volume reste légitime."""
        instrument = _new_instrument(seeded["a"], "RLSNS-EXACT")
        a1 = _new_activity(
            seeded["a"], seeded["meter_a"], date(2026, 5, 1), date(2026, 5, 31)
        )
        a2 = _new_activity(
            seeded["a"], seeded["meter_a"], date(2026, 6, 1), date(2026, 6, 30)
        )
        _allocate(seeded["a"], instrument, a1, 60.0)
        assert _allocate(seeded["a"], instrument, a2, 40.0) is not None

    def test_guard_only_counts_rows_visible_to_the_tenant(self, probe_role, seeded):
        """LE test que le job superuser ne peut pas faire.

        On plante, via l'échappatoire admin `app.rls_bypass` (documentée en
        031), une allocation du tenant B adossée à un instrument du tenant A —
        état qu'aucun tenant ne peut produire lui-même. Puis A alloue 60 MWh sur
        un instrument de 100 :

          - trigger soumis à la RLS (production, et ce module) → il ne voit que
            les lignes de A, somme = 0, 0 + 60 ≤ 100 → ACCEPTÉ ;
          - trigger contournant la RLS (SECURITY DEFINER possédé par un
            superuser, cas CI historique) → somme = 60, 60 + 60 > 100 → REFUSÉ.

        L'acceptation est donc la preuve que le trigger ne compte QUE le
        périmètre visible du tenant courant.
        """
        instrument = _new_instrument(seeded["a"], "RLSNS-SCOPE")
        activity_a = _new_activity(
            seeded["a"], seeded["meter_a"], date(2026, 7, 1), date(2026, 7, 31)
        )

        # `app.rls_bypass` est ici INDISPENSABLE : la fonction trigger, désormais
        # possédée par un rôle non superuser, est soumise à la RLS et ne verrait
        # pas l'instrument de A depuis le contexte de B.
        with get_db(company_id=seeded["b"]) as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                cur.execute(
                    """
                    INSERT INTO instrument_allocations
                        (company_id, instrument_id, energy_activity_id, allocated_mwh)
                    VALUES (%s, %s, %s, 60)
                    """,
                    (seeded["b"], instrument, seeded["activity_b"]),
                )

        # Sous le rôle, tenant A : la ligne de B est invisible → allocation OK.
        assert _allocate(seeded["a"], instrument, activity_a, 60.0) is not None

        with _role_session(seeded["a"]) as conn:
            visible = _scalar(
                conn,
                "SELECT COALESCE(SUM(allocated_mwh), 0) FROM instrument_allocations "
                "WHERE instrument_id = %s",
                (instrument,),
            )
        assert float(visible) == 60.0, (
            "Le tenant A ne doit voir que ses propres 60 MWh (l'allocation de B "
            f"sur le même instrument doit rester invisible) — vu : {visible}"
        )

    def test_cross_tenant_allocation_is_refused_by_the_guard(self, probe_role, seeded):
        """Le trigger refuse d'adosser une allocation à un instrument invisible.

        B tente d'allouer l'instrument de A. La contrainte de clé étrangère ne
        protège pas (les vérifications RI s'exécutent hors RLS) : c'est le
        trigger, soumis à la RLS, qui ne trouve pas l'instrument et lève.
        Sous le superuser CI cette écriture inter-tenant PASSERAIT.
        """
        with pytest.raises(Exception, match="introuvable"):
            _allocate(
                seeded["b"], seeded["instrument_a"], seeded["activity_b"], 5.0
            )
