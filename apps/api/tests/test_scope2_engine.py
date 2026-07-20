"""
test_scope2_engine.py — moteur de calcul Scope 2 dual (PR-06B), tests PURS.

Jamais skippés (aucune DB) : les DEUX hiérarchies de facteurs sont couvertes
niveau par niveau, y compris leur ERREUR EXPLICITE de dernier niveau, ainsi que
les contrôles obligatoires (double allocation, quantité couverte ≤ consommation,
volume utilisé ≤ volume émis, périodes, zones, vecteur, unités) et la
reproductibilité (mêmes entrées ⇒ mêmes sorties).

Les interdits méthodologiques ont chacun leur test :
  * une moyenne nationale ne peut jamais devenir un résultat market-based ;
  * une estimation n'est jamais étiquetée `verified` ;
  * un proxy fournisseur n'est jamais étiqueté facteur contractuel vérifié.
"""

from __future__ import annotations

from datetime import date

import pytest

from services.calculations import CalculationError, scope2
from services.calculations.scope2 import (
    ActivityInput,
    AllocationInput,
    FactorCandidate,
    Methodology,
)
from services.carbon.scope2_selection import select_scope2
from services.export_package import assemble_scope2_pack, inspect_zip

TODAY = date(2026, 7, 20)
P_START = date(2025, 1, 1)
P_END = date(2025, 12, 31)


# ---------------------------------------------------------------------------
# Constructeurs de fixtures (purs, explicites)
# ---------------------------------------------------------------------------

def factor(
    ef_id: int,
    *,
    basis: str = "location",
    zone: str | None = "FR",
    value: float = 0.05,
    unit: str = "kWh",
    carrier: str = "electricity",
    sourced: bool = False,
    valid_from: date | None = None,
    valid_to: date | None = None,
    licensed: bool = True,
    code: str | None = None,
) -> FactorCandidate:
    return FactorCandidate(
        ef_id=ef_id,
        ef_code=code or f"EF-{ef_id}",
        ef_version="v2025",
        factor_value=value,
        factor_unit=unit,
        basis=basis,  # type: ignore[arg-type]
        carrier=carrier,
        geography_code=zone,
        valid_from=valid_from,
        valid_to=valid_to,
        source_release_id=42 if sourced else None,
        license_allows_derived_use=licensed,
    )


def activity(
    activity_id: int = 1,
    *,
    quantity: float = 1000.0,
    unit: str = "MWh",
    zone: str = "FR",
    carrier: str = "electricity",
    review: str = "accepted",
    allocations: tuple[AllocationInput, ...] = (),
    start: date = P_START,
    end: date = P_END,
) -> ActivityInput:
    return ActivityInput(
        activity_id=activity_id,
        carrier=carrier,
        quantity=quantity,
        unit=unit,
        period_start=start,
        period_end=end,
        geography_code=zone,
        site_id=7,
        meter_id=3,
        review_status=review,
        allocations=allocations,
    )


def allocation(
    allocation_id: int = 1,
    *,
    instrument_id: int = 100,
    mwh: float = 400.0,
    volume: float = 1000.0,
    carrier: str = "electricity",
    valid_from: date = date(2024, 1, 1),
    valid_to: date = date(2027, 12, 31),
    status: str = "active",
    certificate: int | None = 555,
) -> AllocationInput:
    return AllocationInput(
        allocation_id=allocation_id,
        instrument_id=instrument_id,
        instrument_type="go",
        allocated_mwh=mwh,
        carrier=carrier,
        valid_from=valid_from,
        valid_to=valid_to,
        instrument_volume_mwh=volume,
        status=status,
        certificate_artifact_id=certificate,
    )


# ---------------------------------------------------------------------------
# Zones
# ---------------------------------------------------------------------------

class TestGeography:
    @pytest.mark.parametrize(
        "code,expected",
        [
            ("FR", "national"), ("fr", "national"),
            ("FR-IDF", "subnational"), ("US-CA", "subnational"),
            ("EU", "regional"), ("OECD", "regional"), ("WORLD", "regional"),
            ("FRA", "regional"),  # non ISO-2 → régional, jamais promu national
            (None, "unknown"), ("", "unknown"), ("   ", "unknown"),
        ],
    )
    def test_geo_level(self, code, expected):
        assert scope2.geo_level(code) == expected

    @pytest.mark.parametrize(
        "code,expected",
        [("FR-IDF", "FR"), ("FR", "FR"), ("EU", None), (None, None)],
    )
    def test_national_of(self, code, expected):
        assert scope2.national_of(code) == expected


