"""
snapshot_migration.py — import auditable du snapshot `/materials` dans le
noyau Evidence Kernel (PR-04).

Objectif : transformer le fichier de démonstration
`apps/carbon/data/crm_full_34_snapshot_2026-06-30.json` en une source globale
`CARBONCO_DEMO_SNAPSHOT` + une release immuable datée + un artefact
content-addressed + une observation par (matière × métrique) — SANS jamais
modifier une valeur du snapshot (migration byte-fidèle, prouvée par un rapport
de parité).

Garanties :
  - **Checksum SHA-256** de la release = hash des octets bruts du fichier
    (identité d'idempotence de détection du noyau 028).
  - **Idempotence** : rejouer l'import ne crée aucun doublon (source, release,
    artefact et observations sont ré-détectés/ré-utilisés, jamais réinsérés).
  - **Parité** : chaque observation importée reproduit EXACTEMENT la valeur du
    snapshot (comparaison Decimal, pas de valeur altérée) — vérifiable via
    `build_parity_report`.
  - **Licence déterministe** : la publication passe la même gate
    `license_policy.evaluate` que le noyau (jamais un LLM, jamais un booléen nu).
  - **Aucun réseau, aucun LLM, aucune écriture prod par Claude** : l'import réel
    est un geste opérateur (CLI sous workflow protégé, §14 du plan).

Écriture d'une source GLOBALE (`company_id IS NULL`) : les services PR-03
(`source_service`/`release_service`/…) sont volontairement scopés tenant (ils
forcent `company_id = tenant` et ne peuvent PAS écrire de ligne globale). Ce
module effectue donc les écritures globales via une connexion admin posant
`app.rls_bypass = 'on'` — en reproduisant fidèlement les mêmes formes SQL que
les services et en réutilisant `license_policy` pour la gate de publication.
C'est exactement le geste admin décrit au risque §11 du plan (« passer
exclusivement par le CLI + get_admin_db sous le workflow protégé »).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Literal

from db.database import get_admin_db
from services.intelligence import license_policy
from services.intelligence.adapters import (
    FakeAdapter,
    ObservationDraft,
    SourceAdapter,
    sha256_hex,
)
from services.storage import get_storage

# ── Constantes de la source démo ──────────────────────────────────────────
DEMO_SOURCE_CODE = "CARBONCO_DEMO_SNAPSHOT"
DEMO_PUBLISHER = "Carbon&Co (snapshot de démonstration)"
DEMO_TITLE = "Matières premières critiques UE — snapshot de démonstration"
DEMO_ATTRIBUTION = (
    "Snapshot CarbonCo compilé à partir de repères publics (USGS, Commission "
    "Européenne CRMA/RMIS, LME, Trading Economics). Valeurs estimées, non normatives."
)
SNAPSHOT_MIME = "application/json"

# Repo root depuis apps/api/services/intelligence/snapshot_migration.py.
_REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_SNAPSHOT_PATH = (
    _REPO_ROOT / "apps" / "carbon" / "data" / "crm_full_34_snapshot_2026-06-30.json"
)

# ── Catalogue de métriques (subject_type='material', subject_key='material:{id}') ──
# Documenté dans PR04_SOURCE_ADMIN_TRACEABILITY.md (mapping snapshot→observation).
SUBJECT_TYPE = "material"
METRIC_SUPPLY_RISK = "carbonco_supply_risk_score"
METRIC_PRICE_USD = "price_usd"
METRIC_PRICE_TREND = "price_trend_3m_pct"
METRIC_TOP_PRODUCER_SHARE = "top_producer_share_pct"
METRIC_CRITICAL_EU = "is_critical_eu"
METRIC_STRATEGIC_EU = "is_strategic_eu"

# Tout le snapshot est estimé (data_quality='estimated' sur les 34 matières).
SNAPSHOT_DATA_STATUS = "estimated"
# Méthode des métriques hors score (prix, flags, part producteur) — provenance
# du snapshot, distincte du score maison qui porte sa propre version.
SNAPSHOT_METHODOLOGY = "CC-DEMO-SNAPSHOT"


class SnapshotMigrationError(Exception):
    """Erreur d'import du snapshot (fichier illisible, structure inattendue…)."""


