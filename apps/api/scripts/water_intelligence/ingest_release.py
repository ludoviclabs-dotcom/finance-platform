"""scripts/water_intelligence/ingest_release.py — grave une release Eau
validée dans l'Evidence Kernel, en staging (X2B).

**C'est le SEUL script opérateur Eau qui touche la base.** Tous les autres
(`validate_hubeau`, `validate_eea`, `discover_hubeau`…) sont en lecture seule
par construction, et un test le vérifie fichier par fichier. L'exemption est
NOMMÉE dans ce test, exactement comme `fetcher.py` est le seul à pouvoir
ouvrir le réseau — une exception explicite et testée, jamais une règle
affaiblie.

Symétriquement, ce script n'ouvre AUCUNE connexion réseau : il ne lit que
l'artefact local et son rapport. Rien n'est retéléchargé au moment de graver.

Usage (dry-run par défaut — le dry-run exécute le VRAI chemin d'écriture puis
avorte la transaction) :

    python -m scripts.water_intelligence.ingest_release \
      --source-code HUBEAU_HYDROMETRIE \
      --release hubeau-hydrometrie-observations-tr-2026-07-26-x2a \
      --artifact /chemin/hors/depot/pages \
      --report docs/carbonco/water-intelligence/activation/reports/X2A_HUBEAU_HYDROMETRIE.md \
      --dry-run

puis, pour graver réellement :

    ... --commit --environment staging
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from services.storage import get_storage
from services.water.staging_environment import (
    STAGING_URL_VARIABLE,
    StagingEnvironmentRefused,
    staging_connection_factory,
)
from services.water.staging_ingestion import (
    INGESTIBLE_SOURCES,
    StagingIngestionRefused,
    load_verified_request,
    report_retrieved_on,
)
from services.water.staging_writer import (
    StagingWriteError,
    ingest_staging_release,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Ingestion staging d'une release Eau dans l'Evidence Kernel (X2B).",
    )
    parser.add_argument("--source-code", required=True, choices=sorted(INGESTIBLE_SOURCES))
    parser.add_argument("--release", required=True, help="release_key exacte du rapport")
    parser.add_argument(
        "--artifact", required=True, type=Path,
        help="page unique OU répertoire de pages (acquisition paginée), HORS dépôt",
    )
    parser.add_argument("--report", required=True, type=Path, help="rapport X1/X2A")
    parser.add_argument(
        "--environment", default="staging",
        help="staging uniquement — toute autre valeur est refusée",
    )
    parser.add_argument("--operator", default=None, help="identité de l'opérateur")
    parser.add_argument(
        "--expect-database", required=True,
        help=(
            "nom de la base de staging visée, confronté à current_database() "
            "AVANT toute écriture — l'URL, elle, vient de "
            f"{STAGING_URL_VARIABLE} et n'est jamais passée en argument"
        ),
    )
    parser.add_argument(
        "--ephemeral", action="store_true",
        help="staging jetable (option B) : les releases ne survivront pas à la répétition",
    )
    parser.add_argument(
        "--output", type=Path, default=None,
        help="chemin du rapport d'ingestion JSON (facultatif)",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dry-run", dest="commit", action="store_false",
        help="défaut : exécute tout puis avorte la transaction",
    )
    group.add_argument(
        "--commit", dest="commit", action="store_true",
        help="grave réellement (transaction unique, tout ou rien)",
    )
    parser.set_defaults(commit=False)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    # Porte d'environnement EN PREMIER, avant même de regarder les fichiers :
    # sur une machine portant les identifiants de production, le premier
    # message doit être le refus, pas une remarque sur un chemin de rapport.
    # `--environment staging` n'est qu'une déclaration ; c'est ici que la
    # destination est prouvée. Le dry-run passe par la même porte, puisqu'il
    # ouvre lui aussi une vraie transaction.
    try:
        connection_factory, target = staging_connection_factory(
            expect_database=args.expect_database, ephemeral=args.ephemeral
        )
    except StagingEnvironmentRefused as exc:
        raise SystemExit(f"ENVIRONNEMENT REFUSÉ — {exc}") from exc

    report_path: Path = args.report
    if not report_path.is_file():
        raise SystemExit(f"rapport introuvable : {report_path}")

    try:
        # Chemin PARTAGÉ avec le constructeur de candidats X4B : une release
        # mesurée doit être exactement celle que ce graveur préparerait.
        loaded = load_verified_request(
            source_code=args.source_code,
            release_key=args.release,
            artifact_path=args.artifact,
            report_path=report_path,
            environment=args.environment,
            operator=args.operator,
            dry_run=not args.commit,
        )

        result = ingest_staging_release(
            loaded.request,
            pages=loaded.pages,
            decoded_pages=loaded.decoded_pages,
            report=loaded.report,
            connection_factory=connection_factory,
            storage=get_storage(),
            commit=args.commit,
            # Le jour où la SOURCE a été consultée, lu dans le rapport — pas le
            # jour où l'on grave. L'attribution Licence Ouverte 2.0 porte cette
            # date : y écrire la date de gravure la rendrait fausse.
            retrieved_at=report_retrieved_on(loaded.report),
        )
    except StagingEnvironmentRefused as exc:
        raise SystemExit(f"ENVIRONNEMENT REFUSÉ — {exc} (transaction avortée)") from exc
    except StagingIngestionRefused as exc:
        raise SystemExit(f"REFUSÉ — {exc}") from exc
    except StagingWriteError as exc:
        raise SystemExit(f"ÉCHEC D'ÉCRITURE — {exc} (transaction avortée)") from exc

    payload = result.as_mapping()
    # La cible est recopiée par son NOM et son verdict ; jamais son URL.
    payload["staging_target"] = target.as_mapping()
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )

    state = "GRAVÉ" if result.committed else "DRY-RUN (rien conservé)"
    print(
        f"{result.source_code} / {result.release_key} : {state} — "
        f"statut de release `{result.release_status}`, "
        f"{result.observations_written} observation(s) écrite(s), "
        f"{result.observations_reused} réutilisée(s), "
        f"{result.records_rejected} rejetée(s)."
    )
    for warning in result.warnings[:5]:
        print(f"  ⚠ {warning}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
