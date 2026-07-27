"""
services/water_intelligence/source_attribution.py — configuration canonique
d'attribution et de fraîcheur, PAR JEU DE DONNÉES (X4B-PREP).

## Pourquoi ce module existe

Deux libellés d'attribution coexistaient dans le dépôt, et X4A les a écartés
tous les deux :

- `hubeau_transport.ATTRIBUTION_TEMPLATE` énumérait les trois éditeurs de la
  plateforme (OFB, SCV, BRGM) **indistinctement, pour les trois jeux** — un jeu
  piézométrique ADES n'est pas produit par le Service Central Vigicrues, et
  l'énumération globale attribuait à chaque jeu des producteurs qui ne le
  concernent pas ;
- `staging_rehearsal.ATTRIBUTION` nommait le point d'accès sans aucun
  producteur, ce que la condition de paternité de la Licence Ouverte n'admet
  pas.

Ce module remplace les deux par une configuration **par `source_code`**, qui
distingue trois choses que les libellés précédents mélangeaient :

| Niveau | Exemple |
|---|---|
| point d'accès | Hub'Eau, et l'API précise |
| système d'information source | ADES, Naïades, BNPE |
| producteurs / contributeurs | partenaires du SIE, Agences de l'eau, gestion des redevances |

## La condition de paternité, et la voie retenue

La Licence Ouverte / Open Licence 2.0 conditionne la réutilisation à la mention
de la paternité : la source, **et la date de la dernière mise à jour de
l'Information réutilisée**. Elle admet une seconde voie de conformité —
indiquer l'URL pointant vers l'Information, la paternité restant effectivement
attribuée.

`source_last_updated_on` n'a été relevée pour **aucune** des trois sources, et
la consigne interdit de la déduire d'un checksum ou d'une période observée.
C'est donc la **voie de l'URL officielle stable** qui est retenue, et
`source_information_url` est obligatoire pour toute source publiée — l'obligation
étant portée par la porte de publication (`assemble_public_snapshot`), pas par
le modèle, afin de ne pas invalider les documents canoniques déjà gelés.

## Ce que ce module ne fait pas

- Il ne vérifie aucune licence jeu par jeu : `license_scope` reste `platform`
  (`source_status.py`), et nommer la licence dans un libellé ne la vérifie pas.
- Il n'invente aucune date : `source_last_updated_on` vaut `None` partout tant
  qu'un relevé direct n'a pas eu lieu.
- Il n'ouvre ni réseau ni base — comme tout `services/water_intelligence/*.py`,
  vérifié par analyse AST
  (`test_water_intelligence_pipeline.py::TestNoRealNetworkOrDatabase`).
- Il ne se replie JAMAIS sur un libellé générique : un `source_code` inconnu
  lève. Un repli reproduirait exactement le défaut que X4A a écarté.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Mapping

#: Libellé de licence, commun aux trois jeux — la Licence Ouverte a été relevée
#: au niveau de la PLATEFORME Hub'Eau (Wave B), jamais jeu par jeu. Le répéter
#: dans un libellé d'attribution ne la vérifie pas davantage.
LICENSE_LABEL = "Licence Ouverte / Etalab 2.0"

#: Portée de la vérification de licence. Reprend `source_status.py` à
#: l'identique : `platform`, jamais `dataset`.
LICENSE_SCOPE = "platform"


class SourceAttributionError(Exception):
    """Configuration d'attribution absente ou mal formée — jamais un repli."""


