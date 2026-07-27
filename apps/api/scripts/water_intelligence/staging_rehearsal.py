"""scripts/water_intelligence/staging_rehearsal.py — outils de répétition X3
sur un PostgreSQL de staging ÉPHÉMÈRE.

Trois sous-commandes, toutes passant par la MÊME porte d'environnement que le
graveur (`services.water.staging_environment`) : jamais `DATABASE_URL`, jamais
`DATABASE_ADMIN_URL`, jamais une destination non prouvée.

    seed-sources   déclare les 4 sources Hub'Eau au Source Registry (idempotent)
    verify         contrôle une release gravée + parité, contre la base
    snapshot       construit le manifeste candidat PRIVÉ (candidate_not_published)

Ce script n'ouvre AUCUN réseau : il ne lit que la base et les rapports déjà
produits. L'acquisition reste le travail de `validate_hubeau`.

**Aucune de ces opérations n'est une approbation de publication.** Enregistrer
les capacités d'une licence dans le registre décrit ce que la licence permet ;
publier est une décision humaine distincte, absente pour les sept sources.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from services.water.staging_environment import (
    StagingEnvironmentRefused,
    staging_connection_factory,
)
from services.water.staging_ingestion import INGESTIBLE_SOURCES

#: Capacités de licence des quatre familles Hub'Eau.
#:
#: Elles ne sont pas devinées : la Licence Ouverte / Etalab 2.0 a été relevée
#: sur les fiches officielles en X1 (cf. `X1_CONNECTOR_READINESS_MATRIX.md`
#: §3), et elle accorde explicitement reproduction, adaptation, rediffusion et
#: usage commercial, sous réserve d'attribution. Les booléens ci-dessous ne
#: font que transcrire ces termes.
#:
#: `display_allowed=True` autorise à STOCKER une valeur (sans lui, le contrat
#: P02 retient toute valeur et `observations_value_presence_check` refuse la
#: ligne). Il n'autorise RIEN à être publié : la release reste `validated`, et
#: le registre des décisions humaines ne porte aucune source `approved`.
SOURCE_DECLARATIONS: dict[str, dict[str, Any]] = {
    "HUBEAU_HYDROMETRIE": {
        "publisher": "Office français de la biodiversité (OFB) — Hub'Eau",
        "title": "Hub'Eau — Hydrométrie, observations temps réel",
        "base_uri": "https://hubeau.eaufrance.fr/page/api-hydrometrie",
    },
    "HUBEAU_ADES": {
        "publisher": "BRGM — Hub'Eau / ADES",
        "title": "Hub'Eau — Piézométrie, chroniques ADES",
        "base_uri": "https://hubeau.eaufrance.fr/page/api-piezometrie",
    },
    "HUBEAU_BNPE_PRELEVEMENTS": {
        "publisher": "Office français de la biodiversité (OFB) — BNPE",
        "title": "Hub'Eau — Prélèvements en eau (BNPE)",
        "base_uri": "https://hubeau.eaufrance.fr/page/api-prelevements-eau",
    },
    "HUBEAU_QUALITE_SURFACE": {
        "publisher": "Office français de la biodiversité (OFB) — Naïades",
        "title": "Hub'Eau — Qualité des cours d'eau (Naïades)",
        "base_uri": "https://hubeau.eaufrance.fr/page/api-qualite-cours-deau",
    },
}

LICENSE_CODE = "etalab-2.0"

#: Libellé historique — CONSERVÉ pour référence, plus jamais semé. Il nommait le
#: point d'accès sans aucun producteur, ce que la condition de paternité de la
#: Licence Ouverte n'admet pas. Remplacé par la configuration canonique par
#: `source_code` (`services.water_intelligence.source_attribution`), qui
#: distingue point d'accès, système d'information source et producteurs.
LEGACY_PLATFORM_ATTRIBUTION = (
    "Source : Hub'Eau / eaufrance.fr — Licence Ouverte / Open Licence (Etalab 2.0)"
)


def _today() -> date:
    """Date de consultation de la déclaration. Lue à l'exécution, jamais figée :
    une date de consultation gelée dans le code cesserait d'être vraie dès le
    lendemain."""
    return datetime.now(timezone.utc).date()


def declared_attribution(source_code: str) -> str:
    """Attribution canonique semée dans le Source Registry, par source.

    Forme STABLE, sans date de consultation : une ligne de registre décrit une
    source, pas une lecture. La date est composée par release au moment de la
    préparation, là où elle est vraie.

    Lève sur une source hors configuration : semer un libellé générique dans le
    registre reproduirait le défaut d'origine, en le rendant durable.
    """
    from services.water_intelligence.source_attribution import stable_attribution

    return stable_attribution(source_code)


#: Capacités communes, transcrites de la Licence Ouverte 2.0.
LICENSE_CAPABILITIES = {
    "automated_access_allowed": True,
    "storage_allowed": True,
    "display_allowed": True,
    "derived_use_allowed": True,
    "commercial_use_allowed": True,
    "redistribution_allowed": True,
}

CANDIDATE_STATUS = "candidate_not_published"


def _connect(args):
    factory, target = staging_connection_factory(
        expect_database=args.expect_database, ephemeral=True
    )
    return factory, target


# ---------------------------------------------------------------------------
# Vérité structurelle du schéma — PAS de ledger `schema_migrations`.
#
# `apply_ddl_inline`/`apply_upto` (tests/_migration_fixtures.py) exécutent les
# fichiers .sql RÉELS directement, en contournant délibérément
# `migration_runner.py` et son ledger (« N'utilise jamais run_migrations()… —
# exécution directe et ordonnée pour un contrôle exact du sous-ensemble
# simulé »). C'est exactement le mécanisme que le job `migration-tests`
# réutilise pour construire ses schémas de test, et c'est pour cela qu'on le
# reprend ici tel quel — mais la table `schema_migrations` n'existe alors sous
# AUCUNE forme : elle est bootstrappée et peuplée uniquement par
# `migration_runner.py`, jamais par ce chemin. La lire ferait planter
# `migrate` et rendrait `gate` aveugle (un `COUNT` sur une table absente est
# silencieusement 0, jamais une erreur : le gate serait passé vert sans avoir
# rien prouvé).
#
# La vérité disponible ici est STRUCTURELLE : soit les fichiers appliqués par
# `apply_upto` n'ont levé aucune exception (chaque fichier committe ou
# interrompt tout, cf. `_apply_file`), soit les tables qu'un fichier de
# migration donné crée existent réellement dans `information_schema`.
# ---------------------------------------------------------------------------


def _migrations_dir() -> Path:
    from tests._migration_fixtures import MIGRATIONS_DIR

    return MIGRATIONS_DIR


def _highest_applied_version(upto: str) -> str | None:
    """Le plus haut numéro de fichier RÉELLEMENT sélectionné par `apply_upto`
    pour cette borne — même critère de sélection, jamais un ledger."""
    limit = int(upto[:3])
    numbers = [int(p.name[:3]) for p in _migrations_dir().glob("*.sql") if int(p.name[:3]) <= limit]
    return f"{max(numbers):03d}" if numbers else None


_CREATE_TABLE_RE = re.compile(r"CREATE TABLE IF NOT EXISTS\s+(\w+)", re.IGNORECASE)


def _sentinel_tables_for(version: str) -> list[str]:
    """Tables que LE fichier de migration `version` crée réellement — lues
    dans le fichier lui-même, jamais devinées. Prouve que ce fichier précis a
    été appliqué, sans dépendre d'un ledger absent de ce mécanisme."""
    matches = [p for p in _migrations_dir().glob("*.sql") if p.name[:3] == version.zfill(3)]
    if not matches:
        raise SystemExit(
            f"ARRÊT — aucun fichier de migration {version!r} dans {_migrations_dir()} : "
            "le gate ne peut pas prouver ce qu'il ne trouve pas."
        )
    text = matches[0].read_text(encoding="utf-8")
    tables = sorted(set(_CREATE_TABLE_RE.findall(text)))
    if not tables:
        raise SystemExit(
            f"ARRÊT — {matches[0].name} ne déclare aucune table CREATE TABLE IF NOT EXISTS : "
            "aucune preuve structurelle possible pour cette version."
        )
    return tables


