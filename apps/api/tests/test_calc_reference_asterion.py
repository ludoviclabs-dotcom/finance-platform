"""
test_calc_reference_asterion.py — les chiffres affichés sont-ils RECALCULÉS
par les vrais moteurs, et cohérents avec le classeur de référence ?

Tests PURS (aucune base, aucun réseau). Trois questions, dans cet ordre :

  A. Achats (Scope 3 cat. 1) — le moteur `procurement.compute_line` redonne-t-il,
     à partir des quantités et facteurs du scénario Asterion, les tCO2e déclarées
     par ligne et le total de 3 552 tCO2e ?
  B. Scope 2 — le moteur `scope2.calculate` redonne-t-il le location-based
     (489 t), la couverture contractuelle (54 %) et le market-based (237 t) ?
  C. Classeur de référence `data/CarbonCo_Calcul_Carbone_v2.xlsx` — les facteurs
     du scénario sont-ils ceux du classeur, et les totaux de `Synthese_GES`
     restent-ils des formules ?

`demo_verify.py` contrôle déjà que le scénario est cohérent AVEC LUI-MÊME (il
additionne les tCO2e déjà écrites dans le JSON). Ce fichier va plus loin : il
fait recalculer les chiffres par les moteurs, à partir des données d'entrée.

Les six écarts relevés le 2026-11-04 sont corrigés (rappelés dans la
docstring du test concerné) :
  * calcul      — aluminium 530 t au lieu de 528,96 t, donc total 3 480 t ;
  * définition  — facteur réseau FR 0,2163 au lieu de 0,0569 (FE020) ;
  * périmètre   — 290 k€ d'achats sans émissions (ligne « autres achats ») ;
  * traitement  — instruments écartés après clôture (moteur Scope 2 1.1.0) ;
  * donnée      — mix résiduel absent pour le market-based.
Si un futur écart est assumé temporairement, le marquer
`xfail(strict=True, raises=AssertionError, reason=...)` : il échouera dès qu'il
sera corrigé, et ne pourra pas rester marqué « connu » par oubli.
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

PHYSICAL_MATERIALS = ("NDFEB", "CU", "AL")


def _compute_purchase_line(idx: int, line: dict) -> procurement.LineComputation:
    """Passe une ligne Asterion dans la VRAIE cascade de méthodes. Sans PCF ni
    déclaration fournisseur, le moteur retient le facteur physique moyen s'il y
    a une masse, sinon le facteur monétaire (ligne « autres achats »)."""
    physical = line.get("physical_kg") is not None
    ctx = procurement.LineContext(
        physical_factor=procurement.FactorCandidate(
            factor_id=f"ASTERION-{line['material_code']}",
            factor_version="asterion-motion-v1",
            factor_kgco2e=float(line["emission_factor_kgco2e_per_kg"]),
            unit="kg",
            source="scénario Asterion (fictif)",
        ) if physical else None,
        spend_factor=None if physical else procurement.FactorCandidate(
            factor_id=f"ASTERION-{line['material_code']}",
            factor_version="asterion-motion-v1",
            factor_kgco2e=float(line["emission_factor_kgco2e_per_keur"]),
            unit="kEUR",
            source=line.get("emission_factor_ref"),
        ),
    )
    return procurement.compute_line(
        procurement.LineInput(
            line_id=idx,
            quantity=float(line["physical_kg"]) if physical else None,
            unit="kg" if physical else None,
            spend_amount=float(line["spend_eur"]),
            currency="EUR",
            category_code=line["material_code"],
            mapping_status="mapped",
        ),
        ctx,
    )


@pytest.fixture(scope="module")
def purchase_results(purchases) -> dict[str, procurement.LineComputation]:
    return {
        line["material_code"]: _compute_purchase_line(i, line)
        for i, line in enumerate(purchases["lines"], start=1)
    }


def _line(purchases: dict, material: str) -> dict:
    return next(ln for ln in purchases["lines"] if ln["material_code"] == material)


class TestAchatsScope3:
    @pytest.mark.parametrize(
        "material,kg_per_motor_key",
        [("NDFEB", "ndfeb_kg_per_motor"), ("CU", "copper_kg_per_motor"), ("AL", "aluminium_kg_per_motor")],
    )
    def test_masse_achetee_egale_nomenclature(self, manifest, purchases, material, kg_per_motor_key):
        """Masse achetée = moteurs/an × kg par moteur (nomenclature)."""
        m = manifest["expected_metrics"]
        assert _line(purchases, material)["physical_kg"] == pytest.approx(
            m["motors_per_year"] * m[kg_per_motor_key]
        )

    @pytest.mark.parametrize("material", PHYSICAL_MATERIALS)
    def test_le_moteur_retient_le_facteur_physique(self, purchase_results, material):
        assert purchase_results[material].calculation_method == "average_physical"

    def test_autres_achats_sur_facteur_monetaire(self, purchase_results):
        """290 k€ × 250 kgCO2e/k€ (FEM10) = 72,5 t, calculés par le niveau 4."""
        res = purchase_results["OTHER"]
        assert res.calculation_method == "spend_based_economic"
        assert res.result_tco2e == pytest.approx(72.5)

    @pytest.mark.parametrize("material", (*PHYSICAL_MATERIALS, "OTHER"))
    def test_ligne_recalculee_egale_ligne_declaree(self, purchases, purchase_results, material):
        assert purchase_results[material].result_tco2e == pytest.approx(
            _line(purchases, material)["scope3_tco2e"], abs=TOL_TCO2E
        )

    def test_total_recalcule_egale_total_affiche(self, manifest, purchase_results):
        """2 151 + 799,2 + 528,96 + 72,5 = 3 551,66 t, affiché 3 552 t.
        (Jusqu'au 2026-11-04 : aluminium déclaré 530 t au lieu de 528,96 t.)"""
        run = procurement.aggregate_run(list(purchase_results.values()))
        assert run.unresolved_count == 0
        assert run.total_tco2e == pytest.approx(
            manifest["expected_metrics"]["scope3_purchases_tco2e"], abs=TOL_TCO2E
        )

    def test_part_aimants_recalculee(self, manifest, purchase_results):
        """Hotspot n°1 : 2 151 / 3 551,66 = 60,6 %."""
        total = sum(r.result_tco2e for r in purchase_results.values())
        share = purchase_results["NDFEB"].result_tco2e / total * 100
        assert round(share, 1) == pytest.approx(manifest["expected_metrics"]["scope3_magnets_share_pct"])

    def test_parts_declarees_egales_parts_recalculees(self, purchases, purchase_results):
        total = sum(r.result_tco2e for r in purchase_results.values())
        for material, res in purchase_results.items():
            assert _line(purchases, material)["share_pct"] == pytest.approx(
                res.result_tco2e / total * 100, abs=TOL_PCT
            )

    def test_depense_des_lignes_egale_depense_totale(self, manifest, purchases):
        """(Jusqu'au 2026-11-04 : 3 lignes pour 5,51 M€ contre 5,8 M€ affichés ;
        la ligne « autres achats » de 290 k€ comble l'écart.)"""
        spend = sum(ln["spend_eur"] for ln in purchases["lines"])
        assert spend == pytest.approx(manifest["expected_metrics"]["purchases_total_eur"])
        assert spend == pytest.approx(purchases["total_spend_eur"])


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

    def test_market_based_recalcule(self, manifest, energy):
        """3 956 MWh non couverts × 0,06 = 237,36 t, affiché 237 t. (Jusqu'au
        2026-11-04 : aucun mix résiduel fourni, 1 090 t non recalculables.)"""
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
    def test_facteur_reseau_fr_identique_au_classeur(self, energy, workbook_factors):
        """(Jusqu'au 2026-11-04 : 0,2163 tCO2e/MWh, 3,8 fois le facteur FE020.)
        t/MWh = kg/kWh : les deux valeurs se comparent directement."""
        fe = workbook_factors["FE020"]
        assert "France" in fe["label"]
        assert energy["scope2"]["lb_factor_tco2e_per_mwh"] == pytest.approx(fe["total"])

    def test_mix_residuel_fr_identique_au_classeur(self, energy, workbook_factors):
        fe = workbook_factors["FE020"]
        assert energy["scope2"]["residual_mix_factor_tco2e_per_mwh"] == pytest.approx(fe["market"])

    def test_facteur_autres_achats_identique_au_classeur(self, purchases, workbook_factors):
        fe = workbook_factors["FEM10"]  # Équipements électroniques, kgCO2e/k€
        assert fe["unit"] == "k€"
        assert _line(purchases, "OTHER")["emission_factor_kgco2e_per_keur"] == pytest.approx(fe["total"])

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
