"""
test_scope2_runs.py — moteur de calcul Scope 2 dual (PR-06B), DB-gated.

Ce que seuls de VRAIS PostgreSQL peuvent prouver :
  * la migration 033 s'applique après 031 et ses objets existent ;
  * l'ISOLATION tenant (RLS FORCE + défense en profondeur applicative) sur les
    runs et les lignes de trace ;
  * l'IMMUTABILITÉ du snapshot d'entrée et des lignes (triggers) ;
  * la reproductibilité BOUT EN BOUT (deux runs sur les mêmes données → même
    empreinte, mêmes totaux) ;
  * l'approbation (refus d'un run incomplet, émission des DEUX facts) ;
  * l'Evidence Pack construit depuis la base.

Inscrit dans le job CI `migration-tests` (le seul avec un vrai `postgres:16`) —
sans cela ce fichier skipperait silencieusement et ne prouverait rien.
"""

from __future__ import annotations

import os
from datetime import date

import pytest

from db.database import db_available, get_db
from services.calculations import CalculationError, scope2, scope2_runs
from services.export_package import assemble_scope2_pack, inspect_zip

from ._scope2_fixtures import (
    add_activity,
    add_allocation,
    add_factor_metadata,
    add_instrument,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")

TODAY = date(2026, 7, 20)
P_START = date(2025, 1, 1)
P_END = date(2025, 12, 31)


def _clear_runs(company_id: int) -> None:
    """Repart d'un état sans run pour ce tenant (les lignes tombent en CASCADE)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM scope2_line_results WHERE company_id = %s", (company_id,))
            cur.execute("DELETE FROM scope2_calculation_runs WHERE company_id = %s", (company_id,))


def _clear_energy(company_id: int) -> None:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM instrument_allocations WHERE company_id = %s", (company_id,))
            cur.execute("DELETE FROM energy_activities WHERE company_id = %s", (company_id,))
            cur.execute("DELETE FROM contractual_instruments WHERE company_id = %s", (company_id,))
            cur.execute("DELETE FROM energy_factor_metadata WHERE company_id = %s", (company_id,))


def _seed_nominal(env, tenant: str = "a") -> dict:
    """1000 MWh consommés, 400 MWh couverts par une GO certifiée, facteurs
    location + mix résiduel disponibles pour la zone FR."""
    cid = env[tenant]
    _clear_runs(cid)
    _clear_energy(cid)
    add_factor_metadata(
        company_id=cid, ef_id=env["ef"]["S2TEST-GRID-FR"], basis="location", geography_code="FR",
    )
    add_factor_metadata(
        company_id=cid, ef_id=env["ef"]["S2TEST-RESIDUAL-FR"], basis="residual_mix",
        geography_code="FR",
    )
    activity_id = add_activity(
        company_id=cid, meter_id=env[f"meter_{tenant}"], site_id=env[f"site_{tenant}"],
        quantity=1000.0, period_start=P_START, period_end=P_END,
    )
    instrument_id = add_instrument(
        company_id=cid, volume_mwh=1000.0, valid_from=date(2024, 1, 1),
        valid_to=date(2027, 12, 31),
    )
    add_allocation(
        company_id=cid, instrument_id=instrument_id, activity_id=activity_id,
        allocated_mwh=400.0,
    )
    return {"company_id": cid, "activity_id": activity_id, "instrument_id": instrument_id}


def _calculate(company_id: int, **kwargs) -> dict:
    params = dict(
        company_id=company_id, period_start=P_START, period_end=P_END,
        geography_code="FR", today=TODAY, calculated_by=1,
    )
    params.update(kwargs)
    return scope2_runs.calculate_and_store(**params)


@_skip_no_db_url
@_skip_no_psycopg2
class TestMigration033:
    def test_objets_presents_apres_migration(self, scope2_env):
        from db.migration_probes import verify_object

        with get_db() as conn:
            with conn.cursor() as cur:
                assert verify_object(cur, "031") is True
                assert verify_object(cur, "033") is True


@_skip_no_db_url
@_skip_no_psycopg2
class TestCalculateAndStore:
    def test_run_nominal_persiste_les_deux_totaux(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])

        assert run["status"] == "draft"
        result = run["result"]
        # 1000 MWh × 50 kg/MWh = 50 tCO2e ; 600 MWh non couverts × 90 = 54 tCO2e.
        assert result["location_based_tco2e"] == pytest.approx(50.0)
        assert result["market_based_tco2e"] == pytest.approx(54.0)
        assert result["contractual_coverage_mwh"] == pytest.approx(400.0)
        assert result["is_complete"] is True

    def test_trace_persistee_avec_niveau_et_raison(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])
        trace = scope2_runs.get_trace(company_id=seed["company_id"], run_id=run["id"])

        assert len(trace) == 3  # LB total + MB covered + MB uncovered
        for line in trace:
            assert line["selection_level"], "aucun facteur choisi silencieusement"
            assert line["selection_reason"]
        bases = {(line["basis"], line["segment"]) for line in trace}
        assert bases == {("location", "total"), ("market", "covered"), ("market", "uncovered")}

    def test_ligne_market_ne_porte_jamais_une_base_location(self, scope2_env):
        """Interdit méthodologique posé EN BASE (CHECK
        `scope2_lines_market_purity_check`) autant que dans le moteur."""
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])
        trace = scope2_runs.get_trace(company_id=seed["company_id"], run_id=run["id"])
        for line in trace:
            if line["basis"] == "market":
                assert line["factor_basis"] != "location"

    def test_contrainte_base_refuse_une_ligne_market_location(self, scope2_env):
        """Barrière SQL directe : même en contournant le moteur, la base refuse
        une ligne market-based portant un facteur de réseau."""
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])
        cid = seed["company_id"]
        with pytest.raises(Exception) as exc:
            with get_db(company_id=cid) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO scope2_line_results
                            (company_id, run_id, basis, segment, carrier, period_start,
                             period_end, activity_value, activity_unit, activity_mwh,
                             factor_basis, selection_level, selection_reason,
                             result_tco2e, data_quality)
                        VALUES (%s, %s, 'market', 'uncovered', 'electricity', %s, %s,
                                1, 'MWh', 1, 'location', 'bidouille',
                                'moyenne nationale maquillée', 1, 'verified')
                        """,
                        (cid, run["id"], P_START, P_END),
                    )
        assert "scope2_lines_market_purity_check" in str(exc.value)

    def test_run_sans_activite_erreur_explicite(self, scope2_env):
        cid = scope2_env["b"]
        _clear_runs(cid)
        _clear_energy(cid)
        with pytest.raises(CalculationError) as exc:
            _calculate(cid)
        assert "Aucune activité énergie" in str(exc.value)

    def test_facteur_manquant_run_incomplet(self, scope2_env):
        cid = scope2_env["a"]
        _clear_runs(cid)
        _clear_energy(cid)
        add_activity(
            company_id=cid, meter_id=scope2_env["meter_a"], site_id=scope2_env["site_a"],
            quantity=100.0, period_start=P_START, period_end=P_END,
        )
        run = _calculate(cid)  # aucun energy_factor_metadata
        assert run["result"]["is_complete"] is False
        assert run["result"]["missing_factors"]
        assert run["result"]["location_based_tco2e"] == 0.0

    def test_licence_sans_usage_derive_ecarte_le_facteur(self, scope2_env):
        """Un facteur sourcé par une release dont la licence interdit l'usage
        dérivé est ÉCARTÉ du calcul, avec un warning explicite (contrats §8)."""
        cid = scope2_env["a"]
        _clear_runs(cid)
        _clear_energy(cid)
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO source_registry
                        (company_id, code, publisher, title, source_type,
                         derived_use_allowed, display_allowed, active)
                    VALUES (%s, 'S2TEST-RESTRICTED', 'Test', 'Source restreinte',
                            'manual', FALSE, TRUE, TRUE)
                    RETURNING id
                    """,
                    (cid,),
                )
                source_id = cur.fetchone()["id"]
                cur.execute(
                    """
                    INSERT INTO source_releases
                        (source_id, company_id, release_key, checksum_sha256, status)
                    VALUES (%s, %s, '2025', 'deadbeef', 'published')
                    RETURNING id
                    """,
                    (source_id, cid),
                )
                release_id = cur.fetchone()["id"]

        add_factor_metadata(
            company_id=cid, ef_id=scope2_env["ef"]["S2TEST-GRID-FR"], basis="location",
            geography_code="FR", source_release_id=release_id,
        )
        add_activity(
            company_id=cid, meter_id=scope2_env["meter_a"], site_id=scope2_env["site_a"],
            quantity=100.0, period_start=P_START, period_end=P_END,
        )
        run = _calculate(cid)
        assert any("licence" in w.lower() for w in run["warnings"])
        assert run["result"]["is_complete"] is False  # écarté ⇒ hiérarchie épuisée

        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM source_releases WHERE id = %s", (release_id,))
                cur.execute("DELETE FROM source_registry WHERE id = %s", (source_id,))

    def test_hierarchie_sous_nationale_prime_bout_en_bout(self, scope2_env):
        cid = scope2_env["a"]
        _clear_runs(cid)
        _clear_energy(cid)
        add_factor_metadata(
            company_id=cid, ef_id=scope2_env["ef"]["S2TEST-GRID-FR"], basis="location",
            geography_code="FR",
        )
        add_factor_metadata(
            company_id=cid, ef_id=scope2_env["ef"]["S2TEST-GRID-FR-IDF"], basis="location",
            geography_code="FR-IDF",
        )
        add_factor_metadata(
            company_id=cid, ef_id=scope2_env["ef"]["S2TEST-RESIDUAL-FR"], basis="residual_mix",
            geography_code="FR",
        )
        add_activity(
            company_id=cid, meter_id=scope2_env["meter_a"], site_id=scope2_env["site_a"],
            quantity=1000.0, period_start=P_START, period_end=P_END,
        )
        run = _calculate(cid, geography_code="FR-IDF")
        trace = scope2_runs.get_trace(company_id=cid, run_id=run["id"])
        lb = [line for line in trace if line["basis"] == "location"][0]
        assert lb["selection_level"] == "subnational_grid"
        # 1000 MWh × 30 kg/MWh = 30 tCO2e (et non 50 du facteur national).
        assert run["result"]["location_based_tco2e"] == pytest.approx(30.0)

    def test_facteur_fournisseur_prime_sur_mix_residuel(self, scope2_env):
        cid = scope2_env["a"]
        _clear_runs(cid)
        _clear_energy(cid)
        add_factor_metadata(
            company_id=cid, ef_id=scope2_env["ef"]["S2TEST-GRID-FR"], basis="location",
            geography_code="FR",
        )
        add_factor_metadata(
            company_id=cid, ef_id=scope2_env["ef"]["S2TEST-RESIDUAL-FR"], basis="residual_mix",
            geography_code="FR",
        )
        add_factor_metadata(
            company_id=cid, ef_id=scope2_env["ef"]["S2TEST-SUPPLIER-FR"], basis="market",
            geography_code="FR",
        )
        add_activity(
            company_id=cid, meter_id=scope2_env["meter_a"], site_id=scope2_env["site_a"],
            quantity=1000.0, period_start=P_START, period_end=P_END,
        )
        run = _calculate(cid)
        trace = scope2_runs.get_trace(company_id=cid, run_id=run["id"])
        mb = [line for line in trace if line["basis"] == "market"][0]
        assert mb["factor_basis"] == "market"
        assert run["result"]["market_based_tco2e"] == pytest.approx(20.0)
        assert run["result"]["residual_mix_used"] is False


@_skip_no_db_url
@_skip_no_psycopg2
class TestReproducibility:
    def test_deux_runs_memes_donnees_meme_empreinte_et_totaux(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        first = _calculate(seed["company_id"])
        second = _calculate(seed["company_id"])

        assert first["id"] != second["id"]
        assert first["input_fingerprint"] == second["input_fingerprint"]
        assert first["result"]["location_based_tco2e"] == second["result"]["location_based_tco2e"]
        assert first["result"]["market_based_tco2e"] == second["result"]["market_based_tco2e"]
        assert first["result"]["trace"] == second["result"]["trace"]

    def test_empreinte_change_si_la_consommation_change(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        before = _calculate(seed["company_id"])
        with get_db(company_id=seed["company_id"]) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE energy_activities SET quantity = 1200 WHERE id = %s AND company_id = %s",
                    (seed["activity_id"], seed["company_id"]),
                )
        after = _calculate(seed["company_id"])
        assert after["input_fingerprint"] != before["input_fingerprint"]


@_skip_no_db_url
@_skip_no_psycopg2
class TestImmutability:
    def test_snapshot_et_resultat_non_modifiables(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])
        with pytest.raises(Exception) as exc:
            with get_db(company_id=seed["company_id"]) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE scope2_calculation_runs SET result = '{}'::jsonb "
                        "WHERE id = %s AND company_id = %s",
                        (run["id"], seed["company_id"]),
                    )
        assert "immuable" in str(exc.value)

    def test_ligne_de_trace_non_modifiable(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])
        with pytest.raises(Exception) as exc:
            with get_db(company_id=seed["company_id"]) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE scope2_line_results SET result_tco2e = 0 "
                        "WHERE run_id = %s AND company_id = %s",
                        (run["id"], seed["company_id"]),
                    )
        assert "immuable" in str(exc.value)

    def test_changement_de_statut_reste_possible(self, scope2_env):
        """L'immutabilité porte sur les CHIFFRES, pas sur le cycle de vie."""
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])
        approved = scope2_runs.approve_run(
            company_id=seed["company_id"], run_id=run["id"], approved_by=1,
        )
        assert approved["status"] == "approved"
        assert approved["result"] == run["result"]


