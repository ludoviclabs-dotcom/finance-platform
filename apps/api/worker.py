"""
worker.py — Worker d'ingestion asynchrone procrastinate (T1.3).

Lancer en local ou via GitHub Actions (cf. .github/workflows/worker.yml) :
    python apps/api/worker.py              # worker long-running (LISTEN/NOTIFY)
    python apps/api/worker.py --until-empty  # draine la file puis sort (cron/CI)

Requiert : pip install -r requirements-worker.txt + DATABASE_URL_DIRECT.
Voir docs/ops/WORKER.md.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jobs import app
import jobs.ingest_job  # noqa: F401  (enregistre ingest_task auprès de l'app)


def main() -> None:
    until_empty = "--until-empty" in sys.argv
    with app.open():
        # wait=False : draine les tâches en attente puis sort (mode cron/CI).
        app.run_worker(queues=["ingest"], wait=not until_empty)


if __name__ == "__main__":
    main()
