"""
staging_ingestion.py — contrat d'entrée du graveur Evidence Kernel Eau (X2B).

Ce module est PUR : il ne touche ni la base, ni le réseau, ni le système de
fichiers au-delà de la lecture des deux fichiers que l'opérateur désigne
explicitement (l'artefact local et son rapport de validation). Il décide
seulement d'une chose : **cette demande d'ingestion a-t-elle le droit
d'exister ?** L'écriture elle-même est dans `staging_writer.py`.

La séparation n'est pas cosmétique : chacune des quinze règles de refus
ci-dessous doit pouvoir être exercée par un test SANS PostgreSQL, sinon elle
ne serait vérifiée qu'en CI DB-gated, c'est-à-dire rarement.

Sur la « version du rapport » demandée par le contrat X2B : les rapports X1/
X2A ne portent aucun champ de version de format (cf.
`scripts/water_intelligence/reporting.py`). Plutôt que d'inventer un champ
libre que personne ne pourrait contredire, ce contrat exige le **SHA-256 du
fichier de rapport lui-même** — la seule version d'un rapport qui ne puisse
être ni devinée ni falsifiée — et journalise son `executed_at` comme
horodatage de recette.

Périmètre X2B (cf. `activation/X2A_SCHEMA_REMEDIATION_HANDOFF.md` §7) : les
QUATRE familles Hub'Eau déclarées `ready_for_staging`. EEA, WRI et Copernicus
sont refusées NOMMÉMENT, avec leur statut réel — un refus muet laisserait
croire à une faute de frappe.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from models.analytics import MethodRef
from services.water_intelligence.connectors import hubeau_hydro as hydro
from services.water_intelligence.connectors import hubeau_withdrawals_quality as usage

#: Seul verdict qui autorise une ingestion staging. Recopié plutôt qu'importé
#: de `scripts.water_intelligence.reporting` : un paquet `services` n'importe
#: jamais `scripts` (cf. `TestDependencyDirection`). Un test vérifie que les
#: deux définitions ne divergent pas.
ACCEPTED_VERDICT = "ready_for_staging"

#: Seul environnement d'écriture autorisé par X2B. La publication publique est
#: X4, et se décide ailleurs (`publication_decisions`), jamais ici.
STAGING_ENVIRONMENT = "staging"

#: Clés de release refusées : une release doit nommer un contenu figé, pas un
#: curseur mouvant. `latest` aujourd'hui n'est pas `latest` demain, et deux
#: ingestions successives produiraient deux contenus sous la même identité.
FORBIDDEN_RELEASE_KEYS = frozenset(
    {"latest", "current", "head", "main", "master", "now", "today", "newest", "last"}
)

#: Noms de paramètres qui trahissent une donnée de tenant dans une recette.
#: Une source Hub'Eau est une donnée publique d'État : rien de tenant ne doit
#: transiter par ce chemin, ni dans la requête, ni dans le rapport.
TENANT_PARAMETER_PATTERN = re.compile(
    r"(company|tenant|client|customer|societe|société|entreprise|siren|siret|org(?:anisation)?_id)",
    re.IGNORECASE,
)


class StagingIngestionRefused(Exception):
    """Demande d'ingestion refusée. Toujours nommée, jamais silencieuse."""


@dataclass(frozen=True)
class IngestibleSource:
    """Une famille Hub'Eau admise en X2B, avec sa méthode vérifiée."""

    source_code: str
    label: str
    method: MethodRef


#: Les QUATRE familles Hub'Eau `ready_for_staging` (X1 + X2A). Les codes sont
#: ceux du catalogue et des rapports — aucun alias n'est créé ici.
INGESTIBLE_SOURCES: dict[str, IngestibleSource] = {
    hydro.HYDROMETRIE_SOURCE_CODE: IngestibleSource(
        source_code=hydro.HYDROMETRIE_SOURCE_CODE,
        label="Hub'Eau hydrométrie (observations temps réel)",
        method=hydro.METHOD,
    ),
    hydro.PIEZOMETRIE_SOURCE_CODE: IngestibleSource(
        source_code=hydro.PIEZOMETRIE_SOURCE_CODE,
        label="Hub'Eau piézométrie (chroniques ADES)",
        method=hydro.METHOD,
    ),
    usage.WITHDRAWALS_SOURCE_CODE: IngestibleSource(
        source_code=usage.WITHDRAWALS_SOURCE_CODE,
        label="Hub'Eau prélèvements (BNPE)",
        method=usage.WITHDRAWALS_METHOD,
    ),
    usage.QUALITY_SOURCE_CODE: IngestibleSource(
        source_code=usage.QUALITY_SOURCE_CODE,
        label="Hub'Eau qualité des rivières (Naïades)",
        method=usage.QUALITY_METHOD,
    ),
}

