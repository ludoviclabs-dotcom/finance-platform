"""
test_procurement_calculation.py — moteur Scope 3 catégorie 1 (PR-05B).

PUR (exécuté partout, sans PostgreSQL) : les 5 méthodes de la hiérarchie, leur
ORDRE de priorité, l'absence de fallback silencieux, les conversions d'unités,
l'incertitude, la reproductibilité, l'agrégation d'un run.

DB-gated (CI `migration-tests` uniquement) : run de bout en bout, idempotence,
gate de revue des imports, isolation tenant + défense en profondeur.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available
from models.procurement import CalculationRequest
from services.calculations import procurement as engine

from ._procurement_fixtures import (
    cleanup_emission_factors,
    insert_declaration,
    insert_emission_factor,
    insert_pcf,
    insert_supplier,
    insert_supplier_product,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


# ═══════════════════════════════════════════════════════════════════════════
# PUR — conversions d'unités
# ═══════════════════════════════════════════════════════════════════════════

class TestUnitConversionPure:
    def test_mass_conversion_is_exact_and_traced(self):
        conv = engine.convert_units(2.0, "t", "kg")
        assert conv is not None
        assert conv.value == 2000.0
        assert conv.factor == 1000.0
        assert "dimension masse" in conv.note

    def test_conversion_is_symmetric(self):
        assert engine.convert_units(1500.0, "kg", "t").value == 1.5

    def test_cross_dimension_conversion_refused(self):
        """kg vs kWh : dimensions différentes → refus EXPLICITE, jamais une
        approximation. C'est ce refus qui fait échouer proprement un niveau."""
        assert engine.convert_units(10.0, "kg", "kWh") is None

    def test_unknown_unit_refused(self):
        assert engine.convert_units(10.0, "brouettes", "kg") is None

    def test_missing_unit_refused_not_defaulted(self):
        """Une unité absente n'est jamais remplacée par une unité par défaut."""
        assert engine.convert_units(10.0, None, "kg") is None
        assert engine.normalize_unit(None) is None
        assert engine.normalize_unit("  ") is None

    def test_unit_normalisation_tolerates_case_and_accents(self):
        assert engine.normalize_unit(" KG ") == "kg"
        assert engine.normalize_unit("Unité") == "unite"
        assert engine.unit_dimension("TONNES")[0] == "masse"

    def test_monetary_scaling(self):
        conv = engine.convert_units(2_000_000.0, "EUR", "MEUR")
        assert conv is not None
        assert conv.value == 2.0


# ═══════════════════════════════════════════════════════════════════════════
# PUR — les 5 méthodes et leur ORDRE
# ═══════════════════════════════════════════════════════════════════════════

def _line(**kwargs) -> engine.LineInput:
    base = {"line_id": 1, "supplier_id": 10, "supplier_product_id": 100}
    base.update(kwargs)
    return engine.LineInput(**base)


_VERIFIED_PCF = engine.PcfCandidate(
    pcf_id=7, value_kgco2e=2.5, declared_unit="kg",
    verification_status="third_party_verified", data_status="verified",
)
_SELF_DECLARED_PCF = engine.PcfCandidate(
    pcf_id=8, value_kgco2e=3.0, declared_unit="kg",
    verification_status="self_declared", data_status="manual",
)
_ACCEPTED_INTENSITY = engine.DeclarationCandidate(
    declaration_id=9, metric_code="ghg_intensity_tco2e_per_meur", value=120.0,
    unit="tCO2e/M€", review_status="accepted",
)
_PHYSICAL_FACTOR = engine.FactorCandidate(
    factor_id="EF-ACIER", factor_version="v2025", factor_kgco2e=1.8, unit="kg",
    source="ADEME", category="materials",
)
_SPEND_FACTOR = engine.FactorCandidate(
    factor_id="EF-SPEND", factor_version="v2025", factor_kgco2e=0.25, unit="EUR",
    source="ADEME", category="materials",
)


