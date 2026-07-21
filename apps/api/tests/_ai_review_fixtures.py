"""
_ai_review_fixtures.py — état PostgreSQL partagé pour les tests du journal IA
(PR-11). Pas un fichier de test (jamais collecté) — convention _iro_fixtures.py.

Applique le DDL historique + les fichiers .sql RÉELS jusqu'à 041 (journal IA :
ai_runs, ai_claims, ai_citations, ai_review_decisions). Seed direct en SQL
(aucune dépendance au stockage Blob) : un IRO + trois preuves (normale,
confidentielle, licence bloquante) pour exercer le grounding sous RLS + licence
+ sensibilité. **Toutes les données semées sont FICTIVES.**
"""

from __future__ import annotations

import pytest

from db.database import get_db

from ._migration_fixtures import apply_ddl_inline, apply_upto

AI_CEILING = "041"

_AI_TABLES = ("ai_citations", "ai_review_decisions", "ai_claims", "ai_runs")
_EVIDENCE_TABLES = ("claim_evidence_links", "evidence_artifacts", "source_releases", "source_registry")
_IRO_TABLES = (
    "disclosure_mappings", "iro_actions", "materiality_decisions",
    "financial_assessments", "impact_assessments", "iros",
)


def build_ai_db(conn) -> None:
    apply_ddl_inline(conn)
    apply_upto(conn, AI_CEILING)


@pytest.fixture(scope="module")
def ai_schema():
    with get_db() as conn:
        build_ai_db(conn)


