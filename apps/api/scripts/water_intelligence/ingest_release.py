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
import hashlib
import json
import sys
from pathlib import Path

from db.database import get_admin_db
from services.storage import get_storage
from services.water.staging_ingestion import (
    StagingIngestionRefused,
    WaterStagingIngestionRequest,
    load_validation_report,
    verify_report,
)
from services.water.staging_writer import (
    INGESTIBLE_SOURCES,
    StagingWriteError,
    ingest_staging_release,
)
from services.water_intelligence.connectors import hubeau_withdrawals_quality as usage


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

    report_path: Path = args.report
    if not report_path.is_file():
        raise SystemExit(f"rapport introuvable : {report_path}")

    try:
        report = load_validation_report(report_path)
    except StagingIngestionRefused as exc:
        raise SystemExit(f"REFUSÉ — {exc}") from exc

    expected = str(report.get("payload_sha256") or "")
    method = INGESTIBLE_SOURCES[args.source_code].method

    try:
        request = WaterStagingIngestionRequest(
            source_code=args.source_code,
            release_key=args.release,
            artifact_path=args.artifact,
            expected_sha256=expected,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
            method_code=method.code,
            method_version=method.version,
            environment=args.environment,
            dry_run=not args.commit,
            operator=args.operator,
        )
        verify_report(request, report)
        pages = request.read_artifact_pages()
        decoded = [usage.PAGE_DECODER.decode(page, page_index=i) for i, page in enumerate(pages)]

        result = ingest_staging_release(
            request,
            pages=pages,
            decoded_pages=decoded,
            report=report,
            connection_factory=get_admin_db,
            storage=get_storage(),
            commit=args.commit,
        )
    except StagingIngestionRefused as exc:
        raise SystemExit(f"REFUSÉ — {exc}") from exc
    except StagingWriteError as exc:
        raise SystemExit(f"ÉCHEC D'ÉCRITURE — {exc} (transaction avortée)") from exc

    payload = result.as_mapping()
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
