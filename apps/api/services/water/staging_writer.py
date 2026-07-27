"""
staging_writer.py — graveur Evidence Kernel des releases Eau en staging (X2B).

Ce module écrit dans le noyau de preuve EXISTANT (migration 028) : aucune
table, aucune colonne, aucun statut nouveau. Il n'y a qu'un seul Evidence
Kernel, et il n'y a pas de registre Water parallèle — cf.
`activation/X2B_EVIDENCE_KERNEL_AUDIT.md`.

**« staging » n'est pas un statut de base.** Le vocabulaire de
`source_releases.status` est fermé à six valeurs par
`source_releases_status_check`, et `staging` n'en fait pas partie. Une release
Eau en staging est donc écrite dans son état NATIF exact :
`status='validated'`, `published_at IS NULL`, `company_id IS NULL`. C'est
précisément la précondition qu'exige `release_service.publish_release()` : X4
pourra promouvoir sans une ligne de code nouvelle. Aucune clé de statut n'est
écrite dans `metadata`.

**Une seule transaction.** Chaque fonction de `services/intelligence/*_service.py`
ouvre sa PROPRE `get_db()`, donc sa propre transaction : les enchaîner
donnerait quatre à six transactions et un état partiel en cas d'échec au
milieu. Ce module reprend donc le motif déjà éprouvé de
`snapshot_migration.import_snapshot` — chaque helper reçoit un `cur` nu et
n'ouvre jamais de connexion — tout en réutilisant les mêmes tables, le même
vocabulaire de statut, la même `license_policy` et les mêmes modèles.

**Le rollback ne peut être que transactionnel.** `evidence_kernel_guard`
refuse toute UPDATE/DELETE sur `observations` et toute DELETE sur
`source_releases` : rien ne peut être défait après commit. « Rollback
complet » signifie donc « transaction avortée avant commit », et c'est ce que
`--dry-run` exerce à chaque fois.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Callable, Mapping, Sequence

from models.intelligence import LicenseDecision
from models.water_intelligence import (
    WaterMetricObservation,
    WaterSourceReference,
)
from services.intelligence import license_policy
from services.intelligence.adapters.base import ObservationDraft
from services.water.staging_ingestion import (
    INGESTIBLE_SOURCES,
    StagingIngestionRefused,
    WaterStagingIngestionRequest,
)
from services.water_intelligence import observation_identity as identity_mod
from services.water_intelligence import pipeline as pipe
from services.water_intelligence import release_provenance
from services.water_intelligence.connectors import hubeau_hydro as hydro
from services.water_intelligence.connectors import hubeau_withdrawals_quality as usage
from services.water_intelligence.release_provenance import ReleaseProvenance

#: Statut natif d'une release validée mais NON publiée. Voir le docstring.
STAGING_RELEASE_STATUS = "validated"

#: Correspondance EXPLICITE `WaterDataStatus` → `observations.data_status`.
#: Les deux vocabulaires sont délibérément distincts
#: (`models/water_intelligence.py` interdit toute conversion implicite) : cette
#: table est la conversion, écrite une fois, refusant tout statut non
#: cartographié. `fixture` n'a PAS de cible : une donnée de fixture n'entre
#: jamais dans le noyau de preuve.
DATA_STATUS_MAPPING: dict[str, str] = {
    "observed": "verified",
    "modelled": "inferred",
    "estimated": "estimated",
    "manual": "manual",
}

#: Paramètres de fenêtre temporelle par source, tels qu'ils apparaissent dans
#: `query_parameters` du rapport X1/X2A. Le rapport atteste ce qui a été
#: réellement demandé : la configuration de parsing en est DÉDUITE, jamais
#: devinée.
_WINDOW_PARAMETERS: dict[str, tuple[str, str]] = {
    "HUBEAU_HYDROMETRIE": ("date_debut_obs", "date_fin_obs"),
    "HUBEAU_ADES": ("date_debut_mesure", "date_fin_mesure"),
    "HUBEAU_BNPE_PRELEVEMENTS": ("annee_from", "annee_to"),
    "HUBEAU_QUALITE_SURFACE": ("date_debut_prelevement", "date_fin_prelevement"),
}


class StagingWriteError(Exception):
    """Écriture staging impossible — transaction avortée, rien n'est écrit."""


