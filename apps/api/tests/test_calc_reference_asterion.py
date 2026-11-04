"""
test_calc_reference_asterion.py — les chiffres affichés sont-ils RECALCULÉS
par les vrais moteurs, et cohérents avec le classeur de référence ?

Tests PURS (aucune base, aucun réseau). Trois questions, dans cet ordre :

  A. Achats (Scope 3 cat. 1) — le moteur `procurement.compute_line` redonne-t-il,
     à partir des quantités et facteurs du scénario Asterion, les tCO2e déclarées
     par ligne et le total de 3 480 tCO2e ?
  B. Scope 2 — le moteur `scope2.calculate` redonne-t-il le location-based
     (1 860 t), la couverture contractuelle (54 %) et le market-based (1 090 t) ?
  C. Classeur de référence `data/CarbonCo_Calcul_Carbone_v2.xlsx` — les facteurs
     du scénario sont-ils ceux du classeur, et les totaux de `Synthese_GES`
     restent-ils des formules ?

`demo_verify.py` contrôle déjà que le scénario est cohérent AVEC LUI-MÊME (il
additionne les tCO2e déjà écrites dans le JSON). Ce fichier va plus loin : il
fait recalculer les chiffres par les moteurs, à partir des données d'entrée.

Écarts connus → `xfail(strict=True)`. Chaque écart constaté le 2026-11-04 est
marqué avec sa raison, en distinguant :
  * ERREUR DE CALCUL      — le chiffre ne découle pas de ses propres entrées ;
  * ERREUR DE DÉFINITION  — facteur ou périmètre incohérent avec la référence ;
  * ERREUR DE TRAITEMENT  — règle du moteur contraire à la méthode (GHG Protocol) ;
  * DONNÉE MANQUANTE      — le chiffre ne peut pas être recalculé.
`strict=True` : dès qu'un écart est corrigé, le test passe, pytest le signale
en échec (XPASS strict) et il faut retirer le marqueur. Un écart corrigé ne
peut donc pas rester marqué « connu » par oubli.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from services.calculations import procurement, scope2

API_ROOT = Path(__file__).resolve().parent.parent
SCENARIO_DIR = API_ROOT / "demo" / "scenarios" / "asterion-motion-v1"
WORKBOOK_PATH = API_ROOT / "data" / "CarbonCo_Calcul_Carbone_v2.xlsx"

TODAY = date(2026, 7, 20)
PERIOD = (date(2025, 1, 1), date(2025, 12, 31))

# Tolérance d'affichage : les tCO2e sont publiées à la tonne près.
TOL_TCO2E = 0.5
# Les pourcentages sont publiés à une décimale.
TOL_PCT = 0.05


def _load(name: str) -> dict:
    return json.loads((SCENARIO_DIR / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def manifest() -> dict:
    return _load("manifest.json")


@pytest.fixture(scope="module")
def purchases() -> dict:
    return _load("purchases.json")


@pytest.fixture(scope="module")
def energy() -> dict:
    return _load("energy.json")


# ---------------------------------------------------------------------------
# A. Achats — Scope 3 catégorie 1, recalculé par le moteur procurement
# ---------------------------------------------------------------------------

def _compute_purchase_line(idx: int, line: dict) -> procurement.LineComputation:
    """Passe une ligne Asterion dans la VRAIE cascade de méthodes : sans PCF ni
    déclaration fournisseur, le moteur doit retenir le facteur physique moyen."""
    return procurement.compute_line(
        procurement.LineInput(
            line_id=idx,
            quantity=float(line["physical_kg"]),
            unit="kg",
            spend_amount=float(line["spend_eur"]),
            currency="EUR",
            category_code=line["material_code"],
            mapping_status="mapped",
        ),
        procurement.LineContext(
            physical_factor=procurement.FactorCandidate(
                factor_id=f"ASTERION-{line['material_code']}",
                factor_version="asterion-motion-v1",
                factor_kgco2e=float(line["emission_factor_kgco2e_per_kg"]),
                unit="kg",
                source="scénario Asterion (fictif)",
            ),
        ),
    )


@pytest.fixture(scope="module")
def purchase_results(purchases) -> dict[str, procurement.LineComputation]:
    return {
        line["material_code"]: _compute_purchase_line(i, line)
        for i, line in enumerate(purchases["lines"], start=1)
    }


class TestAchatsScope3:
    @pytest.mark.parametrize(
        "material,kg_per_motor_key",
        [("NDFEB", "ndfeb_kg_per_motor"), ("CU", "copper_kg_per_motor"), ("AL", "aluminium_kg_per_motor")],
    )
    def test_masse_achetee_egale_nomenclature(self, manifest, purchases, material, kg_per_motor_key):
        """Masse achetée = moteurs/an × kg par moteur (nomenclature)."""
        m = manifest["expected_metrics"]
        line = next(ln for ln in purchases["lines"] if ln["material_code"] == material)
        assert line["physical_kg"] == pytest.approx(m["motors_per_year"] * m[kg_per_motor_key])

    def test_le_moteur_retient_le_facteur_physique(self, purchase_results):
        for res in purchase_results.values():
            assert res.calculation_method == "average_physical"
            assert res.result_tco2e is not None

    @pytest.mark.parametrize("material", ["NDFEB", "CU"])
    def test_ligne_recalculee_egale_ligne_declaree(self, purchases, purchase_results, material):
        line = next(ln for ln in purchases["lines"] if ln["material_code"] == material)
        assert purchase_results[material].result_tco2e == pytest.approx(line["scope3_tco2e"], abs=TOL_TCO2E)

    @pytest.mark.xfail(
        strict=True,
        raises=AssertionError,
        reason=(
            "ERREUR DE CALCUL — aluminium : 348 000 kg × 1,52 kgCO2e/kg = 528,96 t, "
            "mais purchases.json déclare 530 t (+1,04 t). Le total de 3 480 t en dépend."
        ),
    )
    def test_ligne_aluminium_recalculee_egale_ligne_declaree(self, purchases, purchase_results):
        line = next(ln for ln in purchases["lines"] if ln["material_code"] == "AL")
        assert purchase_results["AL"].result_tco2e == pytest.approx(line["scope3_tco2e"], abs=TOL_TCO2E)

    @pytest.mark.xfail(
        strict=True,
        raises=AssertionError,
        reason=(
            "ERREUR DE CALCUL — total recalculé par le moteur = 3 479,16 t "
            "(2 151 + 799,2 + 528,96), affiché 3 480 t. Conséquence de l'écart aluminium."
        ),
    )
    def test_total_recalcule_egale_total_affiche(self, manifest, purchase_results):
        run = procurement.aggregate_run(list(purchase_results.values()))
        assert run.unresolved_count == 0
        assert run.total_tco2e == pytest.approx(
            manifest["expected_metrics"]["scope3_purchases_tco2e"], abs=TOL_TCO2E
        )

    def test_part_aimants_recalculee(self, manifest, purchase_results):
        """La part aimants (hotspot n°1) résiste à l'écart aluminium : 61,8 %."""
        total = sum(r.result_tco2e for r in purchase_results.values())
        share = purchase_results["NDFEB"].result_tco2e / total * 100
        assert round(share, 1) == pytest.approx(manifest["expected_metrics"]["scope3_magnets_share_pct"])

    def test_parts_par_ligne_somment_a_100(self, purchases):
        assert sum(ln["share_pct"] for ln in purchases["lines"]) == pytest.approx(100.0, abs=0.15)

    @pytest.mark.xfail(
        strict=True,
        raises=AssertionError,
        reason=(
            "ERREUR DE DÉFINITION (périmètre) — les 3 lignes d'achat totalisent "
            "5 510 000 €, mais total_spend_eur et le cockpit affichent 5,8 M€. "
            "290 000 € d'achats n'ont aucune émission : soit le total est faux, "
            "soit le Scope 3 « achats » est incomplet."
        ),
    )
    def test_depense_des_lignes_egale_depense_totale(self, manifest, purchases):
        spend = sum(ln["spend_eur"] for ln in purchases["lines"])
        assert spend == pytest.approx(manifest["expected_metrics"]["purchases_total_eur"])