class TestMethodHierarchyPure:
    def test_level_1_verified_pcf_wins(self):
        comp = engine.compute_line(
            _line(quantity=10.0, unit="kg", spend_amount=500.0, currency="EUR"),
            engine.LineContext(
                pcf=_VERIFIED_PCF, declaration=_ACCEPTED_INTENSITY,
                physical_factor=_PHYSICAL_FACTOR, spend_factor=_SPEND_FACTOR,
            ),
        )
        assert comp.calculation_method == "supplier_pcf_verified"
        assert comp.method_rank == 1
        # 10 kg × 2,5 kgCO2e/kg = 25 kg = 0,025 t
        assert comp.result_tco2e == pytest.approx(0.025)
        # Rang 1 : aucun repli n'a eu lieu, donc aucune raison de repli.
        assert comp.fallback_reason is None

    def test_level_2_when_pcf_not_third_party_verified(self):
        comp = engine.compute_line(
            _line(quantity=10.0, unit="kg", spend_amount=500.0, currency="EUR"),
            engine.LineContext(
                pcf=_SELF_DECLARED_PCF, physical_factor=_PHYSICAL_FACTOR,
                spend_factor=_SPEND_FACTOR,
            ),
        )
        assert comp.calculation_method == "supplier_specific_hybrid"
        assert comp.method_rank == 2
        assert comp.result_tco2e == pytest.approx(0.03)
        assert "non vérifiée par tiers" in comp.fallback_reason

    def test_level_2_via_accepted_supplier_intensity(self):
        comp = engine.compute_line(
            _line(quantity=None, unit=None, spend_amount=2_000_000.0, currency="EUR"),
            engine.LineContext(
                declaration=_ACCEPTED_INTENSITY, spend_factor=_SPEND_FACTOR,
            ),
        )
        assert comp.calculation_method == "supplier_specific_hybrid"
        # 2 M€ × 120 tCO2e/M€ = 240 tCO2e
        assert comp.result_tco2e == pytest.approx(240.0)

    def test_level_3_average_physical_factor(self):
        comp = engine.compute_line(
            _line(quantity=100.0, unit="kg", spend_amount=500.0, currency="EUR"),
            engine.LineContext(physical_factor=_PHYSICAL_FACTOR, spend_factor=_SPEND_FACTOR),
        )
        assert comp.calculation_method == "average_physical"
        assert comp.method_rank == 3
        assert comp.result_tco2e == pytest.approx(0.18)

    def test_level_3_prefers_bom_material_mass_over_line_quantity(self):
        """La masse issue de la nomenclature décrit ce que le produit CONTIENT :
        elle prime sur la quantité de la ligne, et l'origine est tracée."""
        comp = engine.compute_line(
            _line(quantity=1.0, unit="unit"),
            engine.LineContext(
                physical_factor=_PHYSICAL_FACTOR, material_mass_kg=50.0,
                material_label="acier",
            ),
        )
        assert comp.calculation_method == "average_physical"
        assert comp.result_tco2e == pytest.approx(0.09)  # 50 kg × 1,8 / 1000
        assert "masse matière BOM" in comp.conversion_note

    def test_level_4_spend_based_last_resort(self):
        comp = engine.compute_line(
            _line(quantity=None, unit=None, spend_amount=1000.0, currency="EUR"),
            engine.LineContext(spend_factor=_SPEND_FACTOR),
        )
        assert comp.calculation_method == "spend_based_economic"
        assert comp.method_rank == 4
        assert comp.result_tco2e == pytest.approx(0.25)

    def test_level_5_unresolved_has_no_value_at_all(self):
        """Le cœur du contrat : aucune valeur inventée. Pas 0, pas une moyenne."""
        comp = engine.compute_line(
            _line(quantity=None, unit=None, spend_amount=None), engine.LineContext(),
        )
        assert comp.calculation_method == "unresolved"
        assert comp.method_rank == 5
        # `is None`, PAS `== 0` : un trou de donnée n'est pas une émission nulle.
        assert comp.result_tco2e is None
        assert comp.fallback_reason

    def test_incomparable_units_force_fallback_not_a_guess(self):
        """PCF « par kg » face à une ligne en litres : le niveau 1 échoue au lieu
        de rapprocher deux dimensions."""
        comp = engine.compute_line(
            _line(quantity=10.0, unit="l", spend_amount=1000.0, currency="EUR"),
            engine.LineContext(pcf=_VERIFIED_PCF, spend_factor=_SPEND_FACTOR),
        )
        assert comp.calculation_method == "spend_based_economic"
        assert "non comparables" in comp.fallback_reason

    def test_pending_declaration_never_used(self):
        """Gate humain : une déclaration non acceptée en revue n'entre pas dans
        un calcul, même si sa valeur est présente."""
        pending = engine.DeclarationCandidate(
            declaration_id=11, metric_code="ghg_intensity_tco2e_per_meur",
            value=120.0, unit="tCO2e/M€", review_status="pending",
        )
        comp = engine.compute_line(
            _line(spend_amount=1_000_000.0, currency="EUR"),
            engine.LineContext(declaration=pending, spend_factor=_SPEND_FACTOR),
        )
        assert comp.calculation_method == "spend_based_economic"
        assert "non acceptée en revue" in comp.fallback_reason


