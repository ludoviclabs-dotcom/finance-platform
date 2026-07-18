"""
_migration_fixtures.py — construction d'états de base PostgreSQL pour PR-02B.

Pas un fichier de test (pas de préfixe `test_`, jamais collecté par pytest).
Exécute les fichiers `.sql` RÉELS du dossier `migrations/` (pas une copie de
schéma recopiée à la main) pour que les fixtures restent vraies si le contenu
des migrations évolue. N'utilise jamais `run_migrations()`/`migrations.py`
(qui applique `MANUAL_ONLY_PREFIXES`/`RLS_FORCE`) — exécution directe et
ordonnée pour un contrôle exact du sous-ensemble simulé.

Jamais contre Neon — conteneur `postgres:16` jetable (CI) ou une instance
locale explicitement pointée par `DATABASE_URL`.
"""

from __future__ import annotations

import re
from pathlib import Path

from db.migrations import DDL as INLINE_DDL

MIGRATIONS_DIR = Path(__file__).parent.parent / "db" / "migrations"

_SORT_RE = re.compile(r"^(\d{3})([a-z]?)_")


def _sort_key(path: Path) -> tuple[int, str]:
    match = _SORT_RE.match(path.name)
    return (int(match.group(1)), match.group(2)) if match else (999, path.name)


def _apply_file(conn, path: Path) -> None:
    """Exécute et **committe** — sans quoi l'état reste invisible aux autres
    connexions (`baseline()`/`verify()`/`mark_manual_verified()` ouvrent
    chacune leur propre connexion via `get_db()`, isolation PostgreSQL par
    défaut READ COMMITTED : une transaction non commitée d'une session n'est
    jamais visible d'une autre session, même contre le même conteneur)."""
    sql = path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def apply_ddl_inline(conn) -> None:
    """DDL historique de `migrations.py` — la baseline `version='000'` du ledger.

    Committe pour la même raison que `_apply_file` (visibilité inter-connexion).
    """
    with conn.cursor() as cur:
        cur.execute(INLINE_DDL)
    conn.commit()


def apply_upto(conn, max_version: str | None) -> None:
    """Applique les fichiers dont le préfixe numérique est <= `max_version`, en ordre croissant.

    `max_version=None` : aucun fichier appliqué (no-op). Ne touche jamais au
    DDL inline (`apply_ddl_inline`, appelé séparément si besoin) — les deux
    « 000 » (bootstrap technique vs baseline historique) restent distincts,
    comme documenté dans migration_runner.py.
    """
    if max_version is None:
        return
    limit = int(max_version[:3])
    for path in sorted(MIGRATIONS_DIR.glob("*.sql"), key=_sort_key):
        num = int(path.name[:3])
        if num <= limit:
            _apply_file(conn, path)


def build_full_db(conn) -> None:
    """DDL inline + TOUS les fichiers `.sql` découverts (001-029, y compris
    004/009/027, le noyau Evidence Kernel 028 et la vue de fraîcheur 029) —
    « base complète ».

    Doit rester aligné sur `discover_migrations()` : ce fixture représente
    « toutes les migrations appliquées », donc sa borne haute suit la dernière
    version réelle du dossier (029 depuis PR-04). Un décalage — p.ex. rester à
    028 alors qu'un fichier 029 existe — ferait échouer toute assertion du type
    « chaque version découverte a une sonde qui passe / est baseline » (la
    sonde 029 verrait la vue source_freshness absente), sans que 029 soit en cause.
    À FAIRE ÉVOLUER à chaque nouvelle migration (030+)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "029")


def reset_public_schema(conn) -> None:
    """Repart d'un schéma `public` vide — isolation entre tests contre le même conteneur jetable.

    Plus simple et plus explicite qu'un rollback de transaction ouverte (qui
    demanderait de contourner le commit automatique de `get_db()`) ; un
    `DROP/CREATE SCHEMA` est bon marché contre un conteneur `postgres:16`
    dédié aux tests, jamais utilisé contre une base persistante.
    """
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    conn.commit()
