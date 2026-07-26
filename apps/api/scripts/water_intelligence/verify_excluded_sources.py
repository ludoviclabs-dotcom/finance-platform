"""scripts/water_intelligence/verify_excluded_sources.py — sources exclues de
X1 (X1.4).

Deux sources sont hors du périmètre de validation, pour deux raisons qui n'ont
rien à voir l'une avec l'autre. Les traiter dans la même commande est
délibéré : elles sont toutes deux « pas encore », et confondre leurs motifs
mènerait à débloquer la mauvaise.

## WRI Aqueduct — `blocked`

Aucune acquisition, aucun appel réseau, rien. Le pack l'écrit sans détour :
« aucune acquisition ou publication tant que l'enregistrement n'est pas
documenté ». Un enregistrement est un acte contractuel entre une personne
morale et le WRI ; un script ne peut ni l'effectuer, ni l'attester, ni s'en
passer. Cette commande constate donc l'absence de preuve d'enregistrement et
s'arrête — elle ne « vérifie l'accessibilité » de rien, parce que vérifier
l'accessibilité d'une ressource qu'on n'a pas le droit de collecter serait
déjà commencer à la collecter.

## Copernicus EDO — `decoder_deferred`

Un seul geste autorisé : constater que le service répond et que le produit
annoncé est bien celui que le connecteur a épinglé. Aucun décodage, aucun
téléchargement de raster. Le connecteur porte déjà `CONNECTOR_STATUS =
"source_verified_decoder_deferred"` ; cette commande le confronte au service
réel plutôt que de le recopier.

    python -m scripts.water_intelligence.verify_excluded_sources \\
      --report-dir <repertoire>
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from scripts.water_intelligence.fetcher import (
    FetcherNetworkError,
    FetcherRefusal,
    OperatorFetcher,
)
from scripts.water_intelligence.reporting import ValidationReport
from services.water_intelligence.connectors import copernicus_edo as edo
from services.water_intelligence.connectors import wri_aqueduct as aqueduct

#: Hôtes officiels de l'European Drought Observatory.
#:
#: `edo.jrc.ec.europa.eu` est l'hôte historique, celui que documente le
#: connecteur. La première exécution X1 a montré qu'il redirige désormais vers
#: `drought.emergency.copernicus.eu` — et le Fetcher a REFUSÉ de suivre, ce qui
#: est le comportement voulu : une allowlist qui s'étend toute seule au gré des
#: `Location` reçus n'est plus une allowlist.
#:
#: Le second hôte est donc ajouté à la main, sur deux motifs vérifiables :
#: la redirection provient de l'hôte JRC déjà tenu pour officiel, et le domaine
#: cible est celui du Copernicus Emergency Management Service — l'opérateur que
#: `copernicus_edo.py` nomme lui-même comme producteur du CDI.
EDO_HOSTS = frozenset({"edo.jrc.ec.europa.eu", "drought.emergency.copernicus.eu"})

#: Page d'identité du produit. Ce n'est PAS un point de téléchargement : elle
#: est demandée pour constater que le service répond et qu'il nomme bien le
#: produit épinglé.
EDO_IDENTITY_URL = "https://edo.jrc.ec.europa.eu/edov2/php/index.php?id=1000"

#: Borne délibérément basse. Une identité tient dans quelques centaines de
#: kilo-octets ; au-delà, on ne vérifie plus une identité, on télécharge.
EDO_MAX_BYTES = 1_000_000


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.water_intelligence.verify_excluded_sources",
        description=(
            "Constate le statut des deux sources exclues de X1. WRI : aucun appel "
            "réseau. Copernicus : identité seule, aucun décodage."
        ),
    )
    parser.add_argument("--report-dir", required=True, type=Path)
    parser.add_argument("--timeout", type=float, default=25.0)
    return parser


def verify_wri(started: datetime) -> ValidationReport:
    """Constate le blocage. Aucun réseau — c'est le fond du sujet."""
    return ValidationReport(
        source_code=aqueduct.SOURCE_CODE,
        release_key=f"aqueduct-{aqueduct.DATASET_VERSION}",
        verdict="blocked",
        executed_at=started.isoformat(),
        method=f"{aqueduct.METHOD.code} {aqueduct.METHOD.version}",
        limits={"network_calls_allowed": 0},
        query_parameters={
            "dataset_version": aqueduct.DATASET_VERSION,
            "published_at": aqueduct.DATASET_PUBLISHED_AT.isoformat(),
            "license_code": aqueduct.LICENSE_CODE,
        },
        transfers=(),
        payload_format=None,
        warnings=(
            "Statut : blocked_registration_required. Aucun enregistrement WRI n'est "
            "documenté dans le dépôt.",
        ),
        notes=(
            "AUCUN appel réseau n'a été émis vers WRI, volontairement. Le pack "
            "l'interdit tant que l'enregistrement n'est pas documenté, et vérifier "
            "l'accessibilité d'une ressource qu'on n'a pas le droit de collecter "
            "reviendrait à commencer à la collecter.",
            "Le connecteur `wri_aqueduct.py` est livré et testé : ce n'est pas un "
            "manque technique. Ce qui manque est un acte contractuel, qu'un script "
            "ne peut ni effectuer ni attester.",
            "Voie de déblocage sans enregistrement : valider le connecteur sur un "
            "artefact local obtenu légalement par un opérateur, en le passant en "
            "entrée — la commande de validation reste à écrire le jour où cet "
            "artefact existe.",
        ),
        duration_seconds=0.0,
    )