class TestNoSilentFallbackPure:
    """« Aucun fallback silencieux » — la garantie la plus importante du moteur."""

    @pytest.mark.parametrize(
        "ctx",
        [
            engine.LineContext(spend_factor=_SPEND_FACTOR),
            engine.LineContext(physical_factor=_PHYSICAL_FACTOR),
            engine.LineContext(pcf=_SELF_DECLARED_PCF),
            engine.LineContext(),
        ],
    )
    def test_every_non_rank_1_result_carries_a_reason(self, ctx):
        comp = engine.compute_line(
            _line(quantity=5.0, unit="kg", spend_amount=100.0, currency="EUR"), ctx,
        )
        if comp.method_rank > 1:
            assert comp.fallback_reason, f"{comp.calculation_method} sans raison de repli"
            assert comp.fallback_reason.strip() != ""

    def test_trace_records_every_level_attempted(self):
        """Chaque niveau essayé laisse une trace, retenu ou écarté — c'est ce qui
        rend le repli lisible plutôt que deviné."""
        comp = engine.compute_line(
            _line(quantity=None, spend_amount=1000.0, currency="EUR"),
            engine.LineContext(spend_factor=_SPEND_FACTOR),
        )
        ranks = [step["rank"] for step in comp.method_trace]
        assert ranks == [1, 2, 3, 4]
        assert comp.method_trace[-1]["outcome"] == "selected"
        assert all(s["outcome"] == "rejected" for s in comp.method_trace[:-1])
        assert all(s["reason"] for s in comp.method_trace)

    def test_unresolved_reason_lists_all_four_failures(self):
        comp = engine.compute_line(_line(), engine.LineContext())
        for rank in (1, 2, 3, 4):
            assert f"[{rank}]" in comp.fallback_reason

    def test_method_order_constant_matches_ranks(self):
        """L'ordre de parcours et les rangs déclarés ne peuvent pas diverger."""
        assert [engine.METHOD_RANKS[m] for m in engine.METHOD_ORDER] == [1, 2, 3, 4]
        assert engine.METHOD_RANKS["unresolved"] == 5


class TestUncertaintyAndQualityPure:
    def test_uncertainty_band_widens_as_method_degrades(self):
        profiles = [engine.METHOD_PROFILES[m] for m in engine.METHOD_ORDER]
        uncertainties = [p.uncertainty_pct for p in profiles]
        assert uncertainties == sorted(uncertainties), "l'incertitude doit croître avec le rang"
        qualities = [p.data_quality for p in profiles]
        assert qualities == sorted(qualities, reverse=True), "la qualité doit décroître"

    def test_band_is_computed_around_the_result(self):
        comp = engine.compute_line(
            _line(quantity=10.0, unit="kg"), engine.LineContext(pcf=_VERIFIED_PCF),
        )
        assert comp.uncertainty_pct == 10.0
        assert comp.uncertainty_low_tco2e == pytest.approx(0.025 * 0.9)
        assert comp.uncertainty_high_tco2e == pytest.approx(0.025 * 1.1)

    def test_unresolved_line_has_no_uncertainty_band(self):
        comp = engine.compute_line(_line(), engine.LineContext())
        assert comp.uncertainty_low_tco2e is None
        assert comp.uncertainty_high_tco2e is None

    def test_confidence_is_a_separate_axis_from_data_quality(self):
        """Contrats §2 : confiance et qualité de donnée sont deux GRANDEURS
        distinctes, jamais fusionnées.

        On ne teste pas qu'elles diffèrent pour chaque méthode (elles peuvent
        coïncider par hasard sur une valeur), mais qu'elles ne sont pas le même
        axe recopié : au moins une méthode les sépare, et une ligne calculée
        porte bien les deux champs indépendamment."""
        pairs = [
            (p.confidence, p.data_quality)
            for p in engine.METHOD_PROFILES.values()
            if p.confidence is not None and p.data_quality is not None
        ]
        assert any(c != q for c, q in pairs), "confiance et qualité seraient un seul axe"

        comp = engine.compute_line(
            _line(quantity=10.0, unit="kg"), engine.LineContext(pcf=_VERIFIED_PCF),
        )
        assert comp.confidence is not None
        assert comp.data_quality is not None
        assert comp.data_quality_label


