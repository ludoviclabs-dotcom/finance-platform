"""
test_energy_allocation_concurrency.py — Wave 3 : preuve de concurrence RÉELLE
pour `energy_allocation_guard()` (migration 035).

CONTEXTE — le trou corrigé
---------------------------
`energy_allocation_guard()` (031) lisait le volume de l'instrument puis la
somme déjà allouée SANS verrouiller la ligne `contractual_instruments`
correspondante. Sous READ COMMITTED, deux transactions concurrentes allouant
au MÊME instrument pouvaient toutes deux lire la même somme AVANT que l'une ou
l'autre ne committe, passer toutes les deux le contrôle, et ensemble survendre
l'instrument (TOCTOU). Trou déjà documenté, non corrigé, explicitement hors
périmètre à l'époque — §6 point 4 de
docs/carbonco/refonte/ENERGY_RLS_NON_SUPERUSER_HARDENING.md :
« Pas de test de concurrence. [...] Un SELECT ... FOR UPDATE sur l'instrument
[...] serait la réponse — hors périmètre (ce serait un changement de
schéma). » La migration 035 ajoute ce verrou ; ce module en apporte la preuve.

CE QUE CE MODULE PROUVE (et ce qu'il NE prouve PAS)
-----------------------------------------------------
Deux VRAIES connexions psycopg2 (deux threads Python, chacun sa propre
connexion `get_db()`), coordonnées par `threading.Barrier`/`threading.Event`
— PAS de `sleep` fragile. La correction vient du verrou PostgreSQL
(`SELECT ... FOR UPDATE`), déterministe ; la synchronisation assure seulement
que le test exerce réellement une tentative simultanée plutôt que d'être
trivialement séquentiel — l'invariant vérifié (la somme committée ne dépasse
jamais le volume) reste vrai même si l'entrelacement réel diffère d'un run à
l'autre.

Ce module NE teste PAS la RLS (déjà couverte par
`test_energy_rls_non_superuser.py`, sous un rôle non superuser réel) — le
verrouillage de ligne (`FOR UPDATE`) est un mécanisme indépendant de la RLS,
actif pour toute session, superuser (le rôle CI) ou non. Note toutefois :
`_energy_fixtures.py` construit désormais le schéma jusqu'à 035 inclus, donc
les 21 tests de `test_energy_rls_non_superuser.py` exercent déjà, sans
modification, la fonction `energy_allocation_guard()` DE CETTE migration (avec
son `FOR UPDATE`) — ils revalident donc en creux que l'ajout du verrou ne
change rien au filtrage RLS de la fonction.
"""

from __future__ import annotations

import os
import threading
from datetime import date
from typing import Any

import pytest

from db.database import db_available, get_db
from models.energy import AllocationRequest, InstrumentCreate
from services.energy import EnergyError, instruments_service

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


# ── Fabriques minimales (mêmes colonnes que test_energy_instruments.py) ──────

def _make_meter(cid: int, code: str, carrier: str = "electricity") -> int:
    with get_db(company_id=cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO energy_meters (company_id, carrier, meter_code) VALUES (%s, %s, %s) RETURNING id",
                (cid, carrier, code),
            )
            return cur.fetchone()["id"]


