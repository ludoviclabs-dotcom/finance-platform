"""scripts/water_intelligence/validate_hubeau.py — validation live Hub'Eau (X1.3).

Geste OPÉRATEUR explicite et borné. Rien ici n'est déclenché par une requête
utilisateur, un cron ou le démarrage de l'API.

Usage :

    python -m scripts.water_intelligence.validate_hubeau \\
      --source hydrometrie|piezometrie|prelevements|qualite_surface \\
      --release <release_key> \\
      --geography-type <nom_de_parametre_officiel> \\
      --geography-code <code> \\
      --date-from <AAAA-MM-JJ> --date-to <AAAA-MM-JJ> \\
      --max-pages <n> --max-bytes <n> \\
      --dry-run --report <chemin.md>

## Aucun territoire, aucune fenêtre, aucun paramètre codés en dur

`--geography-type` est le NOM du paramètre officiel Hub'Eau
(`code_departement`, `code_station`, `code_bss`, `code_entite`…), validé
contre la liste déclarée par le socle pour l'endpoint concerné. Le script ne
propose aucune valeur par défaut : une recette technique doit dire quel
territoire elle a interrogé, et pourquoi.

## Deux passages, une seule collecte

L'acquisition est faite UNE fois par `HubeauTransport` (bornage, pagination,
retries) alimenté par le `OperatorFetcher`. Les octets obtenus sont ensuite
REJOUÉS localement dans `run_pipeline` (`ReplayTransport`) : le checksum du
rapport porte donc exactement sur ce que le pipeline a vu, et l'API publique
n'est interrogée qu'une fois.

## Ce que cette commande ne fait jamais

Aucune écriture en base (`run_pipeline(dry_run=True)`, et `publish_dry_run`
refuse explicitement le contraire). Aucune décision de licence : aucune n'est
fournie, donc toutes les valeurs sont retenues (`value_withheld`) et
`records_publishable` vaut 0. Aucun octet de donnée n'entre dans le rapport.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Sequence

from models.water_intelligence import WaterSourceReference
from scripts.water_intelligence.fetcher import (
    FetcherNetworkError,
    FetcherRefusal,
    FetcherTimeout,
    OperatorFetcher,
)
from scripts.water_intelligence.replay import ReplayTransport
from scripts.water_intelligence.reporting import ValidationReport
from services.water_intelligence import hubeau_transport as transport_mod
from services.water_intelligence.connectors import hubeau_hydro as hydro
from services.water_intelligence.connectors import hubeau_withdrawals_quality as usage
from services.water_intelligence.pipeline import run_pipeline

#: Nombre d'identifiants géographiques cités en exemple dans un rapport. Un
#: rapport n'est pas un extrait de données : il atteste d'une couverture, il
#: ne la reproduit pas.
GEOGRAPHY_SAMPLE = 5


@dataclass(frozen=True)
class HubeauFamily:
    """Une famille Hub'Eau retenue par le pack, reliée au socle et au connecteur."""

    name: str
    endpoint_key: str
    source_code: str
    method_version: str
    method_code: str
    #: Nom des deux paramètres de fenêtre, tels que la plateforme les nomme.
    window_parameters: tuple[str, str]
    #: `date` pour une fenêtre en jours, `year` pour une fenêtre en années.
    window_kind: str


FAMILIES: dict[str, HubeauFamily] = {
    "hydrometrie": HubeauFamily(
        name="hydrometrie",
        endpoint_key="hydrometrie.observations_elaborees",
        source_code=hydro.HYDROMETRIE_SOURCE_CODE,
        method_version=hydro.METHOD.version,
        method_code=hydro.METHOD.code,
        window_parameters=("date_debut_obs_elab", "date_fin_obs_elab"),
        window_kind="date",
    ),
    "piezometrie": HubeauFamily(
        name="piezometrie",
        endpoint_key="piezometrie.chroniques",
        source_code=hydro.PIEZOMETRIE_SOURCE_CODE,
        method_version=hydro.METHOD.version,
        method_code=hydro.METHOD.code,
        window_parameters=("date_debut_mesure", "date_fin_mesure"),
        window_kind="date",
    ),
    "prelevements": HubeauFamily(
        name="prelevements",
        endpoint_key="prelevements.chroniques",
        source_code=usage.WITHDRAWALS_SOURCE_CODE,
        method_version=usage.WITHDRAWALS_METHOD.version,
        method_code=usage.WITHDRAWALS_METHOD.code,
        window_parameters=("annee_min", "annee_max"),
        window_kind="year",
    ),
    "qualite_surface": HubeauFamily(
        name="qualite_surface",
        endpoint_key="qualite_rivieres.analyses",
        source_code=usage.QUALITY_SOURCE_CODE,
        method_version=usage.QUALITY_METHOD.version,
        method_code=usage.QUALITY_METHOD.code,
        window_parameters=("date_debut_prelevement", "date_fin_prelevement"),
        window_kind="date",
    ),
}