def verify_copernicus(started: datetime, *, timeout: float) -> ValidationReport:
    """Constate l'accessibilité et l'identité du produit. Aucun décodage."""
    fetcher = OperatorFetcher(
        allowed_hosts=EDO_HOSTS,
        timeout_seconds=timeout,
        max_bytes=EDO_MAX_BYTES,
    )
    warnings: list[str] = []
    errors: list[str] = []
    payload_format: str | None = None
    reachable = False

    try:
        outcome = fetcher.fetch(EDO_IDENTITY_URL, accept="text/html")
        payload_format = outcome.content_type
        reachable = 200 <= outcome.status_code < 300
        if not reachable:
            errors.append(f"page d'identité : HTTP {outcome.status_code}.")
        else:
            text = outcome.body.decode("utf-8", "replace")
            # L'identité est cherchée dans le texte servi, pas supposée : un
            # service qui répond 200 en ayant renommé son produit doit être
            # visible comme tel.
            if edo.PRODUCT_NAME.lower() in text.lower() or "combined drought" in text.lower():
                warnings.append(
                    f"service joignable et produit nommé : {edo.PRODUCT_NAME} "
                    f"{edo.PRODUCT_VERSION} (opérateur : {edo.PRODUCT_OPERATOR})."
                )
            else:
                warnings.append(
                    "service joignable, mais le nom du produit épinglé n'a pas été "
                    "retrouvé dans la page servie — identité à reconfirmer à la main "
                    "avant toute ingestion."
                )
    except (FetcherRefusal, FetcherNetworkError) as exc:
        errors.append(f"service injoignable : {exc}")

    return ValidationReport(
        source_code=edo.SOURCE_CODE,
        release_key=f"{edo.PRODUCT_NAME} {edo.PRODUCT_VERSION}",
        verdict="decoder_deferred" if reachable else "source_unavailable",
        executed_at=started.isoformat(),
        method=f"{edo.METHOD.code} {edo.METHOD.version}",
        limits={"max_bytes": EDO_MAX_BYTES, "timeout_seconds": timeout, "decoding": "aucun"},
        query_parameters={
            "product": edo.PRODUCT_NAME,
            "version": edo.PRODUCT_VERSION,
            "crs": edo.CRS,
            "resolution": edo.RESOLUTION_NOTE,
            "connector_status": edo.CONNECTOR_STATUS,
        },
        transfers=tuple(fetcher.log),
        payload_format=payload_format,
        warnings=tuple(warnings + list(edo.OFFICIAL_WARNINGS)),
        errors=tuple(errors),
        notes=(
            "Aucun raster n'a été téléchargé et aucun octet n'a été décodé : le "
            f"connecteur porte `{edo.CONNECTOR_STATUS}`, et X1 ne lève pas ce statut.",
            "Les avertissements officiels de l'EDO sont repris tels quels ci-dessus : "
            "ils conditionnent toute interprétation future, et ne sont pas des "
            "remarques de mise en œuvre.",
            f"Formats publiés par la source : {', '.join(edo.PAYLOAD_FORMATS)} — aucun "
            "n'est décodable par le connecteur en l'état.",
        ),
        duration_seconds=(datetime.now(timezone.utc) - started).total_seconds(),
    )


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    started = datetime.now(timezone.utc)

    wri = verify_wri(started)
    wri.write(args.report_dir / "X1_WRI_AQUEDUCT.md")
    print(f"{wri.source_code} : {wri.verdict} (aucun appel réseau)")

    copernicus = verify_copernicus(started, timeout=args.timeout)
    copernicus.write(args.report_dir / "X1_COPERNICUS_EDO.md")
    print(f"{copernicus.source_code} : {copernicus.verdict}")
    return 0


if __name__ == "__main__":  # pragma: no cover - point d'entrée opérateur
    raise SystemExit(main())
