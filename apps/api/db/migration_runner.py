"""
migration_runner.py — découverte, modèle, planification et ledger de migrations.

PR-02A (lecture seule) : discover_migrations, calculate_checksum, load_records,
build_plan.

PR-02B (ajouté ici) : bootstrap contrôlé de `schema_migrations`, verrou
advisory de session (`acquire_lock`), vérification objet-par-objet
(`verify_migration_objects`, délègue à `migration_probes`), `baseline`,
`verify` (checksum_mismatch + drift_detected), `mark_manual_verified`.

Volontairement absent (PR-02C) : `apply_one`/`apply_plan`/CLI `apply`/
`AUTO_MIGRATE` — décision explicite de Ludo (rien à appliquer, 28/28 fichiers
couverts par `baseline`, exécution SQL réelle = pièce la plus risquée du
runner, cf. PR02B_IMPLEMENTATION_PLAN.md §0). `baseline`/`mark_manual_verified`
n'exécutent jamais de SQL de migration — ils ne font que constater et
enregistrer un état déjà réel (objets déjà présents, y compris quand ils l'ont
été par une action manuelle hors runner, §8).
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Literal

from db import migration_probes
from db.database import db_available, get_db
from db.migration_manifest import get_meta
from db.migrations import DDL as _INLINE_DDL

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
BOOTSTRAP_DDL_PATH = Path(__file__).parent / "_bootstrap" / "000_schema_migrations_ledger.sql"
ADVISORY_LOCK_KEY = "carbonco_schema_migrations"
_INLINE_DDL_PATH = Path(__file__).parent / "migrations.py"

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


class MigrationError(Exception):
    """Base des erreurs du runner de migrations."""


class MigrationLockError(MigrationError):
    """Le verrou advisory n'a pas pu être obtenu dans le budget imparti."""


# `baseline()`/`mark_manual_verified()` ont un vocabulaire d'action distinct de
# `MigrationPlan` (qui répond à « que ferait apply ? », hors périmètre PR-02B) —
# deux préoccupations différentes, deux types, pas un seul type surchargé.
BaselineAction = Literal["already_recorded", "baseline", "manual_required", "still_pending"]


@dataclass(frozen=True)
class BaselineItem:
    file: MigrationFile
    action: BaselineAction
    reason: str


@dataclass(frozen=True)
class BaselineResult:
    items: list[BaselineItem]
    dry_run: bool
    written_count: int   # lignes réellement écrites (0 si dry_run=True)