# ---------------------------------------------------------------------------
# B. Scope 2 — recalculé par le moteur dual LB/MB
# ---------------------------------------------------------------------------

def _asterion_activity(energy: dict) -> scope2.ActivityInput:
    allocations = tuple(
        scope2.AllocationInput(
            allocation_id=i,
            instrument_id=100 + i,
            instrument_type=inst["type"].lower(),
            allocated_mwh=float(inst["mwh"]),
            carrier="electricity",
            valid_from=PERIOD[0],
            valid_to=PERIOD[1],
            instrument_volume_mwh=float(inst["mwh"]),
            certificate_artifact_id=500 + i,
        )
        for i, inst in enumerate(energy["contractual_instruments"], start=1)
    )
    return scope2.ActivityInput(
        activity_id=1,
        carrier="electricity",
        quantity=float(energy["electricity_mwh"]),
        unit="MWh",
        period_start=PERIOD[0],
        period_end=PERIOD[1],
        geography_code="FR",
        review_status="accepted",
        allocations=allocations,
    )


def _grid_factor(ef_id: int, value_t_per_mwh: float, basis: str) -> scope2.FactorCandidate:
    # t/MWh = kg/kWh : même nombre, on le déclare donc « par kWh ».
    return scope2.FactorCandidate(
        ef_id=ef_id,
        ef_code=f"ASTERION-{basis.upper()}",
        ef_version="asterion-motion-v1",
        factor_value=value_t_per_mwh,
        factor_unit="kWh",
        basis=basis,  # type: ignore[arg-type]
        carrier="electricity",
        geography_code="FR",
    )


