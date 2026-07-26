"""scripts/water_intelligence/validate_eea.py — validation live EEA WEI+
(X1.3 ; conversion d'artefact local cadrée en X2A).

Geste OPÉRATEUR explicite et borné.

    python -m scripts.water_intelligence.validate_eea \\
      --release subunit|riverbasin \\
      [--input <fichier_local_ou_url_officielle>] \\
      [--expected-sha256 <hex>] \\
      --dry-run --report <chemin.md>

## Trois gestes distincts, dans le même rapport

**Vérifier la release** ne demande aucune donnée : la fiche de métadonnées de
l'EEA suffit à établir que le code de jeu, le titre et la licence sont bien
ceux que le connecteur a épinglés. C'est fait à chaque exécution, et c'est ce
qui rend une dérive de release visible AVANT toute ingestion.

**Inspecter un artefact local** (X2A) : quand `--input` désigne un fichier
xlsx/zip, cette commande l'ouvre EN LECTURE SEULE via
`eea_artifact_inspector` — feuilles réelles, en-têtes réels, présence d'un
projet VBA — et le consigne dans le rapport. Elle ne décide JAMAIS laquelle
de ces feuilles ou colonnes correspond aux champs canoniques WEI+ : c'est un
constat, pas une interprétation.

**Convertir et valider un extrait** exige un `ColumnMappingProfile` VÉRIFIÉ
pour la release demandée (`eea_artifact_inspector.MAPPING_PROFILES`) —
actuellement VIDE, aucun artefact officiel réel n'ayant été obtenu (le lien
de téléchargement conduit à une interface Nextcloud, cf.
`X1_LIVE_VALIDATION_HANDOFF.md` §3.1). Sans profil, le verdict est
`manual_artifact_required` : ni une panne, ni un échec de schéma — un geste
humain restant à faire, nommé comme tel plutôt que déguisé en autre chose.
Un décodeur qui devinerait les colonnes produirait des valeurs plausibles et
fausses, pire qu'une absence assumée.

## Ce qu'elle ne fait jamais

Aucune écriture en base. Aucune décision de licence : la fiche EEA est LUE et
citée, elle n'est jamais transformée en autorisation de publier. Aucun octet
de donnée dans le rapport.
"""

from __future__ import annotations

import argparse
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from models.intelligence import LicenseDecision
from models.water_intelligence import WaterSourceReference
from scripts.water_intelligence import eea_artifact_inspector as inspector
from scripts.water_intelligence.fetcher import (
    FetcherNetworkError,
    FetcherRefusal,
    OperatorFetcher,
)
from scripts.water_intelligence.replay import ReplayTransport
from scripts.water_intelligence.reporting import ValidationReport
from services.water_intelligence.connectors import eea_wei_plus as wei
from services.water_intelligence.pipeline import run_pipeline

#: Hôtes officiels de l'EEA. Le catalogue SDI porte les métadonnées ; le
#: portail porte les pages de jeu de données. Aucun autre hôte n'est
#: atteignable par cette commande.
ALLOWED_HOSTS = frozenset({"sdi.eea.europa.eu", "www.eea.europa.eu"})

#: Fiche de métadonnées ISO 19115, indexée par l'UUID du DOI de la release.
CATALOGUE_RECORD = "https://sdi.eea.europa.eu/catalogue/srv/api/records/{uuid}"

#: Signatures de conteneurs binaires que le connecteur ne décode pas.
_BINARY_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"PK\x03\x04", "zip/ooxml (xlsx, shapefile compressé)"),
    (b"\xd0\xcf\x11\xe0", "ole2 (xls)"),
    (b"\x00\x00\x27\x0a", "shapefile (.shp)"),
    (b"%PDF", "pdf"),
)

GEOGRAPHY_SAMPLE = 5


def uuid_of(release: wei.WeiPlusDatasetRelease) -> str:
    """UUID de la fiche = suffixe du DOI, tel que l'EEA l'indexe."""
    return release.doi.split("/", 1)[1]