# ---------------------------------------------------------------------------
# gate — preuve de destination, avant tout appel réseau
# ---------------------------------------------------------------------------


def gate(args) -> int:
    """Relève l'identité RÉELLE de la base et refuse tout ce qui cloche."""
    import os

    factory, target = _connect(args)
    failures: list[str] = []

    for name in ("VERCEL_ENV", "ENVIRONMENT", "APP_ENV", "NODE_ENV", "DEPLOY_ENV"):
        if (os.environ.get(name) or "").strip().lower() in {"production", "prod"}:
            failures.append(f"{name} désigne la production")
    if (os.environ.get("APP_ENV") or "").strip().lower() != "staging":
        failures.append("APP_ENV ≠ 'staging'")

    sentinel_tables = _sentinel_tables_for(args.expect_migration) if args.expect_migration else []

    with factory() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database() AS db, current_user AS usr, version() AS ver")
            row = dict(cur.fetchone())

            table_status: dict[str, bool] = {}
            for table in sentinel_tables:
                cur.execute("SELECT to_regclass(%s) AS t", (f"public.{table}",))
                table_status[table] = cur.fetchone()["t"] is not None

            tenant_rows = 0
            for table in ("source_registry", "source_releases", "observations",
                          "evidence_artifacts", "ingestion_runs"):
                cur.execute("SELECT to_regclass(%s) AS t", (f"public.{table}",))
                if cur.fetchone()["t"] is None:
                    continue
                cur.execute(f"SELECT COUNT(*) AS c FROM {table} WHERE company_id IS NOT NULL")
                tenant_rows += cur.fetchone()["c"]

    report = {
        "operation": "gate",
        "current_database": row["db"],
        "current_user": row["usr"],
        "postgres_version": row["ver"].split(" on ")[0],
        "expected_migration": args.expect_migration,
        "sentinel_tables": table_status,
        "tenant_rows": tenant_rows,
        "ephemeral": target.ephemeral,
    }

    if row["db"] != args.expect_database:
        failures.append(f"current_database()={row['db']!r} ≠ {args.expect_database!r}")
    if tenant_rows:
        failures.append(f"{tenant_rows} ligne(s) de tenant présente(s)")
    missing = [t for t, present in table_status.items() if not present]
    if missing:
        failures.append(
            f"table(s) de la migration {args.expect_migration} absente(s) : {missing}"
        )

    report["failures"] = failures
    _emit(args, report)
    print(f"  base={report['current_database']} user={report['current_user']} "
          f"pg={report['postgres_version']}")
    print(f"  tables de la migration {args.expect_migration} : {table_status} | "
          f"lignes tenant : {tenant_rows}")
    if failures:
        for f in failures:
            print(f"  ✗ {f}")
        raise SystemExit(f"ARRÊT — gate refusé ({len(failures)} anomalie(s)).")
    print("  ✓ gate vert")
    return 0