def _seed_iro_with_evidence(company_id: int) -> dict:
    """Crée un IRO candidate + 3 artefacts liés (normal / confidential / licence
    bloquante) et renvoie leurs ids. Seed en SQL direct sous le contexte tenant."""
    from models.iro import IroCreate
    from services.iro import iro_service

    iro = iro_service.create_iro(
        company_id=company_id,
        payload=IroCreate(title="IRO test IA", iro_type="risk", origin_domain="manual"),
        created_by=91,
    )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            # (a) preuve normale (tenant-own, pas de source → affichable).
            cur.execute(
                """INSERT INTO evidence_artifacts
                   (company_id, blob_key, sha256, filename, mime_type, page_reference,
                    excerpt, sensitivity, created_by)
                   VALUES (%s,%s,%s,'preuve.pdf','application/pdf','p.3',
                           'extrait normal', 'internal', 91) RETURNING id""",
                (company_id, f"k-normal-{company_id}", f"sha-normal-{company_id}"),
            )
            normal_id = cur.fetchone()["id"]

            # (b) preuve confidentielle → doit être EXCLUE du pack.
            cur.execute(
                """INSERT INTO evidence_artifacts
                   (company_id, blob_key, sha256, filename, mime_type, excerpt,
                    sensitivity, created_by)
                   VALUES (%s,%s,%s,'secret.pdf','application/pdf',
                           'CONTENU CONFIDENTIEL', 'confidential', 91) RETURNING id""",
                (company_id, f"k-conf-{company_id}", f"sha-conf-{company_id}"),
            )
            conf_id = cur.fetchone()["id"]

            # (c) source à display_allowed=false + release + artefact → EXCLU (licence).
            cur.execute(
                """INSERT INTO source_registry
                   (company_id, code, publisher, title, source_type, active, display_allowed)
                   VALUES (%s,%s,'Pub','Src bloquante','file', true, false) RETURNING id""",
                (company_id, f"blocked-{company_id}"),
            )
            src_id = cur.fetchone()["id"]
            cur.execute(
                """INSERT INTO source_releases
                   (source_id, company_id, release_key, checksum_sha256, status)
                   VALUES (%s,%s,'r1',%s,'published') RETURNING id""",
                (src_id, company_id, f"sha-rel-{company_id}"),
            )
            rel_id = cur.fetchone()["id"]
            cur.execute(
                """INSERT INTO evidence_artifacts
                   (company_id, source_release_id, blob_key, sha256, filename, mime_type,
                    excerpt, sensitivity, created_by)
                   VALUES (%s,%s,%s,%s,'licencie.pdf','application/pdf',
                           'extrait bloqué', 'internal', 91) RETURNING id""",
                (company_id, rel_id, f"k-lic-{company_id}", f"sha-lic-{company_id}"),
            )
            blocked_id = cur.fetchone()["id"]

            # (d) source display_allowed=true MAIS derived_use_allowed=false → EXCLU :
            #     envoyer un extrait à un modèle qui en dérive est un usage dérivé.
            cur.execute(
                """INSERT INTO source_registry
                   (company_id, code, publisher, title, source_type, active,
                    display_allowed, derived_use_allowed)
                   VALUES (%s,%s,'Pub','Src derivee','file', true, true, false) RETURNING id""",
                (company_id, f"derived-{company_id}"),
            )
            dsrc_id = cur.fetchone()["id"]
            cur.execute(
                """INSERT INTO source_releases
                   (source_id, company_id, release_key, checksum_sha256, status)
                   VALUES (%s,%s,'r1',%s,'published') RETURNING id""",
                (dsrc_id, company_id, f"sha-drel-{company_id}"),
            )
            drel_id = cur.fetchone()["id"]
            cur.execute(
                """INSERT INTO evidence_artifacts
                   (company_id, source_release_id, blob_key, sha256, filename, mime_type,
                    excerpt, sensitivity, created_by)
                   VALUES (%s,%s,%s,%s,'derivee.pdf','application/pdf',
                           'extrait derive', 'internal', 91) RETURNING id""",
                (company_id, drel_id, f"k-der-{company_id}", f"sha-der-{company_id}"),
            )
            derived_id = cur.fetchone()["id"]

            # Liens preuve↔IRO (convention claim_type='iro', claim_key='iro:{id}').
            for aid, rel in ((normal_id, "supports"), (conf_id, "supports"),
                             (blocked_id, "supports"), (derived_id, "supports")):
                cur.execute(
                    """INSERT INTO claim_evidence_links
                       (company_id, claim_type, claim_key, evidence_artifact_id, relation_type, created_by)
                       VALUES (%s,'iro',%s,%s,%s,91)""",
                    (company_id, f"iro:{iro.id}", aid, rel),
                )
    return {
        "iro_id": iro.id, "normal_id": normal_id, "conf_id": conf_id,
        "blocked_id": blocked_id, "derived_id": derived_id,
    }


@pytest.fixture(scope="function")
def ai_env(ai_schema):
    """2 companies dédiées + un IRO+preuves dans A. Nettoyage complet en teardown.

    Scope function : chaque test part d'un journal IA propre (le journal est
    append-only, on ne peut pas 'annuler' un run autrement qu'au teardown).
    """
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("ai-test-a", "ai-test-b"):
                cur.execute(
                    """INSERT INTO companies (name, slug, plan) VALUES (%s,%s,'starter')
                       ON CONFLICT (slug) DO UPDATE SET updated_at = now() RETURNING id""",
                    (slug.upper(), slug),
                )
                ids.append(cur.fetchone()["id"])
    cid_a, cid_b = ids
    seed = _seed_iro_with_evidence(cid_a)
    yield {"cid_a": cid_a, "cid_b": cid_b, **seed}

    with get_db() as conn:
        with conn.cursor() as cur:
            # replica : désactive les triggers FK ET append-only le temps du nettoyage.
            cur.execute("SET session_replication_role = replica")
            for table in (*_AI_TABLES, *_IRO_TABLES, *_EVIDENCE_TABLES):
                cur.execute(f"DELETE FROM {table} WHERE company_id IN (%s, %s)", (cid_a, cid_b))
            cur.execute("DELETE FROM companies WHERE id IN (%s, %s)", (cid_a, cid_b))
            cur.execute("SET session_replication_role = origin")