def _synthetic_000_file() -> MigrationFile:
    """Représentation synthétique du DDL inline historique (`migrations.py`).

    N'est **jamais** retournée par `discover_migrations()` (ce n'est pas un
    fichier `.sql` dans `migrations/`, seulement une constante Python) — donc
    n'apparaît **pas** dans `build_plan()` (PR-02A, inchangé, toujours 28
    items). Utilisée uniquement par `baseline()`/`verify()`, qui doivent
    traiter le socle historique comme la ligne `version='000'` du ledger
    (§6 — à ne pas confondre avec le bootstrap technique de la table
    elle-même, qui vit dans `_bootstrap/000_schema_migrations_ledger.sql`).
    """
    return MigrationFile(
        version="000",
        suffix="",
        name="000 (DDL inline, migrations.py)",
        path=_INLINE_DDL_PATH,
        checksum_sha256=hashlib.sha256(_INLINE_DDL.encode("utf-8")).hexdigest(),
    )


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
    """Découverte, modèle, planification et ledger de migrations.

    PR-02A : `discover_migrations`/`calculate_checksum`/`load_records`/
    `build_plan`, lecture seule. PR-02B : `acquire_lock`/`baseline`/`verify`/
    `mark_manual_verified`, mutants mais jamais d'exécution de SQL de
    migration (`apply_one`/`apply_plan` restent hors périmètre, PR-02C).
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
        """Lit l'état actuel du ledger `schema_migrations` (ouvre sa propre connexion).

        Retourne un dict vide si la table n'existe pas encore — cas normal
        avant un premier `baseline()`. Ne crée jamais la table elle-même.
        """
        if not db_available():
            raise RuntimeError(
                "PostgreSQL non configuré (DATABASE_URL manquant ou psycopg2 absent)"
            )
        with get_db() as conn:
            return self._read_records(conn)

    def _read_records(self, conn) -> dict[str, MigrationRecord]:
        """Identique à `load_records()`, mais sur une connexion déjà ouverte.

        Utilisé par `baseline()`/`verify()` pour rester sur l'unique connexion
        tenue sous le verrou advisory (§10-11), plutôt que d'en ouvrir une 2e.
        """
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

    # ── PR-02B — bootstrap, verrou, baseline, verify, mark-manual-verified ──

    @contextmanager
    def acquire_lock(
        self, conn, timeout_s: float = 30.0, retry_interval_s: float = 2.0
    ) -> Iterator[None]:
        """Verrou advisory PostgreSQL de **session** (pas de transaction, §10).

        Une clé fixe dérivée d'une chaîne stable (`hashtext`), pas un entier
        codé en dur sans signification. Budget de nouvelle tentative borné —
        ne bloque jamais indéfiniment un run CI ou un cold start.
        """
        deadline = time.monotonic() + timeout_s
        while True:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT pg_try_advisory_lock(hashtext(%s)) AS locked", (ADVISORY_LOCK_KEY,)
                )
                locked = cur.fetchone()["locked"]
            if locked:
                break
            if time.monotonic() >= deadline:
                raise MigrationLockError(
                    f"Verrou '{ADVISORY_LOCK_KEY}' non obtenu après {timeout_s}s — "
                    "un autre run est probablement en cours"
                )
            time.sleep(retry_interval_s)
        try:
            yield
        finally:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (ADVISORY_LOCK_KEY,))

    def _ensure_ledger_table(self, conn) -> None:
        """Bootstrap idempotent de `schema_migrations` (§6).

        Jamais une ligne dans sa propre table — son existence EST la table.
        À appeler uniquement sous `acquire_lock()`.
        """
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
            if cur.fetchone()["t"] is not None:
                return
        ddl = BOOTSTRAP_DDL_PATH.read_text(encoding="utf-8")
        with conn.cursor() as cur:
            cur.execute(ddl)
        logger.info("schema_migrations bootstrappée (%s)", BOOTSTRAP_DDL_PATH.name)

    def verify_migration_objects(self, conn, version: str) -> bool:
        """Sonde si les objets attendus de `version` existent réellement (délègue à migration_probes)."""
        with conn.cursor() as cur:
            return migration_probes.verify_object(cur, version)

    def _write_ledger_row(
        self, conn, file: MigrationFile, meta, status: str, applied_by: str | None, metadata: dict
    ) -> None:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO schema_migrations
                    (version, name, checksum_sha256, status, applied_at, applied_by,
                     requires_owner, transactional, metadata)
                VALUES (%s, %s, %s, %s, now(), %s, %s, %s, %s)
                ON CONFLICT (version) DO NOTHING
                """,
                (
                    file.version,
                    file.name,
                    file.checksum_sha256,
                    status,
                    applied_by,
                    meta.requires_owner,
                    meta.transactional,
                    json.dumps(metadata),
                ),
            )

    def baseline(self, dry_run: bool = True) -> BaselineResult:
        """Vérifie objet par objet et marque `baseline`/`manual_required` (§8).

        N'exécute **aucun** SQL de migration — constate un existant vérifié,
        ne l'exécute pas (027 en est l'exemple réel : appliquée manuellement
        le 2026-07-04, `baseline()` se contente de le confirmer). Ne réécrit
        jamais une ligne déjà présente, quel que soit son statut (contrainte
        #1) — ces lignes ressortent `already_recorded`, `verify()` s'occupe
        des anomalies sur l'existant. `dry_run=True` (défaut) n'écrit rien et
        ne bootstrappe pas la table.

        Inclut la baseline `version='000'` (DDL inline historique) en tête de
        liste — absente de `discover_migrations()`/`build_plan()` (PR-02A,
        inchangés), mais partie intégrante de ce que `baseline()` doit
        reconnaître (§6).
        """
        files = [_synthetic_000_file(), *self.discover_migrations()]
        items: list[BaselineItem] = []
        written = 0
        with get_db() as conn:
            with self.acquire_lock(conn):
                if not dry_run:
                    self._ensure_ledger_table(conn)
                existing = self._read_records(conn)

                for f in files:
                    record = existing.get(f.version)
                    if record is not None:
                        items.append(
                            BaselineItem(
                                file=f,
                                action="already_recorded",
                                reason=(
                                    f"déjà '{record.status}' dans le ledger — baseline() ne "
                                    "réécrit jamais une ligne existante (contrainte #1)"
                                ),
                            )
                        )
                        continue

                    meta = get_meta(f.version)
                    objects_present = self.verify_migration_objects(conn, f.version)

                    if objects_present:
                        action: BaselineAction = "baseline"
                        reason = "objets vérifiés présents"
                    elif meta.requires_owner:
                        action = "manual_required"
                        reason = (
                            f"requires_owner=true ({meta.note or 'privilège propriétaire requis'}), "
                            "objets absents"
                        )
                    else:
                        action = "still_pending"
                        reason = (
                            "objets absents, requires_owner=false — relève d'un futur apply() "
                            "(PR-02C), hors périmètre de baseline()"
                        )

                    items.append(BaselineItem(file=f, action=action, reason=reason))

                    if not dry_run and action in ("baseline", "manual_required"):
                        self._write_ledger_row(
                            conn, f, meta, status=action, applied_by=None, metadata={}
                        )
                        written += 1

        return BaselineResult(items=items, dry_run=dry_run, written_count=written)

    def verify(self) -> list[str]:
        """Détecte `checksum_mismatch` et `drift_detected` (§9). Lecture seule.

        Ne prend jamais le verrou — `status`/`plan`/`verify` sont les 3
        commandes en lecture seule qui n'en ont pas besoin (§10). Retourne
        une liste d'anomalies ; vide = sain.
        """
        anomalies: list[str] = []
        records = self.load_records()
        if not records:
            return anomalies  # ledger pas encore bootstrappé — rien à vérifier

        files_by_version = {
            f.version: f for f in [_synthetic_000_file(), *self.discover_migrations()]
        }

        with get_db() as conn:
            with conn.cursor() as cur:
                for version, record in sorted(records.items()):
                    if record.status not in ("applied", "baseline"):
                        continue
                    file = files_by_version.get(version)
                    if file is not None and file.checksum_sha256 != record.checksum_sha256:
                        anomalies.append(
                            f"{version}: checksum_mismatch (ledger={record.checksum_sha256[:12]}..., "
                            f"fichier={file.checksum_sha256[:12]}...)"
                        )
                        continue
                    if not migration_probes.verify_object(cur, version):
                        anomalies.append(
                            f"{version}: drift_detected (statut '{record.status}' mais "
                            "objet(s) absent(s))"
                        )
        return anomalies

    def mark_manual_verified(self, version: str, applied_by: str, proof: str) -> MigrationRecord:
        """Transition `manual_required`/`pending` → `baseline`, preuve obligatoire (I7).

        Vérifie quand même les objets avant d'écrire — défense en profondeur :
        « le vérificateur d'objets fait toujours autorité, jamais l'hypothèse
        historique » (§8) s'applique aussi à une preuve textuelle humaine, qui
        pourrait être erronée (mauvaise version, faux souvenir). Refuse
        d'écrire si les objets ne sont pas réellement là, même avec preuve.
        """
        if not applied_by or not proof:
            raise ValueError("applied_by et proof sont obligatoires (I7)")

        file = next((f for f in self.discover_migrations() if f.version == version), None)
        if file is None:
            raise KeyError(f"Version inconnue (aucun fichier découvert) : {version}")

        meta = get_meta(version)
        with get_db() as conn:
            with self.acquire_lock(conn):
                self._ensure_ledger_table(conn)
                existing = self._read_records(conn)
                if version in existing:
                    raise ValueError(
                        f"Version {version} déjà '{existing[version].status}' dans le ledger — "
                        "mark-manual-verified ne réécrit jamais une ligne existante (contrainte #1)"
                    )
                if not self.verify_migration_objects(conn, version):
                    raise MigrationError(
                        f"Objets attendus de {version} non vérifiés présents malgré la preuve "
                        "fournie — refus d'écrire une baseline non corroborée (§8)"
                    )
                self._write_ledger_row(
                    conn, file, meta, status="baseline", applied_by=applied_by,
                    metadata={"proof": proof},
                )

        return MigrationRecord(
            version=file.version,
            name=file.name,
            checksum_sha256=file.checksum_sha256,
            status="baseline",
            applied_at=datetime.now(tz=timezone.utc),
            execution_ms=None,
            applied_by=applied_by,
            requires_owner=meta.requires_owner,
            transactional=meta.transactional,
            error_message=None,
            metadata={"proof": proof},
        )