def _subject_key(material_id: str) -> str:
    return f"{SUBJECT_TYPE}:{material_id}"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def crm_snapshot_to_drafts(parsed: Any) -> list[ObservationDraft]:
    """Normalise le snapshot CRM (dict désérialisé) en observations.

    Une observation par (matière × métrique) — voir le catalogue ci-dessus.
    Les valeurs sont RECOPIÉES telles quelles (aucun recalcul) : c'est la
    condition de parité byte-fidèle. Champs absents/null → pas d'observation
    pour cette métrique (jamais une valeur inventée, ex. `score_confidence`
    toujours null dans le snapshot → aucune observation).
    """
    if not isinstance(parsed, dict) or "materials" not in parsed:
        raise SnapshotMigrationError(
            "Structure de snapshot invalide : clé 'materials' introuvable."
        )
    snapshot_dt = _parse_dt(parsed.get("snapshot_date"))
    drafts: list[ObservationDraft] = []

    for m in parsed["materials"]:
        mid = m.get("id")
        if not mid:
            raise SnapshotMigrationError("Matière sans 'id' — snapshot incohérent.")
        key = _subject_key(mid)

        score = m.get("carbonco_supply_risk_score")
        if score is not None:
            drafts.append(ObservationDraft(
                subject_type=SUBJECT_TYPE, subject_key=key, metric_code=METRIC_SUPPLY_RISK,
                numeric_value=float(score), observed_at=snapshot_dt,
                data_status=SNAPSHOT_DATA_STATUS,
                methodology_version=m.get("score_methodology_version"),
            ))

        drafts.append(ObservationDraft(
            subject_type=SUBJECT_TYPE, subject_key=key, metric_code=METRIC_CRITICAL_EU,
            boolean_value=bool(m.get("is_critical_eu")), observed_at=snapshot_dt,
            data_status=SNAPSHOT_DATA_STATUS, methodology_version=SNAPSHOT_METHODOLOGY,
        ))
        drafts.append(ObservationDraft(
            subject_type=SUBJECT_TYPE, subject_key=key, metric_code=METRIC_STRATEGIC_EU,
            boolean_value=bool(m.get("is_strategic_eu")), observed_at=snapshot_dt,
            data_status=SNAPSHOT_DATA_STATUS, methodology_version=SNAPSHOT_METHODOLOGY,
        ))

        producers = m.get("top_producers") or []
        if producers:
            top = producers[0]
            share = top.get("share_pct")
            if share is not None:
                drafts.append(ObservationDraft(
                    subject_type=SUBJECT_TYPE, subject_key=key,
                    metric_code=METRIC_TOP_PRODUCER_SHARE,
                    numeric_value=float(share), unit="pct",
                    geography_code=top.get("country"), observed_at=snapshot_dt,
                    data_status=SNAPSHOT_DATA_STATUS, methodology_version=SNAPSHOT_METHODOLOGY,
                ))

        price = m.get("price_snapshot")
        if price:
            price_dt = _parse_dt(price.get("date")) or snapshot_dt
            if price.get("value") is not None:
                drafts.append(ObservationDraft(
                    subject_type=SUBJECT_TYPE, subject_key=key, metric_code=METRIC_PRICE_USD,
                    numeric_value=float(price["value"]), unit=price.get("unit"),
                    observed_at=price_dt, data_status=SNAPSHOT_DATA_STATUS,
                    methodology_version=SNAPSHOT_METHODOLOGY,
                ))
            if price.get("trend_3m_pct") is not None:
                drafts.append(ObservationDraft(
                    subject_type=SUBJECT_TYPE, subject_key=key, metric_code=METRIC_PRICE_TREND,
                    numeric_value=float(price["trend_3m_pct"]), unit="pct",
                    observed_at=price_dt, data_status=SNAPSHOT_DATA_STATUS,
                    methodology_version=SNAPSHOT_METHODOLOGY,
                ))

    return drafts