class TestLicensePure:
    def test_restrictive_license_warns_without_hiding_the_value(self):
        """Contrats §8 : usage dérivé non couvert ⇒ avertissement TRACÉ (la
        valeur reste utilisée, la réserve reste visible)."""
        comp = engine.compute_line(
            _line(quantity=10.0, unit="kg"),
            engine.LineContext(
                pcf=_VERIFIED_PCF,
                license=engine.LicenseContext(
                    derived_use_allowed=False, source_code="SRC-X",
                    reasons=("derived_use_allowed=false",),
                ),
            ),
        )
        assert comp.result_tco2e is not None
        assert any("Licence" in w for w in comp.warnings)
        assert any("SRC-X" in w for w in comp.warnings)

    def test_permissive_license_adds_no_noise(self):
        comp = engine.compute_line(
            _line(quantity=10.0, unit="kg"),
            engine.LineContext(
                pcf=_VERIFIED_PCF,
                license=engine.LicenseContext(derived_use_allowed=True, source_code="SRC-OK"),
            ),
        )
        assert not any("Licence" in w for w in comp.warnings)


class TestReproducibilityPure:
    def test_same_inputs_produce_identical_output(self):
        line = _line(quantity=7.3, unit="kg", spend_amount=931.7, currency="EUR")
        ctx = engine.LineContext(pcf=_VERIFIED_PCF, spend_factor=_SPEND_FACTOR)
        first = engine.compute_line(line, ctx)
        second = engine.compute_line(line, ctx)
        assert first == second, "le moteur doit être déterministe au champ près"

    def test_aggregate_is_deterministic(self):
        comps = [
            engine.compute_line(
                _line(line_id=i, quantity=float(i), unit="kg"),
                engine.LineContext(pcf=_VERIFIED_PCF),
            )
            for i in range(1, 6)
        ]
        assert engine.aggregate_run(comps) == engine.aggregate_run(comps)


class TestAggregatePure:
    def test_total_excludes_unresolved_and_flags_partial_coverage(self):
        resolved = engine.compute_line(
            _line(line_id=1, quantity=10.0, unit="kg"), engine.LineContext(pcf=_VERIFIED_PCF),
        )
        unresolved = engine.compute_line(_line(line_id=2), engine.LineContext())
        agg = engine.aggregate_run([resolved, unresolved], {1: 100.0, 2: 400.0})

        assert agg.total_tco2e == pytest.approx(0.025)
        assert agg.resolved_count == 1
        assert agg.unresolved_count == 1
        assert agg.coverage_lines_pct == 50.0
        # 400 € non résolus sur 500 € → 20 % de la dépense couverte
        assert agg.coverage_spend_pct == pytest.approx(20.0)
        assert agg.unresolved_spend_amount == pytest.approx(400.0)
        assert any("non résolue" in w for w in agg.warnings)

    def test_primary_data_share_counts_only_ranks_1_and_2(self):
        pcf_line = engine.compute_line(
            _line(line_id=1, quantity=1.0, unit="kg"), engine.LineContext(pcf=_VERIFIED_PCF),
        )
        spend_line = engine.compute_line(
            _line(line_id=2, spend_amount=100.0, currency="EUR"),
            engine.LineContext(spend_factor=_SPEND_FACTOR),
        )
        agg = engine.aggregate_run([pcf_line, spend_line])
        assert agg.primary_data_share_pct == 50.0
        assert any("facteur monétaire" in w for w in agg.warnings)

    def test_all_unresolved_gives_no_total_not_zero(self):
        comps = [engine.compute_line(_line(line_id=i), engine.LineContext()) for i in (1, 2)]
        agg = engine.aggregate_run(comps)
        assert agg.total_tco2e is None
        assert agg.confidence is None