def sniff_container(raw: bytes) -> str:
    """Nomme le conteneur REÇU. Ne devine jamais une structure : constate un
    format, ou constate qu'il est textuel."""
    for signature, label in _BINARY_SIGNATURES:
        if raw.startswith(signature):
            return label
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        return "binaire non identifié"
    return "texte utf-8"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.water_intelligence.validate_eea",
        description=(
            "Validation live BORNÉE d'une release EEA WEI+. Lecture seule : aucune "
            "écriture en base, aucune publication, aucune décision de licence."
        ),
    )
    parser.add_argument("--release", required=True, choices=sorted(wei.DATASET_RELEASES))
    parser.add_argument(
        "--release-key",
        default=None,
        help="Clé de release explicite pour le rapport. Défaut : le code de jeu EEA.",
    )
    parser.add_argument(
        "--input",
        default=None,
        help=(
            "Extrait canonique local, ou URL officielle EEA. Absent = vérification "
            "d'identité seule, sans acquisition de données."
        ),
    )
    parser.add_argument(
        "--expected-sha256",
        default=None,
        help="Checksum attendu de l'extrait. Une différence arrête la validation.",
    )
    parser.add_argument("--max-bytes", type=int, default=5_000_000)
    parser.add_argument("--timeout", type=float, default=25.0)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--report", required=True, type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    started = datetime.now(timezone.utc)
    dataset = wei.DATASET_RELEASES[args.release]
    release_key = args.release_key or dataset.dataset_code

    fetcher = OperatorFetcher(
        allowed_hosts=ALLOWED_HOSTS,
        timeout_seconds=args.timeout,
        max_bytes=args.max_bytes,
    )
    warnings: list[str] = []
    errors: list[str] = []
    notes: list[str] = []

    identity_ok = _verify_identity(fetcher, dataset, warnings, errors)

    payload: bytes | None = None
    payload_format: str | None = None
    if args.input:
        payload, payload_format = _acquire(args.input, fetcher, errors, warnings)

    if payload is not None and args.expected_sha256:
        actual = hashlib.sha256(payload).hexdigest()
        if actual.lower() != args.expected_sha256.lower():
            errors.append(
                f"checksum différent de celui attendu : {actual} != {args.expected_sha256} — "
                "validation arrêtée, l'extrait n'est pas celui qui a été annoncé."
            )
            payload = None

    # X2A : un conteneur binaire local est INSPECTÉ (feuilles, en-têtes réels,
    # macro) puis, seulement si un profil de correspondance VÉRIFIÉ existe
    # pour cette release, converti vers le CSV canonique. Sans profil,
    # `payload`/`payload_format` restent binaires — `_decide` en fera
    # `manual_artifact_required`, jamais une conversion devinée.
    if payload is not None and payload_format != "texte utf-8":
        payload, payload_format = _inspect_and_convert(
            payload, payload_format, release_key, notes, warnings, errors
        )

    analysis = _analyse(payload, payload_format, dataset, release_key, started, warnings, errors)

    verdict = _decide(
        identity_ok=identity_ok,
        has_input=bool(args.input),
        payload=payload,
        payload_format=payload_format,
        records_normalized=analysis["records_normalized"],
        pipeline_failed=analysis["pipeline_failed"],
        rejected=bool(analysis["rejection_causes"]),
    )

    if verdict == "manual_artifact_required":
        if not args.input:
            notes.append(
                "Aucun extrait fourni : cette exécution vérifie l'IDENTITÉ de la release, "
                "pas son contenu. Elle ne peut donc pas conclure `ready_for_staging`."
            )
        else:
            notes.append(
                f"Aucun ColumnMappingProfile VÉRIFIÉ n'existe pour {release_key!r} "
                "(eea_artifact_inspector.MAPPING_PROFILES). La conversion vers le format "
                f"canonique ({', '.join(wei.CANONICAL_COLUMNS)}) reste un geste humain : "
                "inspecter l'artefact réel, puis déclarer un profil signé — jamais une "
                "feuille ou une colonne devinée."
            )
    notes.append(
        "Aucune décision de licence fournie au pipeline : la licence CC-BY 4.0 est "
        "LUE sur la fiche officielle et citée, jamais transformée en autorisation de "
        "publier. `records_publishable` reste à 0."
    )

    report = ValidationReport(
        source_code=wei.SOURCE_CODE,
        release_key=release_key,
        verdict=verdict,
        executed_at=started.isoformat(),
        method=f"{wei.METHOD.code} {wei.METHOD.version}",
        limits={"max_bytes": args.max_bytes, "timeout_seconds": args.timeout},
        query_parameters={
            "release_scale": dataset.scale,
            "dataset_code": dataset.dataset_code,
            "doi": dataset.doi,
            "edition": dataset.edition,
        },
        transfers=tuple(fetcher.log),
        pages_fetched=1 if payload is not None else 0,
        bytes_received=len(payload) if payload is not None else 0,
        payload_sha256=hashlib.sha256(payload).hexdigest() if payload is not None else None,
        payload_format=payload_format,
        records_received=analysis["records_received"],
        records_normalized=analysis["records_normalized"],
        records_rejected=analysis["records_rejected"],
        rejection_causes=tuple(analysis["rejection_causes"]),
        records_absent_value=analysis["records_absent_value"],
        units=tuple(analysis["units"]),
        periods=tuple(analysis["periods"]),
        geographies=tuple(analysis["geographies"]),
        pipeline_steps_executed=tuple(analysis["steps_executed"]),
        pipeline_steps_failed=tuple(analysis["steps_failed"]),
        warnings=tuple(dict.fromkeys(warnings)),
        errors=tuple(dict.fromkeys(errors)),
        duration_seconds=(datetime.now(timezone.utc) - started).total_seconds(),
        notes=tuple(notes),
    )
    report.write(args.report)
    print(f"{wei.SOURCE_CODE} : {verdict} — rapport {args.report}")
    return 0