def build_demo_adapter(file_path: str | Path | None = None) -> FakeAdapter:
    """FakeAdapter câblé sur le fichier snapshot + le normaliseur CRM."""
    path = Path(file_path) if file_path else DEFAULT_SNAPSHOT_PATH
    raw = path.read_bytes()
    parsed = json.loads(raw.decode("utf-8"))
    release_key = str(parsed.get("snapshot_date") or "unknown")
    return FakeAdapter(
        path=path,
        release_key=release_key,
        normalizer=crm_snapshot_to_drafts,
        mime_type=SNAPSHOT_MIME,
        published_at=_parse_dt(parsed.get("snapshot_date")),
    )


# ── Rapport de parité ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class ParityMismatch:
    subject_key: str
    metric_code: str
    expected: str
    found: str
    kind: Literal["mismatch", "missing", "extra"]


@dataclass(frozen=True)
class ParityReport:
    total_expected: int
    total_found: int
    matched: int
    mismatches: list[ParityMismatch] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.mismatches and self.matched == self.total_expected == self.total_found

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "total_expected": self.total_expected,
            "total_found": self.total_found,
            "matched": self.matched,
            "mismatches": [
                {
                    "subject_key": m.subject_key, "metric_code": m.metric_code,
                    "expected": m.expected, "found": m.found, "kind": m.kind,
                }
                for m in self.mismatches
            ],
        }


def _value_signature(numeric: Any, text: Any, boolean: Any) -> str:
    """Signature comparable et exacte d'une valeur d'observation.

    Numérique comparé en Decimal (8.7 == Decimal('8.7'), 39 == 39.0) pour
    éviter tout écart de représentation float ; booléen/texte comparés
    directement. Déterministe."""
    parts: list[str] = []
    if numeric is not None:
        try:
            parts.append("num=" + str(Decimal(str(numeric)).normalize()))
        except (InvalidOperation, ValueError):
            parts.append(f"num={numeric!r}")
    if boolean is not None:
        parts.append(f"bool={bool(boolean)}")
    if text is not None:
        parts.append(f"text={text}")
    return "|".join(parts) if parts else "∅"


def build_parity_report(
    drafts: list[ObservationDraft], observation_rows: list[dict[str, Any]],
) -> ParityReport:
    """Compare les drafts attendus aux observations persistées (valeurs
    numeric/text/boolean uniquement — la parité porte sur les VALEURS, pas
    sur les métadonnées). Toute divergence est signalée explicitement."""
    expected: dict[tuple[str, str], str] = {
        d.dedup_key()[1:]: _value_signature(d.numeric_value, d.text_value, d.boolean_value)
        for d in drafts
    }
    found: dict[tuple[str, str], str] = {
        (r["subject_key"], r["metric_code"]): _value_signature(
            r.get("numeric_value"), r.get("text_value"), r.get("boolean_value")
        )
        for r in observation_rows
    }

    mismatches: list[ParityMismatch] = []
    matched = 0
    for key, exp_sig in expected.items():
        if key not in found:
            mismatches.append(ParityMismatch(key[0], key[1], exp_sig, "∅", "missing"))
        elif found[key] != exp_sig:
            mismatches.append(ParityMismatch(key[0], key[1], exp_sig, found[key], "mismatch"))
        else:
            matched += 1
    for key, found_sig in found.items():
        if key not in expected:
            mismatches.append(ParityMismatch(key[0], key[1], "∅", found_sig, "extra"))

    return ParityReport(
        total_expected=len(expected), total_found=len(found),
        matched=matched, mismatches=mismatches,
    )


# ── Reconstruction depuis les observations (mode « kernel ») ────────────────

