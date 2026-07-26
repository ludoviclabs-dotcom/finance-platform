"""
staging_environment.py — porte d'environnement du graveur Eau (X3).

X2B a livré un graveur dont l'argument `--environment staging` ne contrôlait
qu'une **chaîne de caractères**. La connexion, elle, venait de
`db.database.get_admin_db()`, qui résout `DATABASE_ADMIN_URL` puis **retombe
silencieusement sur `DATABASE_URL`**. Sur une machine portant les
identifiants de production, `ingest_release --commit --environment staging`
aurait donc écrit **en production**, et le mot « staging » n'y aurait rien
changé.

Ce module est la porte qui manquait. Il applique les interdictions de X3 §1 :

- jamais de base de production ;
- jamais `DATABASE_URL`/`DATABASE_ADMIN_URL` par défaut — l'URL de staging
  doit être fournie sous un nom qui ne peut pas être confondu ;
- jamais d'écriture si un indicateur d'environnement désigne la production ;
- la destination doit être **prouvée**, pas déclarée.

**Ce que la porte prouve, et ce qu'elle ne prouve pas.** Elle prouve que
l'opérateur a fourni une URL sous un nom dédié, qu'aucun indicateur de
production n'est présent, et que la base réellement atteinte porte bien le
nom qu'il a annoncé (`SELECT current_database()`, vérifié dans la transaction
avant la moindre écriture). Elle ne peut pas prouver qu'une base ainsi
déclarée n'est pas, en réalité, la production : cela, seul l'opérateur le
sait. Ce que la porte supprime, c'est l'accident silencieux — le cas où
personne n'a rien déclaré et où le graveur a écrit quelque part quand même.

**Le secret ne sort jamais d'ici.** Aucune URL n'est journalisée, retournée,
ni recopiée dans un rapport : seuls le nom de base annoncé et le nom de base
constaté circulent.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Iterator

#: Nom RÉSERVÉ de l'URL de staging. Volontairement distinct de `DATABASE_URL`
#: et de `DATABASE_ADMIN_URL` : une variable qu'on ne peut pas confondre avec
#: celle de production est le premier garde-fou.
STAGING_URL_VARIABLE = "WATER_STAGING_DATABASE_URL"

#: Variables dont la valeur `production` interdit toute écriture, quel que
#: soit le reste. Vérifiées AVANT même de regarder l'URL.
PRODUCTION_INDICATORS: tuple[str, ...] = (
    "VERCEL_ENV",
    "ENVIRONMENT",
    "APP_ENV",
    "NODE_ENV",
    "DEPLOY_ENV",
)

PRODUCTION_VALUES = frozenset({"production", "prod"})

#: Variables dont X3 refuse explicitement de se servir comme cible d'écriture.
#: Les nommer sert au message d'erreur : un opérateur qui n'a que celles-là
#: doit comprendre POURQUOI on ne s'en sert pas.
REFUSED_FALLBACK_VARIABLES: tuple[str, ...] = ("DATABASE_URL", "DATABASE_ADMIN_URL")

VERDICT_MISSING = "staging_environment_missing"
VERDICT_PRODUCTION_REFUSED = "production_environment_refused"
VERDICT_READY = "staging_environment_ready"


class StagingEnvironmentRefused(Exception):
    """Aucune cible d'écriture sûre — arrêt AVANT toute acquisition ou écriture."""


@dataclass(frozen=True)
class StagingTarget:
    """Cible d'écriture vérifiée. Ne porte JAMAIS l'URL."""

    #: Nom de base annoncé par l'opérateur, puis confirmé par la base elle-même.
    database_name: str
    #: Staging jetable (option B) : les releases ne survivront pas à la
    #: répétition, et X4 ne pourra donc pas s'appuyer dessus.
    ephemeral: bool
    #: Verdict lisible, recopiable tel quel dans un rapport.
    verdict: str = VERDICT_READY

    def as_mapping(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict,
            "database_name": self.database_name,
            "ephemeral": self.ephemeral,
            "url_variable": STAGING_URL_VARIABLE,
        }


def production_indicator() -> tuple[str, str] | None:
    """Rend le premier indicateur d'environnement valant `production`, ou None."""
    for name in PRODUCTION_INDICATORS:
        value = (os.environ.get(name) or "").strip().lower()
        if value in PRODUCTION_VALUES:
            return name, value
    return None


