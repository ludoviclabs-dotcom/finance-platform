"""
conftest.py — fixtures partagées pour les tests CarbonCo.

Stratégie :
  - Crée un TestClient FastAPI avec DATABASE_URL absent (mode /tmp JSON, sans PostgreSQL)
  - Aucune dépendance externe requise — les tests tournent en CI sans Neon
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Forcer le mode /tmp (pas de PostgreSQL en CI)
os.environ.setdefault("DATABASE_URL", "")
# Désactiver le rate limit en tests (évite les cascades 429 entre tests qui
# enchaînent beaucoup de login/auth — pré-existant, pas un bug produit).
os.environ.setdefault("RATE_LIMIT_DISABLED", "1")

from main import app  # noqa: E402

# Fixtures partagées entre tests exposées ici (pas dans chaque fichier
# test_*.py) pour éviter le faux positif pyflakes F811 — un paramètre de test
# nommé comme un nom importé est lu à tort comme une redéfinition, alors que
# pytest l'interprète comme une injection de fixture. Une fixture disponible via
# conftest.py n'a besoin d'aucun import explicite côté fichier de test, donc
# aucun nom à "redéfinir".
#
# CRMA = PR-07 ; Énergie & Scope 2 = PR-06A ; Evidence Kernel = PR-03 ;
# exposition achats/fournisseurs = PR-05A. Ordre alphabétique imposé par la
# règle isort du job `validate` (`ruff check . --select=E,F,I`) — les blocs
# séparés par des commentaires ne forment qu'UN seul bloc trié pour isort.
#
# Un module de fixtures absent d'ici n'est PAS résolu par pytest, et le défaut
# reste invisible en local : sans DATABASE_URL, les tests DB-gated sont skippés
# avant toute résolution de fixture. Seul le job CI `migration-tests`, qui
# dispose d'un vrai PostgreSQL, le révèle.
from ._crma_fixtures import (  # noqa: E402,F401
    crma_schema,
    two_companies_crma,
)
from ._energy_fixtures import (  # noqa: E402,F401
    energy_companies,
    energy_schema,
)
from ._intelligence_fixtures import (  # noqa: E402,F401
    evidence_kernel_schema,
    two_companies,
)

# Biodiversité & LEAP (PR-09) : mêmes raisons que ci-dessus — un module de
# fixtures absent d'ici n'est jamais résolu par pytest, et le défaut reste
# invisible en local (tests DB-gated skippés sans DATABASE_URL) — piège déjà
# documenté pour PR-07 (CRMA), toujours vrai ici.
from ._nature_fixtures import (  # noqa: E402,F401
    nature_schema,
    two_companies_nature,
)
from ._procurement_fixtures import (  # noqa: E402,F401
    procurement_schema,
    two_companies_proc,
)

# Moteur de calcul Scope 2 dual (PR-06B) : mêmes raisons que ci-dessus.
from ._scope2_fixtures import (  # noqa: E402,F401
    scope2_env,
    scope2_schema,
)

# Géospatial & eau (PR-08) : mêmes raisons que ci-dessus — un module de
# fixtures absent d'ici n'est jamais résolu par pytest, et le défaut reste
# invisible en local (tests DB-gated skippés sans DATABASE_URL).
from ._water_fixtures import (  # noqa: E402,F401
    two_companies_water,
    water_schema,
)


@pytest.fixture(autouse=True)
def _reset_state_between_tests():
    """Reset les buckets de rate-limit + les caches snapshot entre chaque test.

    Évite la pollution d'état partagé causée par :
      - Rate limit : buckets persistent en mémoire entre tests
      - Snapshot cache /tmp : écrit par un test, lu par un autre
    """
    try:
        from middleware import rate_limit as _rl
        _rl._BUCKETS.clear()
    except Exception:
        pass
    try:
        import shutil
        from pathlib import Path
        cache_dir = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))
        if cache_dir.exists():
            shutil.rmtree(cache_dir, ignore_errors=True)
    except Exception:
        pass
    yield


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Client de test synchrone FastAPI, réutilisé pour toute la session."""
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client: TestClient) -> str:
    """Token JWT admin pour les tests protégés."""
    resp = client.post(
        "/auth/login",
        json={"email": "admin@carbonco.fr", "password": "Admin2024!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


@pytest.fixture(scope="session")
def analyst_token(client: TestClient) -> str:
    """Token JWT analyst."""
    resp = client.post(
        "/auth/login",
        json={"email": "demo@carbonco.fr", "password": "CarbonCo2024!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


@pytest.fixture(scope="session")
def viewer_token(client: TestClient) -> str:
    """Token JWT viewer (lecture seule)."""
    resp = client.post(
        "/auth/login",
        json={"email": "viewer@carbonco.fr", "password": "Viewer2024!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]