def _make_activity(cid: int, meter_id: int, carrier: str, start: date, end: date, quantity: float = 10.0) -> int:
    with get_db(company_id=cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO energy_activities
                    (company_id, meter_id, site_id, carrier, quantity, unit,
                     period_start, period_end, data_status, review_status)
                VALUES (%s, %s, NULL, %s, %s, 'MWh', %s, %s, 'manual', 'accepted')
                RETURNING id
                """,
                (cid, meter_id, carrier, quantity, start, end),
            )
            return cur.fetchone()["id"]


def _make_instrument(cid: int, volume_mwh: float, carrier: str = "electricity") -> int:
    inst = instruments_service.create_instrument(
        company_id=cid,
        payload=InstrumentCreate(
            instrument_type="rec", carrier=carrier, volume_mwh=volume_mwh,
            valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
        ),
    )
    return inst.id


def _allocated_sum(cid: int, instrument_id: int) -> float:
    with get_db(company_id=cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(allocated_mwh), 0) AS s FROM instrument_allocations WHERE instrument_id = %s",
                (instrument_id,),
            )
            return float(cur.fetchone()["s"])


def _allocate_via_own_connection(
    cid: int, instrument_id: int, activity_id: int, amount: float,
    barrier: threading.Barrier, results: dict[str, Any], key: str,
) -> None:
    """Ouvre SA PROPRE connexion (thread dédié), attend la barrière juste
    avant l'INSERT (le SET LOCAL company_id, lui, a déjà eu lieu — seul
    l'INSERT doit être synchronisé pour maximiser la contention réelle), puis
    laisse `with get_db()` committer (ou rollback + relever si le trigger
    refuse). Le résultat est stocké, jamais avalé silencieusement."""
    try:
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                barrier.wait(timeout=10)
                cur.execute(
                    "INSERT INTO instrument_allocations "
                    "(company_id, instrument_id, energy_activity_id, allocated_mwh) "
                    "VALUES (%s, %s, %s, %s)",
                    (cid, instrument_id, activity_id, amount),
                )
        results[key] = ("ok", None)
    except Exception as exc:  # noqa: BLE001 — capturé pour le thread, jamais avalé (stocké + inspecté par le test)
        results[key] = ("error", str(exc))


@_skip_no_db_url
@_skip_no_psycopg2
class TestConcurrentAllocationSameInstrumentNeverOversells:
    def test_two_concurrent_allocations_never_oversell_the_instrument(self, energy_companies):
        """volume_mwh=10, deux tentatives de 6 MWh CHACUNE sur le MÊME
        instrument (12 > 10 si les deux passaient, 6 seul <= 10). Sans le
        verrou FOR UPDATE (035), les deux transactions peuvent lire la même
        somme (0) avant que l'une ou l'autre ne committe, et toutes deux
        réussir — survente. Avec le verrou, la seconde relit la somme À JOUR
        après déblocage et échoue correctement.

        L'issue PRÉCISE (laquelle des deux réussit) n'est pas déterministe et
        n'est pas ce qu'on teste ; ce qui DOIT être vrai dans TOUS les cas :
        jamais les deux ne réussissent, et la somme committée finale ne
        dépasse jamais le volume."""
        cid = energy_companies["a"]
        meter = _make_meter(cid, "WAVE3-CONC-METER-1")
        act_1 = _make_activity(cid, meter, "electricity", date(2026, 1, 1), date(2026, 1, 31))
        act_2 = _make_activity(cid, meter, "electricity", date(2026, 2, 1), date(2026, 2, 28))
        instrument = _make_instrument(cid, volume_mwh=10.0)

        barrier = threading.Barrier(2)
        results: dict[str, Any] = {}
        t1 = threading.Thread(
            target=_allocate_via_own_connection, args=(cid, instrument, act_1, 6.0, barrier, results, "t1"),
        )
        t2 = threading.Thread(
            target=_allocate_via_own_connection, args=(cid, instrument, act_2, 6.0, barrier, results, "t2"),
        )
        t1.start()
        t2.start()
        t1.join(timeout=15)
        t2.join(timeout=15)

        assert not t1.is_alive() and not t2.is_alive(), "un thread n'a pas terminé dans le délai — deadlock suspecté"
        assert "t1" in results and "t2" in results, f"résultats incomplets : {results}"

        outcomes = [results["t1"][0], results["t2"][0]]
        successes = outcomes.count("ok")

        # L'invariant qui compte réellement : la somme committée ne dépasse
        # JAMAIS le volume, quelle que soit l'issue précise de chaque thread.
        total = _allocated_sum(cid, instrument)
        assert total <= 10.0 + 1e-9, f"survente détectée : {total} MWh alloués pour un volume de 10 MWh"

        # Montants dimensionnés pour que EXACTEMENT un des deux réussisse : les
        # deux réussir violerait l'invariant ci-dessus (12 > 10) ; les deux
        # échouer signifierait un défaut du verrou lui-même (aucune raison
        # légitime de refuser une allocation de 6 MWh seule sur 10 MWh).
        assert successes == 1, f"attendu exactement 1 succès sur 2, obtenu {successes} (résultats : {results})"
        failed_key = "t1" if outcomes[0] == "error" else "t2"
        assert "energy_scope2" in results[failed_key][1]

    def test_third_allocation_after_contention_still_respects_remaining_volume(self, energy_companies):
        """Contrôle de non-régression : après la contention ci-dessus, le
        trigger reste correct sur le reliquat exact (pas "épuisé" par la
        course) — une allocation qui dépasserait ce qui reste échoue encore."""
        cid = energy_companies["a"]
        meter = _make_meter(cid, "WAVE3-CONC-METER-2")
        act_1 = _make_activity(cid, meter, "electricity", date(2026, 3, 1), date(2026, 3, 31))
        act_2 = _make_activity(cid, meter, "electricity", date(2026, 4, 1), date(2026, 4, 30))
        act_3 = _make_activity(cid, meter, "electricity", date(2026, 5, 1), date(2026, 5, 31))
        instrument = _make_instrument(cid, volume_mwh=10.0)

        barrier = threading.Barrier(2)
        results: dict[str, Any] = {}
        t1 = threading.Thread(
            target=_allocate_via_own_connection, args=(cid, instrument, act_1, 6.0, barrier, results, "t1"),
        )
        t2 = threading.Thread(
            target=_allocate_via_own_connection, args=(cid, instrument, act_2, 6.0, barrier, results, "t2"),
        )
        t1.start()
        t2.start()
        t1.join(timeout=15)
        t2.join(timeout=15)

        remaining = 10.0 - _allocated_sum(cid, instrument)
        over_amount = remaining + 1.0  # dépasse strictement ce qui reste
        with pytest.raises(Exception, match="energy_scope2"):
            with get_db(company_id=cid) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO instrument_allocations "
                        "(company_id, instrument_id, energy_activity_id, allocated_mwh) "
                        "VALUES (%s, %s, %s, %s)",
                        (cid, instrument, act_3, over_amount),
                    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestLockIsPerInstrumentNotGlobal:
    def test_allocations_on_different_instruments_do_not_block_each_other(self, energy_companies):
        """Preuve que le verrou porte sur LA LIGNE contractual_instruments
        concernée, pas une sérialisation plus large : une transaction qui
        GARDE son verrou ouvert sur l'instrument X ne doit JAMAIS retarder une
        allocation sur un instrument Y différent.

        Synchronisation par `threading.Event` (pas de sleep) : le thread
        « holder » signale (`holder_ready`) qu'il a déjà exécuté son INSERT
        (verrou acquis) et garde sa transaction OUVERTE (n'a pas encore
        committé) jusqu'à ce que le thread principal l'y autorise
        (`release_holder`) ; le thread « other » ne démarre qu'après ce signal
        et doit terminer avant un timeout COURT et strict — s'il fallait
        attendre le holder, ce timeout expirerait, ce qui ferait échouer le
        test de façon déterministe (pas un flake basé sur le timing)."""
        cid = energy_companies["a"]
        meter = _make_meter(cid, "WAVE3-XLOCK-METER")
        act_x = _make_activity(cid, meter, "electricity", date(2026, 6, 1), date(2026, 6, 30))
        act_y = _make_activity(cid, meter, "electricity", date(2026, 7, 1), date(2026, 7, 31))
        instrument_x = _make_instrument(cid, volume_mwh=100.0)
        instrument_y = _make_instrument(cid, volume_mwh=100.0)

        holder_ready = threading.Event()
        release_holder = threading.Event()
        other_done = threading.Event()
        holder_result: dict[str, str] = {}
        other_result: dict[str, str] = {}

        def _hold_instrument_x() -> None:
            try:
                with get_db(company_id=cid) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO instrument_allocations "
                            "(company_id, instrument_id, energy_activity_id, allocated_mwh) "
                            "VALUES (%s, %s, %s, %s)",
                            (cid, instrument_x, act_x, 5.0),
                        )
                    # Transaction ENCORE OUVERTE ici (le `with get_db()` n'a
                    # pas atteint son commit de sortie) : le verrou FOR UPDATE
                    # posé par le trigger sur la ligne instrument_x est
                    # toujours détenu tant que ce bloc ne se termine pas.
                    holder_ready.set()
                    release_holder.wait(timeout=15)
                holder_result["status"] = "ok"
            except Exception as exc:  # noqa: BLE001
                holder_result["status"] = f"error: {exc}"
                holder_ready.set()  # ne jamais laisser l'autre thread bloqué sur un échec du holder

        def _allocate_instrument_y() -> None:
            assert holder_ready.wait(timeout=15), "le holder n'a jamais signalé — précondition du test rompue"
            try:
                with get_db(company_id=cid) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO instrument_allocations "
                            "(company_id, instrument_id, energy_activity_id, allocated_mwh) "
                            "VALUES (%s, %s, %s, %s)",
                            (cid, instrument_y, act_y, 5.0),
                        )
                other_result["status"] = "ok"
            except Exception as exc:  # noqa: BLE001
                other_result["status"] = f"error: {exc}"
            other_done.set()

        t_holder = threading.Thread(target=_hold_instrument_x)
        t_other = threading.Thread(target=_allocate_instrument_y)
        t_holder.start()
        t_other.start()

        # instrument_y ne doit JAMAIS attendre instrument_x : timeout court et
        # strict. Si le verrou était table-large (ou posé sur un autre objet
        # partagé), ce join expirerait puisque le holder ne libère qu'après.
        finished_in_time = other_done.wait(timeout=5)
        release_holder.set()
        t_holder.join(timeout=15)
        t_other.join(timeout=15)

        assert finished_in_time, (
            "l'allocation sur un instrument DIFFÉRENT a été retardée par le verrou de l'instrument "
            "X — le verrou ne devrait bloquer que la ligne contractual_instruments concernée"
        )
        assert other_result.get("status") == "ok", other_result
        assert holder_result.get("status") == "ok", holder_result

        assert _allocated_sum(cid, instrument_x) == 5.0
        assert _allocated_sum(cid, instrument_y) == 5.0


@_skip_no_db_url
@_skip_no_psycopg2
class TestConcurrencyChangeDoesNotAffectTenantIsolation:
    def test_cross_tenant_allocation_still_rejected_by_service_layer(self, energy_companies):
        """Le verrouillage ajouté par 035 ne doit rien changer au refus
        cross-tenant déjà établi (défense en profondeur applicative — même
        chemin et même assertion que `test_cannot_allocate_across_tenants`
        dans `test_energy_instruments.py`, non modifié par cette PR) : B ne
        peut toujours pas allouer l'instrument de A.

        Note honnête sur la portée : ce test exerce le rejet côté SERVICE
        (`instruments_service.allocate_instrument`, prédicat `company_id = %s`
        explicite) — il rejette AVANT même d'atteindre le trigger, donc il ne
        prouve pas à lui seul que le NOUVEAU `FOR UPDATE` respecte la RLS
        inter-tenant en écriture directe (SQL brut, hors service). Cette
        preuve-là existe déjà et continue de s'appliquer sans modification :
        `test_energy_rls_non_superuser.py::test_cross_tenant_allocation_is_refused_by_the_guard`
        exerce le trigger sous un rôle non superuser réel, et
        `_energy_fixtures.py` construit désormais le schéma jusqu'à 035 inclus
        — ce test-là exerce donc déjà la fonction DE CETTE migration."""
        cid_a, cid_b = energy_companies["a"], energy_companies["b"]
        instrument_a = _make_instrument(cid_a, volume_mwh=50.0)
        meter_b = _make_meter(cid_b, "WAVE3-XTEN-METER")
        act_b = _make_activity(cid_b, meter_b, "electricity", date(2026, 8, 1), date(2026, 8, 31))

        with pytest.raises(EnergyError, match="introuvable"):
            instruments_service.allocate_instrument(
                company_id=cid_b, instrument_id=instrument_a,
                payload=AllocationRequest(energy_activity_id=act_b, allocated_mwh=5.0), allocated_by=None,
            )