@_skip_no_db_url
@_skip_no_psycopg2
class TestApproval:
    def test_approbation_emet_les_deux_facts(self, scope2_env):
        from services.carbon.scope2_selection import CODE_SCOPE2_LB, CODE_SCOPE2_MB

        seed = _seed_nominal(scope2_env)
        cid = seed["company_id"]
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM facts_events WHERE company_id = %s", (cid,))
        run = _calculate(cid)
        scope2_runs.approve_run(company_id=cid, run_id=run["id"], approved_by=1)

        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT code, value FROM facts_events WHERE company_id = %s "
                    "AND source_path = %s ORDER BY code",
                    (cid, f"scope2_run:{run['id']}"),
                )
                rows = cur.fetchall()
        codes = [r["code"] for r in rows]
        # Le Scope 2 reste DUAL jusque dans la chaîne de preuve : jamais un seul fact.
        assert codes == sorted([CODE_SCOPE2_LB, CODE_SCOPE2_MB])

    def test_run_incomplet_non_approuvable(self, scope2_env):
        cid = scope2_env["a"]
        _clear_runs(cid)
        _clear_energy(cid)
        add_activity(
            company_id=cid, meter_id=scope2_env["meter_a"], site_id=scope2_env["site_a"],
            quantity=100.0, period_start=P_START, period_end=P_END,
        )
        run = _calculate(cid)
        with pytest.raises(CalculationError) as exc:
            scope2_runs.approve_run(company_id=cid, run_id=run["id"], approved_by=1)
        assert "INCOMPLET" in str(exc.value)

    def test_double_approbation_refusee(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        run = _calculate(seed["company_id"])
        scope2_runs.approve_run(company_id=seed["company_id"], run_id=run["id"], approved_by=1)
        with pytest.raises(CalculationError) as exc:
            scope2_runs.approve_run(company_id=seed["company_id"], run_id=run["id"], approved_by=1)
        assert "déjà approuvé" in str(exc.value)


@_skip_no_db_url
@_skip_no_psycopg2
class TestTenantIsolation:
    def test_run_d_un_autre_tenant_introuvable(self, scope2_env):
        """404 (introuvable), jamais 403 : aucune fuite d'existence. Prouvé par
        la DÉFENSE EN PROFONDEUR applicative (`company_id = %s` explicite) — en
        CI le rôle PostgreSQL est superuser et bypasse la RLS, donc sans ce
        doublon ce test ne pourrait pas passer."""
        seed = _seed_nominal(scope2_env, tenant="a")
        run = _calculate(seed["company_id"])
        with pytest.raises(CalculationError) as exc:
            scope2_runs.get_run(company_id=scope2_env["b"], run_id=run["id"])
        assert "introuvable" in str(exc.value)

    def test_trace_d_un_autre_tenant_introuvable(self, scope2_env):
        seed = _seed_nominal(scope2_env, tenant="a")
        run = _calculate(seed["company_id"])
        with pytest.raises(CalculationError):
            scope2_runs.get_trace(company_id=scope2_env["b"], run_id=run["id"])

    def test_liste_scopee_au_tenant(self, scope2_env):
        seed = _seed_nominal(scope2_env, tenant="a")
        _calculate(seed["company_id"])
        _clear_runs(scope2_env["b"])
        items_b, total_b = scope2_runs.list_runs(company_id=scope2_env["b"])
        assert total_b == 0
        assert items_b == []
        _, total_a = scope2_runs.list_runs(company_id=scope2_env["a"])
        assert total_a >= 1

    def test_approbation_cross_tenant_refusee(self, scope2_env):
        seed = _seed_nominal(scope2_env, tenant="a")
        run = _calculate(seed["company_id"])
        with pytest.raises(CalculationError) as exc:
            scope2_runs.approve_run(company_id=scope2_env["b"], run_id=run["id"], approved_by=1)
        assert "introuvable" in str(exc.value)


@_skip_no_db_url
@_skip_no_psycopg2
class TestEvidencePackFromDb:
    def test_pack_construit_depuis_la_base(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        cid = seed["company_id"]
        run = _calculate(cid)
        trace = scope2_runs.get_trace(company_id=cid, run_id=run["id"])
        pack = assemble_scope2_pack(
            company_id=cid, company_name="S2 TEST A", run=run, trace=trace
        )
        inspection = inspect_zip(pack.zip_bytes)
        assert inspection["valid"] is True
        assert inspection["self_consistent"] is True
        assert pack.manifest["stats"]["line_count"] == len(trace)
        assert pack.manifest["input_fingerprint"] == run["input_fingerprint"]

    def test_pack_reproductible_depuis_la_base(self, scope2_env):
        seed = _seed_nominal(scope2_env)
        cid = seed["company_id"]
        run = _calculate(cid)
        trace = scope2_runs.get_trace(company_id=cid, run_id=run["id"])
        a = assemble_scope2_pack(company_id=cid, company_name="X", run=run, trace=trace)
        b = assemble_scope2_pack(company_id=cid, company_name="X", run=run, trace=trace)
        assert a.package_hash == b.package_hash


@_skip_no_db_url
@_skip_no_psycopg2
class TestLoadInputs:
    def test_activites_pending_exclues_sur_demande(self, scope2_env):
        cid = scope2_env["a"]
        _clear_runs(cid)
        _clear_energy(cid)
        add_activity(
            company_id=cid, meter_id=scope2_env["meter_a"], site_id=scope2_env["site_a"],
            quantity=100.0, period_start=P_START, period_end=P_END, review_status="pending",
        )
        included = scope2_runs.load_activities(
            company_id=cid, period_start=P_START, period_end=P_END,
            geography_code="FR", include_pending=True,
        )
        excluded = scope2_runs.load_activities(
            company_id=cid, period_start=P_START, period_end=P_END,
            geography_code="FR", include_pending=False,
        )
        assert len(included) == 1
        assert excluded == []

    def test_zone_par_site_surcharge_la_zone_du_perimetre(self, scope2_env):
        cid = scope2_env["a"]
        _clear_runs(cid)
        _clear_energy(cid)
        add_activity(
            company_id=cid, meter_id=scope2_env["meter_a"], site_id=scope2_env["site_a"],
            quantity=100.0, period_start=P_START, period_end=P_END,
        )
        activities = scope2_runs.load_activities(
            company_id=cid, period_start=P_START, period_end=P_END, geography_code="FR",
            site_geographies={scope2_env["site_a"]: "FR-IDF"},
        )
        assert activities[0].geography_code == "FR-IDF"

    def test_allocations_scopees_au_tenant(self, scope2_env):
        seed = _seed_nominal(scope2_env, tenant="a")
        activities = scope2_runs.load_activities(
            company_id=seed["company_id"], period_start=P_START, period_end=P_END,
            geography_code="FR",
        )
        assert len(activities[0].allocations) == 1
        assert activities[0].allocations[0].allocated_mwh == pytest.approx(400.0)
        # Le même chargement pour l'autre tenant ne voit rien.
        assert scope2_runs.load_activities(
            company_id=scope2_env["b"], period_start=P_START, period_end=P_END,
            geography_code="FR",
        ) == [] or all(
            not a.allocations
            for a in scope2_runs.load_activities(
                company_id=scope2_env["b"], period_start=P_START, period_end=P_END,
                geography_code="FR",
            )
        )


@_skip_no_db_url
@_skip_no_psycopg2
def test_moteur_pur_et_persistance_donnent_le_meme_resultat(scope2_env):
    """Le moteur PUR et le chemin persisté ne peuvent pas diverger : on rejoue
    `scope2.calculate` sur les entrées rechargées et on compare aux totaux
    enregistrés."""
    seed = _seed_nominal(scope2_env)
    cid = seed["company_id"]
    run = _calculate(cid)

    activities = scope2_runs.load_activities(
        company_id=cid, period_start=P_START, period_end=P_END, geography_code="FR",
    )
    factors, _ = scope2_runs.load_factor_candidates(company_id=cid)
    replayed = scope2.calculate(activities, factors, today=TODAY)

    assert replayed.location_based_tco2e == pytest.approx(run["result"]["location_based_tco2e"])
    assert replayed.market_based_tco2e == pytest.approx(run["result"]["market_based_tco2e"])
