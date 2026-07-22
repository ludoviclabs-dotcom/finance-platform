"""
demo_reset.py — remet à zéro les DONNÉES du tenant de démonstration Asterion.

SÉCURITÉ (garde-fous non contournables) :
  - N'agit QUE sur le tenant dont le slug est `asterion-motion-demo` : le
    company_id est résolu par slug, puis RE-VÉRIFIÉ (le slug de la ligne doit
    correspondre). Un slug non conforme => abandon, aucune écriture.
  - Ne supprime JAMAIS de donnée d'un autre tenant (tout est filtré
    `WHERE company_id = <demo>`), ni de donnée réelle.
  - Conserve la coquille du tenant (companies/users) pour que /auth/demo et un
    re-seed fonctionnent : seule la DONNÉE métier/preuve/IA est effacée.
  - `--dry-run` compte ce qui serait supprimé sans rien effacer.

Les tables Evidence Kernel / IRO / journal IA sont append-only (triggers) : la
suppression passe par `get_admin_db()` (rôle propriétaire) avec
`session_replication_role = replica` le temps du reset — même motif que le
teardown des fixtures de tests. Réservé au workflow protégé `demo-scenario.yml`.

Usage :
    python scripts/demo_reset.py [--dry-run] [--yes]
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import db_available, get_admin_db  # noqa: E402
from services.auth_service import DEMO_TENANT_SLUG  # noqa: E402

# Ordre de suppression (enfants -> parents), toutes filtrées company_id = démo.
_DELETE_ORDER = [
    # MODULE 2 — ressources stratégiques (PR-M2D), enfants -> parents. Les liens
    # d'exposition référencent purchase_lines/energy_activities : supprimés avant.
    # resource_catalog/supply/uses/réglementaire référencent source_releases :
    # supprimés avant source_releases (plus bas). Tables absentes ignorées.
    "resource_assessment_dimensions",
    "resource_assessment_runs",
    "company_resource_exposure_links",
    "purchase_lines",
    "purchase_imports",
    "energy_activities",
    "resource_supply_observations",
    "resource_sector_uses",
    "resource_regulatory_statuses",
    "resource_aliases",
    "resource_catalog",
    "ai_citations",
    "ai_claims",
    "ai_review_decisions",
    "ai_runs",
    "claim_evidence_links",
    "observations",
    "evidence_artifacts",
    "source_releases",
    "source_registry",
    "materiality_decisions",
    "iro_actions",
    "disclosure_mappings",
    "impact_assessments",
    "financial_assessments",
    "iros",
    "suppliers",
    "sites",
]


def _resolve_demo_company(cur) -> int | None:
    cur.execute("SELECT id, slug FROM companies WHERE slug = %s", (DEMO_TENANT_SLUG,))
    row = cur.fetchone()
    if not row:
        return None
    cid = row["id"] if isinstance(row, dict) else row[0]
    slug = row["slug"] if isinstance(row, dict) else row[1]
    # Re-vérification défensive : ne jamais agir sur un autre tenant.
    if slug != DEMO_TENANT_SLUG:
        return None
    return cid


def _table_exists(cur, table: str) -> bool:
    cur.execute("SELECT to_regclass(%s) AS reg", (f"public.{table}",))
    row = cur.fetchone()
    reg = row["reg"] if isinstance(row, dict) else row[0]
    return reg is not None


def run(dry_run: bool, assume_yes: bool) -> int:
    if not db_available():
        print("[abort] PostgreSQL non configuré (DATABASE_URL manquant)")
        return 3

    with get_admin_db() as conn:
        cur = conn.cursor()
        cid = _resolve_demo_company(cur)
        if cid is None:
            print(f"[ok] aucun tenant démo `{DEMO_TENANT_SLUG}` — rien à réinitialiser.")
            return 0

        # Compte préalable (dry-run ou confirmation).
        counts: dict[str, int] = {}
        for table in _DELETE_ORDER:
            if not _table_exists(cur, table):
                continue
            cur.execute(f"SELECT count(*) AS n FROM {table} WHERE company_id = %s", (cid,))
            row = cur.fetchone()
            n = row["n"] if isinstance(row, dict) else row[0]
            if n:
                counts[table] = n

        total = sum(counts.values())
        print(f"== demo_reset :: tenant `{DEMO_TENANT_SLUG}` (company_id={cid}) :: {total} lignes ==")
        for table, n in counts.items():
            print(f"   {table}: {n}")

        if dry_run:
            print("[dry-run] aucune suppression effectuée.")
            return 0
        if total == 0:
            print("[ok] tenant démo déjà vide.")
            return 0
        if not assume_yes:
            print("[abort] confirmation requise : relancer avec --yes.")
            return 4

        # Suppression avec triggers append-only désactivés le temps du reset.
        cur.execute("SET session_replication_role = replica")
        try:
            for table in _DELETE_ORDER:
                if table in counts:
                    cur.execute(f"DELETE FROM {table} WHERE company_id = %s", (cid,))
        finally:
            cur.execute("SET session_replication_role = origin")

        print(f"[ok] {total} lignes supprimées pour le tenant démo (coquille conservée).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset des données du tenant démo Asterion (tenant-only).")
    parser.add_argument("--dry-run", action="store_true", help="compte sans supprimer")
    parser.add_argument("--yes", action="store_true", help="confirme la suppression")
    args = parser.parse_args()
    return run(dry_run=args.dry_run, assume_yes=args.yes)


if __name__ == "__main__":
    raise SystemExit(main())
