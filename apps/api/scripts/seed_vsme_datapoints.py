"""
seed_vsme_datapoints.py — T3.1 : seed du catalogue VSME dans vsme_datapoints.

Charge data/vsme_datapoints.json (source de vérité) et UPSERT chaque datapoint
dans la table globale vsme_datapoints. Idempotent (ON CONFLICT (code) DO UPDATE).
Skip gracieux si la base est absente (mode /tmp).

Usage :
  python scripts/seed_vsme_datapoints.py            # applique
  python scripts/seed_vsme_datapoints.py --dry-run  # affiche sans écrire
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import db_available, get_db  # noqa: E402
from services import vsme_catalog  # noqa: E402


def seed(dry_run: bool = False) -> int:
    datapoints = vsme_catalog.all_datapoints()
    version = vsme_catalog.catalog_version()
    if dry_run:
        for d in datapoints:
            print(f"  {d['code']:7} {d['module']:3} {d['type']:11} {d['label']}")
        print(f"{len(datapoints)} datapoints ({version}) — dry-run, rien écrit.")
        return 0

    if not db_available():
        print("DATABASE_URL absent — seed ignoré (skip gracieux).")
        return 0

    with get_db() as conn:
        with conn.cursor() as cur:
            for d in datapoints:
                cur.execute(
                    """
                    INSERT INTO vsme_datapoints
                        (code, module, label, type, unit, snapshot_path, fact_code, collect_status, version)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (code) DO UPDATE SET
                        module = EXCLUDED.module, label = EXCLUDED.label, type = EXCLUDED.type,
                        unit = EXCLUDED.unit, snapshot_path = EXCLUDED.snapshot_path,
                        fact_code = EXCLUDED.fact_code, collect_status = EXCLUDED.collect_status,
                        version = EXCLUDED.version
                    """,
                    (
                        d["code"], d["module"], d["label"], d["type"], d.get("unit"),
                        d.get("snapshot"), d.get("fact_code"), d["collect"], version,
                    ),
                )
    print(f"{len(datapoints)} datapoints VSME seedés ({version}).")
    return 0


def main() -> int:
    return seed(dry_run="--dry-run" in sys.argv)


if __name__ == "__main__":
    raise SystemExit(main())
