"""
services/water_intelligence/pipeline.py — ossature d'ingestion opérateur
générique Water Intelligence (P03), hors runtime.

Sept étapes explicites, traçables et remplaçables : `plan -> fetch -> parse ->
normalize -> derive -> validate -> publish`. `fetch`/`parse`/`normalize`
réutilisent tels quels le contrat `SourceAdapter` existant
(`services/intelligence/adapters/base.py`, PR-04) — ce module ne le
redéfinit pas. `derive`/`validate` produisent des `WaterMetricObservation`
(`models/water_intelligence.py`, P02) sans jamais inventer une valeur
absente. `publish` reste strictement dry-run dans cette PR : aucun
connecteur réel n'existe encore, aucune ligne `source_registry` n'est créée,
aucun artefact n'est persisté.

Chaque exécution produit un `PipelineExecutionReport` unique, que l'étape
ait réussi ou échoué — jamais une exception qui remonte nue sans rapport, et
jamais un rapport qui masque un échec par un résultat partiel non signalé.
"""

from __future__ import annotations

import hashlib
import json
import struct
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field

from models.analytics import MethodRef, confidence_to_display
from models.water_intelligence import (
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterQualityMetadata,
    WaterSourceReference,
)
from services.intelligence.adapters.base import (
    AdapterError,
    ObservationDraft,
    ReleaseCandidate,
)
from services.water_intelligence.pipeline_transport import (
    Transport,
    TransportError,
)
from services.water_intelligence.source_catalog import (
    SourceCatalogEntry,
    SourceCatalogValidationError,
    load_source_catalog,
)

REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_CATALOG_PATH = (
    REPO_ROOT
    / "docs"
    / "carbonco"
    / "water-intelligence"
    / "SOURCE_CATALOG_NORMALIZED_V1.csv"
)

PipelineStage = Literal["plan", "fetch", "parse", "normalize", "derive", "validate", "publish"]
_STAGE_ORDER: tuple[PipelineStage, ...] = (
    "plan",
    "fetch",
    "parse",
    "normalize",
    "derive",
    "validate",
    "publish",
)


class PipelineError(Exception):
    """Base des erreurs de pipeline — jamais un échec silencieux."""


class PipelineUnknownSourceError(PipelineError):
    """`source_code` absent du catalogue normalisé (P01b) — refusé, pas deviné."""


class PipelineLimitExceeded(PipelineError):
    """Une des bornes fixées en `plan` (pages, octets bruts) est dépassée."""


class PipelineDataUnavailableError(PipelineError):
    """Une étape a besoin d'une donnée que rien ne fournit — arrêt explicite,
    jamais une valeur par défaut métier inventée à sa place."""


# ---------------------------------------------------------------------------
# Rapport d'exécution — machine-readable, jamais de secret
# ---------------------------------------------------------------------------


class PipelineExecutionReport(BaseModel):
    """Rapport produit par CHAQUE exécution, succès ou échec. Ne contient
    jamais d'octet brut, de jeton de page ni de contenu de fixture — unique-
    ment des identités, des checksums et des compteurs."""

    source_code: str
    release_key: str | None = None
    input_checksum: str | None = None
    output_checksum: str | None = None
    steps_executed: list[PipelineStage] = Field(default_factory=list)
    steps_failed: list[PipelineStage] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    records_read: int = 0
    records_normalized: int = 0
    records_publishable: int = 0
    license_status: WaterLicenseDecision | None = None
    dry_run: bool = True
    # Seule exception documentée à "aucune horloge implicite" (règle 9 du
    # pack maître) : l'horodatage du RAPPORT lui-même, jamais une valeur
    # métier. Toujours fourni par un `clock` injecté — jamais `datetime.now()`
    # appelé en dur dans ce module.
    executed_at: datetime

    @property
    def succeeded(self) -> bool:
        return not self.steps_failed


# ---------------------------------------------------------------------------
# Plan — résolution du catalogue P01b, aucune supposition de licence
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PipelinePlan:
    source_code: str
    catalog_entry: SourceCatalogEntry
    license_known: bool
    max_pages: int
    max_raw_bytes: int