# ---------------------------------------------------------------------------
# Étape pure : artefact + rapport -> observations + identités
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PreparedObservation:
    """Une observation prête à graver, avec son identité et son empreinte."""

    observation: WaterMetricObservation
    identity: identity_mod.WaterObservationIdentity
    content_digest: str
    subject_type: str
    subject_key: str


@dataclass
class PreparedRelease:
    """Résultat de l'étape pure. Aucune écriture n'a eu lieu.

    C'est la représentation COMPLÈTE d'une release avant sa projection vers
    l'Evidence Kernel — et donc la seule source légitime pour reconstruire un
    snapshot public. La table `observations` n'en conserve qu'une projection
    (ni période, ni portée géographique, ni provenance) : reconstruire depuis
    elle produirait des snapshots plausibles et inexacts.

    Les agrégats ci-dessous sont LUS sur les observations préparées, jamais
    déduits d'un voisin : les unités sont celles portées par les observations,
    les géographies sont leurs géographies, la période est le min/max réel.
    """

    prepared: list[PreparedObservation] = field(default_factory=list)
    records_received: int = 0
    records_rejected: int = 0
    records_absent_value: int = 0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    observed_period_start: date | None = None
    observed_period_end: date | None = None
    #: Provenance canonique — résolue hors base (`release_provenance.py`).
    provenance: "ReleaseProvenance | None" = None
    source_code: str | None = None
    release_key: str | None = None
    artifact_checksum: str | None = None
    validation_report_checksum: str | None = None
    method_code: str | None = None
    method_version: str | None = None

    @property
    def observations(self) -> list[WaterMetricObservation]:
        return [item.observation for item in self.prepared]

    @property
    def identities(self) -> set[identity_mod.WaterObservationIdentity]:
        """Ensemble d'identités préparées, pour les contrôles de parité.

        `WaterObservationIdentity` est `frozen=True`, donc hachable : les
        identités se comparent en ensembles, jamais par leur nombre. Comparer
        des comptes laisserait passer une substitution — autant d'identités,
        mais pas les mêmes.
        """
        return {item.identity for item in self.prepared}

    @property
    def metric_codes(self) -> tuple[str, ...]:
        return tuple(sorted({o.metric_code for o in self.observations}))

    @property
    def units(self) -> tuple[str, ...]:
        return tuple(sorted({o.unit for o in self.observations if o.unit}))

    @property
    def geography_codes(self) -> tuple[str, ...]:
        return tuple(
            sorted({o.geography.code for o in self.observations if o.geography.code})
        )


def _window(report: Mapping[str, Any], source_code: str) -> tuple[str, str]:
    names = _WINDOW_PARAMETERS[source_code]
    params = report.get("query_parameters") or {}
    try:
        return str(params[names[0]]), str(params[names[1]])
    except KeyError as exc:
        raise StagingIngestionRefused(
            f"rapport sans paramètre de fenêtre {exc} — la configuration de "
            "parsing ne peut pas être reconstruite, et elle n'est jamais devinée."
        ) from exc