# ---------------------------------------------------------------------------
# Hiérarchie LOCATION-BASED
# ---------------------------------------------------------------------------

class TestLocationHierarchy:
    def test_niveau_1_sous_national_prime_sur_national(self):
        act = activity(zone="FR-IDF")
        sel = scope2.select_location_factor(
            act, [factor(1, zone="FR", value=0.05), factor(2, zone="FR-IDF", value=0.03)]
        )
        assert sel.level == "subnational_grid"
        assert sel.ef_id == 2
        assert "sous-national" in sel.reason

    def test_niveau_2_national_quand_pas_de_sous_national(self):
        sel = scope2.select_location_factor(activity(zone="FR-IDF"), [factor(1, zone="FR")])
        assert sel.level == "national_grid"
        assert sel.ef_id == 1
        assert "parent" in sel.reason

    def test_niveau_2_national_zone_nationale(self):
        sel = scope2.select_location_factor(activity(zone="FR"), [factor(1, zone="FR")])
        assert sel.level == "national_grid"

    def test_niveau_3_regional_documente_avec_warning(self):
        sel = scope2.select_location_factor(
            activity(zone="FR"), [factor(9, zone="EU", sourced=True)]
        )
        assert sel.level == "documented_regional"
        assert sel.warnings and "précision géographique dégradée" in sel.warnings[0]

    def test_niveau_3_regional_NON_documente_rejete(self):
        """« Explicitement documenté » est une CONDITION : un facteur régional
        sans sourcing n'est pas admissible et la hiérarchie s'épuise."""
        with pytest.raises(CalculationError) as exc:
            scope2.select_location_factor(activity(zone="FR"), [factor(9, zone="EU", sourced=False)])
        assert "Hiérarchie épuisée" in str(exc.value)

    def test_niveau_4_erreur_explicite(self):
        with pytest.raises(CalculationError) as exc:
            scope2.select_location_factor(activity(zone="FR"), [])
        message = str(exc.value)
        assert "Aucun facteur location-based admissible" in message
        assert "FR" in message and "electricity" in message

    def test_zone_absente_erreur_explicite(self):
        act = ActivityInput(
            activity_id=1, carrier="electricity", quantity=10, unit="MWh",
            period_start=P_START, period_end=P_END, geography_code="",
        )
        with pytest.raises(CalculationError) as exc:
            scope2.select_location_factor(act, [factor(1)])
        assert "Zone de réseau requise" in str(exc.value)

    def test_vecteur_incompatible_exclu(self):
        with pytest.raises(CalculationError):
            scope2.select_location_factor(
                activity(carrier="electricity"), [factor(1, carrier="gas")]
            )

    def test_annee_incompatible_exclue(self):
        """Compatibilité d'année : un facteur qui ne couvre pas TOUTE la période
        n'est pas « à peu près bon », il est incompatible."""
        with pytest.raises(CalculationError):
            scope2.select_location_factor(
                activity(), [factor(1, valid_from=date(2025, 6, 1), valid_to=date(2026, 1, 1))]
            )

    def test_annee_couvrante_acceptee(self):
        sel = scope2.select_location_factor(
            activity(), [factor(1, valid_from=date(2024, 1, 1), valid_to=date(2026, 1, 1))]
        )
        assert sel.level == "national_grid"

    def test_facteur_market_jamais_utilise_en_location(self):
        with pytest.raises(CalculationError):
            scope2.select_location_factor(activity(), [factor(1, basis="market")])

    def test_licence_sans_usage_derive_ecarte_le_facteur(self):
        with pytest.raises(CalculationError):
            scope2.select_location_factor(activity(), [factor(1, licensed=False)])

    def test_facteur_source_est_verified_sinon_estimated(self):
        assert scope2.select_location_factor(
            activity(), [factor(1, sourced=True)]
        ).data_quality == "verified"
        assert scope2.select_location_factor(
            activity(), [factor(1, sourced=False)]
        ).data_quality == "estimated"

    def test_selection_deterministe_entre_candidats_egaux(self):
        """Deux facteurs éligibles au même niveau : le SOURCÉ prime, l'ordre
        d'entrée n'a aucune influence (sinon la reproductibilité tombe)."""
        candidates = [factor(5, sourced=False), factor(6, sourced=True)]
        a = scope2.select_location_factor(activity(), candidates)
        b = scope2.select_location_factor(activity(), list(reversed(candidates)))
        assert a.ef_id == b.ef_id == 6


