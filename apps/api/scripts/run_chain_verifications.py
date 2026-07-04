"""
run_chain_verifications.py — Job quotidien T2.5.

Exécute verify_chain() pour chaque organisation et horodate le résultat dans
chain_verifications. Appelé par .github/workflows/chain-verify.yml (cron) avec
DATABASE_URL en secret. Skip gracieux si la base est absente (sortie 0).

Usage : python scripts/run_chain_verifications.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import db_available  # noqa: E402
from services import chain_monitor  # noqa: E402


def main() -> int:
    if not db_available():
        print("DATABASE_URL absent ou base injoignable — vérification ignorée (skip gracieux).")
        return 0
    done = chain_monitor.run_all()
    print(f"Vérifications de chaîne effectuées : {done} organisation(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
