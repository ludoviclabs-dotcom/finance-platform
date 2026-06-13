"""
jobs — App procrastinate pour l'ingestion asynchrone (T1.3).

Importé UNIQUEMENT en WORKER_MODE=worker (par l'API au moment du defer) et par
worker.py. L'API en mode inline (défaut) n'importe jamais ce module, donc
procrastinate n'est pas une dépendance de l'API (cf. requirements-worker.txt).

LISTEN/NOTIFY exige une connexion DIRECTE à Neon (pas le pooler) : on utilise
DATABASE_URL_DIRECT.
"""

from __future__ import annotations

import os

from procrastinate import App, PsycopgConnector

_DSN = os.environ.get("DATABASE_URL_DIRECT") or os.environ.get("DATABASE_URL") or ""

app = App(connector=PsycopgConnector(conninfo=_DSN))
