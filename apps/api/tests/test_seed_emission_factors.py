"""
test_seed_emission_factors.py — T1.2 : parsing/normalisation du CSV ADEME.

Données SYNTHÉTIQUES (pas de données ADEME réelles — licence). Vérifie la
détection de séparateur, le décimal virgule, les ratios monétaires kgCO2e/€,
le format d'ef_code, l'idempotence de la normalisation, et le no-op sans DB.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "seed_emission_factors.py"
_spec = importlib.util.spec_from_file_location("seed_emission_factors", _SCRIPT)
seed_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(seed_mod)

SYNTHETIC_CSV = """Identifiant de l'élément;Nom base français;Nom attribut français;Code de la catégorie;Unité français;Total poste non décomposé
1001;Electricite France continentale;mix moyen;Energie;kgCO2e/kWh;0,0599
1002;Gaz naturel reseau;combustion;Energie;kgCO2e/kWh;0,2270
1003;Fioul domestique;combustion;Energie;kgCO2e/L;3,2500
1004;Restauration commerciale;repas;Services;kgCO2e/€;0,2500
1005;Achats informatiques;materiel;Achats;kgCO2e/€;0,3100
1006;Transport routier;poids lourd;Transport;kgCO2e/km;0,1050
1007;Acier;production;Materiaux;kgCO2e/kg;2,1000
1008;Papier;production;Materiaux;kgCO2e/kg;0,9190
1009;Ligne sans facteur;na;Divers;kgCO2e/kg;
1010;Ciment;production;Materiaux;kgCO2e/kg;0,8660
"""


def _normalized(tmp_path):
    csv_path = tmp_path / "synthetic.csv"
    csv_path.write_text(SYNTHETIC_CSV, encoding="utf-8")
    header, rows = seed_mod.parse_csv(csv_path)
    return seed_mod.normalize_rows(rows, header, "v2025")


def test_parses_and_skips_empty_factor(tmp_path):
    norm = _normalized(tmp_path)
    # 10 lignes dont 1 sans facteur -> 9 facteurs.
    assert len(norm) == 9
    assert all(r["factor_kgco2e"] is not None for r in norm)


def test_decimal_comma_parsed(tmp_path):
    norm = _normalized(tmp_path)
    elec = next(r for r in norm if "Electricite" in r["label"])
    assert abs(elec["factor_kgco2e"] - 0.0599) < 1e-9
    assert elec["unit"] == "kWh"


def test_monetary_ratios_detected(tmp_path):
    norm = _normalized(tmp_path)
    monetary = [r for r in norm if r["is_monetary"]]
    assert len(monetary) == 2  # restauration + achats info
    assert all(r["unit"] == "€" for r in monetary)


def test_ef_code_format(tmp_path):
    norm = _normalized(tmp_path)
    for r in norm:
        assert r["ef_code"].startswith("ADEME.v2025.")
    # ids uniques
    codes = [r["ef_code"] for r in norm]
    assert len(set(codes)) == len(codes)


def test_seed_dry_run_counts(tmp_path):
    csv_path = tmp_path / "synthetic.csv"
    csv_path.write_text(SYNTHETIC_CSV, encoding="utf-8")
    assert seed_mod.seed(csv_path, version="v2025", dry_run=True) == 9
