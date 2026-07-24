"""
connectors/copernicus_edo.py — connecteur Copernicus EDO / CDI (P09).

Périmètre : situation COURANTE de sécheresse en Europe, à partir du
« Combined Drought Indicator » (CDI) publié par l'European Drought
Observatory du Copernicus Emergency Management Service (CEMS), opéré par le
JRC de la Commission européenne. **Aucun réseau** : ce module n'importe aucun
client HTTP et ne télécharge rien ; l'opérateur fournit les octets. Aucune
écriture en base, aucun frontend.

## Sécheresse courante ≠ stress structurel

Le CDI décrit un ÉTAT à un instant donné (période de 10 jours), reconstruit à
partir d'anomalies de précipitation, d'humidité du sol et de végétation. Le
WEI+ (P06, `eea_wei_plus.py`) décrit une PRESSION STRUCTURELLE (consommation
rapportée à la ressource renouvelable). Les deux ne sont jamais fusionnés,
additionnés, moyennés ni présentés comme un score unique : leurs espaces de
noms de métriques sont disjoints par construction (`METRIC_NAMESPACE`).

## Faits VÉRIFIÉS sur la source (cf. handoffs/WAVE_A_EU_CONNECTORS.md §3)

Fiche officielle « EDO INDICATOR FACTSHEET — Indicator version: v4.1 —
Combined Drought Indicator (CDI) », et portail de téléchargement EDO :

  - version de l'indicateur : v4.1 ;
  - pas de temps : 10 jours (décade) ; archives disponibles depuis 2012 ;
  - résolution spatiale : 1/24 de degré décimal, « around 5 km at the
    Equator » ; référentiel géographique WGS84 (EPSG:4326) ;
  - emprise : xmin -25, xmax 51, ymin 22, ymax 72 ;
  - sept classes, codes 0 à 6 (`CDI_CLASSES` ci-dessous), recopiées verbatim
    de la table 1 de la fiche ;
  - formats de distribution proposés par le portail officiel : GeoTIFF
    (`tif`) et NetCDF (`nc`) — **et rien d'autre** : aucun export tabulaire
    ni CSV n'est offert (vérifié sur le sélecteur de format du portail) ;
  - licence : accès « free, full and open » au titre du règlement (UE)
    2021/696, sans garantie ; attribution obligatoire dès communication
    publique (`ATTRIBUTION_TEMPLATE` / `ATTRIBUTION_TEMPLATE_MODIFIED`) ;
  - avertissement officiel en vigueur, repris verbatim dans
    `OFFICIAL_WARNINGS` : les sorties du modèle hydrologique sont trop sèches
    à l'est de la Pologne, et le CDI « should be interpreted with caution
    since mid-May 2025 ».

## Blocage assumé : la grille raster n'est PAS décodée ici

Les deux seuls formats officiels sont des rasters. Les lire correctement
(compression, tuilage, valeurs manquantes, géoréférencement) exige une
dépendance lourde — GDAL/rasterio pour le GeoTIFF, netCDF4/h5py/xarray pour
le NetCDF — qu'aucun ADR n'autorise à ce stade, et qu'aucune mesure d'impact
ne justifie. Aucun export tabulaire officiel n'existe, et aucun paramétrage
WMS/WCS n'a pu être vérifié (point d'entrée, nom de couche et format de
réponse restent `unknown`).

Conséquence, conforme à la consigne P09 (« si aucun chemin robuste n'existe :
livrer gate source, configuration, contrat, fixtures et tests ; documenter le
blocage ; ne pas simuler une couche raster ») : ce module livre l'identité
vérifiée de la source, la configuration de snapshot, le contrat de connecteur
et l'identification de format — puis **refuse explicitement** de produire la
moindre observation, via `EdoRasterDecodingUnavailableError`. Branché sur
`run_pipeline`, il produit donc un rapport d'exécution qui NOMME le blocage,
plutôt qu'un lot vide qui aurait l'air normal ou, pire, des valeurs inventées.

Ce qu'il fait malgré tout, sans dépendance lourde :
  - épingler une décade explicite (aucun « latest » implicite) ;
  - vérifier que les octets correspondent au format DÉCLARÉ, par nombre
    magique (`identify_payload_format`) — une identification de conteneur,
    jamais un décodage de pixels ;
  - calculer le checksum SHA-256 de l'artefact et porter sa provenance ;
  - transporter licence, attribution et avertissements officiels.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal

from models.analytics import MethodRef
from services.intelligence.adapters.base import AdapterError, ObservationDraft
from services.water_intelligence.pipeline import RawBytesPageDecoder

# ---------------------------------------------------------------------------
# Identité de la source — valeurs VÉRIFIÉES (cf. rapport de source Wave A)
# ---------------------------------------------------------------------------

SOURCE_CODE = "COPERNICUS_EDO"

PRODUCT_NAME = "Combined Drought Indicator (CDI)"
PRODUCT_VERSION = "v4.1"
PRODUCT_OPERATOR = (
    "Copernicus Emergency Management Service (CEMS) — European Drought Observatory "
    "(EDO), European Commission Joint Research Centre (JRC)"
)

#: Espace de noms des métriques. Disjoint de celui du WEI+ (`eea_wei_plus.`) :
#: sécheresse courante et stress structurel ne se mélangent jamais.
METRIC_NAMESPACE = "copernicus_edo.cdi"

#: Accès « free, full and open » au titre du règlement (UE) 2021/696. Ce n'est
#: PAS une licence Creative Commons : ne pas la présenter comme telle.
LICENSE_CODE = "COPERNICUS-EMS-FREE-FULL-OPEN"
LICENSE_REFERENCE = "Regulation (EU) 2021/696"
ATTRIBUTION_TEMPLATE = "Generated using Copernicus Emergency Management Service information {year}"
ATTRIBUTION_TEMPLATE_MODIFIED = (
    "Contains modified Copernicus Emergency Management Service information {year}"
)

#: Grille publiée — jamais reprojetée ni rééchantillonnée par ce module.
CRS = "EPSG:4326"
RESOLUTION_DEGREES = 1 / 24
RESOLUTION_NOTE = "1/24 decimal degree (around 5 km at the Equator)"
BOUNDING_BOX = {"xmin": -25.0, "xmax": 51.0, "ymin": 22.0, "ymax": 72.0}

#: Premier millésime proposé par le portail officiel.
COVERAGE_FIRST_YEAR = 2012

#: Pas de temps : décade (10 jours). Trois décades par mois, la troisième
#: courant jusqu'à la fin du mois.
DEKADS: tuple[int, ...] = (1, 2, 3)
DEKAD_START_DAY: dict[int, int] = {1: 1, 2: 11, 3: 21}

#: Table 1 de la fiche officielle, recopiée verbatim. Ce module ne traduit ni
#: ne réordonne ces classes : ce sont des CLASSES, jamais des nombres à
#: moyenner, et jamais une conclusion réglementaire.
CDI_CLASSES: dict[int, str] = {
    0: "No drought",
    1: "Watch",
    2: "Warning",
    3: "Alert",
    4: "Recovery",
    5: "Temporary Soil Moisture recovery",
    6: "Temporary vegetation recovery",
}

#: Avertissement publié sur le portail officiel au moment de l'inspection.
#: Transporté tel quel : une limite connue de la source ne doit jamais
#: disparaître entre la source et le lecteur.
OFFICIAL_WARNINGS: tuple[str, ...] = (
    "EDO (avertissement officiel) : les sorties du modèle hydrologique donnent un "
    "signal trop sec dans certaines régions, à l'est de la Pologne. Le CDI (ainsi "
    "que LFI et SMI Anomaly) doit être interprété avec prudence depuis la mi-mai "
    "2025, particulièrement dans la partie orientale du domaine.",
)

#: Formats proposés par le portail officiel — les deux seuls vérifiés.
EdoPayloadFormat = Literal["tif", "nc"]
PAYLOAD_FORMATS: tuple[str, ...] = ("tif", "nc")

#: Nombres magiques de conteneur. Identifier un conteneur n'est PAS décoder
#: une grille : aucune valeur de pixel n'est lue ici.
_MAGIC_NUMBERS: tuple[tuple[bytes, str], ...] = (
    (b"II\x2a\x00", "tif"),   # TIFF little-endian
    (b"MM\x00\x2a", "tif"),   # TIFF big-endian
    (b"II\x2b\x00", "tif"),   # BigTIFF little-endian
    (b"MM\x00\x2b", "tif"),   # BigTIFF big-endian
    (b"CDF\x01", "nc"),        # NetCDF classic
    (b"CDF\x02", "nc"),        # NetCDF 64-bit offset
    (b"\x89HDF\r\n\x1a\n", "nc"),  # NetCDF-4 (conteneur HDF5)
)

#: Méthode de CE connecteur : identification et provenance, sans dérivation.
METHOD = MethodRef(code="CC-WI-COPERNICUS-EDO-SNAPSHOT", version="1.0.0")

#: Décodeur de page (P03B) choisi EXPLICITEMENT : la charge utile est binaire,
#: aucun décodage textuel ni JSON n'aurait de sens.
PAGE_DECODER = RawBytesPageDecoder()

#: Budget d'artefact opérateur, borné explicitement.
MAX_PAYLOAD_BYTES = 50_000_000


class EdoError(AdapterError):
    """Erreur du connecteur — jamais un échec silencieux.

    Hérite d'`AdapterError` (P03C) : levée pendant `parse`/`normalize`, elle
    est capturée par `run_pipeline()` et transformée en rapport d'exécution."""