# ═══════════════════════════════════════════════════════════════════════════
# DB-gated — run de bout en bout, idempotence, gate, isolation
# ═══════════════════════════════════════════════════════════════════════════

def _csv_for(marker: str) -> str:
    """CSV d'achats dont les codes produit sont PROPRES au test appelant.

    `two_companies_proc` est de portée module : fournisseurs et produits
    s'accumulent d'un test à l'autre. Or le mapping automatique de PR-05A
    (`purchase_import_service._auto_map`) résout un code produit par
    `SELECT … WHERE company_id AND product_code` + `fetchone()`, **sans
    `ORDER BY`** — l'unicité portant sur `(company_id, supplier_id,
    product_code)`, plusieurs fournisseurs peuvent partager un code et le
    rattachement devient alors arbitraire. Des codes partagés entre tests les
    feraient échouer pour une raison sans rapport avec la hiérarchie de méthode.

    Ce défaut de PR-05A est documenté au §12bis de la traçabilité PR-05B et
    laissé à une PR dédiée (code mergé, hors périmètre ici) ; on s'en isole en
    donnant à chaque test ses propres codes.

    La 3ᵉ ligne n'a volontairement AUCUN `supplier_products` correspondant et
    porte une catégorie absente du catalogue : elle ressort NON RÉSOLUE.
    """
    return (
        "supplier_code,product_code,date,quantity,unit,spend,currency,category,country\n"
        f"{marker},SKU-{marker}-A,2026-01-15,10,kg,500,EUR,materials,FR\n"
        f"{marker},SKU-{marker}-B,2026-01-16,20,kg,800,EUR,materials,DE\n"
        f"{marker},SKU-{marker}-ORPHELIN,2026-01-17,5,kg,120,EUR,inconnue,FR\n"
    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestCalculationDb:
    @pytest.fixture(autouse=True)
    def _factors(self):
        insert_emission_factor(
            ef_code="EF-MAT-TEST", category="materials", factor_kgco2e=1.8, unit="kg",
        )
        insert_emission_factor(
            ef_code="EF-MAT-SPEND-TEST", category="materials", factor_kgco2e=0.25, unit="EUR",
        )
        yield
        cleanup_emission_factors()

    def _validated_import(
        self, company_id: int, marker: str, csv_text: str | None = None,
    ) -> int:
        """Import d'achats passé au gate de revue.

        Par défaut le contenu est construit depuis le marqueur (`_csv_for`).
        `csv_text` permet à un test d'apporter son propre CSV — cas de
        l'intensité fournisseur, qui a besoin d'une ligne SANS quantité pour
        forcer la voie « dépense » du niveau 2.
        """
        from services.procurement import purchase_import_service as imports

        content = csv_text if csv_text is not None else _csv_for(marker)
        imp = imports.create_import(
            company_id=company_id, filename=f"{marker}.csv",
            content=content.encode("utf-8"),
        )
        imports.review_import(company_id=company_id, import_id=imp.id, accept=True)
        return imp.id

    def _products_for(self, company_id: int, marker: str) -> tuple[int, int]:
        """Fournisseur + ses deux produits, aux codes propres au marqueur."""
        supplier = insert_supplier(company_id, f"Fournisseur {marker}")
        product_a = insert_supplier_product(
            company_id, supplier, f"SKU-{marker}-A", category_code="materials",
        )
        insert_supplier_product(
            company_id, supplier, f"SKU-{marker}-B", category_code="materials",
        )
        return supplier, product_a

    def test_run_applies_hierarchy_and_keeps_unresolved(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, _ = two_companies_proc
        _, product_a = self._products_for(cid_a, "CALC")
        insert_pcf(cid_a, product_a, value_kgco2e=2.5, declared_unit="kg")

        import_id = self._validated_import(cid_a, "CALC")
        run = runs.calculate(
            company_id=cid_a, payload=CalculationRequest(import_id=import_id),
        )

        assert run.line_count == 3
        assert run.status == "calculated"

        lines, total = runs.list_line_results(company_id=cid_a, run_id=run.id, limit=100)
        assert total == 3
        methods = {line_.purchase_line_id: line_ for line_ in lines}
        by_method = {line_.calculation_method for line_ in lines}

        # SKU-A a une PCF vérifiée → rang 1 ; SKU-B n'en a pas mais a une
        # catégorie connue → facteur physique ; la 3e ligne n'est pas mappée et
        # sa catégorie est inconnue → non résolue, CONSERVÉE.
        assert "supplier_pcf_verified" in by_method
        assert "unresolved" in by_method
        assert run.unresolved_count >= 1

        for line_ in methods.values():
            if line_.method_rank > 1:
                assert line_.fallback_reason, "aucun repli ne peut être silencieux"
            if line_.calculation_method == "unresolved":
                assert line_.result_tco2e is None

    def test_run_is_idempotent_on_identical_inputs(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, _ = two_companies_proc
        self._products_for(cid_a, "IDEM")
        import_id = self._validated_import(cid_a, "IDEM")

        first = runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=import_id))
        second = runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=import_id))

        assert second.already_calculated is True
        assert second.id == first.id
        assert second.input_fingerprint == first.input_fingerprint

        _, total = runs.list_line_results(company_id=cid_a, run_id=first.id, limit=200)
        assert total == first.line_count, "aucune ligne dupliquée au re-calcul"

    def test_force_recalculate_supersedes_instead_of_deleting(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, _ = two_companies_proc
        self._products_for(cid_a, "FORCE")
        import_id = self._validated_import(cid_a, "FORCE")

        first = runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=import_id))
        second = runs.calculate(
            company_id=cid_a,
            payload=CalculationRequest(import_id=import_id, force_recalculate=True),
        )
        assert second.id != first.id
        assert runs.get_run(company_id=cid_a, run_id=first.id).status == "superseded"

    def test_pending_import_cannot_be_calculated(self, two_companies_proc):
        """Gate humain : un import non revu n'alimente jamais le Scope 3."""
        from services.procurement import calculation_run_service as runs
        from services.procurement import purchase_import_service as imports

        cid_a, _ = two_companies_proc
        imp = imports.create_import(
            company_id=cid_a, filename="pending.csv",
            content=_csv_for("PENDING").encode("utf-8"),
        )
        with pytest.raises(runs.ProcurementCalculationError, match="validé"):
            runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=imp.id))

    def test_coverage_exposes_unresolved_alongside_total(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, _ = two_companies_proc
        self._products_for(cid_a, "COUV")
        import_id = self._validated_import(cid_a, "COUV")
        run = runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=import_id))

        coverage = runs.get_coverage(company_id=cid_a, run_id=run.id)
        assert coverage.line_count == 3
        assert coverage.unresolved_count >= 1
        assert coverage.coverage_lines_pct < 100.0
        assert sum(m.line_count for m in coverage.methods) == coverage.line_count

    def test_trace_walks_purchase_to_factor(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, _ = two_companies_proc
        _, product = self._products_for(cid_a, "TRACE")
        insert_pcf(cid_a, product, value_kgco2e=2.5, declared_unit="kg")
        import_id = self._validated_import(cid_a, "TRACE")
        run = runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=import_id))

        lines, _ = runs.list_line_results(company_id=cid_a, run_id=run.id, limit=100)
        target = next(line_ for line_ in lines if line_.calculation_method != "unresolved")
        trace = runs.get_trace(
            company_id=cid_a, run_id=run.id, line_id=target.purchase_line_id,
        )
        levels = [s.level for s in trace.steps]
        assert "purchase_line" in levels
        assert "factor" in levels
        assert trace.method_trace, "la hiérarchie parcourue doit être exposée"

    def test_approved_run_seals_a_fact(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, _ = two_companies_proc
        self._products_for(cid_a, "APPRO")
        import_id = self._validated_import(cid_a, "APPRO")
        run = runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=import_id))

        approved = runs.approve_run(company_id=cid_a, run_id=run.id, approved_by=1)
        assert approved.status == "approved"
        assert approved.approved_at is not None

        # Ré-approbation refusée : transition stricte, pas de re-approbation muette.
        with pytest.raises(runs.ProcurementCalculationError):
            runs.approve_run(company_id=cid_a, run_id=run.id)

    def test_declaration_intensity_used_when_accepted(self, two_companies_proc):
        """Niveau 2 par l'intensité GES déclarée × dépense.

        Le code produit est PROPRE À CE TEST (`SKU-INTENSITY`) et non le `SKU-A`
        partagé : `two_companies_proc` est de portée module, donc plusieurs
        fournisseurs du même tenant finiraient par porter un `SKU-A`. Le mapping
        automatique de PR-05A (`_auto_map`) sélectionne alors un
        `supplier_products` sans `ORDER BY` — la ligne pourrait être rattachée à
        un autre fournisseur que celui portant la déclaration, et le test
        échouerait pour une raison sans rapport avec la hiérarchie de méthode.
        """
        from services.procurement import calculation_run_service as runs

        cid_a, _ = two_companies_proc
        supplier = insert_supplier(cid_a, "Fournisseur Intensité")
        insert_supplier_product(cid_a, supplier, "SKU-INTENSITY", category_code="materials")
        insert_declaration(
            cid_a, supplier, metric_code="ghg_intensity_tco2e_per_meur", value=100.0,
        )
        # Ligne SANS quantité ni unité : la voie « PCF » du niveau 2 est
        # inapplicable, seule la voie « intensité × dépense » peut répondre.
        csv = (
            "supplier_code,product_code,date,quantity,unit,spend,currency,category,country\n"
            "F-INT,SKU-INTENSITY,2026-02-01,,,1000000,EUR,materials,FR\n"
        )
        import_id = self._validated_import(cid_a, "INTENSITY", csv)
        run = runs.calculate(company_id=cid_a, payload=CalculationRequest(import_id=import_id))
        lines, _ = runs.list_line_results(company_id=cid_a, run_id=run.id)
        # 1 M€ × 100 tCO2e/M€ = 100 tCO2e
        assert lines[0].calculation_method == "supplier_specific_hybrid"
        assert lines[0].result_tco2e == pytest.approx(100.0)


