"""tests/test_water_staging_rehearsal.py — vérité structurelle du schéma X3.

Régression du run X3 réel `30214920815` (2026-07-26, `master`) : `migrate`
plantait sur `psycopg2.errors.UndefinedTable: relation "schema_migrations"
does not exist`, et `gate` aurait silencieusement laissé passer la même
absence (un `COUNT` sur une table absente vaut 0, jamais une erreur).

Cause : `apply_ddl_inline`/`apply_upto` (tests/_migration_fixtures.py)
appliquent les fichiers .sql RÉELS en contournant délibérément
`migration_runner.py` et son ledger `schema_migrations` — c'est le mécanisme
même que le job `migration-tests` réutilise, et il ne peuple ce ledger sous
AUCUNE forme. Le lire était une hypothèse fausse sur ce mécanisme.

AUCUNE base ici : ces tests ne lisent que les fichiers réels de
`db/migrations/`, exactement comme le fait le code corrigé.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from scripts.water_intelligence.staging_rehearsal import (
    _highest_applied_version,
    _sentinel_tables_for,
)

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts" / "water_intelligence" / "staging_rehearsal.py"
)


class TestNoLedgerAssumption:
    def test_no_query_string_references_schema_migrations(self) -> None:
        """La cause exacte du run échoué : aucune requête SQL ne doit plus
        jamais supposer que `schema_migrations` existe après `apply_upto`.

        Recherche AST ciblée sur les appels `.execute(...)` plutôt que texte
        brut : le docstring du module explique légitimement l'historique du
        bug en évoquant `schema_migrations` en prose, et un grep naïf (ou une
        recherche de constante non ciblée) le confondrait avec une requête
        réelle — même piège que le faux positif `decoder_deferred` rencontré
        en X2A."""
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf-8"))
        offending = []
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                    and node.func.attr == "execute"):
                continue
            for arg in node.args:
                if (isinstance(arg, ast.Constant) and isinstance(arg.value, str)
                        and "schema_migrations" in arg.value):
                    offending.append(arg.value)
        assert not offending, f"requête(s) suspecte(s) : {offending}"


class TestHighestAppliedVersion:
    def test_043_resolves_to_043(self) -> None:
        assert _highest_applied_version("043") == "043"

    def test_a_bound_above_the_repo_caps_at_the_real_highest_file(self) -> None:
        """Le même critère que `apply_upto` : demander 999 n'applique — et ne
        rapporte — que ce qui existe réellement sur disque."""
        assert _highest_applied_version("999") == _highest_applied_version("043")

    def test_a_low_bound_resolves_to_itself(self) -> None:
        assert _highest_applied_version("001") == "001"

    def test_a_bound_below_every_file_finds_nothing(self) -> None:
        assert _highest_applied_version("000") is None


class TestSentinelTables:
    def test_028_yields_the_evidence_kernel_tables(self) -> None:
        """028 crée le noyau de preuve dont le graveur dépend directement —
        si ces tables manquent, rien de X3 ne peut fonctionner."""
        tables = _sentinel_tables_for("028")
        assert {
            "source_registry", "source_releases", "evidence_artifacts",
            "observations", "ingestion_runs", "claim_evidence_links",
        } <= set(tables)

    def test_043_yields_real_table_names_not_guessed(self) -> None:
        tables = _sentinel_tables_for("043")
        assert "resource_assessment_runs" in tables
        assert len(tables) > 0

    def test_an_unknown_version_is_refused_with_a_named_reason(self) -> None:
        with pytest.raises(SystemExit, match="aucun fichier de migration"):
            _sentinel_tables_for("999")

    def test_a_view_only_migration_is_refused_rather_than_silently_empty(self) -> None:
        """029 ne crée qu'une VUE (`source_freshness`), aucune table — le
        module doit le signaler comme un arrêt nommé plutôt que de continuer
        avec une liste vide qui rendrait le gate aveugle sans le dire."""
        with pytest.raises(SystemExit, match="ne déclare aucune table"):
            _sentinel_tables_for("029")