class EdoSnapshotError(EdoError):
    """Snapshot mal identifié : décade absente, hors archive, ou « latest »."""


class EdoPayloadError(EdoError):
    """Artefact absent, vide, tronqué, hors budget ou d'un format qui ne
    correspond pas à celui déclaré."""


class EdoRasterDecodingUnavailableError(EdoError):
    """Le décodage de la grille raster n'est pas disponible — blocage ASSUMÉ
    et documenté, jamais contourné par une valeur inventée.

    Levée au stage `normalize` : `run_pipeline()` produit alors un rapport
    nommant le blocage. C'est la seule issue honnête tant qu'aucun ADR
    n'autorise GDAL/rasterio/netCDF4 et qu'aucun export tabulaire officiel
    n'existe (cf. docstring de module)."""


# ---------------------------------------------------------------------------
# Snapshot — décade explicite, jamais « latest »
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EdoSnapshotConfig:
    """Identité d'un snapshot CDI fourni par l'opérateur.

    Une décade est désignée par (année, mois, décade) — jamais par un mot-clé
    mouvant : un build reproductible ne peut pas dépendre de « la dernière
    carte publiée ».
    """

    year: int
    month: int
    dekad: int
    payload_format: EdoPayloadFormat
    retrieved_at: date
    is_fixture: bool = False

    def __post_init__(self) -> None:
        if self.dekad not in DEKADS:
            raise EdoSnapshotError(
                f"décade {self.dekad!r} invalide : le CDI est publié par décade "
                f"{list(DEKADS)} (10 jours)."
            )
        if not 1 <= self.month <= 12:
            raise EdoSnapshotError(f"mois {self.month!r} invalide.")
        if self.year < COVERAGE_FIRST_YEAR:
            raise EdoSnapshotError(
                f"année {self.year} hors archive publiée : le CDI commence en "
                f"{COVERAGE_FIRST_YEAR} — aucune extrapolation."
            )
        if self.payload_format not in PAYLOAD_FORMATS:
            raise EdoSnapshotError(
                f"format {self.payload_format!r} inconnu : le portail officiel ne "
                f"propose que {list(PAYLOAD_FORMATS)}."
            )

    @property
    def snapshot_date(self) -> date:
        """Premier jour de la décade — la date du snapshot est toujours
        explicite et calculable, jamais « aujourd'hui »."""
        return date(self.year, self.month, DEKAD_START_DAY[self.dekad])

    @property
    def release_key(self) -> str:
        """Clé de release déterministe et lisible, portant la décade."""
        return (
            f"copernicus-edo-cdi-{PRODUCT_VERSION}-"
            f"{self.year:04d}{self.month:02d}d{self.dekad}"
        )

    def attribution(self, *, modified: bool = False) -> str:
        """Attribution officielle CEMS. `modified=True` dès que la donnée est
        adaptée — c'est le libellé imposé par les conditions d'utilisation."""
        template = ATTRIBUTION_TEMPLATE_MODIFIED if modified else ATTRIBUTION_TEMPLATE
        return template.format(year=self.year)

    def warnings(self) -> list[str]:
        """Avertissements à porter jusqu'au lecteur, jamais filtrés."""
        return list(OFFICIAL_WARNINGS)


