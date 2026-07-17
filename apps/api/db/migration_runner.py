"""
migration_runner.py — découverte, modèle et planification du ledger de migrations.

Phase PR-02A (lecture seule) : discover_migrations, calculate_checksum,
load_records, build_plan. Aucune écriture en base, aucune exécution de SQL,
aucune création de table (schema_migrations compris — sa création est le
bootstrap décrit en PR02_ARCHITECTURE_PLAN.md §6, réservé à PR-02B).

Les méthodes d'exécution (acquire_lock, apply_one, apply_plan, baseline,
verify, mark_manual_verified) sont ajoutées à cette même classe en PR-02B.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from db.database import db_available, get_db
from db.migration_manifest import get_meta

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

# §7 — capture "001".."027" et "008b" sans ambiguïté ; tout le reste est ignoré
# (avertissement, pas une erreur bloquante) pour ne pas casser sur un fichier
# non-migration (README, .gitkeep) présent dans le même dossier.
_FILENAME_RE = re.compile(r"^(?P<num>\d{3})(?P<suffix>[a-z]?)_(?P<slug>[a-z0-9_]+)\.sql$")

RecordStatus = Literal["applied", "failed", "manual_required", "baseline"]
PlanAction = Literal["apply", "skip", "blocked_manual", "checksum_mismatch", "drift_detected"]


@dataclass(frozen=True)
class MigrationFile:
    version: str          # "004", "008b", "027"
    suffix: str            # "", "b"
    name: str               # nom de fichier complet
    path: Path
    checksum_sha256: str


@dataclass(frozen=True)
class MigrationRecord:
    version: str
    name: str
    checksum_sha256: str
    status: RecordStatus
    applied_at: datetime | None
    execution_ms: int | None
    applied_by: str | None
    requires_owner: bool
    transactional: bool
    error_message: str | None
    metadata: dict


@dataclass(frozen=True)
class MigrationPlanItem:
    file: MigrationFile
    record: MigrationRecord | None       # None si jamais vue dans le ledger (pending)
    action: PlanAction
    reason: str


@dataclass(frozen=True)
class MigrationPlan:
    items: list[MigrationPlanItem]
    has_blocking_issues: bool             # True si un mismatch/drift/manual bloque un apply naïf


def _plan_item(file: MigrationFile, record: MigrationRecord | None) -> MigrationPlanItem:
    """Détermine l'action recommandée pour un fichier. Pur (aucune I/O) — testable sans DB.

    Le checksum est comparé pour TOUTE ligne existante, pas seulement
    `applied`/`baseline` — un fichier modifié après un `manual_required` ou un
    `failed` mérite d'être signalé tout autant (extension prudente de I2).
    """
    if record is not None and record.checksum_sha256 != file.checksum_sha256:
        return MigrationPlanItem(
            file=file,
            record=record,
            action="checksum_mismatch",
            reason=(
                f"checksum ledger {record.checksum_sha256[:12]}... != fichier actuel "
                f"{file.checksum_sha256[:12]}... (statut ledger : {record.status})"
            ),
        )

    if record is None:
        meta = get_meta(file.version)
        if meta.requires_owner:
            return MigrationPlanItem(
                file=file,
                record=None,
                action="blocked_manual",
                reason=(
                    f"requires_owner=true ({meta.note or 'privilège propriétaire requis'}) — "
                    "jamais exécutée par apply, voir mark-manual-verified (PR-02B)"
                ),
            )
        return MigrationPlanItem(
            file=file,
            record=None,
            action="apply",
            reason="absente du ledger — aucune trace d'application antérieure",
        )

    if record.status in ("applied", "baseline"):
        return MigrationPlanItem(
            file=file,
            record=record,
            action="skip",
            reason=f"déjà '{record.status}', checksum inchangé",
        )

    # manual_required ou failed : jamais retentée automatiquement par apply (I4/I5, §11)
    return MigrationPlanItem(
        file=file,
        record=record,
        action="blocked_manual",
        reason=(
            f"statut ledger '{record.status}' — nécessite une action explicite "
            "(mark-manual-verified, ou nouvelle version corrigée) avant tout apply (PR-02B)"
        ),
    )


class MigrationRunner:
    """Découverte, modèle et planification du ledger de migrations.

    Phase PR-02A : seules les méthodes en lecture seule ci-dessous sont
    implémentées. `apply_plan`/`baseline`/`verify`/`acquire_lock`/
    `mark_manual_verified` arrivent en PR-02B.
    """

    def __init__(self, migrations_dir: Path = MIGRATIONS_DIR):
        self.migrations_dir = migrations_dir

    def calculate_checksum(self, path: Path) -> str:
        """SHA-256 des octets bruts du fichier (§7 — pas de normalisation)."""
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def discover_migrations(self) -> list[MigrationFile]:
        """Liste et checksumme les fichiers `*.sql` valides, triés (int(num), suffix).

        Tri explicite — jamais l'ordre brut du système de fichiers (§7 : le tri
        lexicographique actuel de `migrations.py` donne le bon ordre pour
        008/008b/009 par coïncidence ASCII, pas par contrat garanti).
        """
        files: list[MigrationFile] = []
        for path in self.migrations_dir.iterdir():
            if not path.is_file():
                continue
            match = _FILENAME_RE.match(path.name)
            if not match:
                logger.warning(
                    "discover_migrations: fichier ignoré (nom non conforme) : %s", path.name
                )
                continue
            files.append(
                MigrationFile(
                    version=match.group("num") + match.group("suffix"),
                    suffix=match.group("suffix"),
                    name=path.name,
                    path=path,
                    checksum_sha256=self.calculate_checksum(path),
                )
            )
        files.sort(key=lambda f: (int(f.version[:3]), f.suffix))
        return files

    def load_records(self) -> dict[str, MigrationRecord]:
        """Lit l'état actuel du ledger `schema_migrations`.

        Retourne un dict vide si la table n'existe pas encore — cas normal
        avant le bootstrap PR-02B (§6). Ne crée jamais la table elle-même.
        """
        if not db_available():
            raise RuntimeError(
                "PostgreSQL non configuré (DATABASE_URL manquant ou psycopg2 absent)"
            )
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
                if cur.fetchone()["t"] is None:
                    return {}
                cur.execute(
                    """
                    SELECT version, name, checksum_sha256, status, applied_at, execution_ms,
                           applied_by, requires_owner, transactional, error_message, metadata
                    FROM schema_migrations
                    """
                )
                rows = cur.fetchall()
        return {
            row["version"]: MigrationRecord(
                version=row["version"],
                name=row["name"],
                checksum_sha256=row["checksum_sha256"],
                status=row["status"],
                applied_at=row["applied_at"],
                execution_ms=row["execution_ms"],
                applied_by=row["applied_by"],
                requires_owner=row["requires_owner"],
                transactional=row["transactional"],
                error_message=row["error_message"],
                metadata=row["metadata"] or {},
            )
            for row in rows
        }

    def build_plan(self) -> MigrationPlan:
        """Confronte fichiers découverts, ledger et manifeste — déterministe, lecture seule."""
        files = self.discover_migrations()
        records = self.load_records()
        items = [_plan_item(f, records.get(f.version)) for f in files]
        has_blocking_issues = any(
            item.action in ("blocked_manual", "checksum_mismatch", "drift_detected")
            for item in items
        )
        return MigrationPlan(items=items, has_blocking_issues=has_blocking_issues)