# ---------------------------------------------------------------------------
# migrate — MÊME mécanisme que le job migration-tests, jamais dupliqué
# ---------------------------------------------------------------------------


def migrate(args) -> int:
    """Applique le schéma via les helpers RÉELS du job `migration-tests`.

    `apply_ddl_inline` et `apply_upto` acceptent une connexion : on leur passe
    celle de la porte de staging. Le moteur de migration n'est donc ni
    dupliqué, ni contourné — et `DATABASE_URL` n'est jamais consulté.

    `applied_max` est calculé par le MÊME critère de sélection que
    `apply_upto` (numéro de fichier <= borne), jamais lu dans un ledger : ce
    mécanisme n'en peuple aucun (cf. le commentaire au-dessus de `gate`).
    """
    from tests._migration_fixtures import apply_ddl_inline, apply_upto

    factory, _target = _connect(args)
    applied = _highest_applied_version(args.upto)

    with factory() as conn:
        apply_ddl_inline(conn)
        apply_upto(conn, args.upto)
        with conn.cursor() as cur:
            cur.execute("SELECT current_database() AS db")
            actual = cur.fetchone()["db"]

    _emit(args, {"operation": "migrate", "current_database": actual,
                 "requested_upto": args.upto, "applied_max": applied})
    if applied is None:
        print(f"  aucun fichier de migration <= {args.upto} trouvé sur {actual}")
    else:
        print(f"  schéma appliqué jusqu'à {applied} sur {actual}")
    return 0


