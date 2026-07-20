"""
test_procurement_hotspots.py — détection, sélection humaine et campagne (PR-05B).

PUR : garde de dimension inconnue (lève AVANT tout accès base).
DB-gated (CI `migration-tests`) : classement déterministe, part non résolue
visible, sélection idempotente, contrôles de création de campagne, isolation
tenant + défense en profondeur.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available
from models.procurement import (
    CalculationRequest,
    CampaignFromHotspotRequest,
    HotspotSelectionCreate,
)
from services.procurement import hotspots_service

from ._procurement_fixtures import (
    cleanup_emission_factors,
    insert_emission_factor,
    insert_supplier,
    insert_supplier_product,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")

def _csv_for(marker: str) -> str:
    """CSV d'achats dont les codes produit sont PROPRES au test appelant.

    `two_companies_proc` est de portée module : les fournisseurs et produits
    s'accumulent d'un test à l'autre. Or le mapping automatique de PR-05A
    (`purchase_import_service._auto_map`) résout un code produit par
    `SELECT … WHERE company_id AND product_code` + `fetchone()`, **sans
    `ORDER BY`** — l'unicité portant sur `(company_id, supplier_id,
    product_code)`, plusieurs fournisseurs peuvent partager un code et le
    rattachement devient arbitraire. Des codes partagés entre tests feraient
    donc échouer ces tests pour une raison sans rapport avec les hotspots.

    Ce défaut de PR-05A est documenté en §12bis de la traçabilité PR-05B et
    laissé à une PR dédiée (code mergé, hors périmètre ici) ; on s'en isole en
    donnant à chaque test ses propres codes.

    La 3ᵉ ligne n'a volontairement AUCUN `supplier_products` correspondant :
    elle reste non mappée et alimente le groupe « non rattaché » du classement.
    """
    return (
        "supplier_code,product_code,date,quantity,unit,spend,currency,category,country\n"
        f"{marker},SKU-{marker}-A,2026-01-15,100,kg,5000,EUR,materials,FR\n"
        f"{marker},SKU-{marker}-B,2026-01-16,10,kg,800,EUR,materials,DE\n"
        f"{marker},SKU-{marker}-ORPHELIN,2026-01-17,5,kg,120,EUR,inconnue,\n"
    )


# ── PUR : gardes de dimension ────────────────────────────────────────────────

class TestHotspotGuardsPure:
    def test_unknown_hotspot_dimension_rejected(self):
        with pytest.raises(hotspots_service.HotspotError, match="inconnue"):
            hotspots_service.detect_hotspots(
                company_id=1, run_id=1, hotspot_type="astrologie",
            )

    def test_unknown_exposure_dimension_rejected(self):
        with pytest.raises(hotspots_service.HotspotError, match="inconnue"):
            hotspots_service.get_exposure(company_id=1, run_id=1, dimension="lunaire")


# ── DB-gated ────────────────────────────────────────────────────────────────

@_skip_no_db_url
@_skip_no_psycopg2
class TestHotspotsDb:
    @pytest.fixture(autouse=True)
    def _factors(self):
        insert_emission_factor(
            ef_code="EF-HOT-TEST", category="materials", factor_kgco2e=2.0, unit="kg",
        )
        yield
        cleanup_emission_factors()

    def _run(self, company_id: int, marker: str) -> tuple[int, int]:
        """Crée un run calculable ISOLÉ et renvoie (run_id, supplier_id)."""
        from services.procurement import calculation_run_service as runs
        from services.procurement import purchase_import_service as imports

        supplier = insert_supplier(company_id, f"Fournisseur {marker}")
        insert_supplier_product(
            company_id, supplier, f"SKU-{marker}-A", category_code="materials",
        )
        insert_supplier_product(
            company_id, supplier, f"SKU-{marker}-B", category_code="materials",
        )
        imp = imports.create_import(
            company_id=company_id, filename=f"{marker}.csv",
            content=_csv_for(marker).encode("utf-8"),
        )
        imports.review_import(company_id=company_id, import_id=imp.id, accept=True)
        run = runs.calculate(
            company_id=company_id, payload=CalculationRequest(import_id=imp.id),
        )
        return run.id, supplier

    def test_hotspots_ranked_and_expose_unresolved_share(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-A")

        data = hotspots_service.detect_hotspots(
            company_id=cid_a, run_id=run_id, hotspot_type="supplier",
        )
        assert data.items, "au moins un hotspot fournisseur attendu"
        contributions = [
            h.contribution_tco2e for h in data.items if h.contribution_tco2e is not None
        ]
        assert contributions == sorted(contributions, reverse=True)
        assert [h.rank_position for h in data.items] == list(range(1, len(data.items) + 1))
        # La part non résolue est TOUJOURS exposée, jamais masquée.
        assert all(h.unresolved_line_count >= 0 for h in data.items)

    def test_detection_is_deterministic(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-DET")
        first = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_id)
        second = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_id)
        assert [h.hotspot_key for h in first.items] == [h.hotspot_key for h in second.items]

    def test_unmapped_lines_form_a_visible_unknown_bucket(self, two_companies_proc):
        """Une ligne sans fournisseur rattaché doit RESTER au classement.

        Elle est regroupée sous une clé stable (`inconnu`) avec sa dépense et ses
        lignes non résolues : un poste non rattaché qui disparaîtrait du
        classement serait exactement le trou silencieux que cette PR s'interdit.
        Aucune campagne n'est possible dessus — il n'y a personne à interroger.
        """
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-UNMAP")
        data = hotspots_service.detect_hotspots(
            company_id=cid_a, run_id=run_id, hotspot_type="supplier",
        )
        unknown = next(
            (h for h in data.items if h.hotspot_key == hotspots_service.UNKNOWN_KEY), None,
        )
        assert unknown is not None, "le groupe « non rattaché » doit rester visible"
        assert unknown.supplier_id is None
        assert unknown.unresolved_line_count >= 1

        selection = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_id, hotspot_type="supplier",
                hotspot_key=hotspots_service.UNKNOWN_KEY,
            ),
        )
        with pytest.raises(hotspots_service.HotspotError, match="sans fournisseur"):
            hotspots_service.create_campaign_from_selection(
                company_id=cid_a, selection_id=selection.id,
                payload=CampaignFromHotspotRequest(campaign_name="Sans destinataire"),
            )

    def test_category_dimension_keeps_uncategorised_bucket(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-CAT")
        data = hotspots_service.detect_hotspots(
            company_id=cid_a, run_id=run_id, hotspot_type="category",
        )
        keys = {h.hotspot_key for h in data.items}
        assert "materials" in keys
        # La catégorie inconnue reste visible plutôt que d'être écartée du total.
        assert "inconnue" in keys or "non_categorise" in keys

    def test_selection_is_human_and_idempotent(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, supplier = self._run(cid_a, "HOT-SEL")
        data = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_id)
        key = data.items[0].hotspot_key

        first = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_id, hotspot_type="supplier", hotspot_key=key,
                selection_reason="Premier contributeur",
            ),
            selected_by=1,
        )
        assert first.selection_status == "selected"
        assert first.supplier_id == supplier

        second = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_id, hotspot_type="supplier", hotspot_key=key,
                selection_status="dismissed", selection_reason="Finalement écarté",
            ),
            selected_by=1,
        )
        assert second.id == first.id, "re-sélectionner met à jour, n'empile pas"
        assert second.selection_status == "dismissed"

        items, total = hotspots_service.list_selections(company_id=cid_a, run_id=run_id)
        assert total == 1
        assert items[0].selection_status == "dismissed"

    def test_selection_figures_come_from_the_run_not_the_client(self, two_companies_proc):
        """Le client ne fournit qu'une clé : contribution et rang sont RELUS
        depuis le run, donc infalsifiables depuis l'extérieur."""
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-FIG")
        data = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_id)
        top = data.items[0]

        selection = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_id, hotspot_type="supplier", hotspot_key=top.hotspot_key,
            ),
        )
        assert selection.contribution_tco2e == top.contribution_tco2e
        assert selection.rank_position == top.rank_position

    def test_unknown_hotspot_key_rejected(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-UNK")
        with pytest.raises(hotspots_service.HotspotError, match="introuvable"):
            hotspots_service.select_hotspot(
                company_id=cid_a,
                payload=HotspotSelectionCreate(
                    run_id=run_id, hotspot_type="supplier", hotspot_key="999999",
                ),
            )

    def test_campaign_created_from_selected_supplier_hotspot(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, supplier = self._run(cid_a, "HOT-CAMP")
        data = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_id)
        selection = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_id, hotspot_type="supplier",
                hotspot_key=data.items[0].hotspot_key,
            ),
        )

        result = hotspots_service.create_campaign_from_selection(
            company_id=cid_a, selection_id=selection.id,
            payload=CampaignFromHotspotRequest(
                campaign_name="Collecte hotspot 2026", exercise_year=2026,
            ),
            created_by="analyst@test.fr",
        )
        assert result.campaign_id > 0
        assert supplier in result.invited_supplier_ids
        assert result.selection.selection_status == "campaign_created"
        assert result.selection.campaign_id == result.campaign_id

    def test_campaign_refused_on_dismissed_selection(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-DISM")
        data = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_id)
        selection = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_id, hotspot_type="supplier",
                hotspot_key=data.items[0].hotspot_key, selection_status="dismissed",
            ),
        )
        with pytest.raises(hotspots_service.HotspotError, match="retenue"):
            hotspots_service.create_campaign_from_selection(
                company_id=cid_a, selection_id=selection.id,
                payload=CampaignFromHotspotRequest(campaign_name="Refusée"),
            )

    def test_campaign_refused_on_non_supplier_hotspot(self, two_companies_proc):
        """Une campagne cible quelqu'un : un hotspot « catégorie » n'a personne
        à interroger au bout."""
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-NOSUP")
        data = hotspots_service.detect_hotspots(
            company_id=cid_a, run_id=run_id, hotspot_type="category",
        )
        selection = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_id, hotspot_type="category",
                hotspot_key=data.items[0].hotspot_key,
            ),
        )
        with pytest.raises(hotspots_service.HotspotError, match="fournisseur"):
            hotspots_service.create_campaign_from_selection(
                company_id=cid_a, selection_id=selection.id,
                payload=CampaignFromHotspotRequest(campaign_name="Sans cible"),
            )

    def test_country_exposure_keeps_unknown_origin(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id, _ = self._run(cid_a, "HOT-GEO")
        data = hotspots_service.get_exposure(
            company_id=cid_a, run_id=run_id, dimension="countries",
        )
        keys = {row.key for row in data.items}
        assert "FR" in keys
        assert "inconnu" in keys, "une origine inconnue reste visible"


@_skip_no_db_url
@_skip_no_psycopg2
class TestHotspotsIsolationDb:
    """Isolation tenant : le PostgreSQL de CI bypasse la RLS (superuser), donc
    ces assertions vérifient la défense en profondeur applicative."""

    @pytest.fixture(autouse=True)
    def _factors(self):
        insert_emission_factor(
            ef_code="EF-HOTISO-TEST", category="materials", factor_kgco2e=2.0, unit="kg",
        )
        yield
        cleanup_emission_factors()

    def _run(self, company_id: int, marker: str) -> int:
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

    def test_tenant_b_cannot_detect_on_tenant_a_run(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        run_a = self._run(cid_a, "HISO-A")
        with pytest.raises(hotspots_service.HotspotError, match="introuvable"):
            hotspots_service.detect_hotspots(company_id=cid_b, run_id=run_a)

    def test_tenant_b_cannot_select_on_tenant_a_run(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        run_a = self._run(cid_a, "HISO-B")
        with pytest.raises(hotspots_service.HotspotError, match="introuvable"):
            hotspots_service.select_hotspot(
                company_id=cid_b,
                payload=HotspotSelectionCreate(
                    run_id=run_a, hotspot_type="supplier", hotspot_key="1",
                ),
            )

    def test_tenant_b_cannot_turn_tenant_a_selection_into_a_campaign(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        run_a = self._run(cid_a, "HISO-C")
        data = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_a)
        selection = hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_a, hotspot_type="supplier",
                hotspot_key=data.items[0].hotspot_key,
            ),
        )
        with pytest.raises(hotspots_service.HotspotError, match="introuvable"):
            hotspots_service.create_campaign_from_selection(
                company_id=cid_b, selection_id=selection.id,
                payload=CampaignFromHotspotRequest(campaign_name="Vol de hotspot"),
            )

    def test_selections_list_is_scoped(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        run_a = self._run(cid_a, "HISO-D")
        data = hotspots_service.detect_hotspots(company_id=cid_a, run_id=run_a)
        hotspots_service.select_hotspot(
            company_id=cid_a,
            payload=HotspotSelectionCreate(
                run_id=run_a, hotspot_type="supplier",
                hotspot_key=data.items[0].hotspot_key,
            ),
        )
        _, total_b = hotspots_service.list_selections(company_id=cid_b, run_id=run_a)
        assert total_b == 0