#: Sources explicitement HORS périmètre X2B, avec le statut qui les bloque.
#: Elles sont listées pour que le refus cite la vraie raison plutôt que
#: « source inconnue » — qui laisserait croire à une erreur de saisie.
REFUSED_SOURCES: dict[str, str] = {
    "EEA_WEI_PLUS": (
        "manual_artifact_required — aucun artefact officiel réel n'a été obtenu "
        "et aucun profil de correspondance colonnes/feuille vérifié n'existe "
        "(cf. eea_artifact_inspector.MAPPING_PROFILES, vide par construction). "
        "Ingestion possible seulement après un nouveau rapport ready_for_staging."
    ),
    "WRI_AQUEDUCT": (
        "blocked_registration_required — l'inscription préalable exigée par le "
        "WRI n'est pas documentée ; aucune donnée n'a jamais été acquise."
    ),
    "COPERNICUS_EDO": (
        "source_verified_decoder_deferred — l'identité de la source est "
        "vérifiée mais aucun décodeur raster n'est livré : rien à ingérer."
    ),
}


@dataclass(frozen=True)
class WaterStagingIngestionRequest:
    """Demande d'ingestion staging d'une release Eau.

    Gelée et validée à la construction : une demande qui existe est une
    demande dont les quinze règles structurelles sont déjà satisfaites. Les
    règles qui exigent de LIRE le rapport (verdict, dry-run, concordance de
    checksum) sont dans `verify_report()` — elles ont besoin du fichier.
    """

    source_code: str
    release_key: str
    artifact_path: Path
    expected_sha256: str
    report_path: Path
    report_sha256: str
    method_code: str
    method_version: str
    environment: str = STAGING_ENVIRONMENT
    dry_run: bool = True
    operator: str | None = None

    def __post_init__(self) -> None:
        self._check_source()
        self._check_release_key()
        self._check_checksums()
        self._check_method()
        self._check_environment()
        self._check_files_exist()
        self._check_operator()

    # -- règles 1 & 3 : la source ------------------------------------------

    def _check_source(self) -> None:
        code = (self.source_code or "").strip()
        if not code:
            raise StagingIngestionRefused("source_code vide — aucune source désignée.")
        if code in REFUSED_SOURCES:
            raise StagingIngestionRefused(
                f"source {code!r} hors périmètre X2B : {REFUSED_SOURCES[code]}"
            )
        if code not in INGESTIBLE_SOURCES:
            raise StagingIngestionRefused(
                f"source {code!r} inconnue — X2B n'admet que "
                f"{sorted(INGESTIBLE_SOURCES)}."
            )

    # -- règles 2 & 3 : la release -----------------------------------------

    def _check_release_key(self) -> None:
        key = (self.release_key or "").strip()
        if not key:
            raise StagingIngestionRefused(
                "release_key vide — une release doit porter un nom, sinon deux "
                "contenus différents partageraient la même identité."
            )
        if key.lower() in FORBIDDEN_RELEASE_KEYS:
            raise StagingIngestionRefused(
                f"release_key {key!r} refusée — un curseur mouvant "
                f"({', '.join(sorted(FORBIDDEN_RELEASE_KEYS))}) ne nomme pas un "
                "contenu figé et rendrait l'idempotence impossible à vérifier."
            )

    # -- règle 5 : les checksums -------------------------------------------

    def _check_checksums(self) -> None:
        for name, value in (
            ("expected_sha256", self.expected_sha256),
            ("report_sha256", self.report_sha256),
        ):
            if not _is_sha256(value):
                raise StagingIngestionRefused(
                    f"{name} {value!r} n'est pas un SHA-256 hexadécimal de 64 caractères."
                )

    # -- règle 10 : la méthode ---------------------------------------------

    def _check_method(self) -> None:
        if not (self.method_code or "").strip():
            raise StagingIngestionRefused("method_code vide — aucune méthode déclarée.")
        if not (self.method_version or "").strip():
            raise StagingIngestionRefused(
                f"méthode {self.method_code!r} sans version — une méthode non "
                "versionnée ne peut pas être rejouée."
            )
        expected = INGESTIBLE_SOURCES[self.source_code.strip()].method
        if (self.method_code, self.method_version) != (expected.code, expected.version):
            raise StagingIngestionRefused(
                f"méthode {self.method_code}@{self.method_version} ≠ méthode vérifiée "
                f"du connecteur {expected.code}@{expected.version} — une méthode "
                "déclarée à la main ne remplace pas celle du connecteur."
            )

    # -- règles 13 & 14 : l'environnement ----------------------------------

    def _check_environment(self) -> None:
        env = (self.environment or "").strip().lower()
        if env != STAGING_ENVIRONMENT:
            raise StagingIngestionRefused(
                f"environnement {self.environment!r} refusé — X2B n'écrit qu'en "
                f"{STAGING_ENVIRONMENT!r}. La publication publique est X4 et se "
                "décide par une revue humaine, jamais par un argument de commande."
            )

    # -- règle 4 : les fichiers --------------------------------------------

    def _check_files_exist(self) -> None:
        # L'artefact peut être une page unique OU un répertoire de pages
        # (acquisition paginée) ; le rapport est toujours un fichier.
        if not (self.artifact_path.is_file() or self.artifact_path.is_dir()):
            raise StagingIngestionRefused(
                f"artefact introuvable : {self.artifact_path} — rien n'est deviné, "
                "rien n'est téléchargé."
            )
        if not self.report_path.is_file():
            raise StagingIngestionRefused(
                f"rapport introuvable : {self.report_path} — rien n'est deviné, "
                "rien n'est téléchargé."
            )

    # -- règle 15 : aucune donnée tenant -----------------------------------

    def _check_operator(self) -> None:
        if self.operator is not None and TENANT_PARAMETER_PATTERN.search(self.operator):
            raise StagingIngestionRefused(
                f"identité d'opérateur {self.operator!r} évoque un tenant — les "
                "sources Hub'Eau sont des données publiques globales, aucune "
                "ligne de tenant n'est écrite par ce chemin."
            )

    # -- lecture des octets, une seule fois --------------------------------

    def read_artifact_pages(self) -> list[bytes]:
        """Lit l'artefact et VÉRIFIE son checksum de payload (règles 4 et 5).

        Une acquisition Hub'Eau est PAGINÉE : l'artefact est donc soit une page
        unique (fichier), soit un répertoire de pages ordonnées — la forme
        produite par `validate_hubeau --artifact-dir`. Le checksum comparé est
        celui que le rapport atteste, calculé par la MÊME règle que
        `validate_hubeau._payload_checksum` (cf. `payload_digest`) : sinon la
        concordance rapport/artefact ne voudrait rien dire dès la deuxième page.
        """
        pages = self._collect_pages()
        if not pages:
            raise StagingIngestionRefused(
                f"artefact vide : {self.artifact_path} — aucune page à ingérer."
            )
        actual = payload_digest(pages)
        if actual != self.expected_sha256.lower():
            raise StagingIngestionRefused(
                f"checksum du payload différent : attendu "
                f"{self.expected_sha256.lower()}, obtenu {actual}. Les octets ne "
                "sont pas ceux que le rapport atteste."
            )
        return pages

    def _collect_pages(self) -> list[bytes]:
        if self.artifact_path.is_dir():
            # Ordre lexicographique = ordre de pagination : `_write_artifact`
            # numérote `…_p001.json`, `…_p002.json`. Trier autrement (mtime)
            # rendrait le checksum dépendant du système de fichiers.
            return [
                path.read_bytes()
                for path in sorted(self.artifact_path.glob("*.json"))
            ]
        return [self.artifact_path.read_bytes()]


