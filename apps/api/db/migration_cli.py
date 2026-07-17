"""
migration_cli.py — CLI du ledger de migrations.

PR-02A : `plan` (lecture seule). PR-02B (ajouté ici) : `status`, `verify`,
`baseline`, `mark-manual-verified`. Volontairement absent : `apply` — décision
explicite de Ludo, exécution réelle + workflow protégé = PR-02C.

Usage :
    python -m db.migration_cli status                                   [--json]
    python -m db.migration_cli plan                                     [--json]
    python -m db.migration_cli verify                                   [--json]
    python -m db.migration_cli baseline      [--dry-run|--commit]       [--json]
    python -m db.migration_cli mark-manual-verified <version> --applied-by <acteur> --proof <texte>

Codes de sortie : 0 = succès (y compris « rien à faire ») ; 1 = erreur
d'exécution (connexion DB, arguments invalides) ; 2 = verrou advisory non
obtenu ; 3 = migration(s) `requires_owner` en attente d'action manuelle après
`baseline` ; 4 = anomalie détectée par `verify` (checksum_mismatch/drift).
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from db.migration_runner import (
    BaselineResult,
    MigrationLockError,
    MigrationPlan,
    MigrationRunner,
)


def _plan_to_dict(plan: MigrationPlan) -> dict[str, Any]:
    return {
        "has_blocking_issues": plan.has_blocking_issues,
        "items": [
            {
                "version": item.file.version,
                "name": item.file.name,
                "checksum_sha256": item.file.checksum_sha256,
                "ledger_status": item.record.status if item.record else "pending",
                "action": item.action,
                "reason": item.reason,
            }
            for item in plan.items
        ],
    }


def _print_plan_text(plan: MigrationPlan) -> None:
    if not plan.items:
        print("Aucune migration découverte.")
        return
    width_version = max(len(item.file.version) for item in plan.items)
    for item in plan.items:
        status = item.record.status if item.record else "pending"
        print(
            f"{item.file.version:<{width_version}}  {status:<16}  {item.action:<18}  {item.reason}"
        )
    if plan.has_blocking_issues:
        print("\nAttention : au moins une migration bloque un apply naïf (voir colonne action).")


def cmd_plan(args: argparse.Namespace) -> int:
    runner = MigrationRunner()
    try:
        plan = runner.build_plan()
    except Exception as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(_plan_to_dict(plan), indent=2, default=str))
    else:
        _print_plan_text(plan)
    return 0


def _version_sort_key(version: str) -> tuple[int, str]:
    return (int(version[:3]), version[3:])


def cmd_status(args: argparse.Namespace) -> int:
    runner = MigrationRunner()
    try:
        files = runner.discover_migrations()
        records = runner.load_records()
        anomalies = runner.verify()
    except Exception as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1

    counts = {"applied": 0, "baseline": 0, "failed": 0, "manual_required": 0, "pending": 0}
    for f in files:
        record = records.get(f.version)
        counts[record.status if record else "pending"] += 1
    resolved_versions = [v for v, r in records.items() if r.status in ("applied", "baseline")]
    last_version = max(resolved_versions, key=_version_sort_key, default=None)

    if args.json:
        print(
            json.dumps(
                {"counts": counts, "last_applied_or_baseline_version": last_version, "anomalies": anomalies},
                indent=2,
                default=str,
            )
        )
    else:
        for status, n in counts.items():
            print(f"{status:<16} {n}")
        print(f"\nDernière version applied/baseline : {last_version or '(aucune)'}")
        if anomalies:
            print(f"\n{len(anomalies)} anomalie(s) :")
            for a in anomalies:
                print(f"  - {a}")
        else:
            print("\nAucune anomalie détectée.")
    return 4 if anomalies else 0


def cmd_verify(args: argparse.Namespace) -> int:
    runner = MigrationRunner()
    try:
        anomalies = runner.verify()
    except Exception as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"anomalies": anomalies}, indent=2))
    elif not anomalies:
        print("Aucune anomalie détectée.")
    else:
        print(f"{len(anomalies)} anomalie(s) :")
        for a in anomalies:
            print(f"  - {a}")
    return 4 if anomalies else 0


def _baseline_to_dict(result: BaselineResult) -> dict[str, Any]:
    return {
        "dry_run": result.dry_run,
        "written_count": result.written_count,
        "items": [
            {
                "version": item.file.version,
                "name": item.file.name,
                "action": item.action,
                "reason": item.reason,
            }
            for item in result.items
        ],
    }


def cmd_baseline(args: argparse.Namespace) -> int:
    runner = MigrationRunner()
    dry_run = not args.commit
    try:
        result = runner.baseline(dry_run=dry_run)
    except MigrationLockError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1

    blocked = [i for i in result.items if i.action == "manual_required"]
    if args.json:
        print(json.dumps(_baseline_to_dict(result), indent=2))
    else:
        mode = (
            "DRY-RUN (rien écrit)"
            if result.dry_run
            else f"COMMIT ({result.written_count} ligne(s) écrite(s))"
        )
        print(f"baseline - {mode}\n")
        width = max((len(i.file.version) for i in result.items), default=7)
        for item in result.items:
            print(f"{item.file.version:<{width}}  {item.action:<18}  {item.reason}")
        if blocked:
            print(
                f"\n{len(blocked)} version(s) requires_owner en attente d'action manuelle "
                "(mark-manual-verified)."
            )
    return 3 if blocked else 0


def cmd_mark_manual_verified(args: argparse.Namespace) -> int:
    runner = MigrationRunner()
    try:
        record = runner.mark_manual_verified(args.version, applied_by=args.applied_by, proof=args.proof)
    except MigrationLockError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 2
    except (ValueError, KeyError) as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(
            json.dumps(
                {"version": record.version, "status": record.status, "applied_by": record.applied_by},
                indent=2,
                default=str,
            )
        )
    else:
        print(f"{record.version} -> '{record.status}' (applied_by={record.applied_by})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m db.migration_cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan_parser = subparsers.add_parser(
        "plan", help="Calcule et affiche le plan de migration (lecture seule)."
    )
    plan_parser.add_argument("--json", action="store_true", help="Sortie JSON pour intégration CI.")
    plan_parser.set_defaults(func=cmd_plan)

    status_parser = subparsers.add_parser(
        "status", help="État du ledger (comptages, dernière version, anomalies). Lecture seule."
    )
    status_parser.add_argument("--json", action="store_true", help="Sortie JSON pour intégration CI.")
    status_parser.set_defaults(func=cmd_status)

    verify_parser = subparsers.add_parser(
        "verify", help="Détecte checksum_mismatch / drift_detected. Lecture seule."
    )
    verify_parser.add_argument("--json", action="store_true", help="Sortie JSON pour intégration CI.")
    verify_parser.set_defaults(func=cmd_verify)

    baseline_parser = subparsers.add_parser(
        "baseline", help="Vérifie objet par objet et marque baseline/manual_required."
    )
    baseline_mode = baseline_parser.add_mutually_exclusive_group()
    baseline_mode.add_argument(
        "--dry-run", dest="commit", action="store_false",
        help="N'écrit rien, affiche ce qui serait marqué (défaut).",
    )
    baseline_mode.add_argument(
        "--commit", dest="commit", action="store_true",
        help="Écrit réellement les lignes baseline/manual_required.",
    )
    baseline_parser.set_defaults(commit=False)
    baseline_parser.add_argument("--json", action="store_true", help="Sortie JSON pour intégration CI.")
    baseline_parser.set_defaults(func=cmd_baseline)

    mark_parser = subparsers.add_parser(
        "mark-manual-verified",
        help="Transition manual_required/pending -> baseline, avec preuve obligatoire.",
    )
    mark_parser.add_argument("version", help="Version à marquer (ex. 027).")
    mark_parser.add_argument("--applied-by", required=True, help="Acteur ayant réalisé l'action manuelle.")
    mark_parser.add_argument("--proof", required=True, help="Preuve libre (commande exécutée, ticket, capture).")
    mark_parser.add_argument("--json", action="store_true", help="Sortie JSON pour intégration CI.")
    mark_parser.set_defaults(func=cmd_mark_manual_verified)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