class TestScope2:
    def test_location_based_recalcule(self, manifest, energy):
        result = scope2.calculate(
            [_asterion_activity(energy)],
            [_grid_factor(1, energy["scope2"]["lb_factor_tco2e_per_mwh"], "location")],
            today=TODAY,
        )
        assert result.location_based_tco2e == pytest.approx(
            manifest["expected_metrics"]["scope2_lb_tco2e"], abs=TOL_TCO2E
        )

    def test_couverture_contractuelle_recalculee_avant_cloture(self, manifest, energy):
        """Calculée le dernier jour de l'exercice, la couverture redonne 54 % :
        les données d'instruments du scénario sont cohérentes."""
        result = scope2.calculate(
            [_asterion_activity(energy)],
            [_grid_factor(1, energy["scope2"]["lb_factor_tco2e_per_mwh"], "location")],
            today=PERIOD[1],
        )
        assert result.contractual_coverage_pct == pytest.approx(
            manifest["expected_metrics"]["contractual_coverage_pct"], abs=TOL_PCT
        )
        assert result.uncovered_mwh == pytest.approx(3956.0)

    def test_couverture_contractuelle_recalculee_apres_cloture(self, manifest, energy):
        """Corrigé le 2026-11-04 (méthodologie Scope 2 1.1.0) : jusque-là, le
        moteur écartait le PPA et les GO 2025 dès que le calcul avait lieu après
        le 31/12/2025, soit 0 % de couverture au lieu de 54 %."""
        result = scope2.calculate(
            [_asterion_activity(energy)],
            [_grid_factor(1, energy["scope2"]["lb_factor_tco2e_per_mwh"], "location")],
            today=TODAY,
        )
        assert result.contractual_coverage_pct == pytest.approx(
            manifest["expected_metrics"]["contractual_coverage_pct"], abs=TOL_PCT
        )

    def test_sans_mix_residuel_le_moteur_refuse_d_inventer_le_market_based(self, energy):
        """Garde-fou du moteur : sans facteur résiduel, la part non couverte est un
        facteur MANQUANT (run incomplet), jamais un zéro ni le facteur réseau."""
        result = scope2.calculate(
            [_asterion_activity(energy)],
            [_grid_factor(1, energy["scope2"]["lb_factor_tco2e_per_mwh"], "location")],
            today=TODAY,
        )
        assert result.is_complete is False
        assert any(mf.basis == "market" and mf.segment == "uncovered" for mf in result.missing_factors)

    @pytest.mark.xfail(
        strict=True,
        raises=AssertionError,
        reason=(
            "DONNÉE MANQUANTE — energy.json ne fournit aucun facteur de mix résiduel. "
            "Le market-based de 1 090 t n'est pas recalculable : il supposerait "
            "1 090 / 3 956 MWh non couverts = 0,2755 tCO2e/MWh, une valeur écrite nulle part."
        ),
    )
    def test_market_based_recalcule(self, manifest, energy):
        residual = energy["scope2"].get("residual_mix_factor_tco2e_per_mwh")
        assert residual is not None, "facteur de mix résiduel absent du scénario"
        result = scope2.calculate(
            [_asterion_activity(energy)],
            [
                _grid_factor(1, energy["scope2"]["lb_factor_tco2e_per_mwh"], "location"),
                _grid_factor(2, residual, "residual_mix"),
            ],
            today=TODAY,
        )
        assert result.is_complete
        assert result.market_based_tco2e == pytest.approx(
            manifest["expected_metrics"]["scope2_mb_tco2e"], abs=TOL_TCO2E
        )


