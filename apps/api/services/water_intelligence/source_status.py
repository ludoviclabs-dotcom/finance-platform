"""
services/water_intelligence/source_status.py — état public d'une source
(P16, Wave E).

## Pourquoi ce module existe

Le registre de décisions (`publication_decisions.py`) répond à une seule
question : « peut-on publier ? ». Sa réponse est binaire et suffisante pour le
gate, mais elle écrase trois situations qui n'ont ni la même cause ni la même
issue :

- **WRI Aqueduct** est refusée parce que l'enregistrement exigé par WRI n'a pas
  été effectué — la licence, elle, est vérifiée ;
- **Copernicus EDO** est refusée parce que le décodage raster a été
  volontairement reporté — il n'y a aucune valeur à publier ;
- **EEA et Hub'Eau** ne sont pas refusées du tout : leur décision humaine n'a
  simplement pas été rendue.

Les afficher toutes les trois comme « écartées » serait exact et inutile. Ce
module porte donc l'état public détaillé, en composant des faits **déjà
établis** par les Waves A à C — il n'en produit aucun.

## Deux axes, jamais fusionnés

C'est la leçon centrale de la Wave C : **identifier une licence permissive ne
rend rien publiable**. Le module tient donc deux axes séparés :

1. `license` — ce qui a été vérifié, et **à quelle granularité** ;
2. `publication` — la décision humaine, ou son absence.

Les fusionner en un « statut » unique reproduirait exactement la confusion que
le gate licence existe pour empêcher.

## La granularité de licence est une information, pas un détail

La Wave B a vérifié la Licence Ouverte Etalab **au niveau de la plateforme**
Hub'Eau, pas jeu de données par jeu de données. Le catalogue normalisé
(`SOURCE_CATALOG_NORMALIZED_V1.csv`) porte d'ailleurs encore `unknown` pour ces
quatre sources — écart réel entre deux documents du chantier.

Plutôt que de trancher silencieusement en faveur de l'un ou de l'autre, le
champ `license_scope` rend la granularité explicite : `platform` n'est pas
`dataset`, et une vérification de plateforme ne vaut pas autorisation pour un
jeu précis. L'écart est signalé dans le handoff, pas masqué.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping

from services.water_intelligence.publication_decisions import (
    PublicationDecisionRegistry,
    current_registry,
)

#: Granularité de la vérification de licence. `platform` ≠ `dataset` : une
#: licence vérifiée au niveau du portail ne dit rien d'un jeu précis.
LicenseScope = Literal["dataset", "platform", "unknown"]

#: État public d'une source, du point de vue du lecteur de la page publique.
#: Ces cinq valeurs sont celles que la surface a le droit d'afficher.
PublicSourceState = Literal[
    "publishable",  # décision humaine signée — BNPE seule, sur son périmètre pilote
    "decision_pending",  # analyse faite, décision NON rendue
    "publication_blocked",  # refus explicite pour une cause externe (WRI)
    "decoder_deferred",  # rien à publier : aucune valeur décodée (Copernicus)
    "no_decision",  # absente du registre — exclusion par défaut
]

STATE_LABELS: Mapping[PublicSourceState, str] = {
    "publishable": "Publication autorisée",
    "decision_pending": "Décision humaine non rendue",
    "publication_blocked": "Publication bloquée",
    "decoder_deferred": "Décodage reporté",
    "no_decision": "Aucune décision enregistrée",
}


class SourceStatusError(Exception):
    """Entrée mal formée — refusée à la construction."""


@dataclass(frozen=True)
class SourceStatus:
    """État public d'UNE source, deux axes tenus séparés."""

    source_code: str
    label: str
    #: Code de licence tel que VÉRIFIÉ, ou None si rien ne l'a été.
    license_code: str | None
    license_scope: LicenseScope
    #: Vague où la vérification a eu lieu — sert la traçabilité, pas la décoration.
    license_verified_in: str | None
    #: Statut du connecteur, tel que formalisé par les Waves A et B.
    connector_status: str
    #: Ce qu'il manque pour publier, en une phrase actionnable. Pour une
    #: source PUBLIÉE sur un périmètre pilote, ce qui reste bloqué est tout ce
    #: qui sort de ce périmètre — la phrase le dit alors ainsi.
    blocking_reason: str
    #: Code NORMALISÉ du motif de report ou de blocage, destiné à la surface.
    #:
    #: Il existe parce qu'une phrase française ne se compare pas : la
    #: constellation publique doit pouvoir afficher sept états distincts sans
    #: que chacun dépende d'une chaîne libre qu'un remaniement de copie
    #: casserait. `blocking_reason` explique à un lecteur, celui-ci s'adresse
    #: au code — et les deux disent la même chose.
    deferral_code: str

    def __post_init__(self) -> None:
        for name in (
            "source_code",
            "label",
            "connector_status",
            "blocking_reason",
            "deferral_code",
        ):
            if not str(getattr(self, name)).strip():
                raise SourceStatusError(f"SourceStatus.{name} obligatoire.")
        if self.license_code is None and self.license_scope != "unknown":
            raise SourceStatusError(
                f"{self.source_code} : une licence non vérifiée ne peut pas porter "
                "de granularité — `license_scope` doit valoir 'unknown'."
            )
        if self.license_code is not None and self.license_scope == "unknown":
            raise SourceStatusError(
                f"{self.source_code} : une licence vérifiée doit dire À QUELLE "
                "granularité — plateforme ou jeu de données."
            )

    @property
    def license_verified(self) -> bool:
        return self.license_code is not None

    def state(self, registry: PublicationDecisionRegistry) -> PublicSourceState:
        """État public, dérivé de la décision humaine et du statut connecteur.

        La décision humaine prime : c'est elle le gate. Le statut connecteur ne
        sert qu'à distinguer DEUX refus qui n'ont pas la même cause.
        """
        decision = registry.get(self.source_code)
        if decision is None:
            return "no_decision"
        if decision.allows_publication:
            return "publishable"
        if decision.status == "proposed":
            return "decision_pending"
        # Refus : distinguer « rien à publier » de « publication interdite ».
        if self.connector_status == "source_verified_decoder_deferred":
            return "decoder_deferred"
        return "publication_blocked"

    def as_mapping(self, registry: PublicationDecisionRegistry) -> Mapping[str, object]:
        return {
            "source_code": self.source_code,
            "label": self.label,
            "license_code": self.license_code,
            "license_scope": self.license_scope,
            "license_verified": self.license_verified,
            "license_verified_in": self.license_verified_in,
            "connector_status": self.connector_status,
            "state": self.state(registry),
            "state_label": STATE_LABELS[self.state(registry)],
            "blocking_reason": self.blocking_reason,
            "deferral_code": self.deferral_code,
            # Le périmètre signé voyage jusqu'à la surface : « publiée » sans
            # dire SUR QUOI se lirait comme « toute la source est publiée ».
            "authorized_scope": (
                scope.as_mapping()
                if (scope := registry.authorized_scope(self.source_code))
                else None
            ),
        }