# ---------------------------------------------------------------------------
# Étapes
# ---------------------------------------------------------------------------


def _verify_identity(
    fetcher: OperatorFetcher,
    dataset: wei.WeiPlusDatasetRelease,
    warnings: list[str],
    errors: list[str],
) -> bool:
    """Confronte la fiche officielle aux valeurs épinglées par le connecteur.

    Trois vérifications, pas une : le CODE de jeu, le TITRE et la LICENCE. Un
    code identique sous un titre différent signalerait une republication ; un
    titre identique sous une autre licence, un changement de conditions.
    """
    url = CATALOGUE_RECORD.format(uuid=uuid_of(dataset))
    try:
        outcome = fetcher.fetch(url, accept="application/json")
    except (FetcherRefusal, FetcherNetworkError) as exc:
        errors.append(f"fiche de métadonnées inaccessible : {exc}")
        return False

    if outcome.status_code != 200:
        errors.append(f"fiche de métadonnées : HTTP {outcome.status_code}.")
        return False

    text = outcome.body.decode("utf-8", "replace")
    ok = True
    for label, expected in (
        ("code de jeu", dataset.dataset_code),
        ("titre", dataset.title),
        ("licence", wei.LICENSE_URL),
    ):
        if expected not in text:
            errors.append(
                f"{label} absent de la fiche officielle : {expected!r} — la release "
                "épinglée par le connecteur ne correspond plus à ce que publie l'EEA."
            )
            ok = False
    if ok:
        warnings.append(
            f"identité vérifiée sur la fiche officielle : code de jeu, titre et "
            f"licence {wei.LICENSE_CODE} concordent avec la release épinglée."
        )
    return ok