def reconstruct_materials_from_observations(
    observation_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Rebâtit une liste de matières à partir des observations du noyau —
    l'inverse de `crm_snapshot_to_drafts`. Sert au mode de rendu « kernel »
    (rendre `/materials` depuis les observations plutôt que le JSON local)."""
    by_subject: dict[str, dict[str, Any]] = {}
    for r in observation_rows:
        sk = r["subject_key"]
        mat = by_subject.setdefault(sk, {"id": sk.split(":", 1)[-1], "subject_key": sk})
        code = r["metric_code"]
        if code in (METRIC_CRITICAL_EU, METRIC_STRATEGIC_EU):
            mat[code] = r.get("boolean_value")
        else:
            val = r.get("numeric_value")
            mat[code] = float(val) if val is not None else None
            if r.get("geography_code"):
                mat[f"{code}_geo"] = r["geography_code"]
    return sorted(by_subject.values(), key=lambda m: m["id"])


RenderMode = Literal["local", "kernel", "compare"]


def render_materials(
    mode: RenderMode,
    *,
    drafts: list[ObservationDraft] | None = None,
    observation_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Trois modes de transition de rendu (§ scope PR-04) :

      - `local`   : matières dérivées des drafts (issus du JSON local) ;
      - `kernel`  : matières reconstruites depuis les observations du noyau ;
      - `compare` : rapport de parité entre les deux (preuve « aucune valeur
                    changée »).

    Aucun fallback silencieux : un mode sans les données requises lève.
    """
    if mode == "local":
        if drafts is None:
            raise SnapshotMigrationError("mode 'local' : drafts requis.")
        return {"mode": "local", "materials": reconstruct_materials_from_observations(
            [_draft_as_row(d) for d in drafts]
        )}
    if mode == "kernel":
        if observation_rows is None:
            raise SnapshotMigrationError("mode 'kernel' : observations requises.")
        return {"mode": "kernel", "materials": reconstruct_materials_from_observations(observation_rows)}
    if mode == "compare":
        if drafts is None or observation_rows is None:
            raise SnapshotMigrationError("mode 'compare' : drafts ET observations requis.")
        return {"mode": "compare", "parity": build_parity_report(drafts, observation_rows).to_dict()}
    raise SnapshotMigrationError(f"Mode de rendu inconnu : {mode}")


def _draft_as_row(d: ObservationDraft) -> dict[str, Any]:
    return {
        "subject_key": d.subject_key, "metric_code": d.metric_code,
        "numeric_value": d.numeric_value, "text_value": d.text_value,
        "boolean_value": d.boolean_value, "geography_code": d.geography_code,
    }


# ── Résultat d'import ───────────────────────────────────────────────────────

@dataclass
class SnapshotImportResult:
    source_id: int
    source_code: str
    source_reused: bool
    release_id: int
    release_key: str
    release_status: str
    release_reused: bool
    checksum_sha256: str
    artifact_id: int | None
    artifact_reused: bool
    observations_created: int
    observations_skipped: int
    observations_total: int
    license_reasons: list[str] = field(default_factory=list)
    license_warnings: list[str] = field(default_factory=list)
    parity: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "source_code": self.source_code,
            "source_reused": self.source_reused,
            "release_id": self.release_id,
            "release_key": self.release_key,
            "release_status": self.release_status,
            "release_reused": self.release_reused,
            "checksum_sha256": self.checksum_sha256,
            "artifact_id": self.artifact_id,
            "artifact_reused": self.artifact_reused,
            "observations_created": self.observations_created,
            "observations_skipped": self.observations_skipped,
            "observations_total": self.observations_total,
            "license_reasons": self.license_reasons,
            "license_warnings": self.license_warnings,
            "parity": self.parity,
        }


# ── Écritures globales (helpers SQL sous rls_bypass) ────────────────────────

def _upsert_global_source(cur) -> tuple[dict[str, Any], bool]:
    """INSERT idempotent de la source démo globale (company_id IS NULL). Retourne
    (row, reused). Licence permissive (display+derived autorisés) mais tout
    reste `estimated` côté observation."""
    cur.execute(
        """
        INSERT INTO source_registry
            (company_id, code, publisher, title, source_type, license_code,
             automated_access_allowed, storage_allowed, commercial_use_allowed,
             redistribution_allowed, derived_use_allowed, display_allowed,
             attribution_text, active)
        VALUES (NULL, %s, %s, %s, 'file', 'CC-DEMO',
                TRUE, TRUE, FALSE, FALSE, TRUE, TRUE, %s, TRUE)
        ON CONFLICT (code) WHERE company_id IS NULL DO NOTHING
        RETURNING *
        """,
        (DEMO_SOURCE_CODE, DEMO_PUBLISHER, DEMO_TITLE, DEMO_ATTRIBUTION),
    )
    row = cur.fetchone()
    if row is not None:
        return row, False
    cur.execute(
        "SELECT * FROM source_registry WHERE code = %s AND company_id IS NULL",
        (DEMO_SOURCE_CODE,),
    )
    existing = cur.fetchone()
    if existing is None:
        raise SnapshotMigrationError("Source démo introuvable après conflit d'insertion.")
    return existing, True