def _parse_and_normalize(
    request: WaterStagingIngestionRequest,
    *,
    pages: list[Any],
    report: Mapping[str, Any],
    retrieved_at: date,
) -> tuple[list[ObservationDraft], PreparedRelease, Callable, Callable]:
    """Parse le payload avec le connecteur RÉEL de la source, puis normalise.

    Aucune tolérance : une erreur de schéma interrompt l'ingestion. Un artefact
    que le connecteur ne sait pas lire n'est pas « à moitié » ingérable.
    """
    outcome = PreparedRelease()
    code = request.source_code
    start_raw, end_raw = _window(report, code)

    if code in (hydro.HYDROMETRIE_SOURCE_CODE, hydro.PIEZOMETRIE_SOURCE_CODE):
        kind = "hydrometrie" if code == hydro.HYDROMETRIE_SOURCE_CODE else "piezometrie"
        config = hydro.HubeauHydroReleaseConfig(
            release_key=request.release_key,
            retrieved_at=retrieved_at,
            window_start=date.fromisoformat(start_raw),
            window_end=date.fromisoformat(end_raw),
            kind=kind,
        )
        parser = (
            hydro.parse_hydrometrie_pages
            if kind == "hydrometrie"
            else hydro.parse_piezometrie_pages
        )
        try:
            parsed = parser(pages, config=config)
        except hydro.HubeauHydroError as exc:
            raise StagingWriteError(
                f"schéma refusé par le connecteur {code} : {type(exc).__name__} — {exc}"
            ) from exc
        outcome.records_received = parsed.records_total
        outcome.records_absent_value = parsed.values_absent
        outcome.warnings.extend(parsed.warnings)
        days = parsed.observed_days
        outcome.observed_period_start = days[0] if days else None
        outcome.observed_period_end = days[-1] if days else None
        # `drafts_from_measurements` plutôt que `build_normalizer` : le
        # normalizer P03 re-parse les pages, alors que le résultat est déjà
        # là. Reparser deux fois, c'est risquer deux vérités.
        drafts = hydro.drafts_from_measurements(parsed.measurements, config)
        geography_resolver = hydro.build_geography_resolver(parsed.station_ids)
        period_resolver = hydro.build_period_resolver()
        return drafts, outcome, geography_resolver, period_resolver

    if code == usage.WITHDRAWALS_SOURCE_CODE:
        config = usage.WithdrawalsReleaseConfig(
            release_key=request.release_key,
            retrieved_at=retrieved_at,
            year_min=int(start_raw),
            year_max=int(end_raw),
        )
        try:
            parsed = usage.parse_withdrawals_pages(pages, config=config)
        except usage.HubeauUsageError as exc:
            raise StagingWriteError(
                f"schéma refusé par le connecteur {code} : {type(exc).__name__} — {exc}"
            ) from exc
        outcome.records_received = parsed.records_total
        outcome.records_absent_value = parsed.values_absent
        outcome.warnings.extend(parsed.warnings)
        outcome.observed_period_start = date(config.year_min, 1, 1)
        outcome.observed_period_end = date(config.year_max, 12, 31)
        drafts = usage.withdrawals_drafts(parsed.records, config)
        geography_resolver = usage.build_geography_resolver(parsed.ouvrage_ids)
        period_resolver = usage.build_withdrawals_period_resolver()
        return drafts, outcome, geography_resolver, period_resolver

    # qualité de surface — l'allowlist SANDRE vient du rapport, jamais d'un défaut
    codes = [c for c in str((report.get("query_parameters") or {}).get("code_parametre", "")).split(",") if c]
    unknown = [c for c in codes if c not in usage.DEFAULT_PARAMETER_ALLOWLIST]
    if unknown or not codes:
        raise StagingIngestionRefused(
            f"code(s) SANDRE {unknown or 'absent(s)'} hors allowlist sourcée du "
            f"connecteur ({sorted(usage.DEFAULT_PARAMETER_ALLOWLIST)}) — un "
            "paramètre non vérifié n'entre pas dans le noyau de preuve."
        )
    config = usage.QualityReleaseConfig(
        release_key=request.release_key,
        retrieved_at=retrieved_at,
        window_start=date.fromisoformat(start_raw),
        window_end=date.fromisoformat(end_raw),
        parameter_allowlist={c: usage.DEFAULT_PARAMETER_ALLOWLIST[c] for c in codes},
    )
    try:
        parsed = usage.parse_quality_pages(pages, config=config)
    except usage.HubeauUsageError as exc:
        raise StagingWriteError(
            f"schéma refusé par le connecteur {code} : {type(exc).__name__} — {exc}"
        ) from exc
    outcome.records_received = parsed.records_total
    outcome.records_absent_value = parsed.values_absent
    outcome.warnings.extend(parsed.warnings)
    # `QualityParseResult` n'expose pas d'`observed_days` (contrairement à
    # l'hydro) : la période observée est lue sur les analyses elles-mêmes,
    # jamais recopiée depuis la fenêtre DEMANDÉE — une fenêtre demandée n'est
    # pas une période observée.
    sampled = sorted({a.sampled_on for a in parsed.analyses if a.sampled_on})
    outcome.observed_period_start = sampled[0] if sampled else None
    outcome.observed_period_end = sampled[-1] if sampled else None
    drafts = usage.quality_drafts(parsed.analyses, config)
    geography_resolver = usage.build_geography_resolver(parsed.station_ids)
    period_resolver = usage.build_quality_period_resolver()
    return drafts, outcome, geography_resolver, period_resolver


