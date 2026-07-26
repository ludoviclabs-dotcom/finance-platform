"""tests/test_water_staging_environment.py — porte d'environnement du graveur
Eau (X3 §1).

AUCUNE base : la porte se prouve sans PostgreSQL, ce qui est le but — elle
doit REFUSER avant qu'une connexion existe. Le seul test qui touche un curseur
utilise un double, parce qu'il vérifie une comparaison de chaînes, pas un
comportement de base.

Le défaut que ces tests verrouillent : en X2B, `--environment staging` ne
contrôlait qu'une chaîne, et la connexion venait de `get_admin_db()`, qui
retombe sur `DATABASE_URL`. Une machine portant les identifiants de
production aurait écrit en production sans que rien ne s'y oppose.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from services.water import staging_environment as gate
from services.water.staging_environment import (
    PRODUCTION_INDICATORS,
    STAGING_URL_VARIABLE,
    StagingEnvironmentRefused,
    StagingTarget,
    missing_prerequisites,
    production_indicator,
    resolve_staging_url,
    verify_database_name,
)

FAKE_URL = "postgresql://user:secret@staging.invalid:5432/water_staging"
EXPECTED_DB = "water_staging"


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch):
    """Part d'un environnement NU : aucun test ne dépend de la machine."""
    for name in (STAGING_URL_VARIABLE, "DATABASE_URL", "DATABASE_ADMIN_URL", *PRODUCTION_INDICATORS):
        monkeypatch.delenv(name, raising=False)


class _Cursor:
    """Double minimal : `verify_database_name` ne lit qu'un nom de base."""

    def __init__(self, name: str) -> None:
        self._name = name

    def execute(self, *_args, **_kwargs) -> None:
        return None

    def fetchone(self) -> dict[str, str]:
        return {"name": self._name}


# ---------------------------------------------------------------------------
# Absence de cible : le cas par défaut, et il refuse
# ---------------------------------------------------------------------------


