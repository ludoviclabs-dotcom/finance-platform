"""
intelligence_cli.py — CLI d'administration de l'import de sources (PR-04).

Pilote `snapshot_migration.import_snapshot` HORS de toute requête HTTP. Écrit
une source GLOBALE (`company_id IS NULL`) via `get_admin_db` + `app.rls_bypass`
— geste opérateur, jamais déclenché par un utilisateur (risque §11 du plan).

Usage :
    python -m db.intelligence_cli import-release \
        --source CARBONCO_DEMO_SNAPSHOT --file <path> --adapter fake [--publish] [--json]

Codes de sortie (cohérents avec le ledger, contrats §6) :
    0  succès (import effectué ou déjà à jour — idempotent)
    1  erreur (fichier illisible, structure invalide, base indisponible…)
    4  anomalie de parité (au moins une valeur diverge du snapshot — grave)

Aucun réseau, aucun LLM : seul l'adaptateur `fake` (fixture locale) existe.
"""

from __future__ import annotations

import argparse
import json
import sys

from services.intelligence.adapters.base import AdapterError
from services.intelligence.snapshot_migration import (
    DEFAULT_SNAPSHOT_PATH,
    DEMO_SOURCE_CODE,
    SnapshotMigrationError,
    import_snapshot,
)

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_PARITY_ANOMALY = 4


def cmd_import_release(args: argparse.Namespace) -> int:
    if args.adapter != "fake":
        print(
            f"Adaptateur '{args.adapter}' non supporté — seul 'fake' existe en PR-04 "
            "(aucun connecteur externe, aucun réseau).",
            file=sys.stderr,
        )
        return EXIT_ERROR
    if args.source != DEMO_SOURCE_CODE:
        print(
            f"Source '{args.source}' inconnue — seule '{DEMO_SOURCE_CODE}' est câblée "
            "au FakeAdapter/normaliseur CRM en PR-04.",
            file=sys.stderr,
        )
        return EXIT_ERROR

    file_path = args.file or str(DEFAULT_SNAPSHOT_PATH)
    try:
        result = import_snapshot(file_path=file_path, publish=args.publish)
    except (SnapshotMigrationError, AdapterError) as exc:
        print(f"Import échoué : {exc}", file=sys.stderr)
        return EXIT_ERROR
    except RuntimeError as exc:  # base non configurée (get_admin_db)
        print(f"Base indisponible : {exc}", file=sys.stderr)
        return EXIT_ERROR

    payload = result.to_dict()
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
    else:
        print(f"Source   : {result.source_code} (id={result.source_id}, "
              f"{'réutilisée' if result.source_reused else 'créée'})")
        print(f"Release  : {result.release_key} (id={result.release_id}, "
              f"statut={result.release_status}, "
              f"{'réutilisée' if result.release_reused else 'détectée'})")
        print(f"Checksum : {result.checksum_sha256}")
        print(f"Artefact : id={result.artifact_id} "
              f"({'réutilisé' if result.artifact_reused else 'stocké'})")
        print(f"Observations : {result.observations_created} créées, "
              f"{result.observations_skipped} déjà présentes, "
              f"{result.observations_total} attendues")
        if result.parity is not None:
            print(f"Parité   : ok={result.parity['ok']} "
                  f"(matched={result.parity['matched']}/{result.parity['total_expected']})")

    if result.parity is not None and not result.parity["ok"]:
        print("ANOMALIE DE PARITÉ — au moins une valeur diverge du snapshot.", file=sys.stderr)
        return EXIT_PARITY_ANOMALY
    return EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m db.intelligence_cli")
    sub = parser.add_subparsers(dest="command", required=True)

    imp = sub.add_parser("import-release", help="Importe une release depuis un fichier local (fake adapter).")
    imp.add_argument("--source", required=True, help=f"Code de source (ex. {DEMO_SOURCE_CODE}).")
    imp.add_argument("--file", default=None, help="Chemin du fichier snapshot (défaut : snapshot démo du repo).")
    imp.add_argument("--adapter", default="fake", choices=["fake"], help="Adaptateur (seul 'fake' en PR-04).")
    imp.add_argument("--publish", action="store_true", help="Valide + publie la release et matérialise les observations.")
    imp.add_argument("--json", action="store_true", help="Sortie JSON.")
    imp.set_defaults(func=cmd_import_release)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