def payload_digest(pages: list[bytes]) -> str:
    """Checksum de payload d'une acquisition paginée.

    Règle recopiée de `scripts/water_intelligence/validate_hubeau._payload_checksum`
    (un paquet `services` n'importe jamais `scripts`) : une page unique donne
    son propre SHA-256 ; plusieurs pages donnent le SHA-256 de la concaténation
    de leurs empreintes hexadécimales. Un test vérifie que les deux
    implémentations ne divergent pas.
    """
    digests = [hashlib.sha256(page).hexdigest() for page in pages]
    if len(digests) == 1:
        return digests[0]
    return hashlib.sha256("".join(digests).encode("ascii")).hexdigest()


def _is_sha256(value: str | None) -> bool:
    return bool(value) and re.fullmatch(r"[0-9a-fA-F]{64}", value or "") is not None


# ---------------------------------------------------------------------------
# Rapport de validation X1/X2A — règles 6 à 9, 11, 12, 15
# ---------------------------------------------------------------------------

_JSON_BLOCK = re.compile(r"```json\s*\n(.*?)\n```", re.DOTALL)


def load_validation_report(path: Path) -> dict[str, Any]:
    """Extrait le bloc JSON structuré d'un rapport X1/X2A (règle 6).

    Un rapport est un Markdown qui embarque son propre JSON — c'est ce JSON
    qui fait foi, jamais la prose. Un rapport sans bloc JSON lisible est
    refusé plutôt que réinterprété.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise StagingIngestionRefused(f"rapport illisible : {path} ({exc})") from exc

    match = _JSON_BLOCK.search(text)
    if match is None:
        raise StagingIngestionRefused(
            f"rapport {path} sans bloc JSON structuré — format non reconnu, "
            "aucune interprétation de la prose."
        )
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        raise StagingIngestionRefused(
            f"rapport {path} : bloc JSON invalide ({exc})."
        ) from exc
    if not isinstance(payload, dict):
        raise StagingIngestionRefused(
            f"rapport {path} : le bloc JSON n'est pas un objet."
        )
    return payload


def verify_report(
    request: WaterStagingIngestionRequest, report: Mapping[str, Any]
) -> None:
    """Règles 6 à 9, 11, 12 et 15 — le rapport atteste-t-il CET artefact ?"""
    actual_report_digest = hashlib.sha256(
        request.report_path.read_bytes()
    ).hexdigest()
    if actual_report_digest != request.report_sha256.lower():
        raise StagingIngestionRefused(
            f"checksum du rapport différent : attendu {request.report_sha256.lower()}, "
            f"obtenu {actual_report_digest}. Le rapport désigné n'est pas celui déclaré."
        )

    if report.get("source_code") != request.source_code:
        raise StagingIngestionRefused(
            f"rapport émis pour {report.get('source_code')!r}, ingestion demandée "
            f"pour {request.source_code!r}."
        )

    if report.get("release_key") != request.release_key:
        raise StagingIngestionRefused(
            f"rapport émis pour la release {report.get('release_key')!r}, ingestion "
            f"demandée pour {request.release_key!r}."
        )

    verdict = report.get("verdict")
    if verdict != ACCEPTED_VERDICT:
        raise StagingIngestionRefused(
            f"verdict {verdict!r} — seul {ACCEPTED_VERDICT!r} autorise une ingestion "
            "staging. Un connecteur non validé n'est pas ingéré « en attendant »."
        )

    if report.get("dry_run") is not True:
        raise StagingIngestionRefused(
            "rapport avec dry_run=false — X1/X2A sont en lecture seule par "
            "construction ; un tel rapport est incohérent avec sa propre phase "
            "et n'atteste rien."
        )

    payload_sha = (report.get("payload_sha256") or "").lower()
    if not payload_sha:
        raise StagingIngestionRefused(
            "rapport sans payload_sha256 — impossible de rattacher l'artefact au rapport."
        )
    if payload_sha != request.expected_sha256.lower():
        raise StagingIngestionRefused(
            f"checksum attesté par le rapport ({payload_sha}) ≠ checksum déclaré "
            f"pour l'artefact ({request.expected_sha256.lower()})."
        )

    if not report.get("periods"):
        raise StagingIngestionRefused(
            "rapport sans période observée — une observation sans période n'a pas "
            "d'identité (règle 11)."
        )

    if not report.get("geographies"):
        raise StagingIngestionRefused(
            "rapport sans géographie observée — une observation sans géographie "
            "n'a pas d'identité (règle 12)."
        )

    leaked = sorted(
        name
        for name in (report.get("query_parameters") or {})
        if TENANT_PARAMETER_PATTERN.search(str(name))
    )
    if leaked:
        raise StagingIngestionRefused(
            f"paramètre(s) de tenant dans la recette du rapport : {leaked} — une "
            "source publique ne s'interroge jamais avec une clé de tenant (règle 15)."
        )
