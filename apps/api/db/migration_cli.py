"""
migration_cli.py — CLI du ledger de migrations.

Phase PR-02A : seule la commande `plan` est implémentée (lecture seule,
aucune écriture en base). `status`/`apply`/`verify`/`baseline`/`mark-applied`
arrivent en PR-02B (PR02_ARCHITECTURE_PLAN.md §14) — elles impliquent le
bootstrap du ledger réel, l'exécution de migrations et la baseline, hors
périmètre de cette étape.

Usage :
    python -m db.migration_cli plan [--json]

Codes de sortie : 0 = plan calculé avec succès (qu'il soit vide ou non) ;
1 = erreur d'exécution (connexion DB, etc.) — mêmes codes que PR-02B (§14)
pour ne pas les changer plus tard.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from db.migration_runner import MigrationPlan, MigrationRunner


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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m db.migration_cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan_parser = subparsers.add_parser(
        "plan", help="Calcule et affiche le plan de migration (lecture seule)."
    )
    plan_parser.add_argument("--json", action="store_true", help="Sortie JSON pour intégration CI.")
    plan_parser.set_defaults(func=cmd_plan)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
