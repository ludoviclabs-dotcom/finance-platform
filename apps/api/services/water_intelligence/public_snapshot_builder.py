"""
services/water_intelligence/public_snapshot_builder.py — reconstruction FIDÈLE
d'un snapshot public candidat (X4B-RECONSTRUCT).

## D'où vient la donnée, et d'où elle ne vient JAMAIS

L'entrée est une ou plusieurs `PreparedRelease` — la représentation complète
produite par `staging_writer.prepare_release()` depuis les artefacts vérifiés,
**avant** toute projection vers l'Evidence Kernel.

Elle ne vient **jamais** de la table `observations`. Celle-ci n'en conserve
qu'une projection : ni `period_start`/`period_end`, ni portée ni libellé de
géographie, ni couverture, et la provenance vit dans `source_releases`.
Reconstruire depuis elle produirait des snapshots plausibles et inexacts —
c'est le constat de la PR #174, et la raison d'être de ce module.

## Ce que ce module ne fait pas

- Il ne réimplémente **aucune** règle de publication : il appelle
  `assemble_public_snapshot()`, qui porte le gate licence, la barrière de
  provenance, l'exclusion des données tenant et les budgets.
- Il ne contourne ni budget, ni licence, ni barrière.
- Il ne touche **jamais** `publication_decisions.py`. Le registre réel reste à
  zéro source approuvée, avant et après toute mesure.
"""

from __future__ import annotations

import gzip
import json
from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterable, Sequence

from models.water_intelligence import WaterMetricObservation
from services.water_intelligence.public_snapshot import (
    WaterPublicSnapshot,
    assemble_public_snapshot,
)
from services.water_intelligence.publication_decisions import (
    PublicationDecision,
    PublicationDecisionRegistry,
    current_registry,
)

#: Motif inscrit en toutes lettres dans chaque décision de mesure. Un artefact
#: de run relu six mois plus tard ne doit pas pouvoir être confondu avec une
#: décision humaine.
MEASUREMENT_ONLY_REASON = (
    "candidate_measurement_only — contexte de MESURE X4B, en mémoire, jamais "
    "sérialisé comme décision, jamais écrit au registre. Ne vaut aucune "
    "approbation humaine."
)

#: Réviseur factice, nommé pour être reconnaissable comme non humain. Le
#: contrat `PublicationDecision` exige `reviewed_by` ET `reviewed_on` pour un
#: `approved` : les omettre rendrait la mesure impossible, les rendre plausibles
#: rendrait la mesure confondable avec une signature.
MEASUREMENT_REVIEWER = "candidate_measurement_only (non humain — sans valeur de signature)"
MEASUREMENT_REVIEW_DATE = date(1970, 1, 1)


class SnapshotReconstructionError(Exception):
    """Reconstruction refusée — jamais un snapshot approximatif."""


class RealRegistryMutated(Exception):
    """Le registre réel a changé pendant une mesure. Arrêt immédiat."""


def measurement_registry(source_codes: Sequence[str]) -> PublicationDecisionRegistry:
    """Contexte de mesure `candidate_measurement_only`.

    Il existe le temps d'un assemblage et n'est jamais écrit. Son motif et son
    réviseur disent explicitement qu'il ne vaut aucune signature ; la route
    publique, elle, ne lit que `current_registry()`, qu'aucune mesure ne touche.
    """
    return PublicationDecisionRegistry(
        [
            PublicationDecision(
                source_code=code,
                status="approved",
                reason=MEASUREMENT_ONLY_REASON,
                reviewed_by=MEASUREMENT_REVIEWER,
                reviewed_on=MEASUREMENT_REVIEW_DATE,
            )
            for code in sorted(set(source_codes))
        ]
    )


def assert_real_registry_untouched() -> None:
    """Le registre RÉEL ne porte aucune signature — vérifié, jamais supposé."""
    approved = current_registry().approved_source_codes
    if approved:
        raise RealRegistryMutated(
            f"ARRÊT — le registre réel porte des sources approuvées : {approved}. "
            "Une mesure ne signe rien."
        )


# ---------------------------------------------------------------------------
# Sérialisation — DEUX formes canoniques, nommées séparément
# ---------------------------------------------------------------------------
#
# Le dépôt en utilise deux, qui n'ont ni le même but ni la même taille :
#
#   * la CHARGE servie par l'endpoint public — compacte, triée. C'est elle que
#     borne le budget de 100 000 octets du contrat P02, et c'est sur elle que
#     l'ETag est calculé ;
#   * le DOCUMENT canonique versionné — indenté, terminé par un saut de ligne.
#     C'est la forme qu'impose `TestDocumentParity`.
#
# Les réunir sous un seul `serialize_water_public_snapshot()` confondrait deux
# notions et ferait mesurer le budget sur la mauvaise. Elles partagent le même
# `model_dump`, et c'est ce qui compte : mêmes valeurs, deux mises en forme.


