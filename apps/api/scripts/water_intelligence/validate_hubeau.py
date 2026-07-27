"""scripts/water_intelligence/validate_hubeau.py — validation live Hub'Eau (X1.3).

Geste OPÉRATEUR explicite et borné. Rien ici n'est déclenché par une requête
utilisateur, un cron ou le démarrage de l'API.

Usage (hydrometrie / piezometrie / qualite_surface) :

    python -m scripts.water_intelligence.validate_hubeau \\
      --source hydrometrie|piezometrie|qualite_surface \\
      --release <release_key> \\
      --geography-type <nom_de_parametre_officiel> \\
      --geography-code <code> \\
      --date-from <AAAA-MM-JJ> --date-to <AAAA-MM-JJ> \\
      --max-pages <n> --max-bytes <n> \\
      --dry-run --report <chemin.md>

Usage (prelevements — une requête par année, jamais une plage, cf. X2A) :

    python -m scripts.water_intelligence.validate_hubeau \\
      --source prelevements \\
      --release <release_key> \\
      --geography-type <nom_de_parametre_officiel> \\
      --geography-code <code> \\
      --date-from <AAAA> --date-to <AAAA> --max-years <n> \\
      --max-pages <n> --max-bytes <n> [--max-total-bytes <n>] \\
      --dry-run --report <chemin.md>

## Aucun territoire, aucune fenêtre, aucun paramètre codés en dur

`--geography-type` est le NOM du paramètre officiel Hub'Eau
(`code_departement`, `code_station`, `code_bss`, `code_entite`…), validé
contre la liste déclarée par le socle pour l'endpoint concerné. Le script ne
propose aucune valeur par défaut : une recette technique doit dire quel
territoire elle a interrogé, et pourquoi.

## Deux passages, une seule collecte (hydrometrie / piezometrie / qualite_surface)

L'acquisition est faite UNE fois par `HubeauTransport` (bornage, pagination,
retries) alimenté par le `OperatorFetcher`. Les octets obtenus sont ensuite
REJOUÉS localement dans `run_pipeline` (`ReplayTransport`) : le checksum du
rapport porte donc exactement sur ce que le pipeline a vu, et l'API publique
n'est interrogée qu'une fois.

## Prélèvements — une requête PAR ANNÉE, jamais une plage (X2A)

La validation live X1 a montré que `annee_min`/`annee_max` n'existent pas côté
plateforme : Hub'Eau les ignore silencieusement, et une requête prétendument
bornée par un couple début/fin renvoyait en réalité tout l'historique. Le seul
paramètre réel est `annee=<AAAA>`, et il ne porte qu'UNE SEULE année.

`run_prelevements_multi_year` orchestre donc une requête `HubeauQuery`
distincte PAR ANNÉE demandée — jamais un couple `annee_min`/`annee_max`
envoyé tel quel, jamais une plage transformée en requête non bornée.
`--max-years` est OBLIGATOIRE : la plage demandée doit rester sous cette borne
explicite, refusée avant tout appel réseau sinon. Chaque année est validée
avec un `WithdrawalsReleaseConfig(year_min=année, year_max=année)` — une
fenêtre DÉGÉNÉRÉE à une seule valeur, qui fait qu'une ligne dont l'année
réelle diffère de celle demandée lève `HubeauUsageSchemaError` immédiatement,
pour CETTE requête, sans attendre qu'elle sorte d'une plage large qui
l'aurait masquée.

## Ce que cette commande ne fait jamais

Aucune écriture en base (`run_pipeline(dry_run=True)`, et `publish_dry_run`
refuse explicitement le contraire). Aucune décision de licence : aucune n'est
fournie, donc toutes les valeurs sont retenues (`value_withheld`) et
`records_publishable` vaut 0. Aucun octet de donnée n'entre dans le rapport.
"""

from __future__ import annotations

import argparse
import hashlib
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
from services.water_intelligence import source_attribution
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
    #: Noms des paramètres de fenêtre, tels que la plateforme les nomme.
    #: VIDE pour `prelevements` : cette famille n'utilise pas ce champ —
    #: Hub'Eau n'accepte qu'une seule année (`annee`) par requête, orchestrée
    #: par `run_prelevements_multi_year`, jamais un couple envoyé tel quel
    #: (X2A). Un tuple de longueur quelconque, comme au socle
    #: (`HubeauEndpoint.time_window_parameters`), pour ne privilégier ni un
    #: couple ni une valeur unique.
    window_parameters: tuple[str, ...]