def cdi_class_label(code: int) -> str:
    """Libellé officiel d'une classe CDI. Un code hors table est refusé —
    jamais approché vers la classe la plus proche."""
    if code not in CDI_CLASSES:
        raise EdoPayloadError(
            f"classe CDI {code!r} hors table officielle {sorted(CDI_CLASSES)}."
        )
    return CDI_CLASSES[code]


# ---------------------------------------------------------------------------
# Artefact — identification de conteneur, jamais décodage de grille
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EdoArtifact:
    """Un artefact opérateur validé : identité, format confirmé, checksum.

    Ne contient aucune valeur de pixel : la grille n'est pas décodée.
    """

    release_key: str
    snapshot_date: date
    payload_format: str
    payload_bytes: int
    checksum_sha256: str


def identify_payload_format(raw: bytes) -> str:
    """Identifie le conteneur par son nombre magique.

    Lit uniquement l'en-tête : c'est une identification de FORMAT, pas une
    lecture de données géospatiales. Un contenu non reconnu est refusé
    explicitement plutôt que supposé conforme au format déclaré.
    """
    if not raw:
        raise EdoPayloadError("artefact vide : aucun octet à identifier.")
    for magic, fmt in _MAGIC_NUMBERS:
        if raw.startswith(magic):
            return fmt
    raise EdoPayloadError(
        "format d'artefact non reconnu : aucun nombre magique GeoTIFF ni NetCDF/HDF5 "
        "— artefact corrompu, tronqué ou d'un format non officiel."
    )