# ---------------------------------------------------------------------------
# Hiérarchie MARKET-BASED
# ---------------------------------------------------------------------------

class TestMarketHierarchy:
    def test_niveau_1_instrument_avec_certificat_est_verifie(self):
        sel = scope2.select_instrument_factor(activity(), allocation(certificate=555))
        assert sel.level == "contractual_instrument"
        assert sel.factor_basis == "contractual_instrument"
        assert sel.rate_kgco2e_per_mwh == 0.0
        assert sel.data_quality == "verified"
        assert sel.warnings == ()

    def test_niveau_1_instrument_sans_certificat_est_estime_avec_warning(self):
        """Interdit : un proxy présenté comme facteur contractuel VÉRIFIÉ."""
        sel = scope2.select_instrument_factor(activity(), allocation(certificate=None))
        assert sel.data_quality == "estimated"
        assert sel.warnings and "sans certificat" in sel.warnings[0]

    def test_niveau_2_facteur_fournisseur(self):
        sel = scope2.select_market_factor(activity(), [factor(3, basis="market", value=0.02)])
        assert sel.level == "supplier_factor"
        assert sel.factor_basis == "market"
        assert sel.data_quality == "estimated"
        assert sel.warnings and "non sourcé" in sel.warnings[0]

    def test_niveau_2_facteur_fournisseur_source_est_verifie(self):
        sel = scope2.select_market_factor(
            activity(), [factor(3, basis="market", sourced=True)]
        )
        assert sel.level == "supplier_factor_sourced"
        assert sel.data_quality == "verified"

    def test_niveau_2_prime_sur_niveau_3(self):
        sel = scope2.select_market_factor(
            activity(),
            [factor(4, basis="residual_mix", value=0.09), factor(3, basis="market", value=0.02)],
        )
        assert sel.factor_basis == "market"

    def test_niveau_3_mix_residuel_avec_warning(self):
        sel = scope2.select_market_factor(activity(), [factor(4, basis="residual_mix", value=0.09)])
        assert sel.level == "residual_mix"
        assert sel.factor_basis == "residual_mix"
        assert sel.warnings and "MIX RÉSIDUEL" in sel.warnings[0]

    def test_niveau_4_refuse_par_defaut(self):
        """Sans autorisation méthodologique EXPLICITE, l'absence de facteur de
        marché est une erreur — jamais un repli sur la moyenne de réseau."""
        with pytest.raises(CalculationError) as exc:
            scope2.select_market_factor(activity(), [factor(1, basis="location")])
        message = str(exc.value)
        assert "n'autorise aucun repli" in message
        assert "jamais un résultat market-based" in message

    def test_niveau_4_repli_documente_si_methodologie_autorise(self):
        methodology = Methodology(allow_market_fallback=True, fallback_note="Décision comité 2026-03.")
        locations = [factor(1, basis="location", value=0.05)]
        sel = scope2.select_market_factor(
            activity(), locations, methodology=methodology, location_candidates=locations,
        )
        assert sel.level == "documented_fallback"
        # JAMAIS étiqueté 'location' : la migration 033 l'interdit aussi en base.
        assert sel.factor_basis == "documented_fallback"
        assert sel.fallback_reason == "Décision comité 2026-03."
        assert sel.data_quality == "estimated"
        assert sel.warnings and "PAS un résultat market-based" in sel.warnings[0]

    def test_niveau_4_sans_facteur_de_reseau_reste_une_erreur(self):
        methodology = Methodology(allow_market_fallback=True)
        with pytest.raises(CalculationError):
            scope2.select_market_factor(activity(), [], methodology=methodology, location_candidates=[])

    def test_moyenne_nationale_jamais_market_based(self):
        """L'interdit central : un candidat `basis='location'` n'est jamais
        sélectionné par la hiérarchie market-based (niveaux 2 et 3)."""
        with pytest.raises(CalculationError):
            scope2.select_market_factor(
                activity(), [factor(1, basis="location", zone="FR", sourced=True)]
            )

    def test_zone_incompatible_rejetee(self):
        with pytest.raises(CalculationError):
            scope2.select_market_factor(activity(zone="FR"), [factor(3, basis="market", zone="DE")])

    def test_facteur_marche_sans_zone_est_compatible(self):
        """Un facteur de marché sans zone porte sur le CONTRAT, pas sur une
        géographie : il reste admissible."""
        sel = scope2.select_market_factor(activity(zone="FR"), [factor(3, basis="market", zone=None)])
        assert sel.factor_basis == "market"