# ---------------------------------------------------------------------------
# seed-sources
# ---------------------------------------------------------------------------


def seed_sources(args) -> int:
    factory, _target = _connect(args)
    outcome: list[dict[str, Any]] = []

    with factory() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")
            for code in sorted(SOURCE_DECLARATIONS):
                declared = SOURCE_DECLARATIONS[code]
                cur.execute(
                    "SELECT * FROM source_registry WHERE code = %s AND company_id IS NULL",
                    (code,),
                )
                existing = cur.fetchone()
                if existing is not None:
                    # Une source déjà présente n'est JAMAIS réécrite : un écart
                    # est signalé et arrête la répétition (consigne §2).
                    drift = [
                        name
                        for name, expected in LICENSE_CAPABILITIES.items()
                        if bool(existing[name]) != expected
                    ]
                    if existing["license_code"] != LICENSE_CODE:
                        drift.append("license_code")
                    if drift:
                        raise SystemExit(
                            f"ARRÊT — source {code} déjà présente avec des valeurs "
                            f"différentes sur {drift}. Aucune modification n'est faite : "
                            "un écart de licence se tranche par une décision humaine."
                        )
                    outcome.append({"source_code": code, "action": "already_present",
                                     "source_id": existing["id"]})
                    continue

                cur.execute(
                    """
                    INSERT INTO source_registry
                        (company_id, code, publisher, title, source_type, base_uri,
                         license_code, automated_access_allowed, storage_allowed,
                         display_allowed, derived_use_allowed, commercial_use_allowed,
                         redistribution_allowed, active, attribution_text, terms_uri)
                    VALUES (NULL, %s, %s, %s, 'api', %s, %s, %s, %s, %s, %s, %s, %s,
                            TRUE, %s, %s)
                    RETURNING id
                    """,
                    (
                        code, declared["publisher"], declared["title"],
                        declared["base_uri"], LICENSE_CODE,
                        LICENSE_CAPABILITIES["automated_access_allowed"],
                        LICENSE_CAPABILITIES["storage_allowed"],
                        LICENSE_CAPABILITIES["display_allowed"],
                        LICENSE_CAPABILITIES["derived_use_allowed"],
                        LICENSE_CAPABILITIES["commercial_use_allowed"],
                        LICENSE_CAPABILITIES["redistribution_allowed"],
                        declared_attribution(code),
                        "https://www.etalab.gouv.fr/licence-ouverte-open-licence",
                    ),
                )
                outcome.append({"source_code": code, "action": "created",
                                "source_id": cur.fetchone()["id"]})

            # Les trois sources hors périmètre ne doivent exister sous AUCUNE forme.
            cur.execute(
                "SELECT code FROM source_registry WHERE company_id IS NULL AND code = ANY(%s)",
                (["EEA_WEI_PLUS", "WRI_AQUEDUCT", "COPERNICUS_EDO"],),
            )
            intruders = [r["code"] for r in cur.fetchall()]
            if intruders:
                raise SystemExit(
                    f"ARRÊT — source(s) hors périmètre X3 présente(s) au registre : {intruders}."
                )

    _emit(args, {"operation": "seed-sources", "sources": outcome})
    for row in outcome:
        print(f"  {row['source_code']:26} {row['action']}")
    return 0


# ---------------------------------------------------------------------------
# verify
# ---------------------------------------------------------------------------

_RELEASE_SQL = """
SELECT r.id, r.release_key, r.status, r.published_at, r.company_id,
       r.checksum_sha256, s.code AS source_code
FROM source_releases r
JOIN source_registry s ON s.id = r.source_id
WHERE s.code = %s AND s.company_id IS NULL
"""


