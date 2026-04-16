"""
migrate_audit_hash.py — Backfill des colonnes hash_prev/hash_self sur audit_events.

Usage :
    python apps/api/scripts/migrate_audit_hash.py [--dry-run]

Idempotent : skip les lignes où hash_self IS NOT NULL.
Ordonné par (company_id, created_at ASC, id ASC) pour garantir une chaîne stable.
Lancer UNE fois après migration 005. À ne pas relancer après modifs d'audit_events.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import db_available, get_db


def _compute_audit_hash(
    *,
    hash_prev: str | None,
    company_id: int,
    event_type: str,
    title: str,
    detail: str,
    status: str,
    meta_json: str,
    created_at,
) -> str:
    tpl = "|".join([
        hash_prev or "GENESIS",
        str(company_id),
        event_type or "",
        title or "",
        detail or "",
        status or "",
        meta_json or "",
        created_at.isoformat(timespec="microseconds") if created_at else "",
    ])
    return hashlib.sha256(tpl.encode("utf-8")).hexdigest()


def backfill(dry_run: bool = False) -> int:
    """Rehash tous les audit_events qui n'ont pas encore de hash_self.

    Retourne le nombre de lignes mises à jour.
    """
    if not db_available():
        print("[WARN] DATABASE_URL absent — rien à faire.")
        return 0

    updated = 0
    prev_by_company: dict[int, str | None] = {}

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, company_id, event_type, title, detail, status, meta, created_at, hash_self
                FROM audit_events
                ORDER BY company_id, created_at ASC, id ASC
                """
            )
            rows = cur.fetchall()

            # Pré-remplir prev_by_company avec le hash_self de la dernière ligne déjà hashée
            for row in rows:
                cid = row["company_id"]
                if row["hash_self"]:
                    prev_by_company[cid] = row["hash_self"]

            for row in rows:
                if row["hash_self"]:
                    continue  # déjà hashée

                cid = row["company_id"]
                prev = prev_by_company.get(cid)

                import json as _json
                meta_json = _json.dumps(row["meta"], sort_keys=True, default=str) if row["meta"] else ""

                new_hash = _compute_audit_hash(
                    hash_prev=prev,
                    company_id=cid,
                    event_type=row["event_type"],
                    title=row["title"],
                    detail=row["detail"] or "",
                    status=row["status"] or "",
                    meta_json=meta_json,
                    created_at=row["created_at"],
                )

                if dry_run:
                    print(f"[DRY] audit_events.id={row['id']} company={cid} → hash_self={new_hash[:12]}...")
                else:
                    cur.execute(
                        "UPDATE audit_events SET hash_prev = %s, hash_self = %s WHERE id = %s",
                        (prev, new_hash, row["id"]),
                    )
                prev_by_company[cid] = new_hash
                updated += 1

    print(f"[OK] {updated} audit_events {'simulées' if dry_run else 'backfillées'}.")
    return updated


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill hash Merkle sur audit_events")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    count = backfill(dry_run=args.dry_run)
    sys.exit(0 if count >= 0 else 1)