def prepare_release(
    request: WaterStagingIngestionRequest,
    *,
    pages: list[Any],
    report: Mapping[str, Any],
    license_decision: LicenseDecision,
    retrieved_at: date,
    provenance: "ReleaseProvenance",
) -> PreparedRelease:
    """Artefact + rapport → observations validées, identifiées, sans collision.

    Purement en mémoire : aucune connexion n'est ouverte ici. Chaque draft est
    dérivé et validé INDIVIDUELLEMENT, pour que l'observation, son identité et
    son empreinte de contenu restent alignées — `derive_observations` en lot
    perdrait la correspondance dès le premier draft rejeté.
    """
    source_meta = INGESTIBLE_SOURCES[request.source_code]
    drafts, outcome, geography_resolver, period_resolver = _parse_and_normalize(
        request, pages=pages, report=report, retrieved_at=retrieved_at
    )
    outcome.provenance = provenance
    outcome.source_code = request.source_code
    outcome.release_key = request.release_key
    outcome.artifact_checksum = request.expected_sha256.lower()
    outcome.method_code = source_meta.method.code
    outcome.method_version = source_meta.method.version

    source_ref = WaterSourceReference(
        source_code=request.source_code,
        release_key=request.release_key,
        checksum_sha256=request.expected_sha256.lower(),
        retrieved_at=retrieved_at,
        observed_period_start=outcome.observed_period_start,
        observed_period_end=outcome.observed_period_end,
        methodology_version=source_meta.method.version,
        license=license_decision,
        attribution=provenance.attribution,
        # Provenance citable, exigée par la porte de publication depuis
        # X4B-PREP. Sans ces champs, une release préparée aujourd'hui serait
        # écartée du snapshot public pour provenance muette — correctement,
        # mais pour la mauvaise raison.
        source_information_url=provenance.information_url,
        source_refresh_cadence=provenance.refresh_cadence,
        source_last_updated_on=provenance.last_updated_on,
        warnings=[],
    )

    ledger = identity_mod.WaterObservationLedger()
    for draft in drafts:
        derived = pipe.derive_observations(
            [draft],
            source=source_ref,
            method=source_meta.method,
            geography_resolver=geography_resolver,
            period_resolver=period_resolver,
            default_methodology_version=source_meta.method.version,
        )
        if derived.errors or not derived.candidates:
            outcome.records_rejected += 1
            outcome.errors.extend(derived.errors)
            continue

        validated = pipe.validate_candidates(
            derived.candidates,
            catalog_license_known=True,
            license_decision=license_decision,
        )
        if validated.errors or not validated.observations:
            outcome.records_rejected += 1
            outcome.errors.extend(validated.errors)
            continue
        outcome.warnings.extend(validated.warnings)

        observation = validated.observations[0]
        if observation.scenario is not None:
            raise StagingIngestionRefused(
                f"{draft.subject_key}/{draft.metric_code} : observation porteuse "
                "d'un scénario — `observations` ne stocke ni scenario_code ni "
                "horizon_year, l'identité serait irrécupérable après écriture "
                "(cf. X2B_EVIDENCE_KERNEL_AUDIT.md §11.1). Refusé, jamais écrit."
            )

        identity = identity_mod.build_water_observation_identity(
            observation, subject_type=draft.subject_type, subject_key=draft.subject_key
        )
        digest = identity_mod.content_digest(observation)
        # Collision : même identité + contenu différent = erreur, jamais un
        # « premier gagne » silencieux.
        if not ledger.add(identity, content_fingerprint=digest):
            outcome.warnings.append(
                f"{draft.subject_key}/{draft.metric_code} : identité déjà vue avec "
                "un contenu identique — doublon ignoré (idempotent)."
            )
            continue

        outcome.prepared.append(
            PreparedObservation(
                observation=observation,
                identity=identity,
                content_digest=digest,
                subject_type=draft.subject_type,
                subject_key=draft.subject_key,
            )
        )

    return outcome