def canonical_payload_bytes(snapshot: WaterPublicSnapshot) -> bytes:
    """Octets de la CHARGE servie — la forme que le budget borne.

    Compacte et triée, identique à ce que `payload_bytes()` mesure et à ce sur
    quoi l'ETag est calculé.
    """
    return snapshot.canonical_json().encode("utf-8")


def canonical_document_bytes(snapshot: WaterPublicSnapshot) -> bytes:
    """Octets du DOCUMENT canonique versionné — la forme que la parité impose.

    `json.dumps(..., ensure_ascii=False, indent=2, sort_keys=True) + "\\n"`,
    exactement ce que `TestDocumentParity` compare entre `contracts/*.json` et
    son miroir front. Ce n'est **pas** la forme soumise au budget.
    """
    document = json.loads(snapshot.canonical_json())
    return (
        json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")


def gzip_bytes(payload: bytes) -> int:
    """Taille compressée, INFORMATIVE. Le budget porte sur le non compressé :
    compresser pour passer sous le plafond changerait le contrat sans le dire."""
    return len(gzip.compress(payload, mtime=0))


# ---------------------------------------------------------------------------
# Reconstruction
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ReconstructedCandidate:
    """Un snapshot candidat et ce qui permet de le juger."""

    label: str
    snapshot: WaterPublicSnapshot
    source_codes: tuple[str, ...]
    observation_count: int
    payload_bytes: int
    payload_bytes_gzip: int
    document_bytes: int

    def as_mapping(self) -> dict[str, object]:
        return {
            "label": self.label,
            "source_codes": list(self.source_codes),
            "observation_count": self.observation_count,
            "payload_bytes": self.payload_bytes,
            "payload_bytes_gzip": self.payload_bytes_gzip,
            "document_bytes": self.document_bytes,
            "included_source_codes": list(self.snapshot.included_source_codes),
            "exclusions": [
                {"source_code": e.source_code, "reason": e.reason}
                for e in self.snapshot.exclusions
            ],
            "is_empty": self.snapshot.is_empty,
            "etag": self.snapshot.etag(),
        }


def _observations_of(releases: Iterable) -> list[WaterMetricObservation]:
    collected: list[WaterMetricObservation] = []
    for release in releases:
        provenance = getattr(release, "provenance", None)
        if provenance is None:
            raise SnapshotReconstructionError(
                f"{getattr(release, 'source_code', '<sans code>')} : release préparée "
                "sans provenance. Une reconstruction sans provenance produirait un "
                "snapshot que la porte de publication écarterait — refusé ici, où le "
                "motif est encore lisible."
            )
        collected.extend(release.observations)
    return collected


def reconstruct_candidate(
    *,
    label: str,
    releases: Sequence,
    generated_at: datetime,
    enforce_budget: bool = True,
) -> ReconstructedCandidate:
    """Reconstruit un snapshot candidat depuis des `PreparedRelease`.

    Utilise l'assembleur public existant — aucune règle de publication n'est
    réimplémentée ici. Le contexte de décision est
    `candidate_measurement_only` : il autorise l'assemblage pour MESURER ce que
    pèserait une publication, ce qui n'est pas l'autoriser.

    `enforce_budget=False` réservé au contrôle de PARITÉ (X4B-RECONSTRUCT) :
    une release à elle seule au-dessus du budget de publication (le cas
    documenté d'ADES/`x3_technical_sample`, ~255 ko) est un fait de MESURE,
    pas un défaut de parité — la parité vérifie que le contenu survit
    fidèlement à l'assemblage, indépendamment de sa taille. Faire dépendre
    l'un de l'autre ferait échouer TOUT le run de mesure sur la première
    release surdimensionnée, avant même que `candidate_budget.measure()` n'ait
    pu la rapporter proprement en `over_budget`. Le défaut par défaut reste
    `True` : rien d'autre n'appelle cette fonction avec `False`, et
    `TestBudgetIsNeverBypassed` verrouille le comportement par défaut.
    """
    assert_real_registry_untouched()

    observations = _observations_of(releases)
    source_codes = tuple(sorted({o.source.source_code for o in observations}))

    snapshot = assemble_public_snapshot(
        observations=observations,
        registry=measurement_registry(source_codes),
        generated_at=generated_at,
        enforce_budget=enforce_budget,
    )

    payload = canonical_payload_bytes(snapshot)
    result = ReconstructedCandidate(
        label=label,
        snapshot=snapshot,
        source_codes=tuple(snapshot.included_source_codes),
        observation_count=snapshot.observation_count,
        payload_bytes=len(payload),
        payload_bytes_gzip=gzip_bytes(payload),
        document_bytes=len(canonical_document_bytes(snapshot)),
    )

    # Vérifié APRÈS aussi : une mesure qui aurait signé quoi que ce soit doit
    # échouer, pas se rattraper.
    assert_real_registry_untouched()
    return result