# ---------------------------------------------------------------------------
# États courants — composés de faits établis par les Waves A à C
# ---------------------------------------------------------------------------

#: Chaque champ ci-dessous reprend un fait DÉJÀ vérifié et documenté :
#: `LICENSE_CODE` des connecteurs (Waves A/B), `connector_status` de
#: PROJECT_STATE.yaml, et les motifs du registre de décisions (Wave C).
#: Rien n'est déduit ni supposé ; ce qui n'a pas été vérifié reste `None`.
CURRENT_SOURCE_STATUS: tuple[SourceStatus, ...] = (
    SourceStatus(
        source_code="WRI_AQUEDUCT",
        deferral_code="blocked_registration_required",
        label="WRI Aqueduct 4.0",
        license_code="CC-BY-4.0",
        license_scope="dataset",
        license_verified_in="Wave A",
        connector_status="source_verified_publication_blocked",
        blocking_reason=(
            "La licence est vérifiée, mais WRI exige EN OUTRE un enregistrement "
            "pour partager ou adapter les données. Cet enregistrement n'a pas été "
            "effectué : c'est une démarche humaine, pas un réglage technique."
        ),
    ),
    SourceStatus(
        source_code="COPERNICUS_EDO",
        deferral_code="source_verified_decoder_deferred",
        label="Copernicus EDO — indice combiné de sécheresse",
        license_code="COPERNICUS-EMS-FREE-FULL-OPEN",
        license_scope="dataset",
        license_verified_in="Wave A",
        connector_status="source_verified_decoder_deferred",
        blocking_reason=(
            "L'identité de la source est vérifiée, mais le portail ne distribue "
            "que du GeoTIFF et du NetCDF. Le décodage raster a été volontairement "
            "reporté plutôt que simulé : il n'existe aucune valeur à publier."
        ),
    ),
    SourceStatus(
        source_code="EEA_WEI_PLUS",
        deferral_code="manual_artifact_required",
        label="EEA / WISE — Water Exploitation Index Plus",
        license_code="CC-BY-4.0",
        license_scope="dataset",
        license_verified_in="Wave A",
        connector_status="source_verified",
        blocking_reason=(
            "Licence et attribution vérifiées. La décision humaine de publication "
            "n'a pas été rendue — identifier une licence permissive ne vaut pas "
            "autorisation éditoriale."
        ),
    ),
    SourceStatus(
        source_code="HUBEAU_HYDROMETRIE",
        deferral_code="subdaily_identity_collision",
        label="Hub'Eau — hydrométrie (débits et hauteurs)",
        license_code="ETALAB-2.0",
        license_scope="platform",
        license_verified_in="Wave B",
        connector_status="source_verified",
        blocking_reason=(
            "Licence Ouverte vérifiée au niveau de la PLATEFORME, pas jeu par jeu. "
            "La décision de publication n'a pas été rendue, et le connecteur n'a "
            "jamais publié (exécution à blanc uniquement)."
        ),
    ),
    SourceStatus(
        source_code="HUBEAU_ADES",
        deferral_code="deferred_over_budget",
        label="Hub'Eau — piézométrie (niveaux de nappe)",
        license_code="ETALAB-2.0",
        license_scope="platform",
        license_verified_in="Wave B",
        connector_status="source_verified",
        blocking_reason=(
            "Acquisition mesurée et STABLE — le checksum X4B-PREP est identique à "
            "celui de X3 sur 52 139 octets. Le report ne porte donc aucun doute "
            "sur la source : à 182 observations pour 255 121 octets, elle occupe "
            "2,5 fois le budget de 100 000 octets du snapshot public. Alléger la "
            "provenance rendrait le budget tenable en rendant la donnée non "
            "auditable ; la décision de publication reste non rendue."
        ),
    ),
    SourceStatus(
        source_code="HUBEAU_BNPE_PRELEVEMENTS",
        deferral_code="published_limited_scope",
        label="Hub'Eau — prélèvements (BNPE)",
        license_code="ETALAB-2.0",
        license_scope="platform",
        license_verified_in="Wave B",
        connector_status="source_verified_published_limited_scope",
        blocking_reason=(
            "Publication autorisée le 2026-07-28, et UNIQUEMENT sur la commune "
            "INSEE 34172 pour l'année 2020. Tout autre territoire et toute autre "
            "année restent non publiables : ils exigeraient une nouvelle décision "
            "humaine. La couverture reste en outre partielle par construction — "
            "les usages exonérés de redevance sont inconnus et les volumes "
            "inférieurs à 10 000 m³ ne sont pas déclarés : une absence de "
            "déclaration n'est jamais un prélèvement nul."
        ),
    ),
    SourceStatus(
        source_code="HUBEAU_QUALITE_SURFACE",
        deferral_code="deferred_over_budget",
        label="Hub'Eau — qualité des cours d'eau (Naïades)",
        license_code="ETALAB-2.0",
        license_scope="platform",
        license_verified_in="Wave B",
        connector_status="source_verified",
        blocking_reason=(
            "Périmètre resserré jusqu'à devenir exhaustif — 78 observations sur "
            "janvier 2024, au lieu de 50 tronquées sur un trimestre. Le progrès de "
            "méthode ne rend pas le candidat publiable : 111 324 octets, soit "
            "11 324 de trop. Une publication exigerait en outre une liste de "
            "paramètres SANDRE revue et l'absence de toute conclusion de "
            "conformité — celle-ci relève exclusivement du registre juridique."
        ),
    ),
)


def current_source_status() -> tuple[SourceStatus, ...]:
    return CURRENT_SOURCE_STATUS


def public_source_document(
    *, registry: PublicationDecisionRegistry | None = None
) -> Mapping[str, object]:
    """Document publiable de l'état des sources, ordre déterministe.

    Ne porte **aucune observation** et **aucun chiffre hydrique** : uniquement
    l'état de chaque source vis-à-vis de la publication.
    """
    resolved = registry or current_registry()
    statuses = sorted(CURRENT_SOURCE_STATUS, key=lambda s: s.source_code)
    return {
        "source_count": len(statuses),
        "publishable_count": sum(1 for s in statuses if s.state(resolved) == "publishable"),
        "license_verified_count": sum(1 for s in statuses if s.license_verified),
        "sources": [status.as_mapping(resolved) for status in statuses],
    }