def verify(args) -> int:
    factory, _target = _connect(args)
    failures: list[str] = []
    report: dict[str, Any] = {"operation": "verify", "source_code": args.source_code}

    with factory() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(_RELEASE_SQL, (args.source_code,))
            releases = cur.fetchall()

            if len(releases) != 1:
                raise SystemExit(
                    f"ARRÊT — {len(releases)} release(s) pour {args.source_code}, 1 attendue "
                    "(l'unicité de release est un invariant, pas une préférence)."
                )
            release = dict(releases[0])
            report["release"] = {
                "id": release["id"], "release_key": release["release_key"],
                "status": release["status"],
                "published_at": release["published_at"],
                "company_id": release["company_id"],
                "checksum_sha256": release["checksum_sha256"],
            }

            if release["status"] != "validated":
                failures.append(f"status={release['status']!r} ≠ 'validated'")
            if release["published_at"] is not None:
                failures.append("published_at non nul — release publiée")
            if release["company_id"] is not None:
                failures.append("company_id non nul — donnée de tenant")
            if args.expect_checksum and release["checksum_sha256"] != args.expect_checksum:
                failures.append("checksum différent de celui attesté par le rapport")

            cur.execute(
                "SELECT COUNT(*) AS c FROM evidence_artifacts "
                "WHERE source_release_id = %s AND company_id IS NULL",
                (release["id"],),
            )
            artifacts = cur.fetchone()["c"]
            report["artifacts"] = artifacts
            if artifacts < 1:
                failures.append("aucun artefact rattaché à la release")

            cur.execute(
                """
                SELECT COUNT(*) AS observations,
                       MIN(valid_from) AS period_min, MAX(valid_to) AS period_max,
                       COUNT(DISTINCT geography_code) AS geographies,
                       ARRAY_AGG(DISTINCT metric_code) AS metrics,
                       ARRAY_AGG(DISTINCT unit) AS units,
                       ARRAY_AGG(DISTINCT data_status) AS data_statuses,
                       COUNT(*) FILTER (WHERE company_id IS NOT NULL) AS tenant_rows
                FROM observations WHERE source_release_id = %s
                """,
                (release["id"],),
            )
            stats = dict(cur.fetchone())
            report["observations"] = {
                "count": stats["observations"],
                "period_min": stats["period_min"].date().isoformat() if stats["period_min"] else None,
                "period_max": stats["period_max"].date().isoformat() if stats["period_max"] else None,
                "geographies": stats["geographies"],
                "metrics": sorted(stats["metrics"] or []),
                "units": sorted(u for u in (stats["units"] or []) if u),
                "data_statuses": sorted(stats["data_statuses"] or []),
            }
            if stats["observations"] < 1:
                failures.append("aucune observation gravée")
            if stats["tenant_rows"]:
                failures.append(f"{stats['tenant_rows']} observation(s) portant un tenant")

            # Parité : ce que le graveur a annoncé doit exister en base.
            if args.expect_written is not None and args.expect_reused is not None:
                expected = args.expect_written + args.expect_reused
                report["parity"] = {
                    "written": args.expect_written, "reused": args.expect_reused,
                    "expected_total": expected, "in_database": stats["observations"],
                    "matches": expected == stats["observations"],
                }
                if expected != stats["observations"]:
                    failures.append(
                        f"parité rompue : gravées({args.expect_written}) + "
                        f"déjà présentes({args.expect_reused}) = {expected} ≠ "
                        f"{stats['observations']} en base"
                    )

            # Aucune donnée de tenant nulle part dans le noyau.
            for table in ("source_releases", "evidence_artifacts", "observations",
                          "ingestion_runs", "source_registry"):
                cur.execute(f"SELECT COUNT(*) AS c FROM {table} WHERE company_id IS NOT NULL")
                if cur.fetchone()["c"]:
                    failures.append(f"{table} contient une ligne de tenant")

            cur.execute(
                "SELECT COUNT(*) AS c FROM source_releases "
                "WHERE status = 'published' OR published_at IS NOT NULL"
            )
            if cur.fetchone()["c"]:
                failures.append("une release publiée existe dans la base")

    report["failures"] = failures
    _emit(args, report)
    print(f"  release {report['release']['release_key']} — statut "
          f"{report['release']['status']}, {report['observations']['count']} observation(s), "
          f"{report['observations']['geographies']} géographie(s), "
          f"unités {report['observations']['units']}")
    if failures:
        for f in failures:
            print(f"  ✗ {f}")
        raise SystemExit(f"ARRÊT — {len(failures)} anomalie(s) sur {args.source_code}.")
    print("  ✓ tous les contrôles passent")
    return 0


# ---------------------------------------------------------------------------
# snapshot
# ---------------------------------------------------------------------------