def _register_global_artifact(
    cur, *, source_release_id: int | None, raw: bytes, filename: str,
    mime_type: str, storage,
) -> tuple[int, str, str, bool]:
    """Stocke + enregistre l'artefact JSON global (content-addressed). Idempotent
    sur (sha256, company_id IS NULL). Retourne (artifact_id, sha256, blob_key, reused)."""
    sha = sha256_hex(raw)
    cur.execute(
        "SELECT id, blob_key FROM evidence_artifacts WHERE sha256 = %s AND company_id IS NULL "
        "ORDER BY id LIMIT 1",
        (sha,),
    )
    existing = cur.fetchone()
    if existing is not None:
        return existing["id"], sha, existing["blob_key"], True

    ext = filename.rsplit(".", 1)[-1] if "." in filename else "json"
    key = f"intelligence/global/{sha}.{ext.lower()}"
    blob_key = storage.put(key, raw, mime_type)
    cur.execute(
        """
        INSERT INTO evidence_artifacts
            (company_id, source_release_id, blob_key, sha256, filename, mime_type,
             size_bytes, sensitivity)
        VALUES (NULL, %s, %s, %s, %s, %s, %s, 'public')
        RETURNING id
        """,
        (source_release_id, blob_key, sha, filename, mime_type, len(raw)),
    )
    return cur.fetchone()["id"], sha, blob_key, False


def _detect_global_release(
    cur, *, source_id: int, release_key: str, checksum: str, blob_key: str,
    mime_type: str,
) -> tuple[dict[str, Any], bool]:
    """INSERT idempotent (source_id, release_key, checksum) de la release globale."""
    cur.execute(
        """
        INSERT INTO source_releases
            (source_id, company_id, release_key, retrieved_at, checksum_sha256,
             blob_key, mime_type, status, metadata)
        VALUES (%s, NULL, %s, now(), %s, %s, %s, 'detected', '{}'::jsonb)
        ON CONFLICT (source_id, release_key, checksum_sha256) DO NOTHING
        RETURNING *
        """,
        (source_id, release_key, checksum, blob_key, mime_type),
    )
    row = cur.fetchone()
    if row is not None:
        return row, False
    cur.execute(
        "SELECT * FROM source_releases "
        "WHERE source_id = %s AND release_key = %s AND checksum_sha256 = %s",
        (source_id, release_key, checksum),
    )
    return cur.fetchone(), True


def _publish_release(cur, release: dict[str, Any], source: dict[str, Any]) -> str:
    """Transitions detected→validated→published avec gate licence
    (`license_policy.evaluate`, réutilisée du noyau). Idempotent : une release
    déjà publiée/bloquée n'est jamais retransitionnée. Retourne le statut final."""
    status = release["status"]
    rid = release["id"]
    if status in ("published", "blocked_license", "superseded"):
        return status
    if status == "detected":
        cur.execute("UPDATE source_releases SET status = 'validated' WHERE id = %s", (rid,))
        status = "validated"
    if status == "quarantined":
        cur.execute("UPDATE source_releases SET status = 'validated' WHERE id = %s", (rid,))
        status = "validated"
    if status == "validated":
        decision = license_policy.evaluate(source)
        if decision.allow_ingest and decision.allow_store:
            cur.execute(
                "UPDATE source_releases SET status = 'published', published_at = now() "
                "WHERE id = %s",
                (rid,),
            )
            return "published"
        cur.execute(
            "UPDATE source_releases SET status = 'blocked_license', "
            "metadata = metadata || %s::jsonb WHERE id = %s",
            (json.dumps({"license_block_reasons": decision.reasons}), rid),
        )
        return "blocked_license"
    return status