FAMILIES: dict[str, HubeauFamily] = {
    "hydrometrie": HubeauFamily(
        name="hydrometrie",
        # X2A : `observations_tr`, pas `observations_elaborees` — cf.
        # `hubeau_hydro.py` §"X2A — bascule obs_elab → observations_tr".
        endpoint_key="hydrometrie.observations_tr",
        source_code=hydro.HYDROMETRIE_SOURCE_CODE,
        method_version=hydro.METHOD.version,
        method_code=hydro.METHOD.code,
        window_parameters=("date_debut_obs", "date_fin_obs"),
    ),
    "piezometrie": HubeauFamily(
        name="piezometrie",
        endpoint_key="piezometrie.chroniques",
        source_code=hydro.PIEZOMETRIE_SOURCE_CODE,
        method_version=hydro.METHOD.version,
        method_code=hydro.METHOD.code,
        window_parameters=("date_debut_mesure", "date_fin_mesure"),
    ),
    "prelevements": HubeauFamily(
        name="prelevements",
        endpoint_key="prelevements.chroniques",
        source_code=usage.WITHDRAWALS_SOURCE_CODE,
        method_version=usage.WITHDRAWALS_METHOD.version,
        method_code=usage.WITHDRAWALS_METHOD.code,
        # Non utilisé (X2A) : voir le commentaire du champ ci-dessus.
        window_parameters=(),
    ),
    "qualite_surface": HubeauFamily(
        name="qualite_surface",
        endpoint_key="qualite_rivieres.analyses",
        source_code=usage.QUALITY_SOURCE_CODE,
        method_version=usage.QUALITY_METHOD.version,
        method_code=usage.QUALITY_METHOD.code,
        window_parameters=("date_debut_prelevement", "date_fin_prelevement"),
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

    N'est jamais appelée pour `prelevements` (X2A) : cette famille est
    orchestrée par `run_prelevements_multi_year`, qui parse chaque année
    séparément avec une fenêtre dégénérée (`year_min == year_max`) — jamais
    une plage large qui masquerait une ligne d'une autre année.
    """
    assert family.name != "prelevements", (
        "prelevements ne passe jamais par analyse() — cf. run_prelevements_multi_year (X2A)."
    )
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
    parser.add_argument(
        "--max-years",
        type=int,
        default=None,
        help=(
            "OBLIGATOIRE pour --source prelevements. Borne EXPLICITE du nombre d'années "
            "orchestrées : Hub'Eau n'accepte qu'une seule année par requête (`annee=<AAAA>`), "
            "--date-from/--date-to sont donc traduits en autant de requêtes distinctes que "
            "d'années, jamais une plage envoyée telle quelle (X2A)."
        ),
    )
    parser.add_argument(
        "--max-total-bytes",
        type=int,
        default=None,
        help=(
            "prelevements uniquement : budget d'octets CUMULÉ sur toutes les années "
            "orchestrées. Défaut : identique à --max-bytes (une seule année de marge) — "
            "une plage réellement multi-années doit l'élever explicitement."
        ),
    )
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

    fetcher = OperatorFetcher(
        allowed_hosts=transport_mod.ALLOWED_HOSTS,
        timeout_seconds=args.timeout,
        max_bytes=args.max_bytes,
    )

    if family.name == "prelevements":
        # Hub'Eau n'accepte qu'une seule année par requête (X2A) : cette
        # famille est orchestrée à part, jamais par le chemin fenêtre unique
        # ci-dessous, qui enverrait un couple annee_min/annee_max inopérant.
        if args.max_years is None:
            raise SystemExit(
                "--max-years est obligatoire pour --source prelevements : Hub'Eau n'accepte "
                "qu'une année par requête, et une plage doit déclarer explicitement combien "
                "d'années elle orchestre — jamais un historique non borné."
            )
        try:
            year_from = int(args.date_from)
            year_to = int(args.date_to)
        except ValueError as exc:
            raise SystemExit(
                f"--date-from/--date-to doivent être des années AAAA pour prelevements : {exc}"
            ) from exc

        validation = run_prelevements_multi_year(
            geography_type=args.geography_type,
            geography_code=args.geography_code,
            year_from=year_from,
            year_to=year_to,
            max_years=args.max_years,
            release_key=args.release,
            retrieved_at=started.date(),
            fetcher=fetcher,
            max_pages_per_year=args.max_pages,
            max_bytes_per_year=args.max_bytes,
            max_total_bytes=(
                args.max_total_bytes if args.max_total_bytes is not None else args.max_bytes
            ),
            timeout_seconds=args.timeout,
            page_size=args.page_size,
            clock=lambda: started,
            artifact_dir=args.artifact_dir,
        )
        validation.write(args.report)
        print(f"{family.source_code} : {validation.verdict} — rapport {args.report}")
        return 0

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
    """Méthode du connecteur — `prelevements` ne passe plus par ici (X2A) :
    `run_prelevements_multi_year` cite `usage.WITHDRAWALS_METHOD` directement."""
    if family.name in ("hydrometrie", "piezometrie"):
        return hydro.METHOD
    return usage.QUALITY_METHOD


def _source_reference(
    family: HubeauFamily, args: argparse.Namespace, acquisition: Acquisition, started: datetime
) -> WaterSourceReference:
    """Référence de provenance pour hydrometrie/piezometrie/qualite_surface —
    toutes à fenêtre `date` continue. `prelevements` ne passe plus par ici
    (X2A) : `run_prelevements_multi_year` construit sa propre référence par
    année, sur une fenêtre annuelle dégénérée."""
    digest = hashlib.sha256(b"".join(acquisition.pages)).hexdigest()
    return WaterSourceReference(
        source_code=family.source_code,
        release_key=args.release,
        checksum_sha256=digest,
        retrieved_at=started.date(),
        observed_period_start=date.fromisoformat(args.date_from),
        observed_period_end=date.fromisoformat(args.date_to),
        methodology_version=family.method_version,
        # Licence NON évaluée : X1 ne décide rien. La porte du pipeline reste
        # fermée (`license_decision=None`), ce qui retient toutes les valeurs.
        license=_unknown_license(),
        **_provenance(family.source_code, accessed_on=started.date()),
    )


def _provenance(source_code: str, *, accessed_on: date) -> dict[str, object]:
    """Attribution et fraîcheur canoniques d'une source, à sa date de lecture.

    L'attribution est estampillée ICI, à l'acquisition — pas à l'assemblage.
    C'est pourquoi la configuration canonique doit être en place AVANT toute
    réacquisition : la corriger après obligerait à réacquérir (cf. §2.1 (a) du
    plan X4B).

    Une source hors configuration lève plutôt que de recevoir un libellé
    générique : c'est exactement le défaut que X4A a écarté.
    """
    config = source_attribution.attribution_for(source_code)
    return {
        "attribution": config.label(accessed_on=accessed_on),
        "source_information_url": config.information_url,
        "source_refresh_cadence": config.refresh_cadence,
        "source_last_updated_on": config.last_updated_on,
    }


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
    return hashlib.sha256("".join(digests).encode("ascii")).hexdigest()


def _content_type(fetcher: OperatorFetcher) -> str | None:
    for entry in fetcher.log:
        if entry.content_type:
            return entry.content_type
    return None


def _write_artifact(
    directory: Path, family: HubeauFamily, pages: list[bytes], *, year: int | None = None
) -> None:
    """Dépose les octets acquis HORS du dépôt.

    Aucun garde-fou ne peut empêcher un opérateur de viser un chemin suivi par
    Git ; ce qui est possible, c'est de le lui dire. Le répertoire est absent
    par défaut : ne rien écrire est le comportement normal.

    `year`, quand fourni (prélèvements, X2A), distingue les pages de chaque
    requête annuelle — sans lui, les fichiers de deux années s'écraseraient
    silencieusement les uns les autres sous le même nom.
    """
    directory.mkdir(parents=True, exist_ok=True)
    prefix = f"{family.source_code}_{year}" if year is not None else family.source_code
    for index, payload in enumerate(pages, start=1):
        (directory / f"{prefix}_p{index:03d}.json").write_bytes(payload)
    print(
        f"  artefact : {len(pages)} page(s) écrite(s) dans {directory} — "
        "ne jamais committer ce répertoire.",
        file=sys.stderr,
    )


# ---------------------------------------------------------------------------
# Prélèvements — orchestration multi-année (X2A)
# ---------------------------------------------------------------------------


def run_prelevements_multi_year(
    *,
    geography_type: str,
    geography_code: str,
    year_from: int,
    year_to: int,
    max_years: int,
    release_key: str,
    retrieved_at: date,
    fetcher: OperatorFetcher,
    max_pages_per_year: int,
    max_bytes_per_year: int,
    max_total_bytes: int,
    timeout_seconds: float,
    page_size: int,
    clock: Callable[[], datetime],
    artifact_dir: Path | None = None,
) -> ValidationReport:
    """Valide les prélèvements (BNPE) sur une plage d'années, UNE requête
    Hub'Eau par année (X2A) — jamais `annee_min`/`annee_max`, que la
    plateforme ignore silencieusement (cf. docstring de module).

    Chaque année est acquise, puis parsée séparément avec
    `WithdrawalsReleaseConfig(year_min=année, year_max=année)` : une fenêtre
    DÉGÉNÉRÉE à une seule valeur. Une ligne dont l'année réelle diffère lève
    `HubeauUsageSchemaError` pour CETTE requête — jamais masquée par une plage
    large qui l'aurait laissée passer parce qu'elle restait dans l'intervalle
    global. Chaque année exécute ensuite son propre `run_pipeline` (dry-run) ;
    les rapports sont agrégés en un `ValidationReport` unique.
    """
    family = FAMILIES["prelevements"]
    started = clock()

    if year_from > year_to:
        raise SystemExit(f"--date-from ({year_from}) > --date-to ({year_to}) : plage invalide.")
    years = list(range(year_from, year_to + 1))
    if len(years) > max_years:
        raise SystemExit(
            f"{len(years)} année(s) demandée(s) ({year_from}-{year_to}) dépasse(nt) la borne "
            f"explicite --max-years={max_years} — refusé avant tout appel réseau. Hub'Eau "
            "n'accepte qu'une année par requête ; une plage large exige une borne assumée, "
            "jamais une orchestration silencieusement non plafonnée."
        )

    warnings: list[str] = []
    errors: list[str] = []
    rejection_causes: list[str] = []
    units: set[str] = set()
    ouvrage_ids: set[str] = set()
    steps_executed: set[str] = set()
    steps_failed: set[str] = set()
    records_received = 0
    records_normalized = 0
    records_absent_value = 0
    records_rejected = 0
    total_pages_fetched = 0

    for year in years:
        try:
            query = transport_mod.HubeauQuery(
                endpoint_key=family.endpoint_key,
                parameters={geography_type: geography_code, "annee": str(year)},
                page_size=page_size,
            )
        except transport_mod.HubeauTransportError as exc:
            raise SystemExit(
                f"requête refusée par le socle avant tout appel (année {year}) : {exc}"
            ) from exc

        remaining_budget = max_total_bytes - fetcher.total_bytes
        if remaining_budget <= 0:
            warnings.append(
                f"budget global ({max_total_bytes} octets) atteint avant l'année {year} — "
                "collecte arrêtée, années restantes non interrogées."
            )
            break

        year_acquisition = acquire(
            query=query,
            fetcher=fetcher,
            max_pages=max_pages_per_year,
            max_bytes=min(max_bytes_per_year, remaining_budget),
            timeout_seconds=timeout_seconds,
        )
        total_pages_fetched += len(year_acquisition.pages)

        if year_acquisition.errors:
            errors.extend(f"année {year} : {e}" for e in year_acquisition.errors)
            continue
        warnings.extend(f"année {year} : {w}" for w in year_acquisition.warnings)

        if artifact_dir is not None and year_acquisition.pages:
            _write_artifact(artifact_dir, family, year_acquisition.pages, year=year)

        if not year_acquisition.decoded:
            continue

        year_config = usage.WithdrawalsReleaseConfig(
            release_key=release_key,
            retrieved_at=retrieved_at,
            year_min=year,
            year_max=year,
        )
        try:
            parsed = usage.parse_withdrawals_pages(year_acquisition.decoded, config=year_config)
        except usage.HubeauUsageError as exc:
            rejection_causes.append(f"année {year} : {type(exc).__name__} : {exc}")
            records_rejected += _count_records(year_acquisition.decoded)
            continue

        records_received += parsed.records_total
        records_absent_value += parsed.values_absent
        records_normalized += parsed.values_present
        warnings.extend(f"année {year} : {w}" for w in parsed.warnings)
        units.add(usage.VOLUME_UNIT)
        ouvrage_ids.update(parsed.ouvrage_ids)

        digest_source = hashlib.sha256(b"".join(year_acquisition.pages)).hexdigest()
        report = run_pipeline(
            source_code=family.source_code,
            release_key=release_key,
            transport=ReplayTransport(year_acquisition.pages),
            normalizer=usage.build_withdrawals_normalizer(year_config),
            source=WaterSourceReference(
                source_code=family.source_code,
                release_key=release_key,
                checksum_sha256=digest_source,
                retrieved_at=retrieved_at,
                observed_period_start=date(year, 1, 1),
                observed_period_end=date(year, 12, 31),
                methodology_version=usage.WITHDRAWALS_METHOD.version,
                # Licence NON évaluée : X2A ne décide rien, comme X1.
                license=_unknown_license(),
                **_provenance(family.source_code, accessed_on=retrieved_at),
            ),
            method=usage.WITHDRAWALS_METHOD,
            geography_resolver=usage.build_geography_resolver(parsed.ouvrage_ids),
            period_resolver=usage.build_withdrawals_period_resolver(),
            max_pages=max_pages_per_year,
            decoder=usage.PAGE_DECODER,
            license_decision=None,
            dry_run=True,
            clock=clock,
        )
        steps_executed.update(report.steps_executed)
        steps_failed.update(report.steps_failed)
        if not report.succeeded:
            errors.extend(f"année {year} : {e}" for e in report.errors)
        warnings.extend(f"année {year} : {w}" for w in report.warnings)

    return ValidationReport(
        source_code=family.source_code,
        release_key=release_key,
        verdict=decide_verdict(
            transfer_failed=(records_received == 0 and total_pages_fetched == 0),
            schema_rejected=bool(rejection_causes),
            records_normalized=records_normalized,
            pipeline_failed=bool(steps_failed) or bool(errors),
        ),
        executed_at=started.isoformat(),
        method=f"{family.method_code} {family.method_version}",
        limits={
            "max_pages_per_year": max_pages_per_year,
            "max_bytes_per_year": max_bytes_per_year,
            "max_total_bytes": max_total_bytes,
            "max_years": max_years,
            "page_size": page_size,
            "timeout_seconds": timeout_seconds,
        },
        query_parameters={
            geography_type: geography_code,
            "annee_from": str(year_from),
            "annee_to": str(year_to),
            "orchestration": "une requête distincte par année (annee=<AAAA>)",
        },
        transfers=tuple(fetcher.log),
        pages_fetched=total_pages_fetched,
        bytes_received=fetcher.total_bytes,
        payload_sha256=_payload_checksum(fetcher),
        payload_format=_content_type(fetcher),
        records_received=records_received,
        records_normalized=records_normalized,
        records_rejected=records_rejected,
        rejection_causes=tuple(rejection_causes),
        records_absent_value=records_absent_value,
        units=tuple(sorted(units)),
        periods=(f"{year_from} → {year_to} ({len(years)} requête(s) distincte(s))",),
        geographies=tuple(_sample(ouvrage_ids)),
        pipeline_steps_executed=tuple(sorted(steps_executed)),
        pipeline_steps_failed=tuple(sorted(steps_failed)),
        warnings=tuple(dict.fromkeys(warnings)),
        errors=tuple(dict.fromkeys(errors)),
        duration_seconds=(clock() - started).total_seconds(),
        notes=(
            "Échantillon TECHNIQUE de recette : les bornes géographiques et "
            "temporelles ont été choisies pour valider le connecteur, pas pour "
            "documenter un territoire.",
            "Une requête HTTP distincte par année (`annee=<AAAA>`) — jamais "
            "`annee_min`/`annee_max`, ignorés en silence par la plateforme "
            "(cf. X1_LIVE_VALIDATION_HANDOFF.md §2.2).",
            "Aucune décision de licence fournie : toutes les valeurs sont retenues "
            "(`value_withheld`), `records_publishable` reste à 0.",
        ),
    )


if __name__ == "__main__":  # pragma: no cover - point d'entrée opérateur
    raise SystemExit(main())