class TestMissingTarget:
    def test_without_the_dedicated_variable_the_gate_refuses(self) -> None:
        with pytest.raises(StagingEnvironmentRefused, match="staging_environment_missing"):
            resolve_staging_url(expect_database=EXPECTED_DB)

    def test_database_url_is_never_used_as_a_fallback(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """LE défaut de X2B : `get_admin_db()` retombait sur `DATABASE_URL`.
        Ici, sa seule présence ne suffit jamais à ouvrir la porte."""
        monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@prod.invalid:5432/prod")

        with pytest.raises(StagingEnvironmentRefused, match="staging_environment_missing"):
            resolve_staging_url(expect_database=EXPECTED_DB)

    def test_database_admin_url_is_never_used_as_a_fallback(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DATABASE_ADMIN_URL", "postgresql://u:p@prod.invalid:5432/prod")

        with pytest.raises(StagingEnvironmentRefused, match="staging_environment_missing"):
            resolve_staging_url(expect_database=EXPECTED_DB)

    def test_the_refusal_names_the_variables_it_refused_to_use(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Un opérateur qui n'a que ces variables doit comprendre POURQUOI on
        ne s'en sert pas — sinon il croira à une panne et forcera."""
        monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@prod.invalid:5432/prod")

        with pytest.raises(StagingEnvironmentRefused) as excinfo:
            resolve_staging_url(expect_database=EXPECTED_DB)

        assert "DATABASE_URL" in str(excinfo.value)
        assert "accident" in str(excinfo.value)

    def test_prerequisites_are_listed_precisely(self) -> None:
        missing = missing_prerequisites()

        assert len(missing) == 1
        assert STAGING_URL_VARIABLE in missing[0]

    def test_no_prerequisite_remains_once_the_variable_is_set(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(STAGING_URL_VARIABLE, FAKE_URL)

        assert missing_prerequisites() == []


# ---------------------------------------------------------------------------
# Production : refus inconditionnel
# ---------------------------------------------------------------------------


class TestProductionRefusal:
    @pytest.mark.parametrize("indicator", PRODUCTION_INDICATORS)
    def test_any_production_indicator_refuses_even_with_a_staging_url(
        self, monkeypatch: pytest.MonkeyPatch, indicator: str
    ) -> None:
        monkeypatch.setenv(STAGING_URL_VARIABLE, FAKE_URL)
        monkeypatch.setenv(indicator, "production")

        with pytest.raises(StagingEnvironmentRefused, match="production_environment_refused"):
            resolve_staging_url(expect_database=EXPECTED_DB)

    def test_prod_is_refused_like_production(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(STAGING_URL_VARIABLE, FAKE_URL)
        monkeypatch.setenv("VERCEL_ENV", "prod")

        with pytest.raises(StagingEnvironmentRefused, match="production_environment_refused"):
            resolve_staging_url(expect_database=EXPECTED_DB)

    def test_the_indicator_is_case_insensitive(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(STAGING_URL_VARIABLE, FAKE_URL)
        monkeypatch.setenv("VERCEL_ENV", "PRODUCTION")

        assert production_indicator() == ("VERCEL_ENV", "production")

    def test_preview_and_development_are_not_production(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(STAGING_URL_VARIABLE, FAKE_URL)
        monkeypatch.setenv("VERCEL_ENV", "preview")

        assert production_indicator() is None
        assert resolve_staging_url(expect_database=EXPECTED_DB) == FAKE_URL

    def test_production_is_checked_before_the_url(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Aucune URL ne rachète un environnement de production, et le refus
        doit le dire — pas se plaindre d'une variable manquante."""
        monkeypatch.setenv("VERCEL_ENV", "production")

        with pytest.raises(StagingEnvironmentRefused, match="production_environment_refused"):
            resolve_staging_url(expect_database=EXPECTED_DB)


# ---------------------------------------------------------------------------
# Destination prouvée, pas déclarée
# ---------------------------------------------------------------------------


class TestProvenDestination:
    def test_an_undeclared_database_name_is_refused(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(STAGING_URL_VARIABLE, FAKE_URL)

        with pytest.raises(StagingEnvironmentRefused, match="ne peut pas être prouvée"):
            resolve_staging_url(expect_database="   ")

    def test_the_real_database_name_must_match_the_declared_one(self) -> None:
        with pytest.raises(StagingEnvironmentRefused, match="≠ base annoncée"):
            verify_database_name(_Cursor("carbonco_production"), expect_database=EXPECTED_DB)

    def test_a_matching_name_passes(self) -> None:
        assert verify_database_name(_Cursor(EXPECTED_DB), expect_database=EXPECTED_DB) == EXPECTED_DB

    def test_a_typo_in_the_url_cannot_reach_another_database_silently(self) -> None:
        """Le scénario qui compte : l'URL pointe ailleurs que prévu. La porte
        échoue sur le nom RÉEL, avant toute écriture."""
        with pytest.raises(StagingEnvironmentRefused) as excinfo:
            verify_database_name(_Cursor("neondb"), expect_database=EXPECTED_DB)

        assert "avant toute écriture" in str(excinfo.value)


# ---------------------------------------------------------------------------
# Le secret ne sort jamais
# ---------------------------------------------------------------------------


class TestSecretNeverLeaks:
    def test_the_target_never_carries_the_url(self) -> None:
        target = StagingTarget(database_name=EXPECTED_DB, ephemeral=False)

        assert "secret" not in str(target.as_mapping())
        assert not any("://" in str(v) for v in target.as_mapping().values())

    def test_the_refusal_message_never_contains_the_url(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(STAGING_URL_VARIABLE, FAKE_URL)
        monkeypatch.setenv("VERCEL_ENV", "production")

        with pytest.raises(StagingEnvironmentRefused) as excinfo:
            resolve_staging_url(expect_database=EXPECTED_DB)

        assert "secret" not in str(excinfo.value)
        assert "staging.invalid" not in str(excinfo.value)

    def test_the_module_never_logs(self) -> None:
        """Pas de logger : une URL de base ne doit pas pouvoir atterrir dans un
        journal par distraction."""
        source = (
            Path(__file__).resolve().parents[1]
            / "services" / "water" / "staging_environment.py"
        ).read_text(encoding="utf-8")

        assert "logging" not in source
        assert "print(" not in source


# ---------------------------------------------------------------------------
# La CLI passe bien par la porte
# ---------------------------------------------------------------------------


class TestTheCliGoesThroughTheGate:
    CLI = (
        Path(__file__).resolve().parents[1]
        / "scripts" / "water_intelligence" / "ingest_release.py"
    )

    def test_the_cli_no_longer_uses_the_generic_admin_connection(self) -> None:
        """`get_admin_db` résout `DATABASE_ADMIN_URL` puis retombe sur
        `DATABASE_URL` : c'est précisément le chemin par lequel une ingestion
        « staging » atteignait la production."""
        source = self.CLI.read_text(encoding="utf-8")

        assert "get_admin_db" not in source
        assert "staging_connection_factory" in source

    def test_the_cli_requires_an_expected_database_name(self) -> None:
        tree = ast.parse(self.CLI.read_text(encoding="utf-8"))
        options = {
            node.args[0].value
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and getattr(node.func, "attr", None) == "add_argument"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        }

        assert "--expect-database" in options

    def test_the_dry_run_goes_through_the_same_gate(self) -> None:
        """Un dry-run ouvre une VRAIE transaction : le laisser contourner la
        porte reviendrait à se connecter à la production « pour vérifier »."""
        source = self.CLI.read_text(encoding="utf-8")
        gate_position = source.index("staging_connection_factory(")
        ingest_position = source.index("ingest_staging_release(")

        assert gate_position < ingest_position

    def test_the_url_is_never_a_command_line_argument(self) -> None:
        """Un secret passé en argument se retrouve dans l'historique du shell
        et dans la table des processus."""
        source = self.CLI.read_text(encoding="utf-8")

        assert "--database-url" not in source
        assert "--staging-url" not in source


class TestVerdictVocabulary:
    def test_the_three_verdicts_are_stable(self) -> None:
        assert gate.VERDICT_MISSING == "staging_environment_missing"
        assert gate.VERDICT_PRODUCTION_REFUSED == "production_environment_refused"
        assert gate.VERDICT_READY == "staging_environment_ready"

    def test_an_ephemeral_target_says_so(self) -> None:
        target = StagingTarget(database_name=EXPECTED_DB, ephemeral=True)

        assert target.as_mapping()["ephemeral"] is True
