#!/usr/bin/env python3
"""
seed_demo_suppliers.py — Insère les 20 fournisseurs démo dans PostgreSQL.

Remplace le fallback in-memory _DEMO_SUPPLIERS par de vraies lignes en base
pour la company 'carbonco-demo'. Utile après activation de la migration 008b
(RLS active : les données in-memory ne sont plus servies si get_db réussit).

Usage :
    cd apps/api
    DATABASE_URL="postgresql://..." python scripts/seed_demo_suppliers.py

Options :
    --reset     Supprime les suppliers existants avant de ré-insérer (défaut : skip si déjà seedé)
    --dry-run   Affiche le SQL sans l'exécuter

Pré-requis :
  - DATABASE_URL défini dans l'environnement (ou fichier .env à la racine de apps/api)
  - Tables suppliers existantes (migration 008_suppliers.sql)
  - Company 'carbonco-demo' existante (insérée automatiquement par le DDL inline migrations.py)
  - RLS active sur suppliers (migration 008b) — le script passe company_id via get_db()
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

# Ajouter le répertoire racine de l'API au PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

# Charger .env si disponible (développement local)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger("seed_demo_suppliers")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--reset", action="store_true", help="Supprime les suppliers existants avant de ré-insérer")
    p.add_argument("--dry-run", action="store_true", help="Affiche le plan sans modifier la base")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    from db.database import db_available, get_db
    from services.supplier_service import _DEMO_SUPPLIERS

    if not db_available():
        logger.error("DATABASE_URL non défini ou psycopg2 absent — impossible de seeder.")
        sys.exit(1)

    # ── Récupérer l'ID de la company démo ────────────────────────────────────
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM companies WHERE slug = 'carbonco-demo'")
            row = cur.fetchone()
            if not row:
                logger.error(
                    "Company 'carbonco-demo' introuvable.\n"
                    "Assurez-vous que l'API a démarré au moins une fois pour créer les tables."
                )
                sys.exit(1)
            demo_company_id = row["id"]

    logger.info("Company démo trouvée : id=%d (slug='carbonco-demo')", demo_company_id)

    # ── Vérifier si le seed a déjà été fait ──────────────────────────────────
    with get_db(demo_company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM suppliers WHERE company_id = %s",
                (demo_company_id,),
            )
            existing_count = cur.fetchone()["c"]

    if existing_count >= len(_DEMO_SUPPLIERS) and not args.reset:
        logger.info(
            "%d fournisseurs déjà présents pour company %d — seed ignoré (--reset pour forcer).",
            existing_count, demo_company_id,
        )
        return

    if args.dry_run:
        logger.info(
            "[DRY-RUN] Serait inséré : %d fournisseurs pour company_id=%d (reset=%s).",
            len(_DEMO_SUPPLIERS), demo_company_id, args.reset,
        )
        for s in _DEMO_SUPPLIERS:
            logger.info("  • %s (%s, %s)", s["name"], s["country"], s["sector"])
        return

    # ── Seed ─────────────────────────────────────────────────────────────────
    with get_db(demo_company_id) as conn:
        with conn.cursor() as cur:
            if args.reset:
                cur.execute(
                    "DELETE FROM suppliers WHERE company_id = %s", (demo_company_id,)
                )
                logger.info("Suppression des %d suppliers existants.", existing_count)

            inserted = 0
            for s in _DEMO_SUPPLIERS:
                cur.execute(
                    """
                    INSERT INTO suppliers
                        (company_id, name, contact_email, contact_name, country,
                         sector, scope3_category, spend_eur, ghg_estimate_tco2e,
                         status, notes)
                    SELECT %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM suppliers
                        WHERE company_id = %s AND name = %s
                    )
                    """,
                    (
                        demo_company_id,
                        s["name"],
                        s["contact_email"],
                        s["contact_name"],
                        s["country"],
                        s["sector"],
                        s["scope3_category"],
                        s["spend_eur"],
                        s["ghg_estimate_tco2e"],
                        s["status"],
                        s["notes"],
                        # WHERE NOT EXISTS params
                        demo_company_id,
                        s["name"],
                    ),
                )
                inserted += cur.rowcount

    skipped = len(_DEMO_SUPPLIERS) - inserted
    logger.info(
        "Seed terminé : %d insérés, %d ignorés (déjà présents).",
        inserted, skipped,
    )


if __name__ == "__main__":
    main()