def make_plan(
    *,
    source_code: str,
    max_pages: int,
    max_raw_bytes: int,
    catalog_path: Path = DEFAULT_CATALOG_PATH,
) -> PipelinePlan:
    """Résout `source_code` dans le catalogue normalisé P01b. Lève
    `PipelineUnknownSourceError` si absent — jamais une entrée inventée."""
    try:
        catalog = load_source_catalog(catalog_path)
    except SourceCatalogValidationError as exc:
        raise PipelineDataUnavailableError(f"catalogue de sources invalide : {exc}") from exc

    entry = next((e for e in catalog.entries if e.source_code == source_code), None)
    if entry is None:
        raise PipelineUnknownSourceError(
            f"source_code {source_code!r} absent du catalogue normalisé "
            f"({catalog.total} entrées connues) — refusé, pas deviné."
        )
    return PipelinePlan(
        source_code=source_code,
        catalog_entry=entry,
        license_known=entry.license_status != "unknown",
        max_pages=max_pages,
        max_raw_bytes=max_raw_bytes,
    )


# ---------------------------------------------------------------------------
# Transport -> SourceAdapter — réutilise fetch_release/parse/normalize tels
# quels (PR-04) ; seule la collecte paginée en amont est nouvelle.
# ---------------------------------------------------------------------------

Normalizer = Callable[[Any], list[ObservationDraft]]


def _frame_pages(pages: list[bytes]) -> bytes:
    """Concatène des pages en un blob déterministe et sans ambiguïté :
    chaque page est préfixée par sa longueur (4 octets big-endian). Aucun
    JSON/texte impliqué ici — une page peut contenir n'importe quel octet,
    y compris un JSON déjà invalide (la validité n'est vérifiée qu'à `parse`).
    """
    parts: list[bytes] = []
    for page in pages:
        parts.append(struct.pack(">I", len(page)))
        parts.append(page)
    return b"".join(parts)


def _unframe_pages(blob: bytes) -> list[bytes]:
    pages: list[bytes] = []
    offset = 0
    while offset < len(blob):
        (length,) = struct.unpack_from(">I", blob, offset)
        offset += 4
        pages.append(blob[offset : offset + length])
        offset += length
    return pages


class TransportAdapter:
    """Adapte un `Transport` paginé au contrat `SourceAdapter` existant.

    `detect_releases()` assemble TOUTES les pages (bornées par `max_pages`,
    reprise possible via `resume_from_token`) en un contenu JSON canonique
    unique avant de rendre la main à `fetch_release`/`parse`/`normalize`,
    inchangés depuis PR-04. Jamais un connecteur réel : `transport` est
    toujours `FakeTransport` en P03.
    """

    def __init__(
        self,
        *,
        release_key: str,
        transport: Transport,
        max_pages: int,
        normalizer: Normalizer,
        filename: str = "paginated-release.json",
        resume_from_token: str | None = None,
    ) -> None:
        self._release_key = release_key
        self._transport = transport
        self._max_pages = max_pages
        self._normalizer = normalizer
        self._filename = filename
        self._resume_from_token = resume_from_token
        self._assembled: bytes | None = None

    def detect_releases(self) -> list[ReleaseCandidate]:
        """Assemble les octets bruts de toutes les pages — AUCUN décodage JSON
        ici : une page dont le *transport* signale la corruption
        (`TransportCorrupted`) échoue à cette étape (fetch) ; une page dont
        les octets sont simplement du JSON invalide n'échoue qu'à `parse`,
        plus bas. Les deux échecs restent distincts et testables séparément.
        """
        raw_pages = self._fetch_all_raw_pages()
        assembled = _frame_pages(raw_pages)
        self._assembled = assembled
        return [
            ReleaseCandidate(release_key=self._release_key, content=assembled, filename=self._filename)
        ]

    def _fetch_all_raw_pages(self) -> list[bytes]:
        pages: list[bytes] = []
        token = self._resume_from_token
        pages_fetched = 0
        while True:
            pages_fetched += 1
            if pages_fetched > self._max_pages:
                raise PipelineLimitExceeded(
                    f"limite de pages dépassée : {self._max_pages} page(s) maximum "
                    f"autorisée(s) pour cette exécution (page_token={token!r} en attente)."
                )
            fetched = self._transport.fetch_page(page_token=token)
            pages.append(fetched.content)
            if not fetched.has_next_page:
                break
            token = fetched.next_page_token
        return pages

    def fetch_release(self, candidate: ReleaseCandidate) -> bytes:
        assert self._assembled is not None
        return candidate.content

    def parse(self, raw: bytes) -> Any:
        """Décode CHAQUE page en JSON — un échec ici est un échec de
        *parsing*, distinct d'une corruption détectée par le transport."""
        pages: list[Any] = []
        for index, page_bytes in enumerate(_unframe_pages(raw), start=1):
            try:
                pages.append(json.loads(page_bytes.decode("utf-8")))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise AdapterError(f"page {index} : JSON invalide ({exc})") from exc
        return pages

    def normalize(self, parsed: Any) -> list[ObservationDraft]:
        drafts = self._normalizer(parsed)
        for draft in drafts:
            if not draft.has_value():
                raise AdapterError(
                    f"draft sans valeur ({draft.subject_key}/{draft.metric_code}) — "
                    "au moins une valeur numeric/text/boolean requise."
                )
        return drafts


