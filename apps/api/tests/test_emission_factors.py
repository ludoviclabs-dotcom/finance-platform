"""
test_emission_factors.py — Tests unitaires pour le catalogue emission_factors.

Stratégie :
  - Vérifie l'intégrité des données embarquées (≥500, factor_kgco2e ≥ 0, codes uniques)
  - Teste l'endpoint GET /factors si la DB est disponible (sinon skip)
  - Teste le endpoint GET /factors/{ef_code} sur un facteur connu

Ces tests ne nécessitent PAS de base de données (données embarquées testées en mémoire).
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

# ── Charger le module seed sans exécuter __main__ ────────────────────────────
_SEED_PATH = Path(__file__).parent.parent / "scripts" / "seed_factors.py"


def _load_seed_module():
    spec = importlib.util.spec_from_file_location("seed_factors", _SEED_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def seed_module():
    return _load_seed_module()


@pytest.fixture(scope="module")
def all_factors(seed_module):
    return seed_module._collect_all_factors()


# ── Tests sur les données embarquées ─────────────────────────────────────────

class TestEmbeddedFactors:
    def test_count_at_least_500(self, all_factors):
        assert len(all_factors) >= 500, (
            f"Seulement {len(all_factors)} facteurs embarqués — DoD exige ≥500"
        )

    def test_all_factor_kgco2e_non_negative(self, all_factors):
        negatives = [
            f[0] for f in all_factors if f[4] is not None and f[4] < 0
        ]
        assert not negatives, f"Facteurs avec kgCO2e négatif : {negatives[:5]}"

    def test_no_empty_ef_code(self, all_factors):
        empties = [f for f in all_factors if not f[0] or not f[0].strip()]
        assert not empties, "Des ef_code vides trouvés"

    def test_no_empty_label(self, all_factors):
        empties = [f[0] for f in all_factors if not f[1] or not f[1].strip()]
        assert not empties, f"Des labels vides trouvés : {empties[:3]}"

    def test_unique_ef_codes(self, all_factors):
        codes = [f[0] for f in all_factors]
        duplicates = [c for c in set(codes) if codes.count(c) > 1]
        assert not duplicates, f"ef_code dupliqués : {duplicates[:5]}"

    def test_all_codes_start_with_ademe(self, all_factors):
        bad = [f[0] for f in all_factors if not f[0].startswith("ADEME.")]
        assert not bad, f"Codes non-ADEME : {bad[:5]}"

    def test_scopes_valid(self, all_factors):
        invalid_scopes = [
            f[0] for f in all_factors
            if f[2] is not None and f[2] not in (1, 2, 3)
        ]
        assert not invalid_scopes, f"Scopes invalides (doit être 1, 2, 3 ou None) : {invalid_scopes[:5]}"

    def test_unit_non_empty(self, all_factors):
        no_unit = [f[0] for f in all_factors if not f[5] or not f[5].strip()]
        assert not no_unit, f"Facteurs sans unité : {no_unit[:5]}"

    def test_category_non_empty(self, all_factors):
        no_cat = [f[0] for f in all_factors if not f[3] or not f[3].strip()]
        assert not no_cat, f"Facteurs sans catégorie : {no_cat[:5]}"

    def test_scope_coverage(self, all_factors):
        """Vérifie qu'on a des facteurs pour les 3 scopes."""
        s1 = [f for f in all_factors if f[2] == 1]
        s2 = [f for f in all_factors if f[2] == 2]
        s3 = [f for f in all_factors if f[2] == 3]
        assert len(s1) >= 20, f"Pas assez de facteurs Scope 1 : {len(s1)}"
        assert len(s2) >= 10, f"Pas assez de facteurs Scope 2 : {len(s2)}"
        assert len(s3) >= 50, f"Pas assez de facteurs Scope 3 : {len(s3)}"

    def test_category_coverage(self, all_factors):
        """Vérifie qu'on couvre les catégories clés."""
        categories = {f[3] for f in all_factors}
        required = {"energy", "transport", "materials", "waste", "food"}
        missing = required - categories
        assert not missing, f"Catégories manquantes : {missing}"

    def test_key_factors_present(self, all_factors):
        """Quelques facteurs emblématiques ADEME doivent être présents."""
        codes = {f[0] for f in all_factors}
        must_have = [
            "ADEME.2025.ELEC.FR",
            "ADEME.2025.COMBUST.GAZ_NAT",
            "ADEME.2025.TRANSP.VP_THER_MOY",
            "ADEME.2025.ALIM.BOEUF_FR",
            "ADEME.2025.REFRIG.R410A",
        ]
        missing = [c for c in must_have if c not in codes]
        assert not missing, f"Facteurs clés manquants : {missing}"

    def test_electricity_fr_value(self, all_factors):
        """Électricité France ≈ 0.051 kgCO2e/kWh (valeur ADEME 2025)."""
        elec_fr = next((f for f in all_factors if f[0] == "ADEME.2025.ELEC.FR"), None)
        assert elec_fr is not None, "ADEME.2025.ELEC.FR introuvable"
        assert 0.04 <= elec_fr[4] <= 0.08, (
            f"Valeur électricité FR inattendue : {elec_fr[4]} kgCO2e/kWh (attendu ≈ 0.05)"
        )

    def test_dry_run_returns_count(self, seed_module):
        """dry_run doit retourner ≥500 sans erreur."""
        count = seed_module.seed(dry_run=True)
        assert count >= 500


# ── Tests endpoint /factors (nécessite DB + API) ─────────────────────────────

@pytest.mark.skipif(
    not __import__("os").environ.get("DATABASE_URL"),
    reason="Pas de DATABASE_URL — tests API /factors skippés",
)
class TestFactorsEndpoint:
    def test_list_factors_returns_200(self, client):
        resp = client.get("/factors?limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert data["total"] >= 500

    def test_list_factors_pagination(self, client):
        resp1 = client.get("/factors?limit=5&offset=0")
        resp2 = client.get("/factors?limit=5&offset=5")
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        ids1 = [i["id"] for i in resp1.json()["items"]]
        ids2 = [i["id"] for i in resp2.json()["items"]]
        assert not set(ids1) & set(ids2), "Les deux pages ne doivent pas se chevaucher"

    def test_filter_by_scope(self, client):
        resp = client.get("/factors?scope=1&limit=50")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(i["scope"] == 1 for i in items)

    def test_filter_by_version(self, client):
        resp = client.get("/factors?version=v2025.0&limit=10")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(i["version"] == "v2025.0" for i in items)

    def test_get_by_ef_code(self, client):
        resp = client.get("/factors/ADEME.2025.ELEC.FR?version=v2025.0")
        assert resp.status_code == 200
        factor = resp.json()
        assert factor["ef_code"] == "ADEME.2025.ELEC.FR"
        assert factor["factor_kgco2e"] > 0
        assert factor["unit"] == "kWh"

    def test_unknown_ef_code_returns_404(self, client):
        resp = client.get("/factors/ADEME.2025.INEXISTANT")
        assert resp.status_code == 404