# ---------------------------------------------------------------------------
# Adaptation OperatorFetcher -> contrat `Fetcher` du socle Hub'Eau
# ---------------------------------------------------------------------------


def build_socket_fetcher(operator: OperatorFetcher) -> transport_mod.Fetcher:
    """Adapte le Fetcher opérateur au contrat attendu par `HubeauTransport`.

    Le socle décide de TOUT (URL, paramètres, pagination, retries) ; cet
    adaptateur n'ajoute aucune décision — il transporte, et traduit un timeout
    en `HubeauTimeoutSignal` pour que le socle applique sa propre politique de
    reprise plutôt que d'échouer sèchement.
    """

    def fetch(request: transport_mod.HubeauHttpRequest) -> transport_mod.HubeauHttpResponse:
        try:
            outcome = operator.fetch(
                request.url, params=request.params, accept="application/json"
            )
        except FetcherTimeout as exc:
            raise transport_mod.HubeauTimeoutSignal(str(exc)) from exc
        except FetcherRefusal as exc:
            # Un refus du Fetcher est une décision de bornage, pas un incident
            # réseau : il ne doit pas être retenté.
            raise transport_mod.HubeauTransportError(f"transfert refusé : {exc}") from exc
        except FetcherNetworkError as exc:
            raise transport_mod.HubeauTransportError(f"transfert impossible : {exc}") from exc
        return transport_mod.HubeauHttpResponse(
            status_code=outcome.status_code, body=outcome.body
        )

    return fetch


# ---------------------------------------------------------------------------
# Acquisition bornée
# ---------------------------------------------------------------------------


@dataclass
class Acquisition:
    pages: list[bytes]
    decoded: list[Any]
    bytes_received: int
    errors: list[str]
    warnings: list[str]