@dataclass(frozen=True)
class SourceAttribution:
    """Attribution et fraîcheur canoniques d'UN jeu de données.

    `information_url` est l'URL officielle **stable** de la page décrivant le
    jeu — pas une URL d'appel d'API, qui porte des paramètres de requête et ne
    décrit rien à un lecteur.

    `last_updated_on` reste `None` tant qu'aucun relevé direct n'a été fait sur
    la source officielle. Il n'est JAMAIS déduit d'un checksum, d'une période
    observée ni d'une date de consultation — trois faits distincts.
    """

    source_code: str
    #: Point d'accès, API comprise — « Hub'Eau — API Piézométrie ».
    access_point: str
    #: Provenance : système d'information source et producteurs/contributeurs.
    provenance: str
    #: URL officielle stable décrivant le jeu.
    information_url: str
    #: Cadence de mise à jour côté source, relevée. `None` = non vérifiée.
    refresh_cadence: str | None
    #: Date de dernière mise à jour de l'Information, relevée directement.
    last_updated_on: date | None = None

    def __post_init__(self) -> None:
        for field_name in ("source_code", "access_point", "provenance", "information_url"):
            if not getattr(self, field_name).strip():
                raise SourceAttributionError(
                    f"{self.source_code or '<sans code>'} : {field_name} obligatoire."
                )
        if not self.information_url.startswith("https://"):
            raise SourceAttributionError(
                f"{self.source_code} : information_url doit être une URL https officielle, "
                f"reçu {self.information_url!r}."
            )
        if "?" in self.information_url:
            raise SourceAttributionError(
                f"{self.source_code} : information_url doit être une page officielle stable, "
                "jamais une URL d'appel d'API paramétrée — une requête ne décrit pas un jeu."
            )

    def label(self, *, accessed_on: date | str) -> str:
        """Libellé d'attribution complet, prêt à afficher.

        `accessed_on` est la date de **consultation**, c'est-à-dire la nôtre.
        Elle n'est jamais présentée comme la date de mise à jour de la source :
        quand cette dernière est connue, elle apparaît en plus, jamais à la
        place.
        """
        accessed = accessed_on.isoformat() if isinstance(accessed_on, date) else accessed_on
        if not str(accessed).strip():
            raise SourceAttributionError(
                f"{self.source_code} : date de consultation obligatoire dans l'attribution."
            )
        parts = [
            f"Source : {self.access_point}.",
            f"{self.provenance}",
            f"{LICENSE_LABEL}.",
            f"Source officielle : {self.information_url}.",
        ]
        if self.last_updated_on is not None:
            parts.append(f"Dernière mise à jour de la source : {self.last_updated_on.isoformat()}.")
        parts.append(f"Consultées le {accessed}.")
        return " ".join(parts)


#: Configuration réelle des jeux Hub'Eau INGÉRABLES. Chaque `provenance`
#: reprend ce que la page officielle du jeu énonce, sans désigner l'OFB, le
#: BRGM ou le SCV comme producteur unique — aucune preuve du dossier ne
#: l'établit.
#:
#: ## Attribution n'est pas candidature
#:
#: `HUBEAU_HYDROMETRIE` figure ici alors qu'elle n'est PAS candidate à la
#: publication (`subdaily_identity_collision`). Ce n'est pas une contradiction :
#: une attribution DÉCRIT un jeu de données, elle ne le propose pas. Le jeu
#: existe, il est ingérable, il a une page officielle — il doit donc pouvoir
#: être gravé avec une provenance citable, comme n'importe quel autre.
#:
#: Ce qui fait la candidature est ailleurs, et à deux endroits qui ne mentent
#: pas : `candidate_scopes.CANDIDATES` (les périmètres) et
#: `publication_decisions.CURRENT_DECISIONS` (la décision humaine). Confondre
#: les deux — comme cette configuration le faisait d'abord — revenait à faire
#: dépendre l'ingestion d'un jugement de publication.
#:
#: `EEA_WEI_PLUS`, `WRI_AQUEDUCT` et `COPERNICUS_EDO` restent absentes : elles
#: ne sont pas des jeux Hub'Eau, aucune attribution n'a été vérifiée pour
#: elles ici, et aucune n'est ingérable par ce chemin.
CANONICAL_ATTRIBUTIONS: tuple[SourceAttribution, ...] = (
    SourceAttribution(
        source_code="HUBEAU_HYDROMETRIE",
        access_point="Hub'Eau — API Hydrométrie",
        provenance=(
            "Données issues du réseau hydrométrique et des partenaires du "
            "Système d'information sur l'eau."
        ),
        information_url="https://hubeau.eaufrance.fr/page/api-hydrometrie",
        # NON VÉRIFIÉE, délibérément `None`. L'endpoint `observations_tr` sert
        # plusieurs lectures par jour et par station (~33/jour observées en X3),
        # mais aucune page officielle relevée n'énonce de cadence — et « temps
        # réel » décrit la donnée, pas la fréquence d'intégration. Écrire l'un
        # pour l'autre serait une fraîcheur inventée.
        refresh_cadence=None,
    ),
    SourceAttribution(
        source_code="HUBEAU_ADES",
        access_point="Hub'Eau — API Piézométrie",
        provenance=(
            "Données issues d'ADES et des partenaires du Système d'information "
            "sur l'eau."
        ),
        information_url="https://hubeau.eaufrance.fr/page/api-piezometrie",
        refresh_cadence="Mises à jour de la base ADES intégrées quotidiennement dans l'API",
    ),
    SourceAttribution(
        source_code="HUBEAU_QUALITE_SURFACE",
        access_point="Hub'Eau — API Qualité des cours d'eau",
        provenance=(
            "Données issues de Naïades et transmises par les Agences de l'eau."
        ),
        information_url="https://hubeau.eaufrance.fr/page/api-qualite-cours-deau",
        refresh_cadence="Synchronisation continue avec la base Naïades depuis la v2 de l'API",
    ),
    SourceAttribution(
        source_code="HUBEAU_BNPE_PRELEVEMENTS",
        access_point="Hub'Eau — API Prélèvements en eau",
        provenance=(
            "Données issues de la BNPE et de la gestion des redevances par les "
            "agences et offices de l'eau."
        ),
        information_url="https://hubeau.eaufrance.fr/page/api-prelevements-eau",
        # NON VÉRIFIÉE, délibérément `None` : aucune page officielle relevée
        # n'énonce de cadence mensuelle, et data.gouv.fr (Système d'Information
        # sur l'Eau) déclare une mise à jour annuelle. Écrire l'une ou l'autre
        # sans relevé direct serait une fraîcheur inventée. Cf.
        # X4A_ATTRIBUTION_AND_FRESHNESS.md §3.
        refresh_cadence=None,
    ),
)