def snapshot(args) -> int:
    """Manifeste candidat PRIVÉ. Ne sert rien, ne publie rien, ne part nulle part."""
    factory, target = _connect(args)

    with factory() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(
                """
                SELECT s.code AS source_code, r.release_key, r.status,
                       r.checksum_sha256, r.published_at,
                       COUNT(o.id) AS observations,
                       MIN(o.valid_from) AS period_min, MAX(o.valid_to) AS period_max,
                       COUNT(DISTINCT o.geography_code) AS geographies,
                       ARRAY_AGG(DISTINCT o.metric_code) AS metrics,
                       ARRAY_AGG(DISTINCT o.unit) AS units
                FROM source_releases r
                JOIN source_registry s ON s.id = r.source_id
                LEFT JOIN observations o ON o.source_release_id = r.id
                WHERE s.company_id IS NULL AND r.company_id IS NULL
                GROUP BY s.code, r.release_key, r.status, r.checksum_sha256, r.published_at
                ORDER BY s.code
                """
            )
            rows = [dict(r) for r in cur.fetchall()]

    if any(r["status"] != "validated" or r["published_at"] is not None for r in rows):
        raise SystemExit(
            "ARRÊT — une release n'est pas 'validated' ou porte published_at : "
            "un candidat ne se construit pas sur une release publiée."
        )

    manifest = {
        "status": CANDIDATE_STATUS,
        "environment": "ephemeral_staging",
        "promotable_to_x4": False,
        "promotion_blocked_reason": (
            "staging éphémère : la base disparaît avec le runner, les releases "
            "ne sont donc pas promouvables. X4 exigera une ingestion sur un "
            "staging persistant."
        ),
        "database_name": target.database_name,
        "sources": [
            {
                "source_code": r["source_code"],
                "release_key": r["release_key"],
                "status": r["status"],
                "checksum_sha256": r["checksum_sha256"],
                "observations": r["observations"],
                "period_min": r["period_min"].date().isoformat() if r["period_min"] else None,
                "period_max": r["period_max"].date().isoformat() if r["period_max"] else None,
                "geographies": r["geographies"],
                "metrics": sorted(r["metrics"] or []),
                "units": sorted(u for u in (r["units"] or []) if u),
            }
            for r in rows
        ],
        "totals": {
            "releases": len(rows),
            "observations": sum(r["observations"] for r in rows),
        },
    }

    _emit(args, manifest)
    print(f"  manifeste candidat : {manifest['totals']['releases']} release(s), "
          f"{manifest['totals']['observations']} observation(s) — {CANDIDATE_STATUS}")
    return 0


# ---------------------------------------------------------------------------


def _emit(args, payload: dict[str, Any]) -> None:
    text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True, default=str)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Outils de répétition staging X3.")
    parser.add_argument("--expect-database", required=True)
    parser.add_argument("--output", type=Path, default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    gate_parser = sub.add_parser("gate", help="preuve de destination avant tout appel réseau")
    gate_parser.add_argument("--expect-migration", default=None,
                             help="version minimale attendue du ledger, ex. 043")

    migrate_parser = sub.add_parser("migrate", help="applique le schéma (mécanisme migration-tests)")
    migrate_parser.add_argument("--upto", required=True, help="borne haute, ex. 043")

    sub.add_parser("seed-sources", help="déclare les 4 sources Hub'Eau (idempotent)")

    verify_parser = sub.add_parser("verify", help="contrôle une release gravée")
    verify_parser.add_argument("--source-code", required=True, choices=sorted(INGESTIBLE_SOURCES))
    verify_parser.add_argument("--expect-checksum", default=None)
    verify_parser.add_argument("--expect-written", type=int, default=None)
    verify_parser.add_argument("--expect-reused", type=int, default=None)

    sub.add_parser("snapshot", help="manifeste candidat privé")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handlers = {
        "gate": gate, "migrate": migrate, "seed-sources": seed_sources,
        "verify": verify, "snapshot": snapshot,
    }
    try:
        return handlers[args.command](args)
    except StagingEnvironmentRefused as exc:
        raise SystemExit(f"ENVIRONNEMENT REFUSÉ — {exc}") from exc


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