# ---------------------------------------------------------------------------
# C. Classeur de référence — facteurs et totaux
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def workbook():
    openpyxl = pytest.importorskip("openpyxl")
    if not WORKBOOK_PATH.exists():
        pytest.skip(f"classeur absent : {WORKBOOK_PATH.name}")
    return openpyxl.load_workbook(WORKBOOK_PATH, data_only=False)


@pytest.fixture(scope="module")
def workbook_factors(workbook) -> dict[str, dict]:
    """Facteurs_Emission indexés par ID (FE020…), lus par en-tête de ligne et
    non par position de cellule : une ligne insérée ne casse pas le test."""
    ws = workbook["Facteurs_Emission"]
    out: dict[str, dict] = {}
    for row in ws.iter_rows(min_row=4, values_only=True):
        fe_id = row[0]
        if isinstance(fe_id, str) and fe_id.startswith("FE"):
            out[fe_id] = {
                "label": row[2], "unit": row[3], "total": row[6],
                "market": row[7], "uncertainty_pct": row[8], "source": row[9],
            }
    return out


class TestCoherenceClasseur:
    @pytest.mark.xfail(
        strict=True,
        raises=AssertionError,
        reason=(
            "ERREUR DE DÉFINITION — Asterion est en France mais son facteur "
            "location-based vaut 0,2163 tCO2e/MWh. Ton classeur (FE020, ADEME 2024) "
            "donne 0,0569 : 3,8 fois moins. Avec FE020, le LB serait ≈ 489 t, pas 1 860 t."
        ),
    )
    def test_facteur_reseau_fr_identique_au_classeur(self, energy, workbook_factors):
        fe = workbook_factors["FE020"]
        assert "France" in fe["label"]
        tolerance = fe["uncertainty_pct"] / 100
        assert energy["scope2"]["lb_factor_tco2e_per_mwh"] == pytest.approx(fe["total"], rel=tolerance)

    def test_facteur_cuivre_dans_l_incertitude_du_classeur(self, purchases, workbook_factors):
        fe = workbook_factors["FE072"]  # Cuivre, kgCO2e/tonne
        assert fe["unit"] == "tonne"
        line = next(ln for ln in purchases["lines"] if ln["material_code"] == "CU")
        assert line["emission_factor_kgco2e_per_kg"] == pytest.approx(
            fe["total"] / 1000, rel=fe["uncertainty_pct"] / 100
        )

    def test_facteur_aluminium_entre_recycle_et_primaire(self, purchases, workbook_factors):
        recycled = workbook_factors["FE063"]["total"] / 1000  # 0,61 kgCO2e/kg
        primary = workbook_factors["FE062"]["total"] / 1000   # 9,2 kgCO2e/kg
        line = next(ln for ln in purchases["lines"] if ln["material_code"] == "AL")
        assert recycled <= line["emission_factor_kgco2e_per_kg"] <= primary

    def test_totaux_synthese_sont_des_formules(self, workbook):
        """Garde-fou de non-régression : jusqu'au 16/09/2026 (commit 4baf42d),
        ces totaux étaient des nombres saisis (1 336 / 934 / 3 685 / 5 955)
        affichés quelles que soient les saisies. Ils doivent rester des formules.
        Le recalcul serveur est testé dans test_qa_2026_09_16.py."""
        ws = workbook["Synthese_GES"]
        totals = ("C10", "C15", "C17", "C35", "C47", "C50", "C51", "C53", "C54", "C55")
        typed = [c for c in totals if not (isinstance(ws[c].value, str) and ws[c].value.startswith("="))]
        assert typed == [], f"totaux saisis en dur : {', '.join(typed)}"