# ---------------------------------------------------------------------------
# Étape transactionnelle
# ---------------------------------------------------------------------------


@dataclass
class StagingIngestionResult:
    """Rapport d'ingestion. `committed=False` ⇒ transaction avortée."""

    source_code: str
    release_key: str
    committed: bool
    release_status: str
    source_id: int | None = None
    release_id: int | None = None
    artifact_id: int | None = None
    run_id: int | None = None
    release_reused: bool = False
    observations_written: int = 0
    observations_reused: int = 0
    records_received: int = 0
    records_rejected: int = 0
    records_absent_value: int = 0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def as_mapping(self) -> dict[str, Any]:
        return {
            "source_code": self.source_code,
            "release_key": self.release_key,
            "committed": self.committed,
            "release_status": self.release_status,
            "source_id": self.source_id,
            "release_id": self.release_id,
            "artifact_id": self.artifact_id,
            "run_id": self.run_id,
            "release_reused": self.release_reused,
            "observations_written": self.observations_written,
            "observations_reused": self.observations_reused,
            "records_received": self.records_received,
            "records_rejected": self.records_rejected,
            "records_absent_value": self.records_absent_value,
            "warnings": list(self.warnings),
            "errors": list(self.errors),
        }


class _AbortDryRun(Exception):
    """Sortie interne : force le rollback de la transaction en dry-run."""


def idempotency_key(request: WaterStagingIngestionRequest) -> str:
    """Clé de run déterministe : mêmes octets + même release = même clé.

    Adossée à `ingestion_runs_idempotency_key_uniq`, elle sérialise deux
    ingestions concurrentes de la même release — la garantie qui manque aux
    observations, dont aucune contrainte d'unicité ne protège l'identité.
    """
    return "water-staging:" + hashlib.sha256(
        f"{request.source_code}|{request.release_key}|{request.expected_sha256.lower()}".encode()
    ).hexdigest()


def _load_source(cur, source_code: str) -> dict[str, Any]:
    cur.execute(
        "SELECT * FROM source_registry WHERE code = %s AND company_id IS NULL",
        (source_code,),
    )
    row = cur.fetchone()
    if row is None:
        raise StagingIngestionRefused(
            f"source {source_code!r} absente du Source Registry global — X2B "
            "n'en crée aucune : déclarer la source et sa licence est un geste "
            "humain, pas un effet de bord d'ingestion."
        )
    return dict(row)


def _detect_release(
    cur, *, source_id: int, request: WaterStagingIngestionRequest, mime_type: str
) -> tuple[dict[str, Any], bool]:
    """`detected`, idempotent sur (source_id, release_key, checksum) — même
    contrat que `release_service.detect_release`, dans NOTRE transaction."""
    cur.execute(
        """
        INSERT INTO source_releases
            (source_id, company_id, release_key, checksum_sha256, mime_type,
             status, metadata, retrieved_at)
        VALUES (%s, NULL, %s, %s, %s, 'detected', %s, now())
        ON CONFLICT (source_id, release_key, checksum_sha256) DO NOTHING
        RETURNING *
        """,
        (source_id, request.release_key, request.expected_sha256.lower(), mime_type,
         json.dumps(_release_metadata(request))),
    )
    row = cur.fetchone()
    if row is not None:
        return dict(row), False
    cur.execute(
        "SELECT * FROM source_releases WHERE source_id = %s AND release_key = %s "
        "AND checksum_sha256 = %s AND company_id IS NULL",
        (source_id, request.release_key, request.expected_sha256.lower()),
    )
    existing = cur.fetchone()
    if existing is None:
        raise StagingWriteError(
            "détection de release incohérente (conflit puis lecture vide)."
        )
    return dict(existing), True


