"""
test_iro.py — registre `iros` (PR-10, migration 040). DB-gated (job
`migration-tests` UNIQUEMENT — inscrit dans .github/workflows/api.yml).

Deux niveaux :
  - PUR (jamais skippé) : introspection statique de `models/iro.py` — AUCUN
    modèle n'expose un champ numérique combinant impact et financier
    (plan §6/§12, le non-négociable central de cette PR).
  - DB-gated : migration 040 applicable après 039 (sonde) ; création d'IRO
    toujours `status='candidate'` ; filtres/pagination ; RLS + défense en
    profondeur (isolation tenant) ; 404 sans fuite d'existence cross-tenant ;
    vue complète (`GET /iro/iros/{id}`) agrège évaluations/décisions/actions/
    disclosure mappings/preuves ; réutilisation RÉELLE de
    `claim_link_service` (pas de duplication) ; réponse API sans champ de
    score fusionné.
"""

from __future__ import annotations

import os
import re

import pytest
from pydantic import BaseModel

from db.database import db_available, get_db
from models.intelligence import ClaimEvidenceLinkCreate
from services.auth_service import AuthUser, create_access_token
from services.intelligence import artifact_service, claim_link_service
from services.iro import iro_service

from ._iro_fixtures import IRO_CEILING, insert_iro
from ._migration_fixtures import apply_ddl_inline, apply_upto, reset_public_schema

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _token_for(company_id: int, role: str = "analyst", user_id: int = 91) -> str:
    user = AuthUser(email=f"iro-{role}-{company_id}@test.local", role=role, company_id=company_id, user_id=user_id)
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _walk_keys(obj):
    """Parcourt récursivement un dict/list JSON et rend chaque clé rencontrée."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield key
            yield from _walk_keys(value)
    elif isinstance(obj, list):
        for item in obj:
            yield from _walk_keys(item)


# Vocabulaire interdit : tout nom de champ qui évoquerait un score de
# matérialité FUSIONNÉ (impact+financier combinés en un seul nombre).
# `threshold_crossed` (booléen indicatif par dimension) n'est PAS visé.
_FORBIDDEN_SCORE_FIELD = re.compile(
    r"(materiality|iro)_score|overall_score|combined_score|fused_score|^score$", re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# PUR — jamais skippé, aucune DB requise
# ---------------------------------------------------------------------------

class TestNeverAFusedScore:
    """Plan §6/§12 : « aucune fonction du domaine ne produit un score combiné »
    — vérifié en inspectant AUTOMATIQUEMENT `model_fields` de chaque modèle
    Pydantic du domaine IRO, pas seulement par revue de code."""

    def test_no_iro_model_exposes_a_single_fused_materiality_score(self):
        import models.iro as iro_models

        offenders: list[str] = []
        for name in dir(iro_models):
            obj = getattr(iro_models, name)
            if isinstance(obj, type) and issubclass(obj, BaseModel) and obj is not BaseModel:
                for field_name in obj.model_fields:
                    if _FORBIDDEN_SCORE_FIELD.search(field_name):
                        offenders.append(f"{name}.{field_name}")
        assert offenders == [], (
            f"Champ(s) de score de matérialité fusionné détecté(s) dans models/iro.py : {offenders}"
        )

    def test_impact_and_financial_components_are_distinct_columns_in_response_models(self):
        """Les composantes de sévérité (impact) et de transmission (financier)
        ne partagent aucun champ — deux modèles de réponse structurellement
        séparés, jamais un seul modèle « matérialité »."""
        from models.iro import FinancialAssessmentResponse, ImpactAssessmentResponse

        impact_fields = set(ImpactAssessmentResponse.model_fields)
        financial_fields = set(FinancialAssessmentResponse.model_fields)
        shared_business_fields = (impact_fields & financial_fields) - {
            "id", "company_id", "iro_id", "time_horizon", "confidence", "methodology_code",
            "methodology_version", "components", "threshold_crossed", "rationale",
            "calculated_at", "prepared_by", "created_at", "updated_at",
            # `likelihood` existe légitimement DANS LES DEUX tables (motif
            # ESRS : la probabilité qualifie aussi bien un impact potentiel
            # qu'un effet financier) — ce n'est PAS un score fusionné, ce sont
            # deux colonnes indépendantes qui partagent un nom, chacune dans
            # sa propre table. Le non-négociable est « pas de score UNIQUE
            # combinant impact ET financier », pas « pas de nom partagé ».
            "likelihood",
        }
        assert shared_business_fields == set(), (
            "Les colonnes métier d'impact (scale/scope/irremediability/likelihood) et de "
            f"financier (likelihood/magnitude) doivent rester distinctes : {shared_business_fields}"
        )


# ---------------------------------------------------------------------------
# DB-gated
# ---------------------------------------------------------------------------

@_skip_no_db_url
@_skip_no_psycopg2
class TestMigration040AppliesAfter039:
    def test_migration_040_applies_cleanly_after_039(self):
        with get_db() as conn:
            reset_public_schema(conn)
            apply_ddl_inline(conn)
            apply_upto(conn, "039")
            # Doit s'appliquer sans erreur par-dessus 039.
            apply_upto(conn, IRO_CEILING)
            with conn.cursor() as cur:
                for table in (
                    "iros", "impact_assessments", "financial_assessments",
                    "materiality_decisions", "iro_actions", "disclosure_mappings",
                ):
                    cur.execute("SELECT to_regclass(%s) AS t", (f"public.{table}",))
                    assert cur.fetchone()["t"] is not None, f"table {table} absente après 040"


@_skip_no_db_url
@_skip_no_psycopg2
class TestIroServiceCore:
    def test_create_iro_is_always_candidate_status(self, two_companies_iro):
        from models.iro import IroCreate

        cid_a, _ = two_companies_iro
        iro = iro_service.create_iro(
            company_id=cid_a,
            payload=IroCreate(title="Stress hydrique site X", iro_type="risk", topic_code="WR-1"),
            created_by=7,
        )
        assert iro.status == "candidate"
        assert iro.iro_type == "risk"
        assert iro.topic_code == "WR-1"

    def test_create_iro_from_domain_signal_is_still_candidate(self, two_companies_iro):
        """Un point d'appel interne (eau/nature/CRMA) ne peut jamais dépasser
        `candidate` — même appel, même résultat qu'une création manuelle."""
        from models.iro import IroCreate

        cid_a, _ = two_companies_iro
        iro = iro_service.create_iro(
            company_id=cid_a,
            payload=IroCreate(
                title="Signal screening eau", iro_type="risk", origin_domain="water",
                origin_reference="site_water_screening:123",
            ),
            created_by=None,
        )
        assert iro.status == "candidate"
        assert iro.origin_domain == "water"
        assert iro.origin_reference == "site_water_screening:123"

    def test_list_iros_filters_by_status_type_origin(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        insert_iro(cid_a, "Risque A", iro_type="risk", origin_domain="water", status="candidate")
        insert_iro(cid_a, "Opportunité B", iro_type="opportunity", origin_domain="manual", status="assessed")

        by_type = iro_service.list_iros(company_id=cid_a, iro_type="opportunity")
        assert all(i.iro_type == "opportunity" for i in by_type.items)
        assert by_type.total >= 1

        by_origin = iro_service.list_iros(company_id=cid_a, origin_domain="water")
        assert all(i.origin_domain == "water" for i in by_origin.items)

        by_status = iro_service.list_iros(company_id=cid_a, status="assessed")
        assert all(i.status == "assessed" for i in by_status.items)

    def test_get_iro_unknown_id_raises(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        with pytest.raises(iro_service.IroError):
            iro_service.get_iro(company_id=cid_a, iro_id=999999999)

    def test_get_iro_detail_defaults_to_empty_sub_resources(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO neuf, jamais évalué")
        detail = iro_service.get_iro_detail(company_id=cid_a, iro_id=iro_id)
        assert detail.impact_assessments == []
        assert detail.financial_assessments == []
        assert detail.decisions == []
        assert detail.actions == []
        assert detail.disclosure_mappings == []
        assert detail.evidence_links == []


@_skip_no_db_url
@_skip_no_psycopg2
class TestIroTenantIsolation:
    """RLS gen-2 + défense en profondeur applicative (contrats §7 — le
    superuser CI bypasse la RLS, donc le prédicat `company_id = %s` du
    service doit, à lui seul, empêcher toute fuite cross-tenant)."""

    def test_tenant_a_does_not_see_tenant_b_iros(self, two_companies_iro):
        cid_a, cid_b = two_companies_iro
        insert_iro(cid_a, "IRO tenant A")
        insert_iro(cid_b, "IRO tenant B")

        result_a = iro_service.list_iros(company_id=cid_a, limit=200)
        result_b = iro_service.list_iros(company_id=cid_b, limit=200)
        titles_a = {i.title for i in result_a.items}
        titles_b = {i.title for i in result_b.items}
        assert "IRO tenant B" not in titles_a
        assert "IRO tenant A" not in titles_b

    def test_cross_tenant_get_raises_without_leaking_existence(self, two_companies_iro):
        cid_a, cid_b = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO privé A")
        with pytest.raises(iro_service.IroError, match="introuvable"):
            iro_service.get_iro(company_id=cid_b, iro_id=iro_id)

    def test_ci_superuser_connection_bypasses_rls_hence_defense_in_depth_is_mandatory(
        self, two_companies_iro,
    ):
        """Documente EXPLICITEMENT, plutôt que de le supposer, la raison
        d'être de la défense en profondeur applicative (contrats §7) : le
        PostgreSQL de CI (job `migration-tests`) se connecte en superuser, qui
        BYPASSE la RLS même avec FORCE posé — une requête SQL brute scopée
        uniquement par `app.current_company_id` voit encore la ligne d'un
        autre tenant. Seul un rôle NOSUPERUSER/NOBYPASSRLS testerait
        l'enforcement RLS réel (motif `test_energy_rls_non_superuser.py`,
        seul fichier du dépôt à le faire — hors périmètre ici, comme pour
        tous les autres domaines CRMA/eau/nature/achats). La preuve
        d'isolation RÉELLE de ce module passe donc par les tests
        `iro_service.list_iros`/`get_iro` ci-dessus (prédicat `company_id =
        %s` explicite), pas par une lecture SQL brute. La CONFIGURATION RLS
        elle-même (ENABLE+FORCE+policy) reste vérifiée séparément par
        `_probe_040` (`test_migration_probes.py`)."""
        cid_a, cid_b = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO RLS direct")
        with get_db(company_id=cid_b) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM iros WHERE id = %s", (iro_id,))
                # Sous superuser CI : la ligne EST visible malgré RLS FORCE —
                # ce test échouerait, à raison, s'il l'assertion inverse.
                assert cur.fetchone() is not None


@_skip_no_db_url
@_skip_no_psycopg2
class TestIroDetailApi:
    def test_api_create_list_get_round_trip(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        create_resp = client.post(
            "/iro/iros", headers=_auth(_token_for(cid_a)),
            json={"title": "IRO via API", "iro_type": "impact", "topic_code": "BD-1"},
        )
        assert create_resp.status_code == 201, create_resp.text
        body = create_resp.json()
        assert body["status"] == "candidate"
        iro_id = body["id"]

        list_resp = client.get("/iro/iros", headers=_auth(_token_for(cid_a, role="viewer")))
        assert list_resp.status_code == 200
        assert any(i["id"] == iro_id for i in list_resp.json()["items"])

        detail_resp = client.get(f"/iro/iros/{iro_id}", headers=_auth(_token_for(cid_a, role="viewer")))
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["iro"]["id"] == iro_id
        assert detail["impact_assessments"] == []

    def test_create_iro_requires_analyst_role(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        resp = client.post(
            "/iro/iros", headers=_auth(_token_for(cid_a, role="viewer")),
            json={"title": "Refusé", "iro_type": "risk"},
        )
        assert resp.status_code == 403

    def test_get_iro_404_cross_tenant_without_leak(self, client, two_companies_iro):
        cid_a, cid_b = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO caché")
        resp = client.get(f"/iro/iros/{iro_id}", headers=_auth(_token_for(cid_b)))
        assert resp.status_code == 404

    def test_api_response_never_exposes_a_combined_score_field(self, client, two_companies_iro):
        """Version API du test §6/§12 : inspecte la RÉPONSE JSON réelle d'un
        endpoint, pas seulement les modèles Pydantic en mémoire."""
        cid_a, _ = two_companies_iro
        create_resp = client.post(
            "/iro/iros", headers=_auth(_token_for(cid_a)),
            json={"title": "IRO scoré ?", "iro_type": "risk"},
        )
        iro_id = create_resp.json()["id"]
        detail_resp = client.get(f"/iro/iros/{iro_id}", headers=_auth(_token_for(cid_a, role="viewer")))
        keys = set(_walk_keys(detail_resp.json()))
        forbidden = {k for k in keys if _FORBIDDEN_SCORE_FIELD.search(k)}
        assert forbidden == set(), f"Champ(s) suspect(s) dans la réponse API : {forbidden}"


@_skip_no_db_url
@_skip_no_psycopg2
class TestIroEvidenceReuse:
    """Preuve directe : PR-10 réutilise `claim_link_service` tel quel — aucune
    seconde table `iro_evidence_links` (plan §5/§14)."""

    def test_claim_link_service_links_evidence_to_an_iro_and_shows_up_in_detail(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO avec preuve")
        artifact = artifact_service.register_artifact(
            company_id=cid_a, data=b"preuve fictive", filename="preuve.pdf", mime_type="application/pdf",
        )
        link = claim_link_service.create_link(
            company_id=cid_a,
            payload=ClaimEvidenceLinkCreate(
                claim_type="iro", claim_key=f"iro:{iro_id}",
                evidence_artifact_id=artifact.id, relation_type="supports",
            ),
        )
        detail = iro_service.get_iro_detail(company_id=cid_a, iro_id=iro_id)
        assert len(detail.evidence_links) == 1
        assert detail.evidence_links[0].id == link.id
        assert detail.evidence_links[0].relation_type == "supports"

    def test_no_iro_evidence_links_table_exists(self, two_companies_iro):
        """La table `iro_evidence_links` évoquée par le plan §15 n'a
        volontairement jamais été créée."""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.iro_evidence_links') AS t")
                assert cur.fetchone()["t"] is None