def _index() -> Mapping[str, SourceAttribution]:
    indexed: dict[str, SourceAttribution] = {}
    for attribution in CANONICAL_ATTRIBUTIONS:
        if attribution.source_code in indexed:
            raise SourceAttributionError(
                f"{attribution.source_code} : deux configurations pour la même source — "
                "ambiguïté refusée."
            )
        indexed[attribution.source_code] = attribution
    return indexed


ATTRIBUTIONS: Mapping[str, SourceAttribution] = _index()

#: Jeux disposant d'une attribution canonique — INGÉRABLES, pas candidats.
#: La candidature se lit dans `candidate_scopes` et le registre de décisions.
ATTRIBUTED_SOURCE_CODES: tuple[str, ...] = tuple(sorted(ATTRIBUTIONS))


def attribution_for(source_code: str) -> SourceAttribution:
    """Configuration canonique d'une source. **Lève** si elle est inconnue.

    Aucun repli sur un libellé générique : c'est précisément le défaut que X4A
    a écarté. Une source sans configuration n'est pas une source candidate.
    """
    try:
        return ATTRIBUTIONS[source_code]
    except KeyError as exc:
        raise SourceAttributionError(
            f"{source_code!r} n'a aucune attribution canonique. Les sources "
            f"configurées sont {sorted(ATTRIBUTIONS)}. Aucun libellé générique "
            "n'est composé par défaut."
        ) from exc


def attribution_label(source_code: str, *, accessed_on: date | str) -> str:
    """Libellé d'attribution d'une source, à sa date de consultation."""
    return attribution_for(source_code).label(accessed_on=accessed_on)


def information_url(source_code: str) -> str:
    return attribution_for(source_code).information_url


def refresh_cadence(source_code: str) -> str | None:
    """Cadence relevée, ou `None` si elle ne l'a pas été.

    `None` signifie « non vérifiée », jamais « pas de mise à jour » — la
    surface doit rendre les deux différemment.
    """
    return attribution_for(source_code).refresh_cadence


def last_updated_on(source_code: str) -> date | None:
    """Date de dernière mise à jour relevée côté source, ou `None`.

    Jamais déduite : ni d'un checksum, ni d'une période observée, ni d'une date
    de consultation.
    """
    return attribution_for(source_code).last_updated_on
