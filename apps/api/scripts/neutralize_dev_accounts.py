"""
neutralize_dev_accounts.py — remédiation B-03 (rapport QA du 16/09/2026).

Jusqu'au correctif, le premier login sur une instance avec base ensemençait
admin@carbonco.fr / demo@carbonco.fr / viewer@carbonco.fr avec des mots de
passe PUBLICS (présents dans le dépôt), y compris en production. Le code
refuse désormais ces mots de passe hors développement ; ce script neutralise
en plus les comptes existants qui les utilisent encore :

  * compte désactivé (is_active = false) ;
  * sessions de rafraîchissement révoquées.

Un compte dont le mot de passe a été changé n'est pas touché. Simulation par
défaut ; `--apply` pour écrire. `--all-users` vérifie tous les comptes (et pas
seulement les trois adresses connues) — plus lent (bcrypt).

Usage :
    DATABASE_URL="postgresql://..." python scripts/neutralize_dev_accounts.py
    DATABASE_URL="postgresql://..." python scripts/neutralize_dev_accounts.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import db_available, get_db  # noqa: E402
from services.auth_service import (  # noqa: E402
    _DEV_ACCOUNTS,
    _PUBLIC_DEV_PASSWORDS,
    _pwd_context,
)


def _uses_public_password(password_hash: str) -> bool:
    for password in _PUBLIC_DEV_PASSWORDS:
        try:
            if _pwd_context.verify(password, password_hash):
                return True
        except ValueError:
            return False
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--apply", action="store_true", help="écrire (sinon simulation)")
    parser.add_argument("--all-users", action="store_true", help="vérifier tous les comptes")
    args = parser.parse_args()

    if not db_available():
        print("DATABASE_URL absent : rien à vérifier.")
        return 1

    with get_db() as conn:
        with conn.cursor() as cur:
            if args.all_users:
                cur.execute("SELECT id, email, password_hash, is_active FROM users ORDER BY id")
            else:
                cur.execute(
                    "SELECT id, email, password_hash, is_active FROM users WHERE email = ANY(%s) ORDER BY id",
                    (list(_DEV_ACCOUNTS),),
                )
            rows = cur.fetchall()

            exposed = [r for r in rows if _uses_public_password(r["password_hash"])]
            for row in rows:
                state = "MOT DE PASSE PUBLIC" if row in exposed else "mot de passe modifié"
                active = "actif" if row["is_active"] else "inactif"
                print(f"- {row['email']} (id {row['id']}, {active}) : {state}")

            if not exposed:
                print("Aucun compte n'utilise un mot de passe public.")
                return 0
            if not args.apply:
                print(f"Simulation : {len(exposed)} compte(s) à neutraliser — relancer avec --apply.")
                conn.rollback()
                return 2

            ids = [r["id"] for r in exposed]
            cur.execute("UPDATE users SET is_active = FALSE WHERE id = ANY(%s)", (ids,))
            cur.execute(
                "UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ANY(%s) AND revoked = FALSE",
                (ids,),
            )
            print(f"{len(ids)} compte(s) désactivé(s), sessions révoquées.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