# ---------------------------------------------------------------------------
# derive — ObservationDraft (noyau) -> candidat WaterMetricObservation (P02)
# ---------------------------------------------------------------------------

GeographyResolver = Callable[[str | None], WaterGeographyRef]


@dataclass
class DeriveResult:
    candidates: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def derive_observations(
    drafts: list[ObservationDraft],
    *,
    source: WaterSourceReference,
    method: MethodRef,
    geography_resolver: GeographyResolver,
    default_methodology_version: str | None = None,
) -> DeriveResult:
    """Traduit chaque `ObservationDraft` en candidat `WaterMetricObservation`
    (dict non encore validé — la validation stricte est l'étape suivante).

    Aucune valeur par défaut métier inventée : une géographie non résolue ou
    une date d'observation absente rejette le draft (erreur nommée dans le
    rapport), jamais une valeur substituée en silence.
    """
    result = DeriveResult()
    for draft in drafts:
        try:
            geography = geography_resolver(draft.geography_code)
        except PipelineDataUnavailableError as exc:
            result.errors.append(
                f"{draft.subject_key}/{draft.metric_code} : géographie non résolue ({exc})"
            )
            continue

        if draft.observed_at is None:
            result.errors.append(
                f"{draft.subject_key}/{draft.metric_code} : observed_at absent — "
                "période obligatoire, aucune date substituée."
            )
            continue
        period = draft.observed_at.date()

        methodology_version = draft.methodology_version or default_methodology_version
        if not methodology_version:
            result.errors.append(
                f"{draft.subject_key}/{draft.metric_code} : aucune version de méthode "
                "(ni sur le draft, ni de valeur par défaut fournie)."
            )
            continue

        if draft.numeric_value is not None:
            value: float | str | bool | None = draft.numeric_value
        elif draft.text_value is not None:
            value = draft.text_value
        elif draft.boolean_value is not None:
            value = draft.boolean_value
        else:
            value = None  # ne devrait pas arriver : normalize() l'a déjà refusé

        candidate = {
            "metric_code": draft.metric_code,
            "value": value,
            "unit": draft.unit,
            "geography": geography.model_dump(),
            "period_start": period,
            "period_end": period,
            "method": method.model_dump(),
            "quality": WaterQualityMetadata(
                data_status=draft.data_status,  # cf. docstring module : conversion explicite si besoin, jamais implicite
                confidence=confidence_to_display(draft.confidence),
                coverage_pct=None,
                warnings=[],
            ).model_dump(),
            "source": source.model_dump(),
            "scenario": None,
            "value_withheld": False,
        }
        result.candidates.append(candidate)
    return result


# ---------------------------------------------------------------------------
# validate — licence + contrat P02, jamais de licence supposée
# ---------------------------------------------------------------------------


