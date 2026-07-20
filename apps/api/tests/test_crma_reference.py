"""
test_crma_reference.py — référentiels matières CRMA (PR-07).

DB-gated : groupes, statut critique vs stratégique (NON exclusif), vocabulaire
des étapes semé par la migration 034, substituts, filières de recyclage,
événements, et isolation tenant / lecture des lignes globales.

Ces tests sont SKIPPÉS sans `DATABASE_URL` (mode /tmp) — le job CI
`migration-tests` de `.github/workflows/api.yml` est le seul à les exécuter
contre un vrai PostgreSQL.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.crma import (
    GROUP_CODE_CRITICAL,
    GROUP_CODE_STRATEGIC,
    MaterialGroupCreate,
    RecyclingRouteCreate,
    SubstituteCreate,
    TradeEventCreate,
)
from services.crma import reference_service

from ._crma_fixtures import MATERIAL_ND, MATERIAL_SM, insert_source_with_license

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(
    not db_available(), reason="psycopg2/PostgreSQL non disponible"
)


@_skip_no_db_url
@_skip_no_psycopg2
class TestValueChainVocabulary:
    """La migration 034 sème 8 étapes GLOBALES (company_id NULL)."""

    def test_eight_ordered_stages_are_seeded_globally(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        stages = reference_service.list_stages(company_id=cid_a, limit=100)
        codes = [s.code for s in stages.items]
        assert codes == [
            "extraction", "separation", "refining", "metal_alloy",
            "powder", "magnet", "component", "product",
        ]
        # Lignes globales : lisibles par le tenant sans lui appartenir.
        assert all(s.company_id is None for s in stages.items)

    def test_stage_order_is_strictly_increasing(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        orders = [s.stage_order for s in reference_service.list_stages(company_id=cid_a, limit=100).items]
        assert orders == sorted(orders)
        assert len(set(orders)) == len(orders)

    def test_only_extraction_and_separation_are_upstream(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        stages = reference_service.list_stages(company_id=cid_a, limit=100).items
        upstream = {s.code for s in stages if s.is_upstream}
        assert upstream == {"extraction", "separation"}
        # Le raffinage n'est PAS de l'amont extractif — c'est ce qui interdit
        # de le confondre avec l'extraction dans les agrégats.
        assert "refining" not in upstream

    def test_both_tenants_see_the_same_global_stages(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        a = [s.code for s in reference_service.list_stages(company_id=cid_a, limit=100).items]
        b = [s.code for s in reference_service.list_stages(company_id=cid_b, limit=100).items]
        assert a == b


@_skip_no_db_url
@_skip_no_psycopg2
class TestCriticalVersusStrategic:
    """Statut NON EXCLUSIF : toute matière stratégique est aussi critique."""

    @staticmethod
    def _ensure_groups(cid: int) -> None:
        for code, label in (
            (GROUP_CODE_CRITICAL, "Matières critiques UE"),
            (GROUP_CODE_STRATEGIC, "Matières stratégiques UE"),
        ):
            try:
                reference_service.create_group(
                    company_id=cid,
                    payload=MaterialGroupCreate(
                        code=code, label=label, group_kind="regulatory",
                        regulation_version="CRMA-2024",
                    ),
                )
            except reference_service.CrmaReferenceError:
                pass  # déjà créé par un test précédent du module

    def test_material_can_be_both_critical_and_strategic(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        self._ensure_groups(cid_a)
        reference_service.add_material_to_group(
            company_id=cid_a, group_code=GROUP_CODE_CRITICAL, material_id=MATERIAL_ND
        )
        reference_service.add_material_to_group(
            company_id=cid_a, group_code=GROUP_CODE_STRATEGIC, material_id=MATERIAL_ND
        )
        status = reference_service.get_material_status(company_id=cid_a, material_id=MATERIAL_ND)
        # Les deux booléens sont vrais EN MÊME TEMPS — c'est le point.
        assert status.is_critical_eu is True
        assert status.is_strategic_eu is True
        assert status.strategic_not_critical is False
        assert status.regulation_version == "CRMA-2024"

    def test_critical_without_strategic_is_valid(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        self._ensure_groups(cid_a)
        reference_service.add_material_to_group(
            company_id=cid_a, group_code=GROUP_CODE_CRITICAL, material_id="test-critical-only"
        )
        status = reference_service.get_material_status(
            company_id=cid_a, material_id="test-critical-only"
        )
        assert status.is_critical_eu is True
        assert status.is_strategic_eu is False
        assert status.strategic_not_critical is False

    def test_strategic_without_critical_is_flagged_not_silently_fixed(self, two_companies_crma):
        """Une matière stratégique non critique est une INCOHÉRENCE de
        référentiel : elle doit remonter, pas être corrigée en douce."""
        cid_a, _ = two_companies_crma
        self._ensure_groups(cid_a)
        reference_service.add_material_to_group(
            company_id=cid_a, group_code=GROUP_CODE_STRATEGIC, material_id="test-broken"
        )
        status = reference_service.get_material_status(company_id=cid_a, material_id="test-broken")
        assert status.is_strategic_eu is True
        assert status.is_critical_eu is False
        assert status.strategic_not_critical is True

    def test_unknown_material_has_no_status(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        status = reference_service.get_material_status(company_id=cid_a, material_id="inconnue")
        assert status.is_critical_eu is False
        assert status.is_strategic_eu is False
        assert status.group_codes == []

    def test_group_membership_is_not_visible_across_tenants(self, two_companies_crma):
        """Isolation : le statut du tenant A ne teinte pas celui du tenant B."""
        cid_a, cid_b = two_companies_crma
        self._ensure_groups(cid_a)
        reference_service.add_material_to_group(
            company_id=cid_a, group_code=GROUP_CODE_CRITICAL, material_id="test-isolated"
        )
        status_b = reference_service.get_material_status(
            company_id=cid_b, material_id="test-isolated"
        )
        assert status_b.is_critical_eu is False

    def test_duplicate_group_code_rejected(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        reference_service.create_group(
            company_id=cid_a,
            payload=MaterialGroupCreate(code="test-dup", label="Doublon"),
        )
        with pytest.raises(reference_service.CrmaReferenceError):
            reference_service.create_group(
                company_id=cid_a,
                payload=MaterialGroupCreate(code="test-dup", label="Doublon bis"),
            )

    def test_unknown_group_rejected(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        with pytest.raises(reference_service.CrmaReferenceError, match="introuvable"):
            reference_service.add_material_to_group(
                company_id=cid_a, group_code="groupe-fantome", material_id=MATERIAL_ND
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestSubstitutesAndRecycling:
    def test_substitute_created_and_listed(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        created = reference_service.create_substitute(
            company_id=cid_a,
            payload=SubstituteCreate(
                material_id=MATERIAL_ND, substitute_material_id="test-ferrite",
                stage_code="magnet", application="moteur", maturity="pilot",
                performance_penalty_pct=35.0, data_status="estimated",
            ),
        )
        assert created.maturity == "pilot"
        assert created.data_status == "estimated"
        listed = reference_service.list_substitutes(company_id=cid_a, material_id=MATERIAL_ND)
        assert any(s.id == created.id for s in listed.items)

    def test_verified_substitute_without_source_is_rejected(self, two_companies_crma):
        """Pas de fait « vérifié » sans release : la règle est portée par le
        service ET par le CHECK SQL `substitutes_sourced_check`."""
        cid_a, _ = two_companies_crma
        with pytest.raises(reference_service.CrmaReferenceError, match="requiert une release"):
            reference_service.create_substitute(
                company_id=cid_a,
                payload=SubstituteCreate(
                    material_id=MATERIAL_ND, substitute_material_id="test-x",
                    maturity="mature", data_status="verified",
                ),
            )

    def test_verified_substitute_with_source_is_accepted(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        _, release_id = insert_source_with_license(cid_a, "TEST-SUB-SRC")
        created = reference_service.create_substitute(
            company_id=cid_a,
            payload=SubstituteCreate(
                material_id=MATERIAL_SM, substitute_material_id="test-alnico",
                maturity="commercial", data_status="verified", source_release_id=release_id,
            ),
        )
        assert created.data_status == "verified"
        assert created.source_release_id == release_id

    def test_recycling_route_records_where_the_loop_closes(self, two_companies_crma):
        """`output_stage_code` dit à quelle étape la boucle se referme — deux
        filières réinjectant à des étapes différentes ne sont pas équivalentes."""
        cid_a, _ = two_companies_crma
        route = reference_service.create_recycling_route(
            company_id=cid_a,
            payload=RecyclingRouteCreate(
                material_id=MATERIAL_ND, route_code="test-eol-magnet",
                label="Réemploi d'aimants en fin de vie",
                input_stage_code="product", output_stage_code="powder",
                maturity="pilot", recycled_content_pct=15.0, recovery_rate_pct=60.0,
            ),
        )
        assert route.input_stage_code == "product"
        assert route.output_stage_code == "powder"
        assert route.recycled_content_pct == 15.0

    def test_duplicate_recycling_route_rejected(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        payload = RecyclingRouteCreate(
            material_id=MATERIAL_SM, route_code="test-dup-route", label="Doublon",
        )
        reference_service.create_recycling_route(company_id=cid_a, payload=payload)
        with pytest.raises(reference_service.CrmaReferenceError, match="déjà existante"):
            reference_service.create_recycling_route(company_id=cid_a, payload=payload)

    def test_substitutes_are_tenant_isolated(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        reference_service.create_substitute(
            company_id=cid_a,
            payload=SubstituteCreate(
                material_id="test-isolated-mat", substitute_material_id="test-isolated-sub",
            ),
        )
        seen_by_b = reference_service.list_substitutes(
            company_id=cid_b, material_id="test-isolated-mat"
        )
        assert seen_by_b.total == 0
        assert seen_by_b.items == []


@_skip_no_db_url
@_skip_no_psycopg2
class TestTradeEvents:
    def test_event_created_with_severity_and_stage(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        from datetime import date

        event = reference_service.create_event(
            company_id=cid_a,
            payload=TradeEventCreate(
                event_type="export_control", title="Contrôle export fictif",
                material_id=MATERIAL_ND, stage_code="refining", country_code="XX",
                severity="high", effective_from=date(2026, 1, 1),
            ),
        )
        assert event.severity == "high"
        assert event.stage_code == "refining"
        assert event.event_type == "export_control"

    def test_inverted_period_rejected(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        from datetime import date

        with pytest.raises(reference_service.CrmaReferenceError):
            reference_service.create_event(
                company_id=cid_a,
                payload=TradeEventCreate(
                    event_type="quota", title="Période inversée",
                    effective_from=date(2026, 6, 1), effective_to=date(2026, 1, 1),
                ),
            )

    def test_events_are_tenant_isolated(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        reference_service.create_event(
            company_id=cid_a,
            payload=TradeEventCreate(
                event_type="sanction", title="Sanction confidentielle",
                material_id="test-event-mat",
            ),
        )
        assert reference_service.list_events(
            company_id=cid_b, material_id="test-event-mat"
        ).total == 0


@_skip_no_db_url
@_skip_no_psycopg2
class TestRlsAndDefenseInDepth:
    """La RLS gen-2 est posée ; en CI (superuser) elle est bypassée, donc c'est
    le prédicat applicatif qui doit tenir. Les deux sont vérifiés séparément."""

    def test_rls_is_enabled_and_forced_on_every_crma_table(self, crma_schema):
        from ._crma_fixtures import CRMA_TABLES

        with get_db() as conn:
            with conn.cursor() as cur:
                for table in CRMA_TABLES:
                    cur.execute(
                        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = %s",
                        (table,),
                    )
                    row = cur.fetchone()
                    assert row is not None, f"{table} absente"
                    assert row["relrowsecurity"], f"{table} sans ENABLE RLS"
                    assert row["relforcerowsecurity"], f"{table} sans FORCE RLS"

    def test_each_command_has_its_own_policy(self, crma_schema):
        """Policies scopées PAR COMMANDE, jamais une policy ALL unique :
        lecture et écriture n'ont pas la même clause (les lignes globales sont
        lisibles mais jamais écrites par un tenant)."""
        from ._crma_fixtures import CRMA_TABLES

        with get_db() as conn:
            with conn.cursor() as cur:
                for table in CRMA_TABLES:
                    cur.execute(
                        "SELECT cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = %s",
                        (table,),
                    )
                    cmds = {r["cmd"] for r in cur.fetchall()}
                    assert "ALL" not in cmds, f"{table} utilise une policy ALL unique"
                    assert {"SELECT", "INSERT", "UPDATE", "DELETE"} <= cmds, f"{table}: {cmds}"

    def test_write_policies_never_allow_global_rows(self, crma_schema):
        """L'écriture ne doit JAMAIS accepter `company_id IS NULL` : un tenant
        ne crée pas de ligne globale (contrats §7)."""
        from ._crma_fixtures import CRMA_TABLES

        with get_db() as conn:
            with conn.cursor() as cur:
                for table in CRMA_TABLES:
                    cur.execute(
                        """
                        SELECT policyname, with_check FROM pg_policies
                        WHERE schemaname = 'public' AND tablename = %s
                          AND cmd IN ('INSERT', 'UPDATE') AND with_check IS NOT NULL
                        """,
                        (table,),
                    )
                    for row in cur.fetchall():
                        assert "company_id IS NULL" not in row["with_check"], (
                            f"{table}.{row['policyname']} autorise l'écriture d'une ligne globale"
                        )