def _release_metadata(request: WaterStagingIngestionRequest) -> dict[str, Any]:
    """Provenance descriptive. AUCUNE clé de statut : le statut est une colonne.

    `methodology_code` y figure parce que `observations` n'a pas de colonne
    pour lui (cf. audit §11.2) — c'est une donnée de provenance, pas un état.
    """
    return {
        "ingestion_phase": "X2B",
        "methodology_code": request.method_code,
        "methodology_version": request.method_version,
        "validation_report_sha256": request.report_sha256.lower(),
        "operator": request.operator,
    }


def _promote_to_staging(cur, release: Mapping[str, Any]) -> str:
    """`detected` → `validated` : l'état natif d'une release en staging."""
    current = release["status"]
    if current == STAGING_RELEASE_STATUS:
        return current
    if current != "detected":
        raise StagingWriteError(
            f"release au statut {current!r} — X2B ne promeut que 'detected' vers "
            f"{STAGING_RELEASE_STATUS!r}. Une release publiée ou en quarantaine "
            "ne se réécrit pas ici."
        )
    cur.execute(
        "UPDATE source_releases SET status = %s WHERE id = %s AND published_at IS NULL "
        "RETURNING status",
        (STAGING_RELEASE_STATUS, release["id"]),
    )
    row = cur.fetchone()
    if row is None:
        raise StagingWriteError(
            f"promotion refusée pour la release {release['id']} — published_at non nul."
        )
    return row["status"]


def _register_artifact(
    cur, *, release_id: int, pages: list[bytes], request: WaterStagingIngestionRequest,
    mime_type: str, storage,
) -> tuple[int, bool]:
    """Artefact global, content-addressed. Idempotent sur (sha256, global)."""
    raw = b"".join(pages)
    sha = hashlib.sha256(raw).hexdigest()
    cur.execute(
        "SELECT id FROM evidence_artifacts WHERE sha256 = %s AND company_id IS NULL "
        "ORDER BY id LIMIT 1",
        (sha,),
    )
    existing = cur.fetchone()
    if existing is not None:
        return existing["id"], True

    key = f"intelligence/global/{sha}.json"
    blob_key = storage.put(key, raw, mime_type)
    cur.execute(
        """
        INSERT INTO evidence_artifacts
            (company_id, source_release_id, blob_key, sha256, filename, mime_type,
             size_bytes, sensitivity)
        VALUES (NULL, %s, %s, %s, %s, %s, %s, 'public')
        RETURNING id
        """,
        (release_id, blob_key, sha,
         f"{request.source_code}_{request.release_key}.json", mime_type, len(raw)),
    )
    return cur.fetchone()["id"], False


def _existing_projections(cur, release_id: int) -> dict[tuple, dict[str, Any]]:
    """Projection des observations déjà écrites pour CETTE release.

    L'identité Eau complète n'est pas persistable (audit §11.1) : la clé est
    donc la projection sur les colonnes réellement stockées. Une identité qui
    ne différerait que par un scénario se projetterait au même endroit — c'est
    pourquoi les observations à scénario sont refusées en amont.
    """
    cur.execute(
        "SELECT subject_type, subject_key, metric_code, geography_code, valid_from, "
        "valid_to, numeric_value, text_value, boolean_value, unit, data_status, "
        "methodology_version FROM observations "
        "WHERE source_release_id = %s AND company_id IS NULL",
        (release_id,),
    )
    return {
        (
            r["subject_type"], r["subject_key"], r["metric_code"],
            r["geography_code"],
            r["valid_from"].date() if r["valid_from"] else None,
            r["valid_to"].date() if r["valid_to"] else None,
        ): dict(r)
        for r in cur.fetchall()
    }


def _value_columns(observation: WaterMetricObservation) -> tuple[Any, Any, Any]:
    value = observation.value
    if isinstance(value, bool):
        return None, None, value
    if isinstance(value, (int, float)):
        return float(value), None, None
    if isinstance(value, str):
        return None, value, None
    return None, None, None


def _kernel_data_status(observation: WaterMetricObservation, context: str) -> str:
    water_status = observation.quality.data_status
    mapped = DATA_STATUS_MAPPING.get(water_status)
    if mapped is None:
        raise StagingIngestionRefused(
            f"{context} : statut de donnée {water_status!r} sans correspondance "
            f"vérifiée vers le vocabulaire du noyau ({sorted(DATA_STATUS_MAPPING)}) "
            "— aucune conversion implicite, aucune donnée de fixture ingérée."
        )
    return mapped