@dataclass
class ValidateResult:
    observations: list[WaterMetricObservation] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def validate_candidates(
    candidates: list[dict[str, Any]],
    *,
    catalog_license_known: bool,
    license_decision: WaterLicenseDecision | None,
) -> ValidateResult:
    """Applique la porte de licence puis le contrat `WaterMetricObservation`.

    La porte se décide UNIQUEMENT sur `license_decision` : `None` reste
    `unknown` (aucune valeur publiable, jamais une licence supposée
    permissive par défaut) ; une décision explicitement fournie fait foi,
    qu'elle autorise ou bloque l'affichage — indépendamment de ce que dit le
    catalogue P01b (`catalog_license_known` n'est qu'une information de
    contexte ajoutée aux avertissements, jamais une condition de la porte :
    un appelant qui fournit une décision réelle ne doit pas être ignoré au
    prétexte que le catalogue, lui, ne l'a pas encore évaluée). Chaque
    candidat est validé indépendamment — un candidat invalide n'invalide pas
    les autres.
    """
    result = ValidateResult()
    effective_display_allowed = bool(license_decision and license_decision.allow_display)
    if license_decision is None:
        result.warnings.append(
            "licence inconnue (aucune license_decision fournie"
            + ("" if catalog_license_known else " ; catalogue P01b également 'unknown'")
            + ") — toutes les valeurs sont retenues (value_withheld)."
        )

    for candidate in candidates:
        payload = dict(candidate)
        payload["value_withheld"] = not effective_display_allowed
        if payload["value_withheld"]:
            payload["value"] = None
        try:
            observation = WaterMetricObservation.model_validate(payload)
        except Exception as exc:  # pydantic.ValidationError — capturé par record, jamais fatal au lot
            result.errors.append(f"{candidate.get('metric_code', '?')} : {exc}")
            continue
        result.observations.append(observation)
    return result


# ---------------------------------------------------------------------------
# publish — strictement dry-run en P03
# ---------------------------------------------------------------------------


@dataclass
class PublishResult:
    records_publishable: int
    warnings: list[str] = field(default_factory=list)


def publish_dry_run(observations: list[WaterMetricObservation], *, dry_run: bool) -> PublishResult:
    """P03 ne fournit aucun graveur Evidence Kernel réel : `dry_run=False`
    est refusé explicitement plutôt que de silencieusement rien écrire."""
    if not dry_run:
        raise PipelineDataUnavailableError(
            "publish: dry_run=False demandé mais aucun graveur Evidence Kernel "
            "réel n'est fourni par P03 — arrêt explicite, aucune écriture."
        )
    publishable = sum(1 for o in observations if not o.value_withheld)
    warnings: list[str] = []
    if publishable < len(observations):
        warnings.append(
            f"{len(observations) - publishable} observation(s) retenue(s) (value_withheld), "
            f"{publishable}/{len(observations)} publiable(s)."
        )
    return PublishResult(records_publishable=publishable, warnings=warnings)


# ---------------------------------------------------------------------------
# Orchestrateur — toujours un rapport, jamais une exception qui remonte nue
# ---------------------------------------------------------------------------