def _acquire(
    source: str,
    fetcher: OperatorFetcher,
    errors: list[str],
    warnings: list[str],
) -> tuple[bytes | None, str | None]:
    if source.startswith("http://") or source.startswith("https://"):
        try:
            outcome = fetcher.fetch(source)
        except (FetcherRefusal, FetcherNetworkError) as exc:
            errors.append(f"acquisition refusée ou impossible : {exc}")
            return None, None
        if outcome.status_code != 200:
            errors.append(f"acquisition : HTTP {outcome.status_code}.")
            return None, sniff_container(outcome.body)
        return outcome.body, sniff_container(outcome.body)

    path = Path(source)
    if not path.is_file():
        errors.append(f"extrait introuvable : {path}")
        return None, None
    raw = path.read_bytes()
    if len(raw) > fetcher.max_bytes:
        errors.append(
            f"extrait de {len(raw)} octets au-delà de la borne {fetcher.max_bytes} — "
            "refusé plutôt que tronqué."
        )
        return None, sniff_container(raw)
    container = sniff_container(raw)
    _check_extension_consistency(path, container, warnings)
    warnings.append(f"extrait LOCAL fourni par l'opérateur : {path.name}")
    return raw, container


#: Extensions plausibles par famille de conteneur détectée (X2A). Un simple
#: signal de cohérence, pas une vérification cryptographique : un fichier
#: renommé passe toujours le test des octets, jamais celui-ci.
_EXPECTED_EXTENSIONS: dict[str, tuple[str, ...]] = {
    "zip/ooxml (xlsx, shapefile compressé)": (".xlsx", ".xlsm"),
    "ole2 (xls)": (".xls",),
    "shapefile (.shp)": (".shp",),
    "pdf": (".pdf",),
    "texte utf-8": (".csv", ".txt"),
}


def _check_extension_consistency(path: Path, container: str, warnings: list[str]) -> None:
    """Signale — sans jamais refuser — une extension qui ne correspond pas au
    conteneur RÉELLEMENT observé (X2A, pack §2 « extension »). Un fichier
    renommé ou mal exporté produit exactement ce genre d'écart."""
    expected = _EXPECTED_EXTENSIONS.get(container)
    if expected and path.suffix.lower() not in expected:
        warnings.append(
            f"extension {path.suffix!r} inattendue pour un conteneur {container!r} "
            f"(attendues : {expected}) — vérifier que le fichier n'a pas été renommé."
        )


def _inspect_and_convert(
    payload: bytes,
    payload_format: str,
    release_key: str,
    notes: list[str],
    warnings: list[str],
    errors: list[str],
) -> tuple[bytes | None, str | None]:
    """Inspecte un conteneur binaire local et tente sa conversion vers le CSV
    canonique (X2A). Ne devine jamais : sans `ColumnMappingProfile` vérifié
    pour `release_key`, le payload binaire est rendu TEL QUEL — `_decide` en
    fera `manual_artifact_required`, jamais une valeur inventée."""
    if "zip/ooxml" not in payload_format:
        notes.append(
            f"conteneur {payload_format!r} non inspectable par cet outillage (seul "
            "xlsx/zip est pris en charge à ce jour) — reste `manual_artifact_required`."
        )
        return payload, payload_format

    try:
        inspection = inspector.inspect_workbook(payload)
    except inspector.ArtifactError as exc:
        errors.append(f"inspection du classeur : {exc}")
        return payload, payload_format

    notes.append(
        f"classeur inspecté : {len(inspection.sheet_names)} feuille(s) — "
        f"{', '.join(inspection.sheet_names)}."
    )
    for sheet_name, headers in inspection.headers_by_sheet.items():
        notes.append(f"en-têtes réels de {sheet_name!r} : {list(headers)}")
    if inspection.has_macro_indicators:
        warnings.append(
            "le classeur contient un projet VBA (macro) — signalé, jamais exécuté ni "
            "ignoré silencieusement."
        )

    try:
        csv_text = inspector.convert_to_canonical_csv(payload, release_key=release_key)
    except inspector.ArtifactError as exc:
        notes.append(str(exc))
        return payload, payload_format

    warnings.append(
        f"conteneur converti vers le CSV canonique via le profil vérifié de "
        f"{release_key!r}."
    )
    return csv_text.encode("utf-8"), "texte utf-8"