def missing_prerequisites() -> list[str]:
    """Liste EXACTE de ce qui manque pour que la porte s'ouvre.

    Rendue telle quelle dans le rapport de gate : un opérateur doit pouvoir la
    lire et savoir quoi provisionner, sans relire le code.
    """
    missing: list[str] = []
    if not (os.environ.get(STAGING_URL_VARIABLE) or "").strip():
        missing.append(
            f"{STAGING_URL_VARIABLE} absente — URL d'une base PostgreSQL "
            "NON-production, fournie dans l'environnement (jamais dans Git, "
            "jamais dans une commande affichée)."
        )
    indicator = production_indicator()
    if indicator is not None:
        missing.append(
            f"{indicator[0]}={indicator[1]} — indicateur de production présent : "
            "aucune écriture n'est permise depuis cet environnement."
        )
    return missing


def resolve_staging_url(*, expect_database: str) -> str:
    """Rend l'URL de staging après contrôle, ou refuse. **Ne la journalise pas.**

    `expect_database` est le nom de base que l'opérateur annonce viser. Il est
    obligatoire : sans lui, la porte n'aurait rien à confronter au réel.
    """
    if not (expect_database or "").strip():
        raise StagingEnvironmentRefused(
            "aucun nom de base attendu déclaré — la destination ne peut pas être "
            "prouvée, et une destination non prouvée est refusée (X3 §1)."
        )

    indicator = production_indicator()
    if indicator is not None:
        raise StagingEnvironmentRefused(
            f"{VERDICT_PRODUCTION_REFUSED} : {indicator[0]}={indicator[1]}. "
            "Aucune écriture depuis un environnement de production, quelle que "
            "soit l'URL fournie."
        )

    url = (os.environ.get(STAGING_URL_VARIABLE) or "").strip()
    if not url:
        available = [v for v in REFUSED_FALLBACK_VARIABLES if os.environ.get(v)]
        detail = (
            f" ({', '.join(available)} présente(s), mais X3 refuse de s'en servir : "
            "leur destination n'est pas prouvée et c'est exactement ainsi qu'on "
            "écrit en production par accident)"
            if available
            else ""
        )
        raise StagingEnvironmentRefused(
            f"{VERDICT_MISSING} : {STAGING_URL_VARIABLE} absente{detail}."
        )
    return url


def verify_database_name(cur, *, expect_database: str) -> str:
    """Confronte le nom annoncé au nom RÉEL de la base atteinte.

    Appelée dans la transaction, avant toute écriture. Une faute de frappe
    dans l'URL — le scénario par lequel on atteint la production sans le
    vouloir — échoue ici, à coup sûr et sans rien avoir écrit.
    """
    cur.execute("SELECT current_database() AS name")
    actual = cur.fetchone()["name"]
    if actual != expect_database:
        raise StagingEnvironmentRefused(
            f"base atteinte {actual!r} ≠ base annoncée {expect_database!r} — "
            "la destination n'est pas celle déclarée. Transaction avortée avant "
            "toute écriture."
        )
    return actual


def staging_connection_factory(
    *, expect_database: str, ephemeral: bool = False
) -> tuple[Callable[[], Any], StagingTarget]:
    """Fabrique une connexion vers la base de staging PROUVÉE.

    Contrat identique à `get_db`/`get_admin_db` : commit à la sortie du
    contexte, rollback sur exception, connexion fermée à chaque fois. La
    vérification du nom de base est faite à l'ouverture, donc AVANT que
    l'appelant ait pu écrire quoi que ce soit.
    """
    url = resolve_staging_url(expect_database=expect_database)

    # Import tardif : ce module reste importable (et testable) sans psycopg2,
    # ce qui compte pour les tests de la porte elle-même.
    from db.database import _PSYCOPG2_AVAILABLE  # noqa: PLC0415

    if not _PSYCOPG2_AVAILABLE:
        raise StagingEnvironmentRefused(
            "psycopg2 indisponible — aucune connexion possible, donc aucune écriture."
        )

    import psycopg2  # noqa: PLC0415
    from psycopg2.extras import RealDictCursor  # noqa: PLC0415

    @contextmanager
    def factory() -> Iterator[Any]:
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                verify_database_name(cur, expect_database=expect_database)
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    return factory, StagingTarget(database_name=expect_database, ephemeral=ephemeral)