def inspect_artifact(raw: bytes, *, config: EdoSnapshotConfig) -> EdoArtifact:
    """Valide l'artefact fourni par l'opérateur sans en décoder la grille.

    Vérifie : présence, budget, format réellement observé == format déclaré.
    Déterministe : mêmes octets → même checksum.
    """
    if len(raw) > MAX_PAYLOAD_BYTES:
        raise EdoPayloadError(
            f"artefact de {len(raw)} octets > budget {MAX_PAYLOAD_BYTES} — "
            "extrait à restreindre, jamais tronqué en silence."
        )

    observed = identify_payload_format(raw)
    if observed != config.payload_format:
        raise EdoPayloadError(
            f"format déclaré {config.payload_format!r} mais artefact reconnu comme "
            f"{observed!r} — refus plutôt qu'une interprétation devinée."
        )

    return EdoArtifact(
        release_key=config.release_key,
        snapshot_date=config.snapshot_date,
        payload_format=observed,
        payload_bytes=len(raw),
        checksum_sha256=hashlib.sha256(raw).hexdigest(),
    )


# ---------------------------------------------------------------------------
# Intégration pipeline P03 — le blocage est NOMMÉ, jamais contourné
# ---------------------------------------------------------------------------


def metric_code(facet: str) -> str:
    """Code de métrique namespacé, disjoint de celui du WEI+."""
    return f"{METRIC_NAMESPACE}.{facet}"


def build_normalizer(config: EdoSnapshotConfig):
    """Retourne un `Normalizer` compatible `run_pipeline` (P03).

    Valide l'artefact (présence, budget, format), puis lève
    `EdoRasterDecodingUnavailableError` : produire des observations exigerait
    de décoder la grille, donc une dépendance lourde non autorisée. Le
    pipeline transforme cette erreur en rapport nommant le blocage — jamais un
    lot vide silencieux, jamais une valeur inventée.
    """

    def normalizer(pages: Any) -> list[ObservationDraft]:
        artifacts = [inspect_artifact(page, config=config) for page in _as_byte_pages(pages)]
        raise EdoRasterDecodingUnavailableError(
            f"{len(artifacts)} artefact(s) CDI {PRODUCT_VERSION} validé(s) "
            f"(snapshot {config.snapshot_date.isoformat()}, format "
            f"{config.payload_format!r}) mais la grille raster n'est pas décodée : "
            "les deux seuls formats officiels (GeoTIFF, NetCDF) exigent une "
            "dépendance lourde (GDAL/rasterio/netCDF4) qu'aucun ADR n'autorise, et "
            "aucun export tabulaire officiel n'existe. Blocage documenté — aucune "
            "valeur de sécheresse n'est produite ni approchée."
        )

    return normalizer


def _as_byte_pages(pages: Any) -> list[bytes]:
    collected: list[bytes] = []
    for page in pages:
        if not isinstance(page, bytes):
            raise EdoPayloadError(
                "page inattendue : le connecteur EDO attend des octets bruts "
                "(RawBytesPageDecoder), jamais du texte déjà décodé."
            )
        collected.append(page)
    if not collected:
        raise EdoPayloadError("aucune page fournie : release refusée plutôt que vide.")
    return collected