def _analyse(
    payload: bytes | None,
    payload_format: str | None,
    dataset: wei.WeiPlusDatasetRelease,
    release_key: str,
    started: datetime,
    warnings: list[str],
    errors: list[str],
) -> dict:
    empty = {
        "records_received": 0,
        "records_normalized": 0,
        "records_rejected": 0,
        "records_absent_value": 0,
        "rejection_causes": [],
        "units": [],
        "periods": [],
        "geographies": [],
        "steps_executed": [],
        "steps_failed": [],
        "pipeline_failed": False,
    }
    if payload is None or payload_format != "texte utf-8":
        return empty

    config = wei.WeiPlusReleaseConfig(
        release_key=release_key,
        retrieved_at=started.date(),
        scale=dataset.scale,
    )
    try:
        parsed = wei.parse_wei_plus_csv(payload.decode("utf-8"), config=config)
    except wei.WeiPlusError as exc:
        empty["rejection_causes"] = [f"{type(exc).__name__} : {exc}"]
        return empty

    warnings.extend(parsed.warnings)
    result = dict(empty)
    result["records_received"] = parsed.rows_total
    result["records_normalized"] = parsed.values_present
    result["records_absent_value"] = parsed.values_absent
    result["units"] = [wei.EXPECTED_UNIT] if parsed.rows_total else []
    result["periods"] = [f"{year} {quarter}" for year, quarter in parsed.periods[:8]]
    units = parsed.spatial_units
    result["geographies"] = (
        list(units[:GEOGRAPHY_SAMPLE])
        + ([f"… (+{len(units) - GEOGRAPHY_SAMPLE})"] if len(units) > GEOGRAPHY_SAMPLE else [])
    )

    report = run_pipeline(
        source_code=wei.SOURCE_CODE,
        release_key=release_key,
        transport=ReplayTransport([payload]),
        normalizer=wei.build_normalizer(config),
        source=WaterSourceReference(
            source_code=wei.SOURCE_CODE,
            release_key=release_key,
            checksum_sha256=hashlib.sha256(payload).hexdigest(),
            published_at=dataset.published_at,
            retrieved_at=started.date(),
            observed_period_start=dataset.coverage_start,
            observed_period_end=dataset.coverage_end,
            methodology_version=wei.METHOD.version,
            license=LicenseDecision(
                allow_ingest=False,
                allow_store=False,
                allow_display=False,
                allow_derived_use=False,
                reasons=["X1 : licence lue sur la fiche officielle, jamais décidée ici."],
            ),
            attribution=config.attribution(),
        ),
        method=wei.METHOD,
        geography_resolver=wei.build_geography_resolver(parsed.rows),
        period_resolver=wei.build_period_resolver(),
        max_pages=1,
        decoder=wei.PAGE_DECODER,
        license_decision=None,
        dry_run=True,
        clock=lambda: started,
    )
    result["steps_executed"] = list(report.steps_executed)
    result["steps_failed"] = list(report.steps_failed)
    result["pipeline_failed"] = not report.succeeded
    warnings.extend(report.warnings)
    errors.extend(report.errors)
    return result


def _decide(
    *,
    identity_ok: bool,
    has_input: bool,
    payload: bytes | None,
    payload_format: str | None,
    records_normalized: int,
    pipeline_failed: bool,
    rejected: bool,
) -> str:
    """`manual_artifact_required` (X2A) remplace l'ancien `decoder_deferred`
    de X1 pour EEA : ce dernier reste réservé à Copernicus (décodeur RASTER
    non livré). EEA dispose désormais de l'outillage (`eea_artifact_inspector`,
    openpyxl) — ce qui manque est un profil de correspondance VÉRIFIÉ contre
    un artefact réel, pas une bibliothèque : un geste humain, nommé comme tel.
    """
    if not identity_ok:
        return "source_unavailable"
    if not has_input:
        return "manual_artifact_required"
    if payload is None:
        return "source_unavailable"
    if payload_format != "texte utf-8":
        return "manual_artifact_required"
    if rejected or pipeline_failed or records_normalized == 0:
        return "schema_drift"
    return "ready_for_staging"


if __name__ == "__main__":  # pragma: no cover - point d'entrée opérateur
    raise SystemExit(main())