def acquire(
    *,
    query: transport_mod.HubeauQuery,
    fetcher: OperatorFetcher,
    max_pages: int,
    max_bytes: int,
    timeout_seconds: float,
) -> Acquisition:
    """Collecte au plus `max_pages` pages, en s'arrêtant à la première borne."""
    transport = transport_mod.HubeauTransport(
        query=query,
        fetcher=build_socket_fetcher(fetcher),
        max_pages=max_pages,
        max_total_bytes=max_bytes,
        timeout_seconds=timeout_seconds,
    )

    pages: list[bytes] = []
    decoded: list[Any] = []
    errors: list[str] = []
    warnings: list[str] = []
    token: str | None = None

    while True:
        try:
            page = transport.fetch_page(page_token=token)
        except transport_mod.HubeauBudgetExceeded as exc:
            warnings.append(f"borne atteinte, collecte arrêtée : {exc}")
            break
        except transport_mod.HubeauTransportError as exc:
            errors.append(f"transport : {exc}")
            break

        pages.append(page.content)
        try:
            decoded.append(json.loads(page.content.decode("utf-8")))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            errors.append(f"page {page.page_number} illisible en JSON : {exc}")
            break

        if not page.has_next_page:
            break
        token = page.next_page_token

    return Acquisition(
        pages=pages,
        decoded=decoded,
        bytes_received=transport.bytes_received,
        errors=errors,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Analyse par famille
# ---------------------------------------------------------------------------


@dataclass
class Analysis:
    records_received: int = 0
    records_normalized: int = 0
    records_rejected: int = 0
    records_absent_value: int = 0
    rejection_causes: list[str] = None  # type: ignore[assignment]
    units: list[str] = None  # type: ignore[assignment]
    periods: list[str] = None  # type: ignore[assignment]
    geographies: list[str] = None  # type: ignore[assignment]
    warnings: list[str] = None  # type: ignore[assignment]
    normalizer: Callable[[Any], list[Any]] | None = None
    geography_resolver: Callable[[str | None], Any] | None = None
    period_resolver: Callable[[Any], Any] | None = None
    release_config: Any = None

    def __post_init__(self) -> None:
        for name in ("rejection_causes", "units", "periods", "geographies", "warnings"):
            if getattr(self, name) is None:
                setattr(self, name, [])


def _sample(values: Sequence[str]) -> list[str]:
    ordered = sorted(set(values))
    if len(ordered) <= GEOGRAPHY_SAMPLE:
        return ordered
    return ordered[:GEOGRAPHY_SAMPLE] + [f"… (+{len(ordered) - GEOGRAPHY_SAMPLE})"]


def analyse(
    family: HubeauFamily,
    decoded: list[Any],
    *,
    release_key: str,
    retrieved_at: date,
    window: tuple[str, str],
    parameter_codes: Sequence[str],
) -> Analysis:
    """Parse le payload réel et compare-le au schéma attendu par le connecteur.

    Une erreur de schéma n'est PAS rattrapée : elle est le résultat de la
    validation, et elle est reportée telle quelle.
    """
    analysis = Analysis()

    if family.name in ("hydrometrie", "piezometrie"):
        config = hydro.HubeauHydroReleaseConfig(
            release_key=release_key,
            retrieved_at=retrieved_at,
            window_start=date.fromisoformat(window[0]),
            window_end=date.fromisoformat(window[1]),
            kind="hydrometrie" if family.name == "hydrometrie" else "piezometrie",
        )
        analysis.release_config = config
        try:
            parsed = (
                hydro.parse_hydrometrie_pages(decoded, config=config)
                if family.name == "hydrometrie"
                else hydro.parse_piezometrie_pages(decoded, config=config)
            )
        except hydro.HubeauHydroError as exc:
            analysis.rejection_causes.append(f"{type(exc).__name__} : {exc}")
            analysis.records_rejected = _count_records(decoded)
            return analysis

        analysis.records_received = parsed.records_total
        analysis.records_absent_value = parsed.values_absent
        analysis.records_normalized = parsed.values_present
        analysis.warnings.extend(parsed.warnings)
        analysis.units = sorted({m.unit for m in parsed.measurements if m.unit})
        days = parsed.observed_days
        analysis.periods = [f"{days[0].isoformat()} → {days[-1].isoformat()}"] if days else []
        analysis.geographies = _sample(parsed.station_ids)
        analysis.normalizer = hydro.build_normalizer(config)
        analysis.geography_resolver = hydro.build_geography_resolver(parsed.station_ids)
        analysis.period_resolver = hydro.build_period_resolver()
        return analysis

    if family.name == "prelevements":
        config = usage.WithdrawalsReleaseConfig(
            release_key=release_key,
            retrieved_at=retrieved_at,
            year_min=int(window[0]),
            year_max=int(window[1]),
        )
        analysis.release_config = config
        try:
            parsed = usage.parse_withdrawals_pages(decoded, config=config)
        except usage.HubeauUsageError as exc:
            analysis.rejection_causes.append(f"{type(exc).__name__} : {exc}")
            analysis.records_rejected = _count_records(decoded)
            return analysis

        analysis.records_received = parsed.records_total
        analysis.records_absent_value = parsed.values_absent
        analysis.records_normalized = parsed.values_present
        analysis.warnings.extend(parsed.warnings)
        analysis.units = [usage.VOLUME_UNIT] if parsed.records_total else []
        years = sorted({r.year for r in parsed.records})
        analysis.periods = [f"{years[0]} → {years[-1]}"] if years else []
        analysis.geographies = _sample(parsed.ouvrage_ids)
        analysis.normalizer = usage.build_withdrawals_normalizer(config)
        analysis.geography_resolver = usage.build_geography_resolver(parsed.ouvrage_ids)
        analysis.period_resolver = usage.build_withdrawals_period_resolver()
        return analysis

    allowlist = {
        code: usage.DEFAULT_PARAMETER_ALLOWLIST[code]
        for code in parameter_codes
        if code in usage.DEFAULT_PARAMETER_ALLOWLIST
    }
    unknown = [c for c in parameter_codes if c not in usage.DEFAULT_PARAMETER_ALLOWLIST]
    if unknown:
        raise SystemExit(
            f"code(s) SANDRE {unknown} absent(s) de l'allowlist sourcée du connecteur : "
            f"{sorted(usage.DEFAULT_PARAMETER_ALLOWLIST)}. Un code non vérifié n'entre "
            "pas dans une recette."
        )
    config = usage.QualityReleaseConfig(
        release_key=release_key,
        retrieved_at=retrieved_at,
        window_start=date.fromisoformat(window[0]),
        window_end=date.fromisoformat(window[1]),
        parameter_allowlist=allowlist,
    )
    analysis.release_config = config
    try:
        parsed = usage.parse_quality_pages(decoded, config=config)
    except usage.HubeauUsageError as exc:
        analysis.rejection_causes.append(f"{type(exc).__name__} : {exc}")
        analysis.records_rejected = _count_records(decoded)
        return analysis

    analysis.records_received = parsed.records_total
    analysis.records_absent_value = parsed.values_absent
    analysis.records_normalized = parsed.values_present
    analysis.warnings.extend(parsed.warnings)
    analysis.units = sorted({a.unit for a in parsed.analyses if a.unit})
    days = sorted({a.sampled_on for a in parsed.analyses})
    analysis.periods = [f"{days[0].isoformat()} → {days[-1].isoformat()}"] if days else []
    analysis.geographies = _sample(parsed.station_ids)
    analysis.normalizer = usage.build_quality_normalizer(config)
    analysis.geography_resolver = usage.build_geography_resolver(parsed.station_ids)
    analysis.period_resolver = usage.build_quality_period_resolver()
    return analysis


def _count_records(decoded: list[Any]) -> int:
    total = 0
    for page in decoded:
        if isinstance(page, dict) and isinstance(page.get("data"), list):
            total += len(page["data"])
    return total


# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------


def decide_verdict(
    *,
    transfer_failed: bool,
    schema_rejected: bool,
    records_normalized: int,
    pipeline_failed: bool,
) -> str:
    """Traduit l'exécution en un des cinq verdicts autorisés.

    `ready_for_staging` exige les trois : la source a répondu, le schéma réel
    correspond à celui du connecteur, et le pipeline complet est passé. Une
    collecte vide n'est PAS un échec de schéma — c'est une recette dont les
    bornes n'ont rien ramené, et le rapport le dit.
    """
    if transfer_failed:
        return "source_unavailable"
    if schema_rejected or pipeline_failed:
        return "schema_drift"
    if records_normalized == 0:
        return "schema_drift"
    return "ready_for_staging"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.water_intelligence.validate_hubeau",
        description=(
            "Validation live BORNÉE d'une famille Hub'Eau. Lecture seule : aucune "
            "écriture en base, aucune publication, aucune décision de licence."
        ),
    )
    parser.add_argument("--source", required=True, choices=sorted(FAMILIES))
    parser.add_argument(
        "--release",
        required=True,
        help="Clé de release explicite — ni 'latest', ni 'current', ni 'head'.",
    )
    parser.add_argument(
        "--geography-type",
        required=True,
        help="Nom du paramètre géographique officiel (ex. code_departement).",
    )
    parser.add_argument("--geography-code", required=True)
    parser.add_argument(
        "--date-from",
        required=True,
        help="Début de fenêtre : AAAA-MM-JJ, ou AAAA pour les prélèvements.",
    )
    parser.add_argument("--date-to", required=True)
    parser.add_argument(
        "--parameter-code",
        action="append",
        default=[],
        help="Code SANDRE (qualite_surface uniquement), répétable. Allowlist stricte.",
    )
    parser.add_argument(
        "--extra-param",
        action="append",
        default=[],
        metavar="NOM=VALEUR",
        help=(
            "Paramètre officiel supplémentaire (ex. grandeur_hydro_elab=QmJ), répétable. "
            "Validé contre la liste déclarée par le socle pour l'endpoint — un nom inconnu "
            "est refusé avant tout appel."
        ),
    )
    parser.add_argument("--max-pages", type=int, default=1)
    parser.add_argument("--max-bytes", type=int, default=1_000_000)
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Seul mode disponible en X1. Présent pour rendre le geste explicite.",
    )
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument(
        "--artifact-dir",
        type=Path,
        default=None,
        help="Répertoire HORS dépôt où déposer les octets acquis. Absent = rien n'est écrit.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    family = FAMILIES[args.source]
    started = datetime.now(timezone.utc)

    endpoint = transport_mod.ENDPOINTS[family.endpoint_key]
    if args.geography_type not in endpoint.geographic_parameters:
        raise SystemExit(
            f"--geography-type {args.geography_type!r} n'est pas un filtre géographique "
            f"déclaré pour {family.endpoint_key!r}. Attendus : "
            f"{sorted(endpoint.geographic_parameters)}."
        )

    parameters: dict[str, str] = {args.geography_type: args.geography_code}
    parameters[family.window_parameters[0]] = args.date_from
    parameters[family.window_parameters[1]] = args.date_to
    for raw in args.extra_param:
        name, separator, value = raw.partition("=")
        if not separator or not name or not value:
            raise SystemExit(f"--extra-param {raw!r} : format attendu NOM=VALEUR.")
        if name in parameters:
            raise SystemExit(
                f"--extra-param {name!r} entre en conflit avec un paramètre déjà posé "
                "par la géographie ou la fenêtre."
            )
        parameters[name] = value
    if args.source == "qualite_surface":
        codes = args.parameter_code or sorted(usage.DEFAULT_PARAMETER_ALLOWLIST)
        parameters["code_parametre"] = ",".join(codes)
    else:
        codes = []

    try:
        query = transport_mod.HubeauQuery(
            endpoint_key=family.endpoint_key,
            parameters=parameters,
            page_size=args.page_size,
        )
    except transport_mod.HubeauTransportError as exc:
        raise SystemExit(f"requête refusée par le socle avant tout appel : {exc}") from exc

    fetcher = OperatorFetcher(
        allowed_hosts=transport_mod.ALLOWED_HOSTS,
        timeout_seconds=args.timeout,
        max_bytes=args.max_bytes,
    )
    acquisition = acquire(
        query=query,
        fetcher=fetcher,
        max_pages=args.max_pages,
        max_bytes=args.max_bytes,
        timeout_seconds=args.timeout,
    )

    warnings = list(acquisition.warnings)
    errors = list(acquisition.errors)
    analysis = Analysis()
    steps_executed: list[str] = []
    steps_failed: list[str] = []
    pipeline_failed = False

    if acquisition.decoded:
        analysis = analyse(
            family,
            acquisition.decoded,
            release_key=args.release,
            retrieved_at=started.date(),
            window=(args.date_from, args.date_to),
            parameter_codes=codes,
        )
        warnings.extend(analysis.warnings)

        if analysis.normalizer is not None:
            report = run_pipeline(
                source_code=family.source_code,
                release_key=args.release,
                transport=ReplayTransport(acquisition.pages),
                normalizer=analysis.normalizer,
                source=_source_reference(family, args, acquisition, started),
                method=_method_of(family),
                geography_resolver=analysis.geography_resolver,
                period_resolver=analysis.period_resolver,
                max_pages=args.max_pages,
                decoder=_decoder_of(family),
                # Aucune décision de licence : X1 n'en modifie ni n'en suppose
                # aucune. Toutes les valeurs sont donc retenues.
                license_decision=None,
                dry_run=True,
                clock=lambda: started,
            )
            steps_executed = list(report.steps_executed)
            steps_failed = list(report.steps_failed)
            pipeline_failed = not report.succeeded
            warnings.extend(report.warnings)
            errors.extend(report.errors)

    payload_sha = _payload_checksum(fetcher)
    validation = ValidationReport(
        source_code=family.source_code,
        release_key=args.release,
        verdict=decide_verdict(
            transfer_failed=bool(acquisition.errors) or not acquisition.pages,
            schema_rejected=bool(analysis.rejection_causes),
            records_normalized=analysis.records_normalized,
            pipeline_failed=pipeline_failed,
        ),
        executed_at=started.isoformat(),
        method=f"{family.method_code} {family.method_version}",
        limits={
            "max_pages": args.max_pages,
            "max_bytes": args.max_bytes,
            "page_size": args.page_size,
            "timeout_seconds": args.timeout,
        },
        query_parameters=dict(sorted(parameters.items())),
        transfers=tuple(fetcher.log),
        pages_fetched=len(acquisition.pages),
        bytes_received=acquisition.bytes_received,
        payload_sha256=payload_sha,
        payload_format=_content_type(fetcher),
        records_received=analysis.records_received,
        records_normalized=analysis.records_normalized,
        records_rejected=analysis.records_rejected,
        rejection_causes=tuple(analysis.rejection_causes),
        records_absent_value=analysis.records_absent_value,
        units=tuple(analysis.units),
        periods=tuple(analysis.periods),
        geographies=tuple(analysis.geographies),
        pipeline_steps_executed=tuple(steps_executed),
        pipeline_steps_failed=tuple(steps_failed),
        warnings=tuple(dict.fromkeys(warnings)),
        errors=tuple(dict.fromkeys(errors)),
        duration_seconds=(datetime.now(timezone.utc) - started).total_seconds(),
        notes=(
            "Échantillon TECHNIQUE de recette : les bornes géographiques et "
            "temporelles ont été choisies pour valider le connecteur, pas pour "
            "documenter un territoire.",
            "Aucune décision de licence fournie : toutes les valeurs sont retenues "
            "(`value_withheld`), `records_publishable` reste à 0.",
        ),
    )
    validation.write(args.report)

    if args.artifact_dir is not None:
        _write_artifact(args.artifact_dir, family, acquisition.pages)

    print(f"{family.source_code} : {validation.verdict} — rapport {args.report}")
    return 0


def _decoder_of(family: HubeauFamily):
    """Décodeur de page du connecteur concerné — jamais deviné (P03B)."""
    if family.name in ("hydrometrie", "piezometrie"):
        return hydro.PAGE_DECODER
    return usage.PAGE_DECODER


def _method_of(family: HubeauFamily):
    if family.name in ("hydrometrie", "piezometrie"):
        return hydro.METHOD
    if family.name == "prelevements":
        return usage.WITHDRAWALS_METHOD
    return usage.QUALITY_METHOD


def _source_reference(
    family: HubeauFamily, args: argparse.Namespace, acquisition: Acquisition, started: datetime
) -> WaterSourceReference:
    import hashlib

    digest = hashlib.sha256(b"".join(acquisition.pages)).hexdigest()
    if family.window_kind == "year":
        window_start = date(int(args.date_from), 1, 1)
        window_end = date(int(args.date_to), 12, 31)
    else:
        window_start = date.fromisoformat(args.date_from)
        window_end = date.fromisoformat(args.date_to)
    return WaterSourceReference(
        source_code=family.source_code,
        release_key=args.release,
        checksum_sha256=digest,
        retrieved_at=started.date(),
        observed_period_start=window_start,
        observed_period_end=window_end,
        methodology_version=family.method_version,
        # Licence NON évaluée : X1 ne décide rien. La porte du pipeline reste
        # fermée (`license_decision=None`), ce qui retient toutes les valeurs.
        license=_unknown_license(),
        attribution=transport_mod.attribution(accessed_on=started.date().isoformat()),
    )


def _unknown_license():
    from models.intelligence import LicenseDecision

    return LicenseDecision(
        allow_ingest=False,
        allow_store=False,
        allow_display=False,
        allow_derived_use=False,
        reasons=["X1 : licence non évaluée — aucune décision n'est prise en validation."],
    )


def _payload_checksum(fetcher: OperatorFetcher) -> str | None:
    digests = [entry.sha256 for entry in fetcher.log if entry.sha256]
    if not digests:
        return None
    if len(digests) == 1:
        return digests[0]
    import hashlib

    return hashlib.sha256("".join(digests).encode("ascii")).hexdigest()


def _content_type(fetcher: OperatorFetcher) -> str | None:
    for entry in fetcher.log:
        if entry.content_type:
            return entry.content_type
    return None


def _write_artifact(directory: Path, family: HubeauFamily, pages: list[bytes]) -> None:
    """Dépose les octets acquis HORS du dépôt.

    Aucun garde-fou ne peut empêcher un opérateur de viser un chemin suivi par
    Git ; ce qui est possible, c'est de le lui dire. Le répertoire est absent
    par défaut : ne rien écrire est le comportement normal.
    """
    directory.mkdir(parents=True, exist_ok=True)
    for index, payload in enumerate(pages, start=1):
        (directory / f"{family.source_code}_p{index:03d}.json").write_bytes(payload)
    print(
        f"  artefact : {len(pages)} page(s) écrite(s) dans {directory} — "
        "ne jamais committer ce répertoire.",
        file=sys.stderr,
    )


if __name__ == "__main__":  # pragma: no cover - point d'entrée opérateur
    raise SystemExit(main())
