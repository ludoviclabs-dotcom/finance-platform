"""
services/water_intelligence/release_provenance.py — provenance d'une release,
résolue SANS base (X4B-RECONSTRUCT).

## Le problème que ce module résout

`staging_writer.prepare_release()` est pure — aucune connexion, aucun réseau —
mais **ses entrées ne l'étaient pas** : son attribution venait de
`source.get("attribution_text")`, c'est-à-dire d'une ligne du Source Registry
lue dans la transaction. C'est la seule raison pour laquelle le constructeur de
candidats ne pouvait pas la réutiliser, et donc la raison pour laquelle la
mesure de budget se retrouvait à vouloir relire la projection SQL — une
projection qui ne conserve ni période, ni portée géographique, ni provenance.

Ce module rend la provenance **résoluble hors base**, à partir de la seule
configuration canonique :

| Fait | Origine |
|---|---|
| attribution, URL officielle, cadence, dernière mise à jour | `source_attribution.py` |
| `license_code`, `license_scope` | `source_status.py` |

## Ce que la base reste, et ce qu'elle cesse d'être

La ligne du Source Registry **cesse d'être la source de vérité** de la
provenance ; elle devient une déclaration **vérifiée contre** la configuration.
Une divergence LÈVE au lieu de contaminer silencieusement une release.

Le motif : un registre semé par une version antérieure du script de déclaration
porterait un `attribution_text` obsolète, et le graveur l'aurait recopié sur
chaque observation sans que rien ne le signale. La leçon de la Wave E s'applique
telle quelle — « un garde-fou qui vérifie une valeur qu'il a lui-même posée ne
vérifie rien » : ici, la valeur vérifiée vient d'ailleurs que celui qui la pose.

**Ce que la base garde** : les capacités de licence
(`allow_ingest`/`allow_store`/`allow_display`/`allow_derived_use`, évaluées par
`license_policy`). Elles expriment une autorisation déclarée, pas un fait de
source, et les déplacer dans une constante retirerait une barrière réelle.
Seul le `license_code` est confronté à la configuration.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Mapping

from services.water_intelligence import source_attribution
from services.water_intelligence.source_status import current_source_status


class ProvenanceMismatch(Exception):
    """La déclaration en base diverge de la configuration canonique.

    Jamais un avertissement : une provenance divergente serait recopiée sur
    chaque observation d'une release, et une release est immuable.
    """


@dataclass(frozen=True)
class ReleaseProvenance:
    """Provenance complète d'une release, résolue sans base ni réseau.

    Tous les champs viennent de la configuration canonique. **Aucun n'est
    déduit d'un voisin** : la cadence n'est pas calculée depuis deux dates, la
    date de dernière mise à jour n'est pas déduite d'un checksum ni d'une
    période observée, et le libellé n'est pas reconstruit depuis un code.
    """

    source_code: str
    attribution: str
    #: Libellé SANS date — la forme que porte le Source Registry. La ligne d'un
    #: registre décrit une source, pas une lecture : y inscrire une date de
    #: consultation la rendrait fausse dès l'ingestion suivante.
    stable_attribution: str
    information_url: str
    refresh_cadence: str | None
    last_updated_on: date | None
    license_code: str
    license_scope: str
    accessed_on: date


def _license_facts(source_code: str) -> tuple[str, str]:
    for status in current_source_status():
        if status.source_code == source_code:
            if status.license_code is None:
                raise ProvenanceMismatch(
                    f"{source_code} : `license_code` inconnu au registre d'état des "
                    "sources — une release ne peut pas être préparée sans licence "
                    "nommée."
                )
            return status.license_code, status.license_scope
    raise ProvenanceMismatch(
        f"{source_code} : absent de `current_source_status()`. Aucune provenance "
        "n'est composée par défaut."
    )


def provenance_for(source_code: str, *, accessed_on: date) -> ReleaseProvenance:
    """Provenance canonique d'une source, à sa date de consultation.

    Lève sur une source hors configuration — les quatre sources exclues
    (`HUBEAU_HYDROMETRIE`, `EEA_WEI_PLUS`, `WRI_AQUEDUCT`, `COPERNICUS_EDO`)
    n'en ont aucune, et c'est voulu.
    """
    config = source_attribution.attribution_for(source_code)
    license_code, license_scope = _license_facts(source_code)
    return ReleaseProvenance(
        source_code=source_code,
        attribution=config.label(accessed_on=accessed_on),
        stable_attribution=config.stable_label(),
        information_url=config.information_url,
        refresh_cadence=config.refresh_cadence,
        last_updated_on=config.last_updated_on,
        license_code=license_code,
        license_scope=license_scope,
        accessed_on=accessed_on,
    )


#: Codes de licence équivalents entre les deux vocabulaires du dépôt. Le
#: registre d'état des sources écrit `ETALAB-2.0` ; le script de déclaration
#: sème `etalab-2.0` dans le Source Registry. Ce n'est pas une divergence de
#: fait, c'est une différence de casse entre deux fichiers écrits à des dates
#: différentes — normalisée ici plutôt que « corrigée » dans l'un des deux, ce
#: qui casserait des documents gelés.
def _normalized_license(code: str | None) -> str:
    return (code or "").strip().lower()


def verify_registry_row(
    provenance: ReleaseProvenance, row: Mapping[str, Any]
) -> None:
    """Confronte la ligne du Source Registry à la configuration canonique.

    Appelée par le graveur AVANT toute écriture. Une divergence lève : la
    release serait sinon gravée avec une provenance que rien n'a validée, et
    une release est immuable.

    Ne vérifie **pas** les capacités de licence : elles expriment une
    autorisation déclarée en base, évaluée par `license_policy`, et restent
    une barrière à part entière.
    """
    # Comparé à la forme STABLE : l'attribution portée par une release contient
    # sa date de consultation, celle du registre non. Exiger l'égalité avec la
    # forme datée ferait échouer toute ingestion dont la date diffère du jour
    # où le registre a été semé — c'est-à-dire presque toutes.
    declared = row.get("attribution_text")
    if declared is not None and declared != provenance.stable_attribution:
        raise ProvenanceMismatch(
            f"{provenance.source_code} : l'attribution déclarée au Source Registry "
            "diverge de la configuration canonique. La base n'est plus la source de "
            "vérité de la provenance : elle est vérifiée contre elle.\n"
            f"  registre     : {declared!r}\n"
            f"  configuration: {provenance.stable_attribution!r}\n"
            "Resemer le Source Registry (`staging_rehearsal seed-sources`) plutôt "
            "que d'accepter la divergence — une release est immuable, et une "
            "provenance fausse y resterait."
        )

    declared_license = _normalized_license(row.get("license_code"))
    expected_license = _normalized_license(provenance.license_code)
    if declared_license and declared_license != expected_license:
        raise ProvenanceMismatch(
            f"{provenance.source_code} : `license_code` divergent — registre "
            f"{declared_license!r}, configuration {expected_license!r}. Une release "
            "ne se grave pas sous une licence dont le nom n'est pas celui vérifié."
        )