def run_pipeline(
    *,
    source_code: str,
    release_key: str,
    transport: Transport,
    normalizer: Normalizer,
    source: WaterSourceReference,
    method: MethodRef,
    geography_resolver: GeographyResolver,
    max_pages: int = 1,
    max_raw_bytes: int = 10_000_000,
    dry_run: bool = True,
    resume_from_token: str | None = None,
    default_methodology_version: str | None = None,
    license_decision: WaterLicenseDecision | None = None,
    clock: Callable[[], datetime] | None = None,
    catalog_path: Path = DEFAULT_CATALOG_PATH,
) -> PipelineExecutionReport:
    """Exécute `plan -> fetch -> parse -> normalize -> derive -> validate ->
    publish`. Retourne TOUJOURS un rapport : un échec de stage l'arrête (les
    stages suivants ne s'exécutent pas) mais ne lève pas d'exception hors de
    cette fonction — le rapport est la seule sortie côté appelant.
    """
    now = clock or datetime.now
    executed: list[PipelineStage] = []
    failed: list[PipelineStage] = []
    warnings: list[str] = []
    errors: list[str] = []
    release_key_out: str | None = None
    input_checksum: str | None = None
    output_checksum: str | None = None
    records_read = 0
    records_normalized = 0
    records_publishable = 0
    license_known = False

    def _report() -> PipelineExecutionReport:
        return PipelineExecutionReport(
            source_code=source_code,
            release_key=release_key_out,
            input_checksum=input_checksum,
            output_checksum=output_checksum,
            steps_executed=list(executed),
            steps_failed=list(failed),
            warnings=warnings,
            errors=errors,
            records_read=records_read,
            records_normalized=records_normalized,
            records_publishable=records_publishable,
            license_status=license_decision,
            dry_run=dry_run,
            executed_at=now(),
        )

    # --- plan ---
    try:
        plan = make_plan(
            source_code=source_code,
            max_pages=max_pages,
            max_raw_bytes=max_raw_bytes,
            catalog_path=catalog_path,
        )
        license_known = plan.license_known
        executed.append("plan")
    except PipelineError as exc:
        failed.append("plan")
        errors.append(f"plan : {exc}")
        return _report()

    adapter = TransportAdapter(
        release_key=release_key,
        transport=transport,
        max_pages=plan.max_pages,
        normalizer=normalizer,
        resume_from_token=resume_from_token,
    )

    # --- fetch ---
    try:
        candidates = adapter.detect_releases()
        candidate = candidates[0]
        release_key_out = candidate.release_key
        input_checksum = candidate.checksum_sha256
        if len(candidate.content) > max_raw_bytes:
            raise PipelineLimitExceeded(
                f"volume brut {len(candidate.content)} octets > budget {max_raw_bytes} octets."
            )
        raw = adapter.fetch_release(candidate)
        executed.append("fetch")
    except (PipelineError, TransportError, AdapterError) as exc:
        failed.append("fetch")
        errors.append(f"fetch : {exc}")
        return _report()

    # --- parse ---
    try:
        parsed = adapter.parse(raw)
        executed.append("parse")
    except AdapterError as exc:
        failed.append("parse")
        errors.append(f"parse : {exc}")
        return _report()

    # --- normalize ---
    try:
        drafts = adapter.normalize(parsed)
        records_read = len(drafts)
        records_normalized = len(drafts)
        executed.append("normalize")
    except AdapterError as exc:
        failed.append("normalize")
        errors.append(f"normalize : {exc}")
        return _report()

    # --- derive ---
    derive_result = derive_observations(
        drafts,
        source=source,
        method=method,
        geography_resolver=geography_resolver,
        default_methodology_version=default_methodology_version,
    )
    errors.extend(derive_result.errors)
    if not derive_result.candidates and drafts:
        failed.append("derive")
        return _report()
    executed.append("derive")
    if derive_result.errors:
        warnings.append(
            f"{len(derive_result.errors)}/{len(drafts)} draft(s) écarté(s) en dérivation "
            "(voir errors)."
        )

    # --- validate ---
    validate_result = validate_candidates(
        derive_result.candidates,
        catalog_license_known=license_known,
        license_decision=license_decision,
    )
    errors.extend(validate_result.errors)
    warnings.extend(validate_result.warnings)
    if not validate_result.observations and derive_result.candidates:
        failed.append("validate")
        return _report()
    executed.append("validate")

    canonical = [o.model_dump(mode="json") for o in validate_result.observations]
    output_checksum = hashlib.sha256(
        json.dumps(canonical, sort_keys=True).encode("utf-8")
    ).hexdigest()

    # --- publish (dry-run only in P03) ---
    try:
        publish_result = publish_dry_run(validate_result.observations, dry_run=dry_run)
        records_publishable = publish_result.records_publishable
        warnings.extend(publish_result.warnings)
        executed.append("publish")
    except PipelineError as exc:
        failed.append("publish")
        errors.append(f"publish : {exc}")
        return _report()

    return _report()