# ---------------------------------------------------------------------------
# Contrôles d'allocation
# ---------------------------------------------------------------------------

class TestAllocationControls:
    def test_double_allocation_meme_instrument_erreur(self):
        act = activity(allocations=(
            allocation(1, instrument_id=100, mwh=100.0),
            allocation(2, instrument_id=100, mwh=100.0),
        ))
        with pytest.raises(CalculationError) as exc:
            scope2.calculate([act], [factor(1)], today=TODAY)
        assert "Double allocation détectée" in str(exc.value)

    def test_quantite_couverte_superieure_a_la_consommation_erreur(self):
        act = activity(quantity=100.0, allocations=(allocation(1, mwh=150.0, volume=500.0),))
        with pytest.raises(CalculationError) as exc:
            scope2.calculate([act], [factor(1)], today=TODAY)
        assert "supérieure à la consommation" in str(exc.value)

    def test_volume_utilise_superieur_au_volume_instrument_erreur(self):
        """Contrôle transverse (toutes activités) : la survente de garanties est
        refusée au calcul même si la base l'avait laissée passer avant coup."""
        acts = [
            activity(1, quantity=1000.0, allocations=(allocation(1, instrument_id=7, mwh=600.0, volume=1000.0),)),
            activity(2, quantity=1000.0, allocations=(allocation(2, instrument_id=7, mwh=600.0, volume=1000.0),)),
        ]
        with pytest.raises(CalculationError) as exc:
            scope2.calculate(acts, [factor(1)], today=TODAY)
        assert "survente" in str(exc.value)

    def test_periode_incompatible_exclue_avec_warning(self):
        """Instrument NON expiré (valide jusqu'en 2027) mais dont la fenêtre
        s'ouvre après le début de la consommation : la couverture ne peut pas
        rétroagir sur des MWh consommés avant l'émission de l'instrument."""
        act = activity(allocations=(
            allocation(1, valid_from=date(2025, 6, 1), valid_to=date(2027, 12, 31)),
        ))
        result = scope2.calculate(
            [act], [factor(1), factor(2, basis="residual_mix")], today=TODAY
        )
        assert result.contractual_coverage_mwh == 0.0
        assert any("hors de la validité" in w for w in result.warnings)

    def test_vecteur_incompatible_exclu_avec_warning(self):
        act = activity(carrier="electricity", allocations=(allocation(1, carrier="gas"),))
        result = scope2.calculate(
            [act], [factor(1), factor(2, basis="residual_mix")], today=TODAY
        )
        assert result.contractual_coverage_mwh == 0.0
        assert any("vecteur incompatible" in w for w in result.warnings)

    def test_instrument_expire_exclu_avec_warning(self):
        act = activity(allocations=(allocation(1, valid_from=date(2020, 1, 1), valid_to=date(2021, 12, 31)),))
        result = scope2.calculate(
            [act], [factor(1), factor(2, basis="residual_mix")], today=TODAY
        )
        assert result.contractual_coverage_mwh == 0.0
        assert any("expiré" in w for w in result.warnings)

    def test_instrument_non_actif_exclu(self):
        act = activity(allocations=(allocation(1, status="cancelled"),))
        result = scope2.calculate(
            [act], [factor(1), factor(2, basis="residual_mix")], today=TODAY
        )
        assert result.contractual_coverage_mwh == 0.0
        assert any("non actif" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Calcul complet & agrégation
# ---------------------------------------------------------------------------

class TestCalculate:
    def test_totaux_lb_et_mb_coexistent(self):
        """Cas nominal : 1000 MWh, 400 MWh couverts par une GO, le reste au mix
        résiduel. LB porte sur la TOTALITÉ (les instruments n'y changent rien)."""
        act = activity(quantity=1000.0, allocations=(allocation(1, mwh=400.0),))
        factors = [
            factor(1, basis="location", value=0.05),        # 50 kg/MWh
            factor(2, basis="residual_mix", value=0.09),    # 90 kg/MWh
        ]
        result = scope2.calculate([act], factors, today=TODAY)

        assert result.location_based_tco2e == pytest.approx(1000 * 50 / 1000)   # 50 t
        assert result.market_based_tco2e == pytest.approx(600 * 90 / 1000)      # 54 t
        assert result.contractual_coverage_mwh == 400.0
        assert result.contractual_coverage_pct == pytest.approx(40.0)
        assert result.uncovered_mwh == 600.0
        assert result.residual_mix_used is True
        assert result.is_complete is True

    def test_part_non_couverte_visible_dans_la_trace(self):
        act = activity(quantity=1000.0, allocations=(allocation(1, mwh=400.0),))
        result = scope2.calculate(
            [act], [factor(1), factor(2, basis="residual_mix")], today=TODAY
        )
        segments = {(line.basis, line.segment) for line in result.lines}
        assert ("location", "total") in segments
        assert ("market", "covered") in segments
        assert ("market", "uncovered") in segments

    def test_couverture_totale_sans_facteur_de_marche_reste_valide(self):
        """Couverture contractuelle à 100 % : aucune part résiduelle, donc aucun
        facteur de marché nécessaire — ce n'est PAS un facteur manquant."""
        act = activity(quantity=500.0, allocations=(allocation(1, mwh=500.0, volume=500.0),))
        result = scope2.calculate([act], [factor(1)], today=TODAY)
        assert result.market_based_tco2e == 0.0
        assert result.uncovered_mwh == 0.0
        assert result.is_complete is True
        assert result.missing_factors == ()

    def test_mb_zero_legitime_et_lb_non_nul(self):
        """Électricité 100 % couverte : MB = 0 alors que LB > 0. Les deux totaux
        restent publiés — jamais l'un à la place de l'autre."""
        act = activity(quantity=500.0, allocations=(allocation(1, mwh=500.0, volume=500.0),))
        result = scope2.calculate([act], [factor(1, value=0.05)], today=TODAY)
        assert result.market_based_tco2e == 0.0
        assert result.location_based_tco2e > 0.0

    def test_lb_zero_reste_une_donnee_legitime(self):
        """LB = 0 (facteur nul, ex. réseau décarboné) est une DONNÉE, pas une
        absence : le helper de sélection mono-total le retient bien sur la
        PRÉSENCE, pas la véracité (règle PR-06A conservée)."""
        act = activity(quantity=100.0)
        result = scope2.calculate(
            [act], [factor(1, value=0.0), factor(2, basis="residual_mix", value=0.0)], today=TODAY
        )
        assert result.location_based_tco2e == 0.0
        assert result.is_complete is True
        selection = select_scope2(result.location_based_tco2e, 12.5)
        assert selection is not None
        assert selection.basis == "location_based"
        assert selection.value == 0.0

    def test_conversion_unites_appliquee(self):
        act = activity(quantity=1_000_000.0, unit="kWh")  # = 1000 MWh
        result = scope2.calculate([act], [factor(1, value=0.05)], today=TODAY)
        assert result.total_consumption_mwh == pytest.approx(1000.0)
        assert result.location_based_tco2e == pytest.approx(50.0)

    def test_unite_non_convertible_erreur_explicite(self):
        act = activity(quantity=10.0, unit="kg")
        with pytest.raises(CalculationError) as exc:
            scope2.calculate([act], [factor(1)], today=TODAY)
        assert "non convertible" in str(exc.value)

    def test_facteur_manquant_run_incomplet_sans_substitution_par_zero(self):
        """Une activité sans facteur ne contribue à AUCUN total ; elle apparaît
        en `missing_factors` avec le message d'erreur explicite intégral."""
        acts = [
            activity(1, quantity=100.0, zone="FR"),
            activity(2, quantity=100.0, zone="DE"),  # aucun facteur DE, ni LB ni MB
        ]
        factors = [
            factor(1, zone="FR", value=0.05),
            factor(2, zone="FR", basis="residual_mix", value=0.05),
        ]
        result = scope2.calculate(acts, factors, today=TODAY)

        assert result.is_complete is False
        assert len(result.missing_factors) >= 1
        assert {m.energy_activity_id for m in result.missing_factors} == {2}
        # L'activité 2 manque des DEUX bases : la trace le dit pour chacune.
        assert {m.basis for m in result.missing_factors} == {"location", "market"}
        assert result.location_based_tco2e == pytest.approx(5.0)  # seule l'activité 1
        assert result.calculated_consumption_mwh == 100.0
        assert result.total_consumption_mwh == 200.0
        assert result.coverage_pct == pytest.approx(50.0)
        assert any("Run INCOMPLET" in w for w in result.warnings)

    def test_activite_en_attente_de_revue_signalee(self):
        act = activity(review="pending")
        result = scope2.calculate([act], [factor(1)], today=TODAY)
        assert any("EN ATTENTE DE REVUE" in w for w in result.warnings)

    def test_facteurs_utilises_listes(self):
        act = activity(quantity=1000.0, allocations=(allocation(1, mwh=400.0),))
        result = scope2.calculate(
            [act], [factor(1, value=0.05), factor(2, basis="residual_mix", value=0.09)], today=TODAY
        )
        used = {(f["ef_id"], f["basis"]) for f in result.factor_versions}
        assert used == {(1, "location"), (2, "market")}

    def test_confiance_deterministe_et_bornee(self):
        act = activity()
        a = scope2.calculate([act], [factor(1)], today=TODAY)
        b = scope2.calculate([act], [factor(1)], today=TODAY)
        assert a.confidence == b.confidence
        assert 0 <= a.confidence <= 100

    def test_confiance_degradee_par_le_repli(self):
        methodology = Methodology(allow_market_fallback=True)
        act = activity(quantity=1000.0)
        strong = scope2.calculate(
            [act], [factor(1), factor(2, basis="market", sourced=True)], today=TODAY
        )
        weak = scope2.calculate([act], [factor(1)], methodology=methodology, today=TODAY)
        assert weak.confidence < strong.confidence


# ---------------------------------------------------------------------------
# Reproductibilité
# ---------------------------------------------------------------------------

class TestReproducibility:
    def _inputs(self):
        acts = [activity(1, quantity=1000.0, allocations=(allocation(1, mwh=400.0),)),
                activity(2, quantity=250.0, unit="MWh")]
        factors = [factor(1, value=0.05), factor(2, basis="residual_mix", value=0.09)]
        return acts, factors

    def test_memes_entrees_memes_sorties(self):
        acts, factors = self._inputs()
        first = scope2.result_to_dict(scope2.calculate(acts, factors, today=TODAY))
        second = scope2.result_to_dict(scope2.calculate(acts, factors, today=TODAY))
        assert first == second

    def test_ordre_des_entrees_sans_influence(self):
        acts, factors = self._inputs()
        a = scope2.result_to_dict(scope2.calculate(acts, factors, today=TODAY))
        b = scope2.result_to_dict(scope2.calculate(list(reversed(acts)), list(reversed(factors)), today=TODAY))
        assert a == b

    def test_empreinte_stable_et_sensible(self):
        acts, factors = self._inputs()
        kwargs = dict(methodology=scope2.DEFAULT_METHODOLOGY, period_start=P_START,
                      period_end=P_END, geography_code="FR", today=TODAY)
        snap1 = scope2.build_input_snapshot(acts, factors, **kwargs)
        snap2 = scope2.build_input_snapshot(list(reversed(acts)), factors, **kwargs)
        assert scope2.fingerprint(snap1) == scope2.fingerprint(snap2)

        changed = scope2.build_input_snapshot(
            [activity(1, quantity=999.0), acts[1]], factors, **kwargs
        )
        assert scope2.fingerprint(changed) != scope2.fingerprint(snap1)

    def test_trace_serialisable_et_complete(self):
        acts, factors = self._inputs()
        payload = scope2.result_to_dict(scope2.calculate(acts, factors, today=TODAY))
        assert payload["trace"]
        for line in payload["trace"]:
            # « Aucun facteur choisi silencieusement » : niveau ET raison présents.
            assert line["selection"]["level"]
            assert line["selection"]["reason"]


# ---------------------------------------------------------------------------
# Evidence Pack (assemblage PUR)
# ---------------------------------------------------------------------------

def _run_payload():
    acts = [activity(1, quantity=1000.0, allocations=(allocation(1, mwh=400.0),))]
    factors = [factor(1, value=0.05), factor(2, basis="residual_mix", value=0.09)]
    result = scope2.calculate(acts, factors, today=TODAY)
    payload = scope2.result_to_dict(result)
    snapshot = scope2.build_input_snapshot(
        acts, factors, methodology=scope2.DEFAULT_METHODOLOGY, period_start=P_START,
        period_end=P_END, geography_code="FR", today=TODAY,
    )
    return {
        "id": 1,
        "methodology_code": "CC-SCOPE2-DUAL",
        "methodology_version": "1.0.0",
        "period_start": P_START,
        "period_end": P_END,
        "geography_code": "FR",
        "status": "draft",
        "input_snapshot": snapshot,
        "input_fingerprint": scope2.fingerprint(snapshot),
        "factor_versions": [dict(f) for f in result.factor_versions],
        "result": payload,
        "warnings": list(result.warnings),
        "confidence": result.confidence,
        "coverage_pct": result.coverage_pct,
        "calculated_at": "2026-07-20T10:00:00+00:00",
        "approved_at": None,
    }, [scope2.line_to_dict(line) for line in result.lines]


class TestEvidencePack:
    def test_pack_reproductible_bit_a_bit(self):
        run, trace = _run_payload()
        a = assemble_scope2_pack(company_id=1, company_name="ACME", run=run, trace=trace)
        b = assemble_scope2_pack(company_id=1, company_name="ACME", run=run, trace=trace)
        assert a.package_hash == b.package_hash
        assert a.manifest_hash == b.manifest_hash

    def test_pack_coherent_en_interne(self):
        run, trace = _run_payload()
        pack = assemble_scope2_pack(company_id=1, company_name="ACME", run=run, trace=trace)
        inspection = inspect_zip(pack.zip_bytes)
        assert inspection["valid"] is True
        assert inspection["self_consistent"] is True
        assert inspection["manifest_hash"] == pack.manifest_hash

    def test_pack_contient_les_pieces_attendues(self):
        import io
        import zipfile

        run, trace = _run_payload()
        pack = assemble_scope2_pack(company_id=1, company_name="ACME", run=run, trace=trace)
        names = set(zipfile.ZipFile(io.BytesIO(pack.zip_bytes)).namelist())
        assert {
            "manifest.json", "run.json", "result.json", "calculation_trace.json",
            "input_snapshot.json", "factors.json", "warnings.json",
            "CHECKSUMS.sha256", "README.txt",
        } <= names

    def test_readme_publie_les_deux_totaux_et_les_interdits(self):
        import io
        import zipfile

        run, trace = _run_payload()
        pack = assemble_scope2_pack(company_id=1, company_name="ACME", run=run, trace=trace)
        readme = zipfile.ZipFile(io.BytesIO(pack.zip_bytes)).read("README.txt").decode("utf-8")
        assert "Location-based" in readme and "Market-based" in readme
        assert "n'est JAMAIS presentee comme market-based" in readme

    def test_pack_change_si_le_resultat_change(self):
        run, trace = _run_payload()
        pack = assemble_scope2_pack(company_id=1, company_name="ACME", run=run, trace=trace)
        run["result"] = {**run["result"], "location_based_tco2e": 999.0}
        altered = assemble_scope2_pack(company_id=1, company_name="ACME", run=run, trace=trace)
        assert altered.manifest_hash != pack.manifest_hash