def _materialize_observations(
    cur, *, release_id: int, drafts: list[ObservationDraft],
) -> tuple[int, int]:
    """Insère une observation par draft manquant pour la release (idempotent).
    Retourne (created, skipped)."""
    cur.execute(
        "SELECT subject_type, subject_key, metric_code FROM observations "
        "WHERE source_release_id = %s AND company_id IS NULL",
        (release_id,),
    )
    existing = {(r["subject_type"], r["subject_key"], r["metric_code"]) for r in cur.fetchall()}

    created = skipped = 0
    for d in drafts:
        if d.dedup_key() in existing:
            skipped += 1
            continue
        cur.execute(
            """
            INSERT INTO observations
                (company_id, subject_type, subject_key, metric_code, numeric_value,
                 text_value, boolean_value, unit, geography_code, observed_at,
                 source_release_id, data_status, methodology_version)
            VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                d.subject_type, d.subject_key, d.metric_code, d.numeric_value,
                d.text_value, d.boolean_value, d.unit, d.geography_code, d.observed_at,
                release_id, d.data_status, d.methodology_version,
            ),
        )
        created += 1
    return created, skipped


def _load_release_observations(cur, release_id: int) -> list[dict[str, Any]]:
    cur.execute(
        "SELECT subject_type, subject_key, metric_code, numeric_value, text_value, "
        "boolean_value, geography_code FROM observations "
        "WHERE source_release_id = %s AND company_id IS NULL",
        (release_id,),
    )
    return list(cur.fetchall())


# ── Orchestration ───────────────────────────────────────────────────────────

def import_snapshot(
    *,
    adapter: SourceAdapter | None = None,
    file_path: str | Path | None = None,
    publish: bool = True,
    connection_factory: Callable[[], Any] = get_admin_db,
    storage: Any | None = None,
    with_parity: bool = True,
) -> SnapshotImportResult:
    """Importe le snapshot de démonstration de bout en bout (idempotent).

    `connection_factory` : `get_admin_db` par défaut (écriture globale sous
    workflow protégé). Les tests injectent `get_db` (superuser CI). Une seule
    transaction : source → artefact → release (detect/validate/publish si
    `publish`) → observations. `app.rls_bypass = 'on'` autorise l'écriture des
    lignes globales (`company_id IS NULL`).
    """
    adapter = adapter or build_demo_adapter(file_path)
    storage = storage or get_storage()

    candidates = adapter.detect_releases()
    if not candidates:
        raise SnapshotMigrationError("Aucune release détectée par l'adaptateur.")
    candidate = candidates[0]
    raw = adapter.fetch_release(candidate)
    parsed = adapter.parse(raw)
    drafts = adapter.normalize(parsed)

    with connection_factory() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")

            source, source_reused = _upsert_global_source(cur)

            artifact_id, sha, blob_key, artifact_reused = _register_global_artifact(
                cur, source_release_id=None, raw=raw, filename=candidate.filename,
                mime_type=candidate.mime_type, storage=storage,
            )
            release, release_reused = _detect_global_release(
                cur, source_id=source["id"], release_key=candidate.release_key,
                checksum=candidate.checksum_sha256, blob_key=blob_key,
                mime_type=candidate.mime_type,
            )
            # Rattacher l'artefact à la release si ce n'est pas déjà fait (le
            # premier import crée l'artefact avant de connaître la release id).
            cur.execute(
                "UPDATE evidence_artifacts SET source_release_id = %s "
                "WHERE id = %s AND source_release_id IS DISTINCT FROM %s",
                (release["id"], artifact_id, release["id"]),
            )

            status = release["status"]
            if publish:
                status = _publish_release(cur, release, source)

            decision = license_policy.evaluate(source)

            created = skipped = 0
            if status == "published":
                created, skipped = _materialize_observations(
                    cur, release_id=release["id"], drafts=drafts,
                )

            parity = None
            if with_parity and status == "published":
                obs_rows = _load_release_observations(cur, release["id"])
                parity = build_parity_report(drafts, obs_rows).to_dict()

    return SnapshotImportResult(
        source_id=source["id"],
        source_code=source["code"],
        source_reused=source_reused,
        release_id=release["id"],
        release_key=release["release_key"],
        release_status=status,
        release_reused=release_reused,
        checksum_sha256=sha,
        artifact_id=artifact_id,
        artifact_reused=artifact_reused,
        observations_created=created,
        observations_skipped=skipped,
        observations_total=len(drafts),
        license_reasons=decision.reasons,
        license_warnings=decision.warnings,
        parity=parity,
    )