@_skip_no_db_url
@_skip_no_psycopg2
class TestCalculationIsolationDb:
    """Isolation tenant — RLS gen-2 + défense en profondeur applicative.

    En CI, PostgreSQL se connecte en superuser et BYPASSE la RLS (FORCE
    compris) : seul le prédicat `company_id = %s` porté par chaque requête de
    service fait tenir ces assertions. C'est précisément ce qu'elles vérifient.
    """

    @pytest.fixture(autouse=True)
    def _factors(self):
        insert_emission_factor(
            ef_code="EF-ISO-TEST", category="materials", factor_kgco2e=1.0, unit="kg",
        )
        yield
        cleanup_emission_factors()

    def _run_for(self, company_id: int, marker: str) -> int:
        from services.procurement import calculation_run_service as runs
        from services.procurement import purchase_import_service as imports

        supplier = insert_supplier(company_id, f"Fournisseur {marker}")
        insert_supplier_product(
            company_id, supplier, f"SKU-{marker}-A", category_code="materials",
        )
        imp = imports.create_import(
            company_id=company_id, filename=f"{marker}.csv",
            content=_csv_for(marker).encode("utf-8"),
        )
        imports.review_import(company_id=company_id, import_id=imp.id, accept=True)
        return runs.calculate(
            company_id=company_id, payload=CalculationRequest(import_id=imp.id),
        ).id

    def test_tenant_b_cannot_read_tenant_a_run(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, cid_b = two_companies_proc
        run_a = self._run_for(cid_a, "ISO-A")
        with pytest.raises(runs.ProcurementCalculationError, match="introuvable"):
            runs.get_run(company_id=cid_b, run_id=run_a)

    def test_tenant_b_cannot_list_tenant_a_line_results(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, cid_b = two_companies_proc
        run_a = self._run_for(cid_a, "ISO-C")
        with pytest.raises(runs.ProcurementCalculationError, match="introuvable"):
            runs.list_line_results(company_id=cid_b, run_id=run_a)

    def test_tenant_b_cannot_read_tenant_a_coverage_or_trace(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, cid_b = two_companies_proc
        run_a = self._run_for(cid_a, "ISO-D")
        with pytest.raises(runs.ProcurementCalculationError, match="introuvable"):
            runs.get_coverage(company_id=cid_b, run_id=run_a)
        with pytest.raises(runs.ProcurementCalculationError, match="introuvable"):
            runs.get_trace(company_id=cid_b, run_id=run_a, line_id=1)

    def test_runs_list_is_scoped_per_tenant(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, cid_b = two_companies_proc
        run_a = self._run_for(cid_a, "ISO-E")
        items_b, _ = runs.list_runs(company_id=cid_b, limit=200)
        assert all(item.id != run_a for item in items_b)