def _write_observations(
    cur, *, release_id: int, prepared: Sequence[PreparedObservation]
) -> tuple[int, int]:
    existing = _existing_projections(cur, release_id)
    written = reused = 0

    for item in prepared:
        observation = item.observation
        context = f"{item.subject_key}/{observation.metric_code}"
        numeric, text, boolean = _value_columns(observation)
        if numeric is None and text is None and boolean is None:
            raise StagingIngestionRefused(
                f"{context} : aucune valeur à écrire (value_withheld={observation.value_withheld}). "
                "`observations_value_presence_check` exige au moins une valeur — "
                "une source dont la licence interdit l'affichage produit des "
                "observations structurellement non insérables (audit §11.3). "
                "Rien n'est écrit plutôt qu'une ligne vide."
            )
        data_status = _kernel_data_status(observation, context)
        key = (
            item.subject_type, item.subject_key, observation.metric_code,
            observation.geography.code, observation.period_start, observation.period_end,
        )
        if key in existing:
            previous = existing[key]
            same = (
                _same_number(previous["numeric_value"], numeric)
                and previous["text_value"] == text
                and previous["boolean_value"] == boolean
                and previous["unit"] == observation.unit
                and previous["data_status"] == data_status
                and previous["methodology_version"] == observation.method.version
            )
            if same:
                reused += 1
                continue
            raise StagingIngestionRefused(
                f"{context} : collision d'identité — une observation de même "
                "identité existe déjà dans cette release avec un contenu "
                "DIFFÉRENT. Aucune valeur n'est retenue par défaut : soit "
                "l'identité est sous-spécifiée, soit les données sont "
                "contradictoires. Transaction avortée."
            )

        cur.execute(
            """
            INSERT INTO observations
                (company_id, subject_type, subject_key, metric_code, numeric_value,
                 text_value, boolean_value, unit, geography_code, observed_at,
                 valid_from, valid_to, source_release_id, data_status,
                 methodology_version)
            VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                item.subject_type, item.subject_key, observation.metric_code,
                numeric, text, boolean, observation.unit, observation.geography.code,
                _as_utc(observation.period_end), _as_utc(observation.period_start),
                _as_utc(observation.period_end), release_id, data_status,
                observation.method.version,
            ),
        )
        written += 1

    return written, reused


def _same_number(previous: Any, candidate: float | None) -> bool:
    if previous is None or candidate is None:
        return previous is None and candidate is None
    return float(previous) == float(candidate)


def _as_utc(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=timezone.utc)


def _record_run(
    cur, *, source_id: int, release_id: int, request: WaterStagingIngestionRequest,
    outcome: PreparedRelease, written: int, reused: int,
) -> tuple[int | None, bool]:
    """Trace d'exécution dans `ingestion_runs`. Statut `validated`, jamais
    `published` : X2B ne publie rien."""
    cur.execute(
        """
        INSERT INTO ingestion_runs
            (company_id, source_id, source_release_id, adapter_kind, idempotency_key,
             status, detected_count, accepted_count, rejected_count, warning_count,
             completed_at, metadata)
        VALUES (NULL, %s, %s, %s, %s, 'validated', %s, %s, %s, %s, now(), %s)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
        """,
        (
            source_id, release_id, f"water-staging:{request.source_code}",
            idempotency_key(request), outcome.records_received, written + reused,
            outcome.records_rejected, len(outcome.warnings),
            json.dumps({
                "environment": request.environment,
                "observations_written": written,
                "observations_reused": reused,
                "validation_report_sha256": request.report_sha256.lower(),
                "operator": request.operator,
            }),
        ),
    )
    row = cur.fetchone()
    if row is not None:
        return row["id"], False
    cur.execute(
        "SELECT id FROM ingestion_runs WHERE idempotency_key = %s",
        (idempotency_key(request),),
    )
    existing = cur.fetchone()
    return (existing["id"] if existing else None), True


def ingest_staging_release(
    request: WaterStagingIngestionRequest,
    *,
    pages: list[bytes],
    decoded_pages: list[Any],
    report: Mapping[str, Any],
    connection_factory: Callable,
    storage,
    commit: bool,
    retrieved_at: date | None = None,
    mime_type: str = "application/json",
) -> StagingIngestionResult:
    """Grave une release Eau en staging, en UNE transaction.

    `commit=False` (défaut opérateur) exécute TOUT — y compris les INSERT —
    puis avorte la transaction : le dry-run éprouve donc le vrai chemin
    d'écriture, contraintes et triggers compris, au lieu de le simuler.
    """
    result = StagingIngestionResult(
        source_code=request.source_code,
        release_key=request.release_key,
        committed=False,
        release_status=STAGING_RELEASE_STATUS,
    )
    effective_retrieved_at = retrieved_at or datetime.now(timezone.utc).date()

    try:
        with connection_factory() as conn:
            with conn.cursor() as cur:
                # Écriture de lignes GLOBALES (company_id IS NULL) : la policy
                # d'INSERT ne l'autorise qu'en bypass explicite — geste
                # d'opérateur, jamais une requête utilisateur.
                cur.execute("SET LOCAL app.rls_bypass = 'on'")

                source = _load_source(cur, request.source_code)
                # La provenance vient de la CONFIGURATION CANONIQUE, jamais de
                # la ligne du registre : celle-ci est confrontée à elle, et une
                # divergence lève avant toute écriture. Un registre semé par une
                # version antérieure porterait sinon une attribution obsolète que
                # le graveur recopierait sur chaque observation — et une release
                # est immuable.
                provenance = release_provenance.provenance_for(
                    request.source_code, accessed_on=effective_retrieved_at
                )
                release_provenance.verify_registry_row(provenance, source)
                decision = license_policy.evaluate(source)
                if not decision.allow_ingest:
                    raise StagingIngestionRefused(
                        f"licence de {request.source_code} : ingestion interdite — "
                        + " ; ".join(decision.reasons)
                    )
                if not decision.allow_store:
                    raise StagingIngestionRefused(
                        f"licence de {request.source_code} : conservation interdite — "
                        + " ; ".join(decision.reasons)
                    )

                outcome = prepare_release(
                    request,
                    pages=decoded_pages,
                    report=report,
                    license_decision=decision,
                    retrieved_at=effective_retrieved_at,
                    provenance=provenance,
                )
                result.records_received = outcome.records_received
                result.records_rejected = outcome.records_rejected
                result.records_absent_value = outcome.records_absent_value
                result.warnings = list(outcome.warnings)
                result.errors = list(outcome.errors)

                if not outcome.prepared:
                    raise StagingIngestionRefused(
                        "aucune observation exploitable après parsing et validation — "
                        "rien n'est gravé. " + " ; ".join(outcome.errors[:3])
                    )

                release, reused = _detect_release(
                    cur, source_id=source["id"], request=request, mime_type=mime_type
                )
                result.source_id = source["id"]
                result.release_id = release["id"]
                result.release_reused = reused
                result.release_status = _promote_to_staging(cur, release)

                artifact_id, _ = _register_artifact(
                    cur, release_id=release["id"], pages=pages, request=request,
                    mime_type=mime_type, storage=storage,
                )
                result.artifact_id = artifact_id

                written, obs_reused = _write_observations(
                    cur, release_id=release["id"], prepared=outcome.prepared
                )
                result.observations_written = written
                result.observations_reused = obs_reused

                run_id, _ = _record_run(
                    cur, source_id=source["id"], release_id=release["id"],
                    request=request, outcome=outcome, written=written, reused=obs_reused,
                )
                result.run_id = run_id

                if not commit:
                    raise _AbortDryRun()
        result.committed = True
    except _AbortDryRun:
        # Transaction avortée par `get_db`/`get_admin_db` : rien n'a été écrit.
        result.committed = False
        result.warnings.append(
            "dry-run : transaction avortée, aucune ligne conservée. "
            "Relancer avec --commit pour graver."
        )
    return result
